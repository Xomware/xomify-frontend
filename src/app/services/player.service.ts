import { Injectable } from '@angular/core';
import { Observable, Subscriber } from 'rxjs';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { AuthService } from './auth.service';

interface SpotifyDevice {
  id: string;
  name: string;
  is_active: boolean;
  type: string;
}

interface DevicesResponse {
  devices: SpotifyDevice[];
}

/**
 * Spotify REST helpers that operate on the user's OWN Spotify Connect
 * devices (their phone, desktop app, etc.) — "add to queue" and "play
 * next", used from action buttons across the app.
 *
 * This service used to ALSO run the Spotify Web Playback SDK to play full
 * tracks in-browser. That's been removed: the SDK requires Spotify Premium
 * and a live Connect session, and its `Player.connect()` handshake 404s on
 * `social-connect/v2/sessions/current` for everyone else — silently, with
 * no error surfaced to the user, so "play" just did nothing. Actual preview
 * playback now lives in `PreviewPlayerService` (HTML5 Audio, works for
 * every user). See docs/features/song-preview-playback for the root cause.
 */
@Injectable({
  providedIn: 'root',
})
export class PlayerService {
  constructor(private http: HttpClient, private authService: AuthService) {}

  addToSpotifyQueue(trackId: string): Observable<boolean> {
    return new Observable((observer) => {
      this.getAvailableDevices().subscribe({
        next: (devicesResponse) => {
          const devices = devicesResponse.devices || [];
          const realDevices = devices.filter(
            (d: SpotifyDevice) => d.name !== 'Xomify Web Player'
          );
          const webPlayer = devices.find(
            (d: SpotifyDevice) => d.name === 'Xomify Web Player'
          );
          const activeRealDevice = realDevices.find(
            (d: SpotifyDevice) => d.is_active
          );
          const activeWebPlayer = webPlayer?.is_active ? webPlayer : null;

          if (realDevices.length === 0 && !webPlayer) {
            observer.next(false);
            observer.complete();
            return;
          }

          if (activeRealDevice) {
            this.attemptAddToQueue(trackId, observer);
          } else if (realDevices.length > 0) {
            this.transferPlayback(realDevices[0].id).subscribe({
              next: () => {
                setTimeout(() => {
                  this.attemptAddToQueue(trackId, observer);
                }, 1500);
              },
              error: () => {
                observer.next(false);
                observer.complete();
              },
            });
          } else if (activeWebPlayer) {
            this.attemptAddToQueue(trackId, observer);
          } else {
            observer.next(false);
            observer.complete();
          }
        },
        error: () => {
          this.attemptAddToQueue(trackId, observer);
        },
      });
    });
  }

  private attemptAddToQueue(
    trackId: string,
    observer: Subscriber<boolean>
  ): void {
    const token = this.authService.getAccessToken();
    const headers = new HttpHeaders({
      Authorization: `Bearer ${token}`,
    });
    const uri = `spotify:track:${trackId}`;

    this.http
      .post(
        `https://api.spotify.com/v1/me/player/queue?uri=${encodeURIComponent(
          uri
        )}`,
        null,
        { headers, responseType: 'text' }
      )
      .subscribe({
        next: () => {
          observer.next(true);
          observer.complete();
        },
        error: () => {
          observer.next(false);
          observer.complete();
        },
      });
  }

  playNext(trackId: string): Observable<boolean> {
    return this.addToSpotifyQueue(trackId);
  }

  private getAvailableDevices(): Observable<DevicesResponse> {
    const token = this.authService.getAccessToken();
    const headers = new HttpHeaders({
      Authorization: `Bearer ${token}`,
    });

    return this.http.get<DevicesResponse>(
      'https://api.spotify.com/v1/me/player/devices',
      { headers }
    );
  }

  private transferPlayback(deviceId: string): Observable<string> {
    const token = this.authService.getAccessToken();
    const headers = new HttpHeaders({
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    });

    const body = {
      device_ids: [deviceId],
      play: false,
    };

    return this.http.put('https://api.spotify.com/v1/me/player', body, {
      headers,
      responseType: 'text',
    });
  }

}
