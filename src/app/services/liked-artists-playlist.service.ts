import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, forkJoin, of, throwError } from 'rxjs';
import { map, catchError, switchMap, expand, reduce } from 'rxjs/operators';
import { AuthService } from './auth.service';
import { UserService } from './user.service';
import { ArtistService } from './artist.service';
import { PlaylistService } from './playlist.service';
import { EMPTY } from 'rxjs';

export interface ArtistRelease {
  albumId: string;
  albumName: string;
  artistName: string;
  artistId: string;
  imageUrl: string | null;
  albumType: 'album' | 'single' | 'appears_on';
  releaseDate: string;
  releaseDateObj: Date;
  totalTracks: number;
  uri: string;
  spotifyUrl?: string;
  genres: string[];
}

export interface GeneratePlaylistOptions {
  name: string;
  description: string;
  isPublic: boolean;
  addXomifyLogo: boolean;
  includeAlbumTypes: {
    album: boolean;
    single: boolean;
    appearsOn: boolean;
  };
  releaseDateFilter?: {
    from?: Date;
    to?: Date;
  };
  genreFilters?: string[];
  limitTracks?: number;
}

@Injectable({
  providedIn: 'root',
})
export class LikedArtistsPlaylistService {
  private baseUrl = 'https://api.spotify.com/v1';

  constructor(
    private http: HttpClient,
    private authService: AuthService,
    private userService: UserService,
    private artistService: ArtistService,
    private playlistService: PlaylistService,
  ) {}

  private getHeaders(): HttpHeaders {
    const token = this.authService.getAccessToken();
    return new HttpHeaders({
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    });
  }

  /**
   * Get all followed artists (liked artists)
   * Returns all artists the user follows
   */
  getLikedArtists(): Observable<any[]> {
    return new Observable((observer) => {
      const allArtists: any[] = [];

      const fetchPage = (after?: string) => {
        this.userService.getFollowedArtists(50, after).subscribe({
          next: (data) => {
            const artists = data.artists?.items || [];
            allArtists.push(...artists);

            const nextCursor = data.artists?.cursors?.after;
            if (nextCursor && artists.length === 50) {
              fetchPage(nextCursor);
            } else {
              observer.next(allArtists);
              observer.complete();
            }
          },
          error: (err) => {
            observer.error(err);
          },
        });
      };

      fetchPage();
    });
  }

  /**
   * Get recent releases from multiple artists
   * Fetches the latest releases from all liked artists
   */
  getArtistRecentReleases(artistId: string, limitPerType: number = 3): Observable<ArtistRelease[]> {
    const types = ['album', 'single'];
    
    const requests = types.map((type) =>
      this.http.get(`${this.baseUrl}/artists/${artistId}/albums`, {
        headers: this.getHeaders(),
        params: {
          limit: limitPerType.toString(),
          include_groups: type,
        },
      }).pipe(
        map((response: any) => {
          return (response.items || []).map((album: any) => ({
            albumId: album.id,
            albumName: album.name,
            artistId: artistId,
            artistName: album.artists?.[0]?.name || '',
            imageUrl: album.images?.[0]?.url || null,
            albumType: type as 'album' | 'single' | 'appears_on',
            releaseDate: album.release_date,
            releaseDateObj: new Date(album.release_date),
            totalTracks: album.total_tracks,
            uri: album.uri,
            spotifyUrl: album.external_urls?.spotify,
            genres: album.genres || [],
          }));
        }),
        catchError(() => of([]))
      )
    );

    return forkJoin(requests).pipe(
      map((results: any[]) => {
        // Flatten all results
        const allReleases: ArtistRelease[] = results.reduce((acc, arr) => acc.concat(arr), []);
        
        // Sort by release date (newest first)
        allReleases.sort((a, b) => b.releaseDateObj.getTime() - a.releaseDateObj.getTime());
        
        return allReleases;
      })
    );
  }

  /**
   * Get latest releases from all liked artists
   * Aggregates releases from all followed artists
   */
  getAllLikedArtistsReleases(limitPerArtist: number = 5): Observable<ArtistRelease[]> {
    return this.getLikedArtists().pipe(
      switchMap((artists) => {
        if (artists.length === 0) {
          return of([]);
        }

        // Fetch releases for each artist
        const releaseRequests = artists.map((artist) =>
          this.getArtistRecentReleases(artist.id, limitPerArtist)
        );

        return forkJoin(releaseRequests).pipe(
          map((results: any[]) => {
            // Flatten and deduplicate by album ID
            const allReleases: ArtistRelease[] = results.reduce((acc, arr) => acc.concat(arr), []);
            const seenIds = new Set<string>();
            const unique: ArtistRelease[] = [];

            for (const release of allReleases) {
              if (!seenIds.has(release.albumId)) {
                seenIds.add(release.albumId);
                unique.push(release);
              }
            }

            // Sort by release date (newest first)
            unique.sort((a, b) => b.releaseDateObj.getTime() - a.releaseDateObj.getTime());
            
            return unique;
          })
        );
      })
    );
  }

