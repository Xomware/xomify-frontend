import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, of, forkJoin } from 'rxjs';
import { map, switchMap, catchError } from 'rxjs/operators';
import { AuthService } from './auth.service';
import { PlaylistService } from './playlist.service';

export interface CollaborativePlaylist {
  id: string;
  name: string;
  description: string;
  images: { url: string }[];
  tracks: { total: number };
  followers: { total: number };
  collaborative: boolean;
  external_urls: { spotify: string };
  owner: { id: string; display_name: string };
}

export interface CollaborativeTrack {
  track: {
    id: string;
    name: string;
    uri: string;
    artists: { id: string; name: string }[];
    album: {
      name: string;
      images: { url: string; width: number; height: number }[];
    };
    duration_ms: number;
    external_urls: { spotify: string };
  };
  added_by: { id: string; external_urls?: { spotify: string } };
  added_at: string;
}

@Injectable({
  providedIn: 'root',
})
export class CollaborativePlaylistsService {
  private readonly spotifyBase = 'https://api.spotify.com/v1';

  constructor(
    private http: HttpClient,
    private authService: AuthService,
    private playlistService: PlaylistService
  ) {}

  private getHeaders(): HttpHeaders {
    return new HttpHeaders({
      Authorization: `Bearer ${this.authService.getAccessToken()}`,
    });
  }

  getCollaborativePlaylists(): Observable<CollaborativePlaylist[]> {
    return this.playlistService.getAllUserPlaylists().pipe(
      map((playlists: any[]) =>
        playlists.filter((p) => p.collaborative === true)
      ),
      catchError((err) => {
        console.error('[CollabPlaylists] Error fetching playlists:', err);
        throw err;
      })
    );
  }

  getPlaylistWithTracks(playlistId: string): Observable<{ playlist: any; tracks: CollaborativeTrack[] }> {
    return this.playlistService.getPlaylistDetails(playlistId).pipe(
      switchMap((playlist) =>
        this.fetchAllTracks(playlistId).pipe(
          map((tracks) => ({ playlist, tracks }))
        )
      ),
      catchError((err) => {
        console.error('[CollabPlaylists] Error fetching playlist tracks:', err);
        throw err;
      })
    );
  }

  private fetchAllTracks(playlistId: string): Observable<CollaborativeTrack[]> {
    const fields = 'items(track(id,name,uri,artists,album,duration_ms,external_urls),added_by,added_at),next,total';
    return this.http
      .get<any>(`${this.spotifyBase}/playlists/${playlistId}/tracks?limit=50&fields=${fields}`, {
        headers: this.getHeaders(),
      })
      .pipe(
        switchMap((res) => {
          const items = res.items || [];
          const total = res.total || 0;
          if (total <= 50) return of(items);

          const requests: Observable<any>[] = [of(res)];
          for (let offset = 50; offset < total; offset += 50) {
            requests.push(
              this.http.get<any>(
                `${this.spotifyBase}/playlists/${playlistId}/tracks?limit=50&offset=${offset}`,
                { headers: this.getHeaders() }
              )
            );
          }

          return forkJoin(requests).pipe(
            map((responses: any[]) => responses.flatMap((r) => r.items || []))
          );
        }),
        map((items: any[]) => items.filter((i) => i.track && i.track.id)),
        catchError(() => of([]))
      );
  }

  addTrackToPlaylist(playlistId: string, trackUri: string): Observable<any> {
    return this.playlistService.addTracksToPlaylist(playlistId, [trackUri]);
  }
}
