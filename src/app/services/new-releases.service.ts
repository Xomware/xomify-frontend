import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { AuthService } from './auth.service';

export interface SpotifyAlbum {
  id: string;
  name: string;
  album_type: 'album' | 'single' | 'compilation';
  artists: { id: string; name: string }[];
  images: { url: string; width: number; height: number }[];
  release_date: string;
  release_date_precision: string;
  total_tracks: number;
  external_urls: { spotify: string };
  uri: string;
}

export interface NewReleasesResponse {
  albums: {
    items: SpotifyAlbum[];
    total: number;
    limit: number;
    offset: number;
    next: string | null;
    previous: string | null;
    href: string;
  };
}

@Injectable({
  providedIn: 'root',
})
export class NewReleasesService {
  private readonly spotifyBase = 'https://api.spotify.com/v1';
  private readonly cacheKey = 'xomify_new_releases';
  private readonly cacheTTL = 15 * 60 * 1000; // 15 minutes

  constructor(private http: HttpClient, private authService: AuthService) {}

  private getHeaders(): HttpHeaders {
    return new HttpHeaders({
      Authorization: `Bearer ${this.authService.getAccessToken()}`,
    });
  }

  getNewReleases(offset: number = 0): Observable<NewReleasesResponse> {
    if (offset === 0) {
      const cached = this.getCache();
      if (cached) {
        return of(cached);
      }
    }

    return this.http
      .get<NewReleasesResponse>(
        `${this.spotifyBase}/browse/new-releases?limit=50&offset=${offset}`,
        { headers: this.getHeaders() }
      )
      .pipe(
        tap((response) => {
          if (offset === 0) {
            this.setCache(response);
          }
        }),
        catchError((err) => {
          console.error('[NewReleases] Error fetching new releases:', err);
          throw err;
        })
      );
  }

  formatReleaseDate(dateStr: string, precision: string): string {
    if (precision === 'year') {
      return dateStr;
    }
    try {
      // Parse as UTC to avoid timezone shifting
      const parts = dateStr.split('-');
      if (parts.length >= 2) {
        const date = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2] || '1'));
        return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      }
      return dateStr;
    } catch {
      return dateStr;
    }
  }

  formatAlbumType(type: string): string {
    switch (type) {
      case 'album': return 'Album';
      case 'single': return 'Single';
      case 'compilation': return 'EP';
      default: return type;
    }
  }

  clearCache(): void {
    sessionStorage.removeItem(this.cacheKey);
  }

  private getCache(): NewReleasesResponse | null {
    try {
      const cached = sessionStorage.getItem(this.cacheKey);
      if (!cached) return null;
      const data = JSON.parse(cached);
      if (Date.now() - data.timestamp > this.cacheTTL) {
        sessionStorage.removeItem(this.cacheKey);
        return null;
      }
      return data.response;
    } catch {
      return null;
    }
  }

  private setCache(response: NewReleasesResponse): void {
    sessionStorage.setItem(
      this.cacheKey,
      JSON.stringify({ response, timestamp: Date.now() })
    );
  }
}
