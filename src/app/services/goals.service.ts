import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { map } from 'rxjs/operators';
import { ListeningHistoryService, RecentlyPlayedItem } from './listening-history.service';

export type GoalMetric =
  | 'minutes_listened'
  | 'new_artists'
  | 'genres_explored'
  | 'songs_from_top_artist'
  | 'unique_tracks';

export interface Goal {
  id: string;
  metric: GoalMetric;
  target: number;
  label: string;
  icon: string;
  current: number;
  completed: boolean;
}

export interface WeekHistoryEntry {
  weekStart: string; // ISO date string of Monday
  allMet: boolean;
  metCount: number;
  totalCount: number;
}

const GOALS_KEY = 'xomify_goals';
const HISTORY_KEY = 'xomify_goals_history';

const DEFAULT_GOALS: Omit<Goal, 'id' | 'current' | 'completed'>[] = [
  { metric: 'minutes_listened', target: 300, label: 'Listen for 5 hours', icon: '🎵' },
  { metric: 'new_artists', target: 3, label: 'Discover 3 new artists', icon: '🎤' },
  { metric: 'genres_explored', target: 4, label: 'Explore 4 genres', icon: '🎸' },
  { metric: 'unique_tracks', target: 50, label: '50 unique tracks', icon: '🎶' },
];

@Injectable({
  providedIn: 'root',
})
export class GoalsService {
  constructor(private listeningHistory: ListeningHistoryService) {}

  getGoals(): Observable<Goal[]> {
    const saved = this.loadGoals();
    return this.listeningHistory.getRecentlyPlayed().pipe(
      map((response) => {
        const thisWeekItems = this.getThisWeekItems(response.items);
        return saved.map((goal) => {
          const current = this.computeProgress(goal, thisWeekItems, response.items);
          return { ...goal, current, completed: current >= goal.target };
        });
      })
    );
  }

  computeProgress(
    goal: Pick<Goal, 'metric'>,
    thisWeekItems: RecentlyPlayedItem[],
    allItems: RecentlyPlayedItem[]
  ): number {
    switch (goal.metric) {
      case 'minutes_listened':
        return Math.round(
          thisWeekItems.reduce((sum, item) => sum + (item.track.duration_ms || 0), 0) / 60000
        );

      case 'new_artists': {
        const thisWeekArtists = new Set<string>();
        thisWeekItems.forEach((item) =>
          item.track.artists.forEach((a) => thisWeekArtists.add(a.id))
        );
        const olderItems = allItems.filter(
          (item) => !thisWeekItems.includes(item)
        );
        const olderArtists = new Set<string>();
        olderItems.forEach((item) =>
          item.track.artists.forEach((a) => olderArtists.add(a.id))
        );
        let count = 0;
        thisWeekArtists.forEach((id) => {
          if (!olderArtists.has(id)) count++;
        });
        return count;
      }

      case 'genres_explored': {
        // Approximate via unique artist count (genres aren't in recently-played response)
        const artists = new Set<string>();
        thisWeekItems.forEach((item) =>
          item.track.artists.forEach((a) => artists.add(a.name))
        );
        // Rough estimate: unique artists / 2 as genre proxy
        return Math.min(artists.size, Math.ceil(artists.size / 2));
      }

      case 'songs_from_top_artist': {
        const artistCounts = new Map<string, number>();
        thisWeekItems.forEach((item) => {
          const artistId = item.track.artists[0]?.id;
          if (artistId) {
            artistCounts.set(artistId, (artistCounts.get(artistId) || 0) + 1);
          }
        });
        let max = 0;
        artistCounts.forEach((count) => {
          if (count > max) max = count;
        });
        return max;
      }

      case 'unique_tracks': {
        const trackIds = new Set<string>();
        thisWeekItems.forEach((item) => trackIds.add(item.track.id));
        return trackIds.size;
      }

      default:
        return 0;
    }
  }

  saveGoals(goals: Goal[]): void {
    const toSave = goals.map(({ id, metric, target, label, icon }) => ({
      id,
      metric,
      target,
      label,
      icon,
    }));
    localStorage.setItem(GOALS_KEY, JSON.stringify(toSave));
  }

  addGoal(metric: GoalMetric, target: number, label: string, icon: string): void {
    const goals = this.loadGoals();
    goals.push({
      id: crypto.randomUUID(),
      metric,
      target,
      label,
      icon,
      current: 0,
      completed: false,
    });
    this.saveGoals(goals);
  }

  removeGoal(id: string): void {
    const goals = this.loadGoals();
    this.saveGoals(goals.filter((g) => g.id !== id));
  }

  getWeeklyStreak(): number {
    const history = this.getHistory();
    let streak = 0;
    // History is sorted newest first
    for (const entry of history) {
      if (entry.allMet) {
        streak++;
      } else {
        break;
      }
    }
    return streak;
  }

  recordWeekCompletion(allMet: boolean, metCount: number, totalCount: number): void {
    const history = this.getHistory();
    const weekStart = this.getWeekStart(new Date()).toISOString();
    // Don't duplicate
    if (history.length > 0 && history[0].weekStart === weekStart) {
      history[0] = { weekStart, allMet, metCount, totalCount };
    } else {
      history.unshift({ weekStart, allMet, metCount, totalCount });
    }
    // Keep last 52 weeks
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, 52)));
  }

  getHistory(): WeekHistoryEntry[] {
    try {
      return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
    } catch {
      return [];
    }
  }

  getMetricLabel(metric: GoalMetric, target: number): string {
    switch (metric) {
      case 'minutes_listened':
        return target >= 60 ? `${Math.round(target / 60)} hours listening` : `${target} min listening`;
      case 'new_artists':
        return `Discover ${target} new artist${target !== 1 ? 's' : ''}`;
      case 'genres_explored':
        return `Explore ${target} genre${target !== 1 ? 's' : ''}`;
      case 'songs_from_top_artist':
        return `${target} songs from top artist`;
      case 'unique_tracks':
        return `${target} unique tracks`;
    }
  }

  getMetricIcon(metric: GoalMetric): string {
    const icons: Record<GoalMetric, string> = {
      minutes_listened: '🎵',
      new_artists: '🎤',
      genres_explored: '🎸',
      songs_from_top_artist: '⭐',
      unique_tracks: '🎶',
    };
    return icons[metric];
  }

  private loadGoals(): Goal[] {
    try {
      const raw = localStorage.getItem(GOALS_KEY);
      if (!raw) {
        // Initialize with defaults
        const defaults: Goal[] = DEFAULT_GOALS.map((g) => ({
          ...g,
          id: crypto.randomUUID(),
          current: 0,
          completed: false,
        }));
        this.saveGoals(defaults);
        return defaults;
      }
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }

  private getThisWeekItems(items: RecentlyPlayedItem[]): RecentlyPlayedItem[] {
    const weekStart = this.getWeekStart(new Date());
    return items.filter(
      (item) => new Date(item.played_at).getTime() >= weekStart.getTime()
    );
  }

  private getWeekStart(date: Date): Date {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday
    d.setDate(diff);
    d.setHours(0, 0, 0, 0);
    return d;
  }
}
