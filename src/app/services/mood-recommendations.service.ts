import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, forkJoin, of } from 'rxjs';
import { map, switchMap, catchError } from 'rxjs/operators';
import { AuthService } from './auth.service';

export type MoodType = 'Happy' | 'Chill' | 'Hype' | 'Focus' | 'Sad' | 'Party' | 'Workout';

export interface MoodPreset {
  name: MoodType;
  /** `app-icon` name — see `components/icon/icon.component.html`. */
  icon: string;
  description: string;
  genreKeywords: string[]; // substring matches against artist.genres
}

export const MOOD_PRESETS: MoodPreset[] = [
  {
    name: 'Happy',
    icon: 'sun',
    description: 'Upbeat and joyful',
    genreKeywords: ['pop', 'dance', 'disco', 'funk', 'indie pop', 'bubblegum'],
  },
  {
    name: 'Chill',
    icon: 'wave',
    description: 'Relaxed and mellow',
    genreKeywords: ['chill', 'lo-fi', 'lofi', 'ambient', 'acoustic', 'bedroom', 'singer-songwriter'],
  },
  {
    name: 'Hype',
    icon: 'bolt',
    description: 'High-energy bangers',
    genreKeywords: ['edm', 'trap', 'drill', 'electronic', 'house', 'dubstep', 'hip hop', 'rap'],
  },
  {
    name: 'Focus',
    icon: 'leaf',
    description: 'Instrumental, clean',
    genreKeywords: ['ambient', 'classical', 'post-rock', 'instrumental', 'minimal', 'study'],
  },
  {
    name: 'Sad',
    icon: 'droplet',
    description: 'Introspective and emotional',
    genreKeywords: ['emo', 'indie folk', 'sad', 'melancholy', 'slowcore', 'singer-songwriter', 'ballad'],
  },
  {
    name: 'Party',
    icon: 'sparkle',
    description: 'Loud, fun, danceable',
    genreKeywords: ['dance', 'house', 'pop', 'reggaeton', 'latin', 'edm', 'disco', 'funk'],
  },
  {
    name: 'Workout',
    icon: 'flame',
    description: 'Drive-through-a-wall energy',
    genreKeywords: ['hip hop', 'rap', 'edm', 'trap', 'punk', 'metal', 'rock', 'drill'],
  },
];

export interface RecommendedTrack {
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
  preview_url: string | null;
}

interface SpotifyArtist {
  id: string;
  name: string;
  genres: string[];
}

@Injectable({
  providedIn: 'root',
})
export class MoodRecommendationsService {
  private readonly spotifyBase = 'https://api.spotify.com/v1';
  private readonly TARGET_TRACKS = 30;
  private readonly MAX_ARTISTS_TO_SAMPLE = 12;

  constructor(private http: HttpClient, private authService: AuthService) {}

  private getHeaders(): HttpHeaders {
    return new HttpHeaders({
      Authorization: `Bearer ${this.authService.getAccessToken()}`,
    });
  }

  /**
   * Build a mood-tagged set of tracks by picking from the user's top artists
   * whose genres match the mood, then pulling each matched artist's top tracks.
   * Uses only non-deprecated Spotify endpoints.
   */
  getMoodTracks(mood: MoodPreset): Observable<RecommendedTrack[]> {
    return this.getUserTopArtists().pipe(
      switchMap((artists) => {
        const matched = this.filterArtistsByMood(artists, mood);
        if (matched.length === 0) {
          return of([] as RecommendedTrack[]);
        }
        const sampled = this.shuffle(matched).slice(0, this.MAX_ARTISTS_TO_SAMPLE);
        const requests = sampled.map((a) => this.getArtistTopTracks(a.id));
        return forkJoin(requests).pipe(
          map((results) => this.dedupeShuffleSlice(results.flat()))
        );
      })
    );
  }

  private getUserTopArtists(): Observable<SpotifyArtist[]> {
    return this.http
      .get<{ items: SpotifyArtist[] }>(
        `${this.spotifyBase}/me/top/artists?limit=50&time_range=medium_term`,
        { headers: this.getHeaders() }
      )
      .pipe(
        map((res) => res.items || []),
        catchError(() => of([] as SpotifyArtist[]))
      );
  }

  private getArtistTopTracks(artistId: string): Observable<RecommendedTrack[]> {
    return this.http
      .get<{ tracks: RecommendedTrack[] }>(
        `${this.spotifyBase}/artists/${artistId}/top-tracks?market=US`,
        { headers: this.getHeaders() }
      )
      .pipe(
        map((res) => res.tracks || []),
        catchError(() => of([] as RecommendedTrack[]))
      );
  }

  private filterArtistsByMood(artists: SpotifyArtist[], mood: MoodPreset): SpotifyArtist[] {
    const needles = mood.genreKeywords.map((k) => k.toLowerCase());
    return artists.filter((a) =>
      (a.genres || []).some((g) => needles.some((n) => g.toLowerCase().includes(n)))
    );
  }

  private dedupeShuffleSlice(tracks: RecommendedTrack[]): RecommendedTrack[] {
    const seen = new Set<string>();
    const deduped: RecommendedTrack[] = [];
    for (const track of tracks) {
      if (!track?.id || seen.has(track.id)) continue;
      seen.add(track.id);
      deduped.push(track);
    }
    return this.shuffle(deduped).slice(0, this.TARGET_TRACKS);
  }

  private shuffle<T>(arr: T[]): T[] {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  formatDuration(ms: number): string {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }
}
