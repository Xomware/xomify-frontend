import { Injectable } from '@angular/core';
import { Observable, forkJoin } from 'rxjs';
import { map } from 'rxjs/operators';
import { ListeningHistoryService, RecentlyPlayedItem } from './listening-history.service';
import { SongService } from './song.service';

export interface WeeklySnapshot {
  weekKey: string; // e.g., "2026-W09"
  weekLabel: string; // e.g., "Feb 23 – Mar 1, 2026"
  savedAt: string;
  topSongs: { id: string; name: string; artists: string[]; albumArt: string; playCount: number }[];
  topArtist: { name: string; imageUrl: string; playCount: number } | null;
  totalMinutes: number;
  topGenre: string;
  listeningStreak: number;
  uniqueTracks: number;
}

const AVG_TRACK_MS = 3.5 * 60 * 1000;
const STORAGE_KEY = 'xomify_weekly_wrapped';

@Injectable({
  providedIn: 'root',
})
export class WeeklyWrappedService {
  constructor(
    private historyService: ListeningHistoryService,
  ) {}

  /**
   * Build a weekly snapshot from the user's recently played items.
   */
  buildCurrentWeekSnapshot(): Observable<WeeklySnapshot> {
    return this.historyService.getRecentlyPlayed().pipe(
      map((response) => this.aggregate(response.items))
    );
  }

  private aggregate(items: RecentlyPlayedItem[]): WeeklySnapshot {
    const now = new Date();
    const weekStart = this.getWeekStart(now);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);

    const weekKey = this.getISOWeekKey(now);
    const weekLabel = this.formatDateRange(weekStart, weekEnd);

    // Filter to this week's items
    const weekItems = items.filter(item => {
      const d = new Date(item.played_at);
      return d >= weekStart && d <= new Date(weekEnd.getTime() + 24 * 60 * 60 * 1000);
    });

    // Count plays per track
    const trackPlays = new Map<string, { name: string; artists: string[]; albumArt: string; count: number }>();
    const artistPlays = new Map<string, { name: string; count: number }>();
    const playDays = new Set<string>();

    for (const item of weekItems) {
      const t = item.track;
      if (!t?.id) continue;

      const existing = trackPlays.get(t.id);
      if (existing) {
        existing.count++;
      } else {
        trackPlays.set(t.id, {
          name: t.name,
          artists: (t.artists || []).map(a => a.name),
          albumArt: t.album?.images?.[0]?.url || '',
          count: 1,
        });
      }

      for (const artist of t.artists || []) {
        const a = artistPlays.get(artist.name);
        if (a) a.count++;
        else artistPlays.set(artist.name, { name: artist.name, count: 1 });
      }

      const dayStr = new Date(item.played_at).toISOString().slice(0, 10);
      playDays.add(dayStr);
    }

    // Top 3 songs
    const topSongs = Array.from(trackPlays.entries())
      .map(([id, data]) => ({ id, ...data, playCount: data.count }))
      .sort((a, b) => b.playCount - a.playCount)
      .slice(0, 3);

    // Top artist
    const sortedArtists = Array.from(artistPlays.values()).sort((a, b) => b.count - a.count);
    const topArtist = sortedArtists.length > 0
      ? { name: sortedArtists[0].name, imageUrl: '', playCount: sortedArtists[0].count }
      : null;

    // Streak
    const streak = this.computeStreak(playDays);

    return {
      weekKey,
      weekLabel,
      savedAt: new Date().toISOString(),
      topSongs,
      topArtist,
      totalMinutes: Math.round((weekItems.length * AVG_TRACK_MS) / 60000),
      topGenre: '—', // Would need top artists endpoint for genres
      listeningStreak: streak,
      uniqueTracks: trackPlays.size,
    };
  }

  private computeStreak(playDays: Set<string>): number {
    if (playDays.size === 0) return 0;
    const sorted = Array.from(playDays).sort().reverse();
    let streak = 1;
    for (let i = 1; i < sorted.length; i++) {
      const prev = new Date(sorted[i - 1] + 'T00:00:00');
      prev.setDate(prev.getDate() - 1);
      if (sorted[i] === prev.toISOString().slice(0, 10)) {
        streak++;
      } else break;
    }
    return streak;
  }

  // ─── localStorage History ─────────────────────

  saveSnapshot(snapshot: WeeklySnapshot): void {
    const history = this.getHistory();
    const idx = history.findIndex(s => s.weekKey === snapshot.weekKey);
    if (idx >= 0) history[idx] = snapshot;
    else history.unshift(snapshot);
    // Keep max 12 weeks
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history.slice(0, 12)));
  }

  getHistory(): WeeklySnapshot[] {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    } catch {
      return [];
    }
  }

  shouldAutoSave(): boolean {
    const history = this.getHistory();
    const currentWeek = this.getISOWeekKey(new Date());
    return !history.some(s => s.weekKey === currentWeek);
  }

  getMinutesDelta(current: WeeklySnapshot): { delta: number; percent: number } | null {
    const history = this.getHistory();
    const prev = history.find(s => s.weekKey !== current.weekKey);
    if (!prev || prev.totalMinutes === 0) return null;
    const delta = current.totalMinutes - prev.totalMinutes;
    const percent = Math.round((delta / prev.totalMinutes) * 100);
    return { delta, percent };
  }

  // ─── Helpers ──────────────────────────────────

  private getWeekStart(date: Date): Date {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday start
    d.setDate(diff);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  private getISOWeekKey(date: Date): string {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
    const week1 = new Date(d.getFullYear(), 0, 4);
    const weekNum = 1 + Math.round(((d.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
    return `${d.getFullYear()}-W${weekNum.toString().padStart(2, '0')}`;
  }

  private formatDateRange(start: Date, end: Date): string {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const s = `${months[start.getMonth()]} ${start.getDate()}`;
    const e = `${months[end.getMonth()]} ${end.getDate()}, ${end.getFullYear()}`;
    return `${s} – ${e}`;
  }
}
