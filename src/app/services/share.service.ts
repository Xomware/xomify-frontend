import { Injectable } from '@angular/core';
import { Observable, forkJoin } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { of } from 'rxjs';
import { SongService } from './song.service';
import { ArtistService } from './artist.service';

export interface ShareableStats {
  topSongs: any[];
  topArtists: any[];
}

@Injectable({
  providedIn: 'root',
})
export class ShareService {
  constructor(
    private songService: SongService,
    private artistService: ArtistService
  ) {}

  async copyToClipboard(text: string): Promise<boolean> {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
      // Fallback
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      const success = document.execCommand('copy');
      document.body.removeChild(textarea);
      return success;
    } catch {
      return false;
    }
  }

  sharePlaylist(playlist: any): void {
    const url = playlist?.external_urls?.spotify || '';
    const title = playlist?.name || 'My Playlist';

    if (navigator.share) {
      navigator.share({ title, url }).catch(() => {
        this.copyToClipboard(url);
      });
    } else {
      this.copyToClipboard(url);
    }
  }

  shareStats(stats: ShareableStats): string {
    const songs = stats.topSongs
      .slice(0, 5)
      .map((s, i) => `${i + 1}. ${s.name} — ${(s.artists || []).map((a: any) => a.name).join(', ')}`)
      .join('\n');

    const artists = stats.topArtists
      .slice(0, 5)
      .map((a, i) => `${i + 1}. ${a.name}`)
      .join('\n');

    return `🎵 My Top Songs (Xomify):\n${songs}\n\n🎤 My Top Artists:\n${artists}\n\nDiscover yours at xomify!`;
  }

  getTopItems(): Observable<ShareableStats> {
    return forkJoin({
      songs: this.songService.getTopTracks('short_term', 5).pipe(
        map((res: any) => res?.items || []),
        catchError(() => of([]))
      ),
      artists: this.artistService.getTopArtists('short_term', 5).pipe(
        map((res: any) => res?.items || []),
        catchError(() => of([]))
      ),
    }).pipe(
      map(({ songs, artists }) => ({ topSongs: songs, topArtists: artists }))
    );
  }
}
