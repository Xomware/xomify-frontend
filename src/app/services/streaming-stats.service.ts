import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ListeningHistoryService, RecentlyPlayedItem } from './listening-history.service';

export interface StreamingStats {
  totalPlays: number;
  estimatedHoursMs: number;
  uniqueTracks: number;
  uniqueArtists: number;
  playsByDayOfWeek: number[]; // Sun=0..Sat=6
  playsByHourOfDay: number[]; // 0..23
  topListeningDay: string;
  currentStreak: number; // consecutive days with plays
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const AVG_TRACK_MS = 3.5 * 60 * 1000; // 3.5 minutes in ms

@Injectable({
  providedIn: 'root',
})
export class StreamingStatsService {
  constructor(private historyService: ListeningHistoryService) {}

  getStreamingStats(): Observable<StreamingStats> {
    return this.historyService.getRecentlyPlayed().pipe(
      map((response) => this.aggregate(response.items))
    );
  }

  private aggregate(items: RecentlyPlayedItem[]): StreamingStats {
    if (!items || items.length === 0) {
      return {
        totalPlays: 0,
        estimatedHoursMs: 0,
        uniqueTracks: 0,
        uniqueArtists: 0,
        playsByDayOfWeek: new Array(7).fill(0),
        playsByHourOfDay: new Array(24).fill(0),
        topListeningDay: 'N/A',
        currentStreak: 0,
      };
    }

    const trackIds = new Set<string>();
    const artistIds = new Set<string>();
    const playsByDayOfWeek = new Array(7).fill(0);
    const playsByHourOfDay = new Array(24).fill(0);
    const playDateStrings = new Set<string>();

    for (const item of items) {
      if (item.track?.id) trackIds.add(item.track.id);
      for (const artist of item.track?.artists || []) {
        if (artist.id) artistIds.add(artist.id);
      }

      const date = new Date(item.played_at);
      playsByDayOfWeek[date.getDay()]++;
      playsByHourOfDay[date.getHours()]++;

      // Day string for streak: YYYY-MM-DD
      const dayStr = date.toISOString().slice(0, 10);
      playDateStrings.add(dayStr);
    }

    // Top listening day
    const maxDayCount = Math.max(...playsByDayOfWeek);
    const topDayIndex = playsByDayOfWeek.indexOf(maxDayCount);
    const topListeningDay = DAY_NAMES[topDayIndex];

    // Current streak (consecutive days ending today or yesterday)
    const streak = this.computeStreak(playDateStrings);

    return {
      totalPlays: items.length,
      estimatedHoursMs: items.length * AVG_TRACK_MS,
      uniqueTracks: trackIds.size,
      uniqueArtists: artistIds.size,
      playsByDayOfWeek,
      playsByHourOfDay,
      topListeningDay,
      currentStreak: streak,
    };
  }

  private computeStreak(playDays: Set<string>): number {
    if (playDays.size === 0) return 0;

    const sortedDays = Array.from(playDays).sort().reverse(); // newest first
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().slice(0, 10);

    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().slice(0, 10);

    // Start from today or yesterday
    let startStr = sortedDays[0];
    if (startStr !== todayStr && startStr !== yesterdayStr) return 0;

    let streak = 1;
    let current = new Date(startStr + 'T00:00:00');

    for (let i = 1; i < sortedDays.length; i++) {
      const prev = new Date(current);
      prev.setDate(current.getDate() - 1);
      const prevStr = prev.toISOString().slice(0, 10);

      if (sortedDays[i] === prevStr) {
        streak++;
        current = prev;
      } else {
        break;
      }
    }

    return streak;
  }

  formatEstimatedHours(ms: number): string {
    const totalMinutes = Math.floor(ms / 60000);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  }
}
