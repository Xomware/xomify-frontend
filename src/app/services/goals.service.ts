import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, concat, of } from 'rxjs';
import { catchError, map, switchMap, tap, toArray } from 'rxjs/operators';
import { environment } from 'src/environments/environment';
import { ListeningHistoryService, RecentlyPlayedItem } from './listening-history.service';
import { ArtistService } from './artist.service';

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
  /** `app-icon` name — see `components/icon/icon.component.html`. */
  icon: string;
  current: number;
  completed: boolean;
}

export interface WeekHistoryEntry {
  /** `YYYY-MM-DD` — the LOCAL Monday. Not an ISO timestamp; see `weekStartKey`. */
  weekStart: string;
  allMet: boolean;
  metCount: number;
  totalCount: number;
}

/** What `/goals/get` and `/goals/set` speak. The backend calls the id `goalId`
 * and stores no progress — `current`/`completed` are derived here, per request,
 * from listening history. */
interface StoredGoal {
  goalId: string;
  metric: GoalMetric;
  target: number;
  label: string;
  icon?: string;
}

interface GoalsGetResponse {
  goals: StoredGoal[];
  history: WeekHistoryEntry[];
}

/** Pre-backend storage. Read once by {@link migrateLocalStorage}, then deleted. */
const LEGACY_GOALS_KEY = 'xomify_goals';
const LEGACY_HISTORY_KEY = 'xomify_goals_history';

/** Migrating 52 weeks would be 52 sequential POSTs against a page load. The
 * streak and the history strip only ever read the recent end of the list. */
const MIGRATE_HISTORY_WEEKS = 12;

/** Spotify's per-request cap for `/artists?ids=`. */
const SPOTIFY_ARTISTS_PER_REQUEST = 50;

const DEFAULT_ICON = 'headphones';

@Injectable({
  providedIn: 'root',
})
export class GoalsService {
  private readonly baseUrl = `${environment.xomifyApiUrl}/goals`;

  /**
   * Last history seen from the server. `getWeeklyStreak()` and `getHistory()`
   * are called by the template synchronously right after `getGoals()` emits,
   * which is why this is cached rather than re-fetched — one round trip per
   * page load, and the strip can never disagree with the streak above it.
   */
  private history: WeekHistoryEntry[] = [];

  constructor(
    private http: HttpClient,
    private listeningHistory: ListeningHistoryService,
    private artistService: ArtistService
  ) {}

  getGoals(): Observable<Goal[]> {
    return this.migrateLocalStorage().pipe(
      switchMap(() => this.http.get<GoalsGetResponse>(`${this.baseUrl}/get`)),
      tap((res) => (this.history = res.history ?? [])),
      switchMap((res) =>
        this.listeningHistory.getRecentlyPlayed().pipe(
          switchMap((played) => {
            const thisWeekItems = this.getThisWeekItems(played.items);
            const goals = res.goals ?? [];
            // Only pay for the extra Spotify call when a goal actually counts
            // genres — most sets do not.
            const needsGenres = goals.some((g) => g.metric === 'genres_explored');
            return (needsGenres ? this.fetchGenres(thisWeekItems) : of(new Set<string>())).pipe(
              map((genres) =>
                goals.map((stored) => {
                  const goal = this.fromStored(stored);
                  const current = this.computeProgress(goal, thisWeekItems, played.items, genres);
                  return { ...goal, current, completed: current >= goal.target };
                })
              )
            );
          })
        )
      )
    );
  }

