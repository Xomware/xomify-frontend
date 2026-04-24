import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { catchError, switchMap, expand, reduce, map } from 'rxjs/operators';
import { AuthService } from './auth.service';
import { LogoService } from './logo.service';
import { EMPTY } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class PlaylistService {
  private apiUrl = 'https://api.spotify.com/v1';

  constructor(
    private http: HttpClient,
    private authService: AuthService,
    private logoService: LogoService,
  ) {}

  private getHeaders(): HttpHeaders {
    const token = this.authService.getAccessToken();
    return new HttpHeaders({
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    });
  }

  // ============================================
  // PLAYLIST CRUD OPERATIONS
  // ============================================

  /**
   * Get user's playlists. Strips `null` entries from `items` — Spotify can
   * return nulls for deleted/unreadable playlists and downstream templates
   * assume `playlist.name` is defined.
   */
  getUserPlaylists(limit: number = 50, offset: number = 0): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/me/playlists`, {
      headers: this.getHeaders(),
      params: { limit: limit.toString(), offset: offset.toString() },
    }).pipe(
      map((res: any) => ({
        ...res,
        items: (res?.items || []).filter((p: any) => p != null),
      })),
    );
  }

  /**
   * Get all user's playlists (paginated, returns all).
   *
   * Tracks `offset` locally rather than trusting `response.offset` — some
   * Spotify client paths strip the paging metadata and leave it `undefined`,
   * which turns `undefined + 50` into `NaN` and stalls pagination. Also
   * filters out `null` entries Spotify occasionally returns for deleted or
   * unreadable playlists (those would crash the template on `playlist.name`).
   */
  getAllUserPlaylists(): Observable<any[]> {
    const limit = 50;
    let offset = 0;
    return this.getUserPlaylists(limit, offset).pipe(
      expand((response) => {
        if (response?.next) {
          offset += limit;
          return this.getUserPlaylists(limit, offset);
        }
        return EMPTY;
      }),
      reduce((acc: any[], response) => {
        const items = (response?.items || []).filter((p: any) => p != null);
        return acc.concat(items);
      }, [])
    );
  }

  /**
   * Get playlist details. Filters `null` track entries inside
   * `tracks.items` — Spotify returns nulls for removed/unavailable tracks
   * and the template renders `item.track.name` unconditionally for
   * in-queue checks.
   */
  getPlaylistDetails(playlistId: string): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/playlists/${playlistId}`, {
      headers: this.getHeaders(),
    }).pipe(
      map((res: any) => {
        if (!res?.tracks?.items) return res;
        return {
          ...res,
          tracks: {
            ...res.tracks,
            items: res.tracks.items.filter((i: any) => i?.track != null),
          },
        };
      }),
    );
  }

  /**
   * Get playlist tracks with pagination. Filters null-track items.
   */
  getPlaylistTracks(playlistId: string, limit: number = 50, offset: number = 0): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/playlists/${playlistId}/tracks`, {
      headers: this.getHeaders(),
      params: { limit: limit.toString(), offset: offset.toString() },
    }).pipe(
      map((res: any) => ({
        ...res,
        items: (res?.items || []).filter((i: any) => i?.track != null),
      })),
    );
  }

  /**
   * Create a new playlist
   */
  createPlaylist(
    userId: string,
    name: string,
    description: string = '',
    isPublic: boolean = false
  ): Observable<any> {
    const body = {
      name,
      description,
      public: isPublic,
    };
    return this.http.post(`${this.apiUrl}/users/${userId}/playlists`, body, {
      headers: this.getHeaders(),
    });
  }

  /**
   * Add tracks to a playlist
   * Handles batching for large track lists (Spotify limit is 100 per request)
   */
  addTracksToPlaylist(playlistId: string, trackUris: string[]): Observable<any> {
    if (trackUris.length === 0) {
      return of({ snapshot_id: null });
    }

    // Spotify allows max 100 tracks per request
    if (trackUris.length <= 100) {
      return this.http.post(
        `${this.apiUrl}/playlists/${playlistId}/tracks`,
        { uris: trackUris },
        { headers: this.getHeaders() }
      );
    }

    // Batch requests for more than 100 tracks
    const batches: string[][] = [];
    for (let i = 0; i < trackUris.length; i += 100) {
      batches.push(trackUris.slice(i, i + 100));
    }

    // Chain the batch requests
    return batches.reduce(
      (chain, batch) =>
        chain.pipe(
          switchMap(() =>
            this.http.post(
              `${this.apiUrl}/playlists/${playlistId}/tracks`,
              { uris: batch },
              { headers: this.getHeaders() }
            )
          )
        ),
      of(null)
    );
  }

  /**
   * Legacy method name for backwards compatibility
   */
  addPlaylistSongs(playlist: any, trackUris: string[]): Observable<any> {
    return this.addTracksToPlaylist(playlist.id, trackUris);
  }

  /**
   * Remove tracks from a playlist
   */
  removeTracksFromPlaylist(playlistId: string, trackUris: string[]): Observable<any> {
    const tracks = trackUris.map(uri => ({ uri }));
    return this.http.delete(`${this.apiUrl}/playlists/${playlistId}/tracks`, {
      headers: this.getHeaders(),
      body: { tracks },
    });
  }

  /**
   * Update playlist details
   */
  updatePlaylistDetails(
    playlistId: string,
    name?: string,
    description?: string,
    isPublic?: boolean
  ): Observable<any> {
    const body: any = {};
    if (name !== undefined) body.name = name;
    if (description !== undefined) body.description = description;
    if (isPublic !== undefined) body.public = isPublic;

    return this.http.put(`${this.apiUrl}/playlists/${playlistId}`, body, {
      headers: this.getHeaders(),
    });
  }

  // ============================================
  // PLAYLIST IMAGE OPERATIONS
  // ============================================

  /**
   * Upload a custom image to a playlist
   * @param playlistId - The Spotify playlist ID
   * @param base64Image - Base64 encoded JPEG image (max 256KB)
   */
  uploadPlaylistImage(playlistId: string, base64Image: string): Observable<any> {
    // Remove data URL prefix if present
    let imageData = base64Image;
    if (imageData.includes('base64,')) {
      imageData = imageData.split('base64,')[1];
    }
    // Remove any newlines
    imageData = imageData.replace(/\n/g, '').replace(/\r/g, '');

    const token = this.authService.getAccessToken();
    const headers = new HttpHeaders({
      Authorization: `Bearer ${token}`,
      'Content-Type': 'image/jpeg',
    });

    return this.http.put(
      `${this.apiUrl}/playlists/${playlistId}/images`,
      imageData,
      { headers }
    );
  }

  /**
   * Upload the Xomify logo to a playlist.
   * Loads the logo from a static asset at runtime.
   */
  uploadXomifyLogo(playlistId: string): Observable<any> {
    return this.logoService.getLogoBase64().pipe(
      switchMap((base64) => this.uploadPlaylistImage(playlistId, base64)),
    );
  }

  /**
   * Create a playlist with tracks and optional Xomify branding
   * Convenience method that handles the full flow
   */
  createPlaylistWithTracks(
    userId: string,
    name: string,
    description: string,
    trackUris: string[],
    options: {
      isPublic?: boolean;
      addXomifyLogo?: boolean;
    } = {}
  ): Observable<any> {
    const { isPublic = false, addXomifyLogo = true } = options;

    return this.createPlaylist(userId, name, description, isPublic).pipe(
      switchMap((playlist) => {
        return this.addTracksToPlaylist(playlist.id, trackUris).pipe(
          switchMap(() => {
            if (addXomifyLogo) {
              return this.uploadXomifyLogo(playlist.id).pipe(
                // Don't fail if image upload fails
                catchError((err) => {
                  console.warn('Failed to upload playlist image:', err);
                  return of(null);
                }),
                switchMap(() => of(playlist))
              );
            }
            return of(playlist);
          })
        );
      })
    );
  }

  // ============================================
  // SEARCH OPERATIONS
  // ============================================

  /**
   * Search for tracks
   */
  searchTracks(query: string, limit: number = 20): Observable<any> {
    if (!query || !query.trim()) {
      return of({ tracks: { items: [] } });
    }

    return this.http.get(`${this.apiUrl}/search`, {
      headers: this.getHeaders(),
      params: {
        q: query,
        type: 'track',
        limit: limit.toString(),
      },
    }).pipe(
      catchError((error) => {
        console.error('Search error:', error);
        return of({ tracks: { items: [] } });
      })
    );
  }

  /**
   * Search for playlists
   */
  searchPlaylists(query: string, limit: number = 20): Observable<any> {
    return this.http.get(`${this.apiUrl}/search`, {
      headers: this.getHeaders(),
      params: {
        q: query,
        type: 'playlist',
        limit: limit.toString(),
      },
    });
  }

  // ============================================
  // FOLLOW OPERATIONS
  // ============================================

  /**
   * Follow a playlist
   */
  followPlaylist(playlistId: string): Observable<any> {
    return this.http.put(
      `${this.apiUrl}/playlists/${playlistId}/followers`,
      {},
      { headers: this.getHeaders() }
    );
  }

  /**
   * Unfollow a playlist
   */
  unfollowPlaylist(playlistId: string): Observable<any> {
    return this.http.delete(
      `${this.apiUrl}/playlists/${playlistId}/followers`,
      { headers: this.getHeaders() }
    );
  }

  /**
   * Check if user follows a playlist
   */
  checkFollowsPlaylist(playlistId: string, userId: string): Observable<boolean[]> {
    return this.http.get<boolean[]>(
      `${this.apiUrl}/playlists/${playlistId}/followers/contains`,
      {
        headers: this.getHeaders(),
        params: { ids: userId },
      }
    );
  }
}
