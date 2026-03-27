import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, Subscriber } from 'rxjs';
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

interface PlayContextBody {
  context_uri: string;
  offset?: { uri: string };
}

@Injectable({
  providedIn: 'root',
})
export class PlayerService {
  private playerReadySubject = new BehaviorSubject<boolean>(false);
  private currentTrackIdSubject = new BehaviorSubject<string | null>(null);
  private isLoadingSubject = new BehaviorSubject<boolean>(false);
  private isPlayingSubject = new BehaviorSubject<boolean>(false);

  playerReady$ = this.playerReadySubject.asObservable();
  currentTrackId$ = this.currentTrackIdSubject.asObservable();
  isLoading$ = this.isLoadingSubject.asObservable();
  isPlaying$ = this.isPlayingSubject.asObservable();

  private deviceId: string | null = null;
  // Spotify SDK player instance -- typed loosely due to external SDK
  private player: {
    addListener: (event: string, callback: (...args: unknown[]) => void) => void;
    connect: () => Promise<boolean>;
    pause: () => Promise<void>;
    togglePlay: () => void;
    resume: () => Promise<void>;
    setVolume: (volume: number) => void;
    seek: (positionMs: number) => void;
    getCurrentState: () => Promise<unknown>;
    disconnect: () => void;
  } | null = null;
  private sdkReady = false;

  constructor(private http: HttpClient, private authService: AuthService) {
    this.waitForSpotifySDK();
  }

  private waitForSpotifySDK(): void {
    if (typeof window !== 'undefined') {
      const win = window as unknown as Record<string, unknown>;
      const spotify = win['Spotify'] as Record<string, unknown> | undefined;
      if (spotify?.['Player']) {
        this.sdkReady = true;
        this.initializePlayer();
      } else {
        win['onSpotifyWebPlaybackSDKReady'] = () => {
          this.sdkReady = true;
          this.initializePlayer();
        };
      }
    }
  }

  private initializePlayer(): void {
    const token = this.authService.getAccessToken();
    if (!token) {
      console.warn('No access token available for player');
      return;
    }

    const win = window as unknown as Record<string, unknown>;
    const spotify = win['Spotify'] as Record<string, unknown> | undefined;
    if (!this.sdkReady || !spotify?.['Player']) {
      console.warn('Spotify SDK not ready');
      return;
    }

    try {
      const PlayerCtor = spotify['Player'] as new (opts: Record<string, unknown>) => typeof this.player;
      this.player = new PlayerCtor({
        name: 'Xomify Web Player',
        getOAuthToken: (cb: (token: string) => void) => {
          cb(this.authService.getAccessToken());
        },
        volume: 0.5,
      });

      if (!this.player) return;

      this.player.addListener(
        'ready',
        (data: unknown) => {
          const { device_id } = data as { device_id: string };
          this.deviceId = device_id;
          this.playerReadySubject.next(true);
        }
      );

      this.player.addListener(
        'not_ready',
        () => {
          this.playerReadySubject.next(false);
        }
      );

      this.player.addListener('player_state_changed', (state: unknown) => {
        if (!state) {
          this.isPlayingSubject.next(false);
          this.currentTrackIdSubject.next(null);
          return;
        }
        const s = state as { paused: boolean; track_window?: { current_track?: { uri: string } } };
        this.isPlayingSubject.next(!s.paused);
        if (s.track_window?.current_track) {
          const trackUri = s.track_window.current_track.uri;
          const trackId = trackUri.split(':').pop() || null;
          this.currentTrackIdSubject.next(trackId);
        }
      });

      this.player.addListener(
        'initialization_error',
        (data: unknown) => {
          const { message } = data as { message: string };
          console.error('Initialization Error:', message);
        }
      );

      this.player.addListener(
        'authentication_error',
        (data: unknown) => {
          const { message } = data as { message: string };
          console.error('Authentication Error:', message);
          this.playerReadySubject.next(false);
        }
      );

      this.player.addListener(
        'account_error',
        (data: unknown) => {
          const { message } = data as { message: string };
          console.error('Account Error (Premium required):', message);
        }
      );

      this.player.addListener(
        'playback_error',
        () => {
          this.isLoadingSubject.next(false);
        }
      );

      this.player.connect().then((success: boolean) => {
        if (!success) {
          console.warn('Failed to connect Spotify Player');
        }
      });
    } catch (error) {
      console.error('Error initializing Spotify Player:', error);
    }
  }

