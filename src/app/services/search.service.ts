import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AuthService } from './auth.service';

/**
 * Subset of Spotify track shape consumed by the search page.
 * Other fields are present in the raw response but unused — keep this shape
 * minimal so the page binds against a stable contract.
 */
export interface SearchTrack {
  id: string;
  name: string;
  uri: string;
  artists: { id: string; name: string }[];
  album: {
    id: string;
    name: string;
    images: { url: string; width?: number; height?: number }[];
  };
}

export interface SearchArtist {
  id: string;
  name: string;
  uri: string;
  images: { url: string; width?: number; height?: number }[];
  genres?: string[];
  followers?: { total: number };
}

export interface SearchAlbum {
  id: string;
  name: string;
  uri: string;
  album_type?: string;
  release_date?: string;
  artists: { id: string; name: string }[];
  images: { url: string; width?: number; height?: number }[];
}

export type SearchType = 'track' | 'artist' | 'album';

/**
 * Normalized envelope. Spotify returns one of `tracks`, `artists`, `albums`
 * depending on the `type` param — we expose just the items array the caller
 * cares about, plus the original total so we can render counts later.
 */
export interface SearchResults {
  tracks: SearchTrack[];
  artists: SearchArtist[];
  albums: SearchAlbum[];
  total: number;
}

interface SpotifySearchResponse {
  tracks?: { items: SearchTrack[]; total: number };
  artists?: { items: SearchArtist[]; total: number };
  albums?: { items: SearchAlbum[]; total: number };
}

@Injectable({
  providedIn: 'root',
})
export class SearchService {
  private readonly baseUrl = 'https://api.spotify.com/v1';

  constructor(
    private http: HttpClient,
    private authService: AuthService,
  ) {}

  private getAuthHeaders(): HttpHeaders {
    const accessToken = this.authService.getAccessToken();
    return new HttpHeaders({
      Authorization: `Bearer ${accessToken}`,
    });
  }

  /**
   * Hits Spotify `/search`. Caller supplies a singular `type` — the response
   * object key from Spotify is plural (`tracks`/`artists`/`albums`), which we
   * normalize into a fixed `SearchResults` envelope.
   *
   * Empty/whitespace queries return an empty result set without making a
   * network call — Spotify rejects empty `q` with 400.
   */
  search(query: string, type: SearchType, limit: number = 20): Observable<SearchResults> {
    return new Observable<SearchResults>((observer) => {
      const trimmed = query.trim();
      if (!trimmed) {
        observer.next({ tracks: [], artists: [], albums: [], total: 0 });
        observer.complete();
        return;
      }

      const sub = this.http
        .get<SpotifySearchResponse>(`${this.baseUrl}/search`, {
          headers: this.getAuthHeaders(),
          params: {
            q: trimmed,
            type,
            limit: limit.toString(),
          },
        })
        .subscribe({
          next: (resp) => {
            observer.next(this.normalize(resp));
            observer.complete();
          },
          error: (err) => observer.error(err),
        });

      return () => sub.unsubscribe();
    });
  }

  private normalize(resp: SpotifySearchResponse): SearchResults {
    const tracks = resp.tracks?.items ?? [];
    const artists = resp.artists?.items ?? [];
    const albums = resp.albums?.items ?? [];
    const total =
      resp.tracks?.total ?? resp.artists?.total ?? resp.albums?.total ?? 0;
    return { tracks, artists, albums, total };
  }
}