  /**
   * Get album tracks for a given album ID
   */
  getAlbumTracks(albumId: string): Observable<any[]> {
    const limit = 50;
    return this.http.get<any>(`${this.baseUrl}/albums/${albumId}/tracks`, {
      headers: this.getHeaders(),
      params: { limit: limit.toString(), offset: '0' },
    }).pipe(
      expand((response: any) => {
        if (response && response.next) {
          return this.http.get<any>(response.next, { headers: this.getHeaders() });
        }
        return EMPTY;
      }),
      reduce((acc: any[], response: any) => {
        return acc.concat(response && response.items ? response.items : []);
      }, [])
    );
  }

  /**
   * Get all tracks from multiple albums
   */
  getTracksFromAlbums(albumIds: string[]): Observable<any[]> {
    if (albumIds.length === 0) {
      return of([]);
    }

    const requests = albumIds.map((albumId) => this.getAlbumTracks(albumId));
    
    return forkJoin(requests).pipe(
      map((results: any[]) => {
        return results.reduce((acc, arr) => acc.concat(arr), []);
      })
    );
  }

  /**
   * Filter releases based on options
   */
  filterReleases(
    releases: ArtistRelease[],
    options: {
      albumTypes?: { album: boolean; single: boolean; appearsOn: boolean };
      releaseDateFrom?: Date;
      releaseDateTo?: Date;
      genres?: string[];
    }
  ): ArtistRelease[] {
    return releases.filter((release) => {
      // Filter by album type
      if (options.albumTypes) {
        const typeIncluded =
          (release.albumType === 'album' && options.albumTypes.album) ||
          (release.albumType === 'single' && options.albumTypes.single) ||
          (release.albumType === 'appears_on' && options.albumTypes.appearsOn);
        if (!typeIncluded) return false;
      }

      // Filter by release date
      if (options.releaseDateFrom && release.releaseDateObj < options.releaseDateFrom) {
        return false;
      }
      if (options.releaseDateTo && release.releaseDateObj > options.releaseDateTo) {
        return false;
      }

      // Filter by genre
      if (options.genres && options.genres.length > 0) {
        const hasGenre = options.genres.some((genre) =>
          release.genres.some((g) => g.toLowerCase().includes(genre.toLowerCase()))
        );
        if (!hasGenre) return false;
      }

      return true;
    });
  }

  /**
   * Generate a playlist from liked artists' latest releases.
   *
   * IMPORTANT: `releases` contains album-level data (release.uri = spotify:album:...).
   * Spotify's add-tracks API requires TRACK URIs, so we must first fetch all tracks
   * from the selected albums, then build the playlist from those track URIs.
   */
  generatePlaylist(releases: ArtistRelease[], options: GeneratePlaylistOptions): Observable<any> {
    const userId = this.userService.getUserId();
    const limitTracks = options.limitTracks ?? 50;

    // Extract unique album IDs from the filtered releases (preserve order)
    const albumIds = [...new Set(releases.map((r) => r.albumId))];

    // Fetch all tracks from each album, then flatten + limit + create playlist
    return this.getTracksFromAlbums(albumIds).pipe(
      map((tracks: any[]) => {
        // Build track URIs — prefer uri field, fall back to building from id
        const trackUris: string[] = tracks
          .filter((t) => t && (t.uri || t.id))
          .map((t) => t.uri ?? `spotify:track:${t.id}`)
          .slice(0, limitTracks);

        if (trackUris.length === 0) {
          throw new Error('No tracks found in the selected releases. Try different filters.');
        }

        return trackUris;
      }),
      switchMap((trackUris: string[]) =>
        this.playlistService.createPlaylistWithTracks(
          userId,
          options.name,
          options.description,
          trackUris,
          {
            isPublic: options.isPublic,
            addXomifyLogo: options.addXomifyLogo,
          }
        )
      )
    );
  }

  /**
   * Generate playlist directly from options (full workflow)
   */
  generatePlaylistFromOptions(
    releases: ArtistRelease[],
    options: GeneratePlaylistOptions
  ): Observable<any> {
    // Filter releases based on options
    const filtered = this.filterReleases(releases, {
      albumTypes: options.includeAlbumTypes,
      releaseDateFrom: options.releaseDateFilter?.from,
      releaseDateTo: options.releaseDateFilter?.to,
      genres: options.genreFilters,
    });

    if (filtered.length === 0) {
      return throwError(() => new Error('No releases match the selected filters'));
    }

    return this.generatePlaylist(filtered, options);
  }

  /**
   * Get all genres from releases
   */
  getGenresFromReleases(releases: ArtistRelease[]): string[] {
    const genresSet = new Set<string>();
    releases.forEach((release) => {
      release.genres.forEach((genre) => genresSet.add(genre));
    });
    return Array.from(genresSet).sort();
  }

  /**
   * Get date range from releases
   */
  getDateRangeFromReleases(releases: ArtistRelease[]): { min: Date; max: Date } {
    if (releases.length === 0) {
      return { min: new Date(), max: new Date() };
    }

    const dates = releases.map((r) => r.releaseDateObj);
    return {
      min: new Date(Math.min(...dates.map((d) => d.getTime()))),
      max: new Date(Math.max(...dates.map((d) => d.getTime()))),
    };
  }
}
