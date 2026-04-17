import { Injectable } from '@angular/core';
import { ArtistService } from './artist.service';
import { SongService } from './song.service';
import { GenresService } from './genre.service';
import { UserService } from './user.service';
import { Observable, forkJoin, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';

export interface RankedArtist {
  name: string;
  rank: number;
  imageUrl?: string;
}

export interface RankedTrack {
  name: string;
  artist: string;
  rank: number;
}

export interface ListeningSnapshot {
  username: string;
  generatedAt: string;
  topArtists: RankedArtist[];
  topTracks: RankedTrack[];
  topGenres: string[];
}

@Injectable({
  providedIn: 'root',
})
export class ComparisonService {
  constructor(
    private artistService: ArtistService,
    private songService: SongService,
    private genreService: GenresService,
    private userService: UserService
  ) {}

  generateShareableSnapshot(): Observable<{ uuid: string; encoded: string }> {
    return forkJoin({
      artists: this.artistService.getTopArtists('short_term', 10).pipe(
        map((res: any) => res.items || []),
        catchError(() => of([]))
      ),
      tracks: this.songService.getTopTracks('short_term', 10).pipe(
        map((res: any) => res.items || []),
        catchError(() => of([]))
      ),
    }).pipe(
      map(({ artists, tracks }) => {
        const topArtists: RankedArtist[] = artists.map((a: any, i: number) => ({
          name: a.name,
          rank: i + 1,
          imageUrl: a.images?.[0]?.url,
        }));

        const topTracks: RankedTrack[] = tracks.map((t: any, i: number) => ({
          name: t.name,
          artist: t.artists?.[0]?.name || 'Unknown',
          rank: i + 1,
        }));

        const genreSet = new Set<string>();
        artists.forEach((a: any) => {
          (a.genres || []).forEach((g: string) => genreSet.add(g));
        });

        const snapshot: ListeningSnapshot = {
          username: this.userService.userName || 'Anonymous',
          generatedAt: new Date().toISOString(),
          topArtists,
          topTracks,
          topGenres: Array.from(genreSet).slice(0, 10),
        };

        const uuid = this.generateUUID();
        const encoded = btoa(encodeURIComponent(JSON.stringify(snapshot)));

        localStorage.setItem(`xomify-snap-${uuid}`, encoded);

        return { uuid, encoded };
      })
    );
  }

  decodeSnapshot(encoded: string): ListeningSnapshot | null {
    try {
      return JSON.parse(decodeURIComponent(atob(encoded)));
    } catch {
      return null;
    }
  }

  loadSnapshot(uuid: string): ListeningSnapshot | null {
    const encoded = localStorage.getItem(`xomify-snap-${uuid}`);
    if (!encoded) return null;
    return this.decodeSnapshot(encoded);
  }

  /**
   * Jaccard similarity on case-insensitive name sets.
   * Deterministic — same inputs always produce the same score.
   */
  calculateCompatibility(
    myArtists: { name: string }[],
    friendArtists: { name: string }[]
  ): number {
    const mySet = new Set(myArtists.map((a) => a.name.toLowerCase()));
    const friendSet = new Set(friendArtists.map((a) => a.name.toLowerCase()));
    const intersection = new Set([...mySet].filter((x) => friendSet.has(x)));
    const union = new Set([...mySet, ...friendSet]);
    if (union.size === 0) return 0;
    return Math.round((intersection.size / union.size) * 100);
  }

  getSharedItems(myList: string[], friendList: string[]): string[] {
    const friendSet = new Set(friendList.map((s) => s.toLowerCase()));
    return myList.filter((item) => friendSet.has(item.toLowerCase()));
  }

  private generateUUID(): string {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
      return (crypto as any).randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }
}
