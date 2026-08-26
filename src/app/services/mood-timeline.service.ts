import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, of, forkJoin } from 'rxjs';
import { map, catchError, switchMap, tap } from 'rxjs/operators';
import { AuthService } from './auth.service';
import { ListeningHistoryService, RecentlyPlayedItem } from './listening-history.service';

export interface HourlyMood {
  /**
   * True when energy/valence are ESTIMATED from the hour of day rather than
   * measured from the tracks.
   *
   * Spotify deprecated `/audio-features` in November 2024, and it returns 403
   * for newer app registrations. When that happens this service falls back to
   * a fixed time-of-day curve — which is a reasonable stand-in, but it is not
   * the user's data, and the UI must say so rather than presenting a
   * hard-coded sine wave as "your listening mood".
   */
  isEstimated?: boolean;
  hour: number;
  avgEnergy: number;
  avgValence: number;
  avgDanceability: number;
  trackCount: number;
  topTracks: { id: string; name: string; artist: string; albumArt: string }[];
}

export type MoodQuadrant = 'Euphoric' | 'Intense' | 'Peaceful' | 'Melancholy';

export interface MoodSummary {
  /** True when the summary is derived from estimated points — see HourlyMood. */
  isEstimated?: boolean;
  peakEnergyHour: number;
  mostPositiveHour: number;
  overallMood: MoodQuadrant;
  chronotype: 'Night Owl' | 'Morning Person' | 'Balanced';
  avgEnergy: number;
  avgValence: number;
}

export type TimelineMode = 'today' | 'yesterday' | 'weekly';

@Injectable({
  providedIn: 'root',
})
export class MoodTimelineService {
  private readonly spotifyBase = 'https://api.spotify.com/v1';
  private cache = new Map<string, { data: HourlyMood[]; timestamp: number }>();
  private readonly cacheTTL = 30 * 60 * 1000;

  constructor(
    private http: HttpClient,
    private authService: AuthService,
    private historyService: ListeningHistoryService
  ) {}

  private getHeaders(): HttpHeaders {
    return new HttpHeaders({
      Authorization: `Bearer ${this.authService.getAccessToken()}`,
    });
  }

  getMoodTimeline(mode: TimelineMode): Observable<HourlyMood[]> {
    const cacheKey = mode;
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      return of(cached.data);
    }

