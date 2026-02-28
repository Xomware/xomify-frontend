import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, of, forkJoin } from 'rxjs';
import { map, switchMap, tap, catchError } from 'rxjs/operators';
import { AuthService } from './auth.service';

export interface SpotifyArtist {
  id: string;
  name: string;
  images: { url: string; width: number; height: number }[];
  genres: string[];
  popularity: number;
  followers: { total: number };
  external_urls: { spotify: string };
}

export interface DiscoveryArtist extends SpotifyArtist {
  isFollowing: boolean;
  followLoading: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class ArtistDiscoveryService {
  private readonly spotifyBase = 'https://api.spotify.com/v1';
  private readonly cacheKey = 'xomify_artist_discovery';
  private readonly seedCacheKey = 'xomify_artist_discovery_seeds';
  private readonly cacheTTL = 30 * 60 * 1000; // 30 minutes

  constructor(private http: HttpClient, private authService: AuthService) {}

  private getHeaders(): HttpHeaders {
    return new HttpHeaders({
      Authorization: `Bearer ${this.authService.getAccessToken()}`,
    });
  }

  /**
   * Get top 5 seed artists from user's short-term top artists
   */
  getSeedArtists(): Observable<SpotifyArtist[]> {
    return this.http
      .get<{ items: SpotifyArtist[] }>(
        `${this.spotifyBase}/me/top/artists?time_range=short_term&limit=5`,
        { headers: this.getHeaders() }
      )
      .pipe(
        map((res) => res.items),
        catchError((err) => {
          console.error('[ArtistDiscovery] Error fetching seed artists:', err);
          throw err;
        })
      );
  }

  /**
   * Get related artists for a given artist ID
   */
  getRelatedArtists(artistId: string): Observable<SpotifyArtist[]> {
    return this.http
      .get<{ artists: SpotifyArtist[] }>(
        `${this.spotifyBase}/artists/${artistId}/related-artists`,
        { headers: this.getHeaders() }
      )
      .pipe(
        map((res) => res.artists),
        catchError((err) => {
          console.error('[ArtistDiscovery] Error fetching related artists:', err);
          return of([]);
        })
      );
  }

  /**
   * Check if user follows given artist IDs (max 50)
   */
  checkFollowStatus(artistIds: string[]): Observable<boolean[]> {
    if (artistIds.length === 0) return of([]);

    const ids = artistIds.slice(0, 50).join(',');
    return this.http
      .get<boolean[]>(
        `${this.spotifyBase}/me/following/contains?type=artist&ids=${ids}`,
        { headers: this.getHeaders() }
      )
      .pipe(
        catchError((err) => {
          console.error('[ArtistDiscovery] Error checking follow status:', err);
          return of(artistIds.map(() => false));
        })
      );
  }

  /**
   * Follow an artist
   */
  followArtist(artistId: string): Observable<any> {
    return this.http.put(
      `${this.spotifyBase}/me/following?type=artist&ids=${artistId}`,
      {},
      { headers: this.getHeaders() }
    );
  }

  /**
   * Unfollow an artist
   */
  unfollowArtist(artistId: string): Observable<any> {
    return this.http.delete(
      `${this.spotifyBase}/me/following?type=artist&ids=${artistId}`,
      { headers: this.getHeaders() }
    );
  }

  /**
   * Full discovery flow: get seeds → related → dedup → check follow status
   */
  loadDiscovery(): Observable<{ seeds: SpotifyArtist[]; discovered: DiscoveryArtist[] }> {
    const cached = this.getCache();
    if (cached) {
      return of(cached);
    }

    return this.getSeedArtists().pipe(
      switchMap((seeds) => {
        const seedIds = new Set(seeds.map((a) => a.id));

        // Fetch related artists for each seed
        const relatedRequests = seeds.map((seed) =>
          this.getRelatedArtists(seed.id)
        );

        return forkJoin(relatedRequests).pipe(
          map((relatedArrays) => {
            // Flatten and dedupe
            const seen = new Set<string>(seedIds);
            const related: SpotifyArtist[] = [];

            for (const arr of relatedArrays) {
              for (const artist of arr) {
                if (!seen.has(artist.id)) {
                  seen.add(artist.id);
                  related.push(artist);
                }
              }
            }

            // Sort by popularity
            related.sort((a, b) => b.popularity - a.popularity);

            return { seeds, related: related.slice(0, 50) };
          }),
          switchMap(({ seeds, related }) => {
            if (related.length === 0) {
              return of({ seeds, discovered: [] as DiscoveryArtist[] });
            }

            const ids = related.map((a) => a.id);
            return this.checkFollowStatus(ids).pipe(
              map((followStatus) => {
                const discovered: DiscoveryArtist[] = related.map((artist, i) => ({
                  ...artist,
                  isFollowing: followStatus[i] ?? false,
                  followLoading: false,
                }));
                return { seeds, discovered };
              })
            );
          })
        );
      }),
      tap((result) => {
        this.setCache(result);
      }),
      catchError((err) => {
        console.error('[ArtistDiscovery] Error in discovery flow:', err);
        throw err;
      })
    );
  }

  clearCache(): void {
    sessionStorage.removeItem(this.cacheKey);
  }

  private getCache(): { seeds: SpotifyArtist[]; discovered: DiscoveryArtist[] } | null {
    try {
      const cached = sessionStorage.getItem(this.cacheKey);
      if (!cached) return null;
      const data = JSON.parse(cached);
      if (Date.now() - data.timestamp > this.cacheTTL) {
        sessionStorage.removeItem(this.cacheKey);
        return null;
      }
      return data.result;
    } catch {
      return null;
    }
  }

  private setCache(result: { seeds: SpotifyArtist[]; discovered: DiscoveryArtist[] }): void {
    sessionStorage.setItem(
      this.cacheKey,
      JSON.stringify({ result, timestamp: Date.now() })
    );
  }
}