  tryInitializePlayer(): void {
    if (this.sdkReady && !this.player) {
      this.initializePlayer();
    } else if (!this.sdkReady) {
      this.waitForSpotifySDK();
    }
  }

  playSong(trackId: string): void {
    if (!this.deviceId) {
      console.warn('No device ID available');
      return;
    }

    if (this.currentTrackIdSubject.getValue() === trackId) {
      this.togglePlayPause();
      return;
    }

    this.isLoadingSubject.next(true);
    this.currentTrackIdSubject.next(trackId);

    const token = this.authService.getAccessToken();
    const headers = new HttpHeaders({
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    });

    const body = { uris: [`spotify:track:${trackId}`] };

    this.http
      .put(
        `https://api.spotify.com/v1/me/player/play?device_id=${this.deviceId}`,
        body,
        { headers }
      )
      .subscribe({
        next: () => {
          this.isLoadingSubject.next(false);
          this.isPlayingSubject.next(true);
        },
        error: (err) => {
          console.error('Error playing song:', err);
          this.isLoadingSubject.next(false);
          this.currentTrackIdSubject.next(null);
        },
      });
  }

  playContext(contextUri: string, trackId?: string): void {
    if (!this.deviceId) {
      console.warn('No device ID available');
      return;
    }

    this.isLoadingSubject.next(true);
    if (trackId) {
      this.currentTrackIdSubject.next(trackId);
    }

    const token = this.authService.getAccessToken();
    const headers = new HttpHeaders({
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    });

    const body: PlayContextBody = { context_uri: contextUri };
    if (trackId) {
      body.offset = { uri: `spotify:track:${trackId}` };
    }

    this.http
      .put(
        `https://api.spotify.com/v1/me/player/play?device_id=${this.deviceId}`,
        body,
        { headers }
      )
      .subscribe({
        next: () => {
          this.isLoadingSubject.next(false);
          this.isPlayingSubject.next(true);
        },
        error: (err) => {
          console.error('Error playing context:', err);
          this.isLoadingSubject.next(false);
          this.currentTrackIdSubject.next(null);
        },
      });
  }

  stopSong(): void {
    if (this.player) {
      this.player.pause().then(() => {
        this.isPlayingSubject.next(false);
      });
    }
  }

  togglePlayPause(): void {
    if (this.player) {
      this.player.togglePlay();
    }
  }

  resume(): void {
    if (this.player) {
      this.player.resume().then(() => {
        this.isPlayingSubject.next(true);
      });
    }
  }

  setVolume(volume: number): void {
    if (this.player) {
      this.player.setVolume(volume);
    }
  }

  seek(positionMs: number): void {
    if (this.player) {
      this.player.seek(positionMs);
    }
  }

  getCurrentState(): Promise<unknown> {
    if (this.player) {
      return this.player.getCurrentState();
    }
    return Promise.resolve(null);
  }

  get isPlayerReady(): boolean {
    return this.playerReadySubject.getValue();
  }

  get currentTrackId(): string | null {
    return this.currentTrackIdSubject.getValue();
  }

  get isCurrentlyPlaying(): boolean {
    return this.isPlayingSubject.getValue();
  }

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

  private activateDevice(): Observable<boolean> {
    return new Observable((observer) => {
      if (this.deviceId) {
        this.transferPlayback(this.deviceId).subscribe({
          next: () => {
            observer.next(true);
            observer.complete();
          },
          error: () => {
            this.tryActivateAnyDevice(observer);
          },
        });
      } else {
        this.tryActivateAnyDevice(observer);
      }
    });
  }

  private tryActivateAnyDevice(observer: Subscriber<boolean>): void {
    this.getAvailableDevices().subscribe({
      next: (response) => {
        const devices = response.devices || [];

        if (devices.length > 0) {
          const activeDevice =
            devices.find((d: SpotifyDevice) => d.is_active) || devices[0];

          this.transferPlayback(activeDevice.id).subscribe({
            next: () => {
              observer.next(true);
              observer.complete();
            },
            error: () => {
              observer.next(false);
              observer.complete();
            },
          });
        } else {
          console.warn('No Spotify devices available');
          observer.next(false);
          observer.complete();
        }
      },
      error: () => {
        observer.next(false);
        observer.complete();
      },
    });
  }

  disconnect(): void {
    if (this.player) {
      this.player.disconnect();
      this.playerReadySubject.next(false);
      this.currentTrackIdSubject.next(null);
      this.isPlayingSubject.next(false);
    }
  }
}