  computeProgress(
    goal: Pick<Goal, 'metric'>,
    thisWeekItems: RecentlyPlayedItem[],
    allItems: RecentlyPlayedItem[],
    /** Distinct genres across this week's artists — see {@link fetchGenres}.
     * Empty when no goal needs them, which is why the `genres_explored`
     * branch is the only reader. */
    genres: Set<string> = new Set()
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

      case 'genres_explored':
        // Real genres, from `/artists`. This used to be `uniqueArtists / 2` —
        // a number that was never a genre count, reported as one.
        return genres.size;

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

  /** Replace the whole set. The backend treats a goal the client stops sending
   * as a deletion, so callers pass the list they want to end up with. */
  saveGoals(goals: Goal[]): Observable<Goal[]> {
    return this.http
      .put<{ goals: StoredGoal[] }>(`${this.baseUrl}/set`, {
        goals: goals.map((g) => this.toStored(g)),
      })
      .pipe(map((res) => (res.goals ?? []).map((s) => this.fromStored(s))));
  }

  addGoal(
    metric: GoalMetric,
    target: number,
    label: string,
    icon: string
  ): Observable<Goal[]> {
    return this.getStoredGoals().pipe(
      switchMap((goals) =>
        this.saveGoals([
          ...goals,
          { id: crypto.randomUUID(), metric, target, label, icon, current: 0, completed: false },
        ])
      )
    );
  }

  removeGoal(id: string): Observable<Goal[]> {
    return this.getStoredGoals().pipe(
      switchMap((goals) => this.saveGoals(goals.filter((g) => g.id !== id)))
    );
  }

  /**
   * Weeks fully met, counting back from the most recent.
   *
   * The week in progress is SKIPPED when it is not yet met, rather than
   * breaking the count. It is recorded from the first page view on Monday, when
   * nothing has been listened to yet — treating that as a miss would zero the
   * streak every Monday and leave it there until the week was complete.
   */
  getWeeklyStreak(): number {
    const thisWeek = this.weekStartKey(new Date());
    let streak = 0;
    for (const entry of this.history) {
      if (entry.allMet) {
        streak++;
        continue;
      }
      if (entry.weekStart === thisWeek) continue;
      break;
    }
    return streak;
  }

  /**
   * Upsert this week's outcome. Returns without a request when the server
   * already holds these numbers — the page records on every load, and progress
   * only changes when the user has listened to something since.
   */
  recordWeekCompletion(
    allMet: boolean,
    metCount: number,
    totalCount: number
  ): Observable<void> {
    const weekStart = this.weekStartKey(new Date());
    const entry: WeekHistoryEntry = { weekStart, allMet, metCount, totalCount };

    const existing = this.history.find((e) => e.weekStart === weekStart);
    if (
      existing &&
      existing.allMet === allMet &&
      existing.metCount === metCount &&
      existing.totalCount === totalCount
    ) {
      return of(undefined);
    }

    this.history = [entry, ...this.history.filter((e) => e.weekStart !== weekStart)];

    return this.http.post<unknown>(`${this.baseUrl}/history-set`, entry).pipe(
      map(() => undefined),
      // A failed record must not blank the page — the goals themselves loaded
      // fine, and the next load rewrites this same week.
      catchError((err) => {
        console.error('[Goals] Failed to record week:', err);
        return of(undefined);
      })
    );
  }

  /** Newest first. Populated by the last {@link getGoals}. */
  getHistory(): WeekHistoryEntry[] {
    return this.history;
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

  /** Returns an `app-icon` name (not an emoji glyph) for the given metric. */
  getMetricIcon(metric: GoalMetric): string {
    const icons: Record<GoalMetric, string> = {
      minutes_listened: 'headphones',
      new_artists: 'mic',
      genres_explored: 'music-note',
      songs_from_top_artist: 'sparkle',
      unique_tracks: 'trending-up',
    };
    return icons[metric];
  }

  private toStored(goal: Goal): StoredGoal {
    return {
      goalId: goal.id,
      metric: goal.metric,
      target: goal.target,
      label: goal.label,
      icon: goal.icon,
    };
  }

  private fromStored(stored: StoredGoal): Goal {
    return {
      id: stored.goalId,
      metric: stored.metric,
      target: stored.target,
      label: stored.label,
      icon: stored.icon || this.getMetricIcon(stored.metric) || DEFAULT_ICON,
      current: 0,
      completed: false,
    };
  }

  /** The saved set without progress — what add/remove edit before saving back.
   * Deliberately skips the listening-history call that `getGoals` makes: an
   * edit does not need progress it is about to discard. */
  private getStoredGoals(): Observable<Goal[]> {
    return this.http
      .get<GoalsGetResponse>(`${this.baseUrl}/get`)
      .pipe(map((res) => (res.goals ?? []).map((s) => this.fromStored(s))));
  }

  /**
   * One-time lift of pre-backend goals into the account, so nobody logs in
   * after this ships and finds their targets replaced by the defaults.
   *
   * Runs before the GET, and only while the legacy keys exist — they are
   * deleted on success, which is what makes it once. A failure leaves them in
   * place to retry on the next load, and does NOT block the page: the account
   * still has the defaults to show.
   */
  private migrateLocalStorage(): Observable<void> {
    const rawGoals = localStorage.getItem(LEGACY_GOALS_KEY);
    if (!rawGoals) return of(undefined);

    let legacyGoals: Goal[] = [];
    let legacyHistory: WeekHistoryEntry[] = [];
    try {
      legacyGoals = JSON.parse(rawGoals) ?? [];
      legacyHistory = JSON.parse(localStorage.getItem(LEGACY_HISTORY_KEY) || '[]') ?? [];
    } catch {
      // Unparseable local state is not worth a retry on every page load.
      this.clearLegacyKeys();
      return of(undefined);
    }

    if (legacyGoals.length === 0) {
      this.clearLegacyKeys();
      return of(undefined);
    }

    // History entries were stored as full ISO timestamps of local midnight; the
    // backend keys on a `YYYY-MM-DD` day.
    const weeks = legacyHistory.slice(0, MIGRATE_HISTORY_WEEKS).map((e) => ({
      ...e,
      weekStart: e.weekStart.slice(0, 10),
    }));

    return this.saveGoals(legacyGoals).pipe(
      switchMap(() =>
        weeks.length === 0
          ? of(null)
          : concat(
              ...weeks.map((w) => this.http.post<unknown>(`${this.baseUrl}/history-set`, w))
            ).pipe(toArray())
      ),
      tap(() => this.clearLegacyKeys()),
      map(() => undefined),
      catchError((err) => {
        console.error('[Goals] Migration failed, keeping local copy to retry:', err);
        return of(undefined);
      })
    );
  }

  private clearLegacyKeys(): void {
    localStorage.removeItem(LEGACY_GOALS_KEY);
    localStorage.removeItem(LEGACY_HISTORY_KEY);
  }

  /**
   * Distinct genres across the artists played this week.
   *
   * Recently-played carries only artist stubs — no genres — so this is one
   * extra `/artists?ids=` call. Spotify takes 50 ids per request, which a
   * week of plays fits inside; anything beyond that is dropped rather than
   * paged, since the 50-play window cannot hold more artists than that anyway.
   *
   * A failure yields an empty set (reported as zero genres) rather than
   * failing the page — the other three metrics are still correct.
   */
  private fetchGenres(items: RecentlyPlayedItem[]): Observable<Set<string>> {
    const ids = Array.from(
      new Set(items.flatMap((item) => item.track.artists.map((a) => a.id).filter(Boolean)))
    ).slice(0, SPOTIFY_ARTISTS_PER_REQUEST);

    if (ids.length === 0) return of(new Set<string>());

    return this.artistService.getArtistsByIds(ids.join(',')).pipe(
      map((res) => {
        const genres = new Set<string>();
        for (const artist of res?.artists ?? []) {
          for (const genre of artist?.genres ?? []) genres.add(genre);
        }
        return genres;
      }),
      catchError((err) => {
        console.error('[Goals] Could not load artist genres:', err);
        return of(new Set<string>());
      })
    );
  }

  private getThisWeekItems(items: RecentlyPlayedItem[]): RecentlyPlayedItem[] {
    const weekStart = this.getWeekStart(new Date());
    return items.filter(
      (item) => new Date(item.played_at).getTime() >= weekStart.getTime()
    );
  }

  /**
   * The Monday of `date`'s week as `YYYY-MM-DD`, built from LOCAL parts.
   *
   * Not `toISOString().slice(0, 10)` — that converts to UTC first, so local
   * Monday midnight east of Greenwich renders as the Sunday before, and the
   * week silently keys to the wrong row.
   */
  private weekStartKey(date: Date): string {
    const monday = this.getWeekStart(date);
    const month = String(monday.getMonth() + 1).padStart(2, '0');
    const day = String(monday.getDate()).padStart(2, '0');
    return `${monday.getFullYear()}-${month}-${day}`;
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