    return this.historyService.getRecentlyPlayed().pipe(
      map((response) => this.filterByMode(response.items, mode)),
      switchMap((items) => {
        if (items.length === 0) {
          return of(this.generateEstimatedData());
        }
        return this.fetchAudioFeatures(items).pipe(
          map((features) => this.groupByHour(items, features, mode === 'weekly')),
          catchError(() => of(this.groupByHourWithoutFeatures(items, mode === 'weekly')))
        );
      }),
      tap((data) => this.cache.set(cacheKey, { data, timestamp: Date.now() })),
      catchError(() => of(this.generateEstimatedData()))
    );
  }

  private filterByMode(items: RecentlyPlayedItem[], mode: TimelineMode): RecentlyPlayedItem[] {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterdayStart = new Date(todayStart);
    yesterdayStart.setDate(yesterdayStart.getDate() - 1);
    const weekAgoStart = new Date(todayStart);
    weekAgoStart.setDate(weekAgoStart.getDate() - 7);

    return items.filter((item) => {
      const playedAt = new Date(item.played_at);
      switch (mode) {
        case 'today':
          return playedAt >= todayStart;
        case 'yesterday':
          return playedAt >= yesterdayStart && playedAt < todayStart;
        case 'weekly':
          return playedAt >= weekAgoStart;
      }
    });
  }

  private fetchAudioFeatures(items: RecentlyPlayedItem[]): Observable<Map<string, any>> {
    const uniqueIds = [...new Set(items.map((i) => i.track.id))];
    // Batch in groups of 100
    const batches: string[][] = [];
    for (let i = 0; i < uniqueIds.length; i += 100) {
      batches.push(uniqueIds.slice(i, i + 100));
    }

    return forkJoin(
      batches.map((batch) =>
        this.http
          .get<any>(`${this.spotifyBase}/audio-features?ids=${batch.join(',')}`, {
            headers: this.getHeaders(),
          })
          .pipe(catchError(() => of({ audio_features: [] })))
      )
    ).pipe(
      map((responses) => {
        const featureMap = new Map<string, any>();
        for (const resp of responses) {
          if (resp.audio_features) {
            for (const f of resp.audio_features) {
              if (f) featureMap.set(f.id, f);
            }
          }
        }
        return featureMap;
      })
    );
  }

  private groupByHour(
    items: RecentlyPlayedItem[],
    features: Map<string, any>,
    isWeekly: boolean
  ): HourlyMood[] {
    const hourData: Map<number, { energies: number[]; valences: number[]; dances: number[]; tracks: RecentlyPlayedItem[]; days: Set<string> }> = new Map();

    for (let h = 0; h < 24; h++) {
      hourData.set(h, { energies: [], valences: [], dances: [], tracks: [], days: new Set() });
    }

    for (const item of items) {
      const playedAt = new Date(item.played_at);
      const hour = playedAt.getHours();
      const dayKey = playedAt.toDateString();
      const data = hourData.get(hour)!;
      const feat = features.get(item.track.id);

      if (feat) {
        data.energies.push(feat.energy);
        data.valences.push(feat.valence);
        data.dances.push(feat.danceability);
      }
      data.tracks.push(item);
      data.days.add(dayKey);
    }

    return Array.from(hourData.entries()).map(([hour, data]) => {
      const avg = (arr: number[]) => (arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);
      const topTracks = data.tracks
        .slice(0, 3)
        .map((t) => ({
          id: t.track.id,
          name: t.track.name,
          artist: t.track.artists.map((a) => a.name).join(', '),
          albumArt: t.track.album.images?.[0]?.url || '',
        }));

      return {
        hour,
        avgEnergy: avg(data.energies),
        avgValence: avg(data.valences),
        avgDanceability: avg(data.dances),
        trackCount: data.tracks.length,
        topTracks,
      };
    });
  }

  private groupByHourWithoutFeatures(items: RecentlyPlayedItem[], isWeekly: boolean): HourlyMood[] {
    // Without audio features, use mock energy/valence based on time of day
    const hourData: Map<number, RecentlyPlayedItem[]> = new Map();
    for (let h = 0; h < 24; h++) hourData.set(h, []);
    for (const item of items) {
      const hour = new Date(item.played_at).getHours();
      hourData.get(hour)!.push(item);
    }

    return Array.from(hourData.entries()).map(([hour, tracks]) => ({
      hour,
      avgEnergy: this.estimatedEnergyForHour(hour),
      avgValence: this.estimatedValenceForHour(hour),
      avgDanceability:
        (this.estimatedEnergyForHour(hour) + this.estimatedValenceForHour(hour)) / 2,
      isEstimated: true,
      trackCount: tracks.length,
      topTracks: tracks.slice(0, 3).map((t) => ({
        id: t.track.id,
        name: t.track.name,
        artist: t.track.artists.map((a) => a.name).join(', '),
        albumArt: t.track.album.images?.[0]?.url || '',
      })),
    }));
  }

  /** Fully estimated 24-hour curve, used when there is nothing to measure. */
  generateEstimatedData(): HourlyMood[] {
    return Array.from({ length: 24 }, (_, hour) => ({
      hour,
      avgEnergy: this.estimatedEnergyForHour(hour),
      avgValence: this.estimatedValenceForHour(hour),
      avgDanceability:
        (this.estimatedEnergyForHour(hour) + this.estimatedValenceForHour(hour)) / 2,
      isEstimated: true,
      // Zero, not a random number. The previous version invented a play count
      // between 0 and 4 per hour, which rendered as a real-looking histogram
      // of listening that never happened.
      trackCount: 0,
      topTracks: [],
    }));
  }

  /**
   * A generic listening-energy curve by hour — NOT this user's data.
   *
   * Only reached when `/audio-features` is unavailable. Any point built from
   * this carries `isEstimated: true` so the UI can label it.
   */
  private estimatedEnergyForHour(hour: number): number {
    // Natural energy curve: low at night, peaks afternoon
    const curves: Record<number, number> = {
      0: 0.2, 1: 0.15, 2: 0.1, 3: 0.08, 4: 0.1, 5: 0.15,
      6: 0.25, 7: 0.4, 8: 0.55, 9: 0.65, 10: 0.72, 11: 0.78,
      12: 0.75, 13: 0.7, 14: 0.82, 15: 0.85, 16: 0.8, 17: 0.75,
      18: 0.68, 19: 0.6, 20: 0.55, 21: 0.45, 22: 0.35, 23: 0.25,
    };
    return curves[hour] ?? 0.5;
  }

  private estimatedValenceForHour(hour: number): number {
    const curves: Record<number, number> = {
      0: 0.3, 1: 0.25, 2: 0.2, 3: 0.18, 4: 0.2, 5: 0.25,
      6: 0.35, 7: 0.5, 8: 0.6, 9: 0.65, 10: 0.7, 11: 0.72,
      12: 0.7, 13: 0.68, 14: 0.71, 15: 0.75, 16: 0.78, 17: 0.72,
      18: 0.65, 19: 0.58, 20: 0.5, 21: 0.42, 22: 0.35, 23: 0.3,
    };
    return curves[hour] ?? 0.5;
  }

  getSummary(data: HourlyMood[]): MoodSummary {
    const estimated = data.some((point) => point.isEstimated);
    const withTracks = data.filter((d) => d.trackCount > 0 || d.avgEnergy > 0);
    if (withTracks.length === 0) {
      return {
      isEstimated: estimated,
        peakEnergyHour: 14,
        mostPositiveHour: 16,
        overallMood: 'Euphoric',
        chronotype: 'Balanced',
        avgEnergy: 0.5,
        avgValence: 0.5,
      };
    }

    const peakEnergy = data.reduce((max, d) => (d.avgEnergy > max.avgEnergy ? d : max), data[0]);
    const peakValence = data.reduce((max, d) => (d.avgValence > max.avgValence ? d : max), data[0]);

    const totalEnergy = withTracks.reduce((s, d) => s + d.avgEnergy, 0) / withTracks.length;
    const totalValence = withTracks.reduce((s, d) => s + d.avgValence, 0) / withTracks.length;

    const morningEnergy = data.filter((d) => d.hour >= 6 && d.hour < 12).reduce((s, d) => s + d.avgEnergy, 0) / 6;
    const eveningEnergy = data.filter((d) => d.hour >= 18 && d.hour < 24).reduce((s, d) => s + d.avgEnergy, 0) / 6;

    let chronotype: 'Night Owl' | 'Morning Person' | 'Balanced';
    if (eveningEnergy - morningEnergy > 0.1) chronotype = 'Night Owl';
    else if (morningEnergy - eveningEnergy > 0.1) chronotype = 'Morning Person';
    else chronotype = 'Balanced';

    return {
      peakEnergyHour: peakEnergy.hour,
      mostPositiveHour: peakValence.hour,
      overallMood: this.classifyMood(totalEnergy, totalValence),
      chronotype,
      avgEnergy: totalEnergy,
      avgValence: totalValence,
    };
  }

  classifyMood(energy: number, valence: number): MoodQuadrant {
    if (energy >= 0.5 && valence >= 0.5) return 'Euphoric';
    if (energy >= 0.5 && valence < 0.5) return 'Intense';
    if (energy < 0.5 && valence >= 0.5) return 'Peaceful';
    return 'Melancholy';
  }

  formatHour(hour: number): string {
    if (hour === 0) return '12am';
    if (hour < 12) return `${hour}am`;
    if (hour === 12) return '12pm';
    return `${hour - 12}pm`;
  }
}
