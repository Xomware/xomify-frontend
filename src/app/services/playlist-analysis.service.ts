import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, forkJoin, of } from 'rxjs';
import { map, switchMap, catchError } from 'rxjs/operators';
import { AuthService } from './auth.service';
import { PlaylistService } from './playlist.service';

export interface TrackSummary {
  id: string;
  name: string;
  artists: string;
  artistIds: string[];
  albumArt: string;
  spotifyUrl: string;
  durationMs: number;
  popularity: number;
  explicit: boolean;
  releaseYear: number | null;
  addedAt: string | null;
}

export interface ArtistCount {
  id: string;
  name: string;
  count: number;
}

export interface GenreCount {
  genre: string;
  count: number;
}

export interface DecadeCount {
  decade: string;
  count: number;
}

export interface PlaylistAnalysis {
  totalTracks: number;
  totalDurationMs: number;
  avgPopularity: number;
  explicitCount: number;
  uniqueArtistCount: number;
  topArtists: ArtistCount[];
  topGenres: GenreCount[];
  decades: DecadeCount[];
  tracks: TrackSummary[];
}

@Injectable({
  providedIn: 'root',
})
export class PlaylistAnalysisService {
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

  analyzePlaylist(playlistId: string): Observable<PlaylistAnalysis> {
    return this.fetchAllPlaylistTracks(playlistId).pipe(
      switchMap((trackItems) => {
        const validItems = trackItems.filter((t: any) => t?.track && t.track.id);
        const tracks = validItems.map((item: any) => this.toSummary(item));
        const artistIdSet = new Set<string>();
        tracks.forEach((t) => t.artistIds.forEach((id) => artistIdSet.add(id)));
        const artistIds = Array.from(artistIdSet);

        return this.fetchArtists(artistIds).pipe(
          map((artists) => this.aggregate(tracks, artists))
        );
      })
    );
  }

  private toSummary(item: any): TrackSummary {
    const track = item.track;
    const releaseDate: string = track.album?.release_date || '';
    const releaseYear = releaseDate ? parseInt(releaseDate.slice(0, 4), 10) : null;
    return {
      id: track.id,
      name: track.name,
      artists: (track.artists || []).map((a: any) => a.name).join(', '),
      artistIds: (track.artists || []).map((a: any) => a.id).filter(Boolean),
      albumArt: track.album?.images?.[0]?.url || '',
      spotifyUrl: track.external_urls?.spotify || '',
      durationMs: track.duration_ms || 0,
      popularity: typeof track.popularity === 'number' ? track.popularity : 0,
      explicit: !!track.explicit,
      releaseYear: Number.isFinite(releaseYear) ? releaseYear : null,
      addedAt: item.added_at || null,
    };
  }

  private aggregate(tracks: TrackSummary[], artists: any[]): PlaylistAnalysis {
    const totalTracks = tracks.length;
    const totalDurationMs = tracks.reduce((sum, t) => sum + t.durationMs, 0);
    const avgPopularity =
      totalTracks > 0
        ? Math.round(tracks.reduce((sum, t) => sum + t.popularity, 0) / totalTracks)
        : 0;
    const explicitCount = tracks.filter((t) => t.explicit).length;

    // Top artists by appearance count
    const artistCountMap = new Map<string, ArtistCount>();
    const artistMetaMap = new Map<string, any>();
    artists.forEach((a) => artistMetaMap.set(a.id, a));

    tracks.forEach((t) => {
      t.artistIds.forEach((id) => {
        const existing = artistCountMap.get(id);
        const meta = artistMetaMap.get(id);
        if (existing) {
          existing.count++;
        } else {
          artistCountMap.set(id, {
            id,
            name: meta?.name || id,
            count: 1,
          });
        }
      });
    });

    const topArtists = Array.from(artistCountMap.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Genre distribution from artist metadata
    const genreCountMap = new Map<string, number>();
    artists.forEach((a) => {
      const appearances = artistCountMap.get(a.id)?.count || 0;
      (a.genres || []).forEach((g: string) => {
        genreCountMap.set(g, (genreCountMap.get(g) || 0) + appearances);
      });
    });

    const topGenres = Array.from(genreCountMap.entries())
      .map(([genre, count]) => ({ genre, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Decade distribution
    const decadeCountMap = new Map<string, number>();
    tracks.forEach((t) => {
      if (t.releaseYear == null) return;
      const decade = `${Math.floor(t.releaseYear / 10) * 10}s`;
      decadeCountMap.set(decade, (decadeCountMap.get(decade) || 0) + 1);
    });

    const decades = Array.from(decadeCountMap.entries())
      .map(([decade, count]) => ({ decade, count }))
      .sort((a, b) => a.decade.localeCompare(b.decade));

    return {
      totalTracks,
      totalDurationMs,
      avgPopularity,
      explicitCount,
      uniqueArtistCount: artistCountMap.size,
      topArtists,
      topGenres,
      decades,
      tracks,
    };
  }

  private fetchArtists(artistIds: string[]): Observable<any[]> {
    if (artistIds.length === 0) return of([]);
    const batches: string[][] = [];
    for (let i = 0; i < artistIds.length; i += 50) {
      batches.push(artistIds.slice(i, i + 50));
    }
    const requests = batches.map((batch) =>
      this.http
        .get<{ artists: any[] }>(`${this.spotifyBase}/artists?ids=${batch.join(',')}`, {
          headers: this.getHeaders(),
        })
        .pipe(
          map((res) => res.artists || []),
          catchError(() => of([] as any[]))
        )
    );
    return forkJoin(requests).pipe(map((results) => results.flat()));
  }

  private fetchAllPlaylistTracks(playlistId: string): Observable<any[]> {
    return this.playlistService.getPlaylistTracks(playlistId, 50, 0).pipe(
      switchMap((res) => {
        const items = res.items || [];
        const total = res.total || 0;

        if (total <= 50) return of(items);

        const requests: Observable<any>[] = [of(res)];
        for (let offset = 50; offset < total; offset += 50) {
          requests.push(this.playlistService.getPlaylistTracks(playlistId, 50, offset));
        }

        return forkJoin(requests).pipe(
          map((responses) => responses.flatMap((r) => r.items || []))
        );
      }),
      catchError(() => of([]))
    );
  }
}
