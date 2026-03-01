import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { AuthService } from './auth.service';

export type MoodType = 'Happy' | 'Chill' | 'Energetic' | 'Melancholic' | 'Focus';

export interface MoodPreset {
  name: MoodType;
  emoji: string;
  description: string;
  params: { [key: string]: number };
}

export const MOOD_PRESETS: MoodPreset[] = [
  {
    name: 'Happy',
    emoji: '🌞',
    description: 'Upbeat and joyful vibes',
    params: { target_valence: 0.8, target_energy: 0.7 },
  },
  {
    name: 'Chill',
    emoji: '🌊',
    description: 'Relaxed and mellow sounds',
    params: { target_valence: 0.5, target_energy: 0.3, target_acousticness: 0.6 },
  },
  {
    name: 'Energetic',
    emoji: '⚡',
    description: 'High energy, pump-up tracks',
    params: { target_energy: 0.9, target_danceability: 0.8 },
  },
  {
    name: 'Melancholic',
    emoji: '🌧️',
    description: 'Introspective and emotional',
    params: { target_valence: 0.2, target_energy: 0.3 },
  },
  {
    name: 'Focus',
    emoji: '🧘',
    description: 'Instrumental, distraction-free',
    params: {
      target_instrumentalness: 0.5,
      target_energy: 0.5,
      target_speechiness: 0.05,
    },
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

@Injectable({
  providedIn: 'root',
})
export class MoodRecommendationsService {
  private readonly spotifyBase = 'https://api.spotify.com/v1';

  constructor(private http: HttpClient, private authService: AuthService) {}

  private getHeaders(): HttpHeaders {
    return new HttpHeaders({
      Authorization: `Bearer ${this.authService.getAccessToken()}`,
    });
  }

  getUserTopTrackIds(): Observable<string[]> {
    return this.http
      .get<{ items: { id: string }[] }>(
        `${this.spotifyBase}/me/top/tracks?limit=5&time_range=short_term`,
        { headers: this.getHeaders() }
      )
      .pipe(
        map((res) => res.items.map((t) => t.id)),
        catchError(() => of([]))
      );
  }

  getRecommendations(mood: MoodPreset, seedTrackIds: string[]): Observable<RecommendedTrack[]> {
    const ids = seedTrackIds.slice(0, 5).join(',');
    let params = new HttpParams()
      .set('seed_tracks', ids)
      .set('limit', '30');

    for (const [key, value] of Object.entries(mood.params)) {
      params = params.set(key, value.toString());
    }

    return this.http
      .get<{ tracks: RecommendedTrack[] }>(`${this.spotifyBase}/recommendations`, {
        headers: this.getHeaders(),
        params,
      })
      .pipe(
        map((res) => res.tracks || []),
        catchError((err) => {
          console.error('[MoodRecs] Error fetching recommendations:', err);
          throw err;
        })
      );
  }

  formatDuration(ms: number): string {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }
}
