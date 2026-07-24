import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { XomtracksSharesService } from './services/xomtracks-shares.service';
import { XomtracksRatingsService } from './services/xomtracks-ratings.service';
import { XomtracksHeardService } from './services/xomtracks-heard.service';
import {
  XT_FEED_SOURCES,
  XT_TIME_WINDOWS,
  XtFeedMode,
  XtRatedTrack,
  XtRating,
  XtShare,
  XtTimeWindow,
} from './models/xomtracks-share.model';
import {
  xtDisplayTitle,
  xtIsMatched,
  xtOpenLabel,
  xtPlatformLabel,
  xtPrimaryUrl,
  xtRelativeDate,
  xtSharerLabel,
  xtTrackKey,
} from './utils/xomtracks-track-display';

type XtLoadState = 'loading' | 'loaded' | 'error';
export type XtFeedView = 'tile' | 'list';

const VIEW_STORAGE_KEY = 'xt.feed.view';

/**
 * The Xomtracks feature's home page — replaces xomify's old "feed" +
 * "groups" (docs/features/xomtracks-xomify-merge/PLAN.md). Two directions
 * (shared with me / by me) + "my rated", each with a time-window control
 * (week/month/6mo/all — window is meaningless for "my rated", which loads
 * every rated track regardless of window) and a genre filter (hidden until
 * the backend genre-fetch populates one). Small scale, so the whole window
 * loads from `GET /shares/list` and filters/groups client-side.
 *
 * Renders either a cover-art tile grid or a dense list; the choice persists
 * in localStorage. Clicking any row/card opens a detail modal. The rolling
 * playlists live in the slide-out panel; the "set up your own" ingest-token
 * card sits below the feed.
 */
@Component({
  selector: 'app-xomtracks',
  templateUrl: './xomtracks.component.html',
  styleUrls: ['./xomtracks.component.scss'],
})
export class XomtracksComponent implements OnInit, OnDestroy {
  readonly windows = XT_TIME_WINDOWS;
  readonly sources = XT_FEED_SOURCES;

  mode: XtFeedMode = 'in';
  window: XtTimeWindow = 'month';
  search = '';
  view: XtFeedView = 'tile';

  /** Selected genre filter, or null for "all genres". */
  genre: string | null = null;

  /** When on, hides tracks the caller has already marked heard. */
  unheardOnly = false;

  /** The share whose detail modal is open, or null when closed. */
  selected: XtShare | null = null;

  state: XtLoadState = 'loading';
  private allShares: XtShare[] = [];
  private sub?: Subscription;

  /** Bumped on every successful load so the grouping memo invalidates. */
  private dataVersion = 0;
  private groupCache?: {
    key: string;
    reps: XtShare[];
    countByKey: Map<string, number>;
    sharersByKey: Map<string, string[]>;
  };

  constructor(
    private sharesService: XomtracksSharesService,
    private ratingsService: XomtracksRatingsService,
    private heardService: XomtracksHeardService,
    private route: ActivatedRoute,
    private router: Router,
  ) {}

  ngOnInit(): void {
    // Honour a `?source=<mode>` deep link (e.g. from the xomware hub's "view
    // more in xomify" CTA).
    const requested = this.resolveModeFromQuery();
    if (requested) this.mode = requested;
    this.restoreView();
    this.load();
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  private resolveModeFromQuery(): XtFeedMode | undefined {
    const requested = this.route.snapshot.queryParamMap.get('source');
    if (requested && this.sources.some((s) => s.value === requested)) {
      return requested as XtFeedMode;
    }
    return undefined;
  }

  setMode(mode: XtFeedMode): void {
    if (this.mode === mode) return;
    this.mode = mode;
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { source: mode },
      queryParamsHandling: 'merge',
    });
    this.load();
  }

  setWindow(window: XtTimeWindow): void {
    if (this.window === window) return;
    this.window = window;
    this.load();
  }

  /** The time-window control is meaningless for "My rated" (loads ALL rated
   * tracks across directions), so it's hidden in that mode. */
  get showWindow(): boolean {
    return this.mode !== 'rated';
  }

  toggleUnheard(): void {
    this.unheardOnly = !this.unheardOnly;
    this.dataVersion++;
  }

  setView(view: XtFeedView): void {
    if (this.view === view) return;
    this.view = view;
    this.persistView();
  }

  retry(): void {
    this.load();
  }

  clearSearch(): void {
    this.search = '';
  }

  openDetail(share: XtShare): void {
    this.selected = share;
  }

  closeDetail(): void {
    this.selected = null;
  }

  load(): void {
    this.state = 'loading';
    this.selected = null;
    this.sub?.unsubscribe();

    // "My rated" loads EVERY track the caller has rated, across BOTH
    // directions, from the dedicated `/ratings/list` endpoint (not a filter
    // over one direction). The rated rows are mapped into XtShare shape so
    // the same grid, grouping, and rating control render them unchanged.
    if (this.mode === 'rated') {
      this.sub = this.ratingsService.list().subscribe({
        next: (res) => {
          this.setShares((res.rated ?? []).map((r) => this.ratedToShare(r)));
          this.state = 'loaded';
        },
        error: () => {
          this.setShares([]);
          this.state = 'error';
        },
      });
      return;
    }

    // Every other mode maps 1:1 to a share direction.
    const direction: 'in' | 'out' = this.mode;
    this.sub = this.sharesService.list(direction, this.window).subscribe({
      next: (res) => {
        this.setShares(res.shares ?? []);
        this.state = 'loaded';
      },
      error: () => {
        this.setShares([]);
        this.state = 'error';
      },
    });
  }

  private ratedToShare(r: XtRatedTrack): XtShare {
    const spId = r.trackKey.startsWith('sp:') ? r.trackKey.slice(3) : null;
    const url = r.trackKey.startsWith('url:') ? `https://${r.trackKey.slice(4)}` : '';
    const when = this.toEpochSeconds(r.date) ?? this.toEpochSeconds(r.ratedAt) ?? 0;
    return {
      shareId: `rated:${r.trackKey}`,
      messageGuid: `rated:${r.trackKey}`,
      direction: r.direction,
      platform: r.platform,
      sourceUrl: url,
      messageDate: when,
      sharerHandle: null,
      sharerName: null,
      chatId: null,
      trackTitle: r.trackTitle ?? null,
      trackArtist: r.trackArtist ?? null,
      albumName: r.albumName ?? null,
      albumArtUrl: r.albumArtUrl ?? null,
      resolvedSpotifyId: spId,
      resolvedSpotifyUri: null,
      matchStatus: spId ? 'matched' : 'unmatched',
      matchConfidence: null,
      createdAt: '',
      genres: null,
      rating: { avg: r.rating, count: 1, myRating: r.rating },
    };
  }

  private toEpochSeconds(value: string | number | null | undefined): number | null {
    if (value == null) return null;
    if (typeof value === 'number') return value > 1e12 ? Math.floor(value / 1000) : value;
    const ms = Date.parse(value);
    return Number.isNaN(ms) ? null : Math.floor(ms / 1000);
  }

  private setShares(shares: XtShare[]): void {
    this.allShares = shares;
    this.dataVersion++;
  }

  /** Client-side dedup: drops only exact same-message repeats — keyed on
   * `messageGuid`, else a composite of resolved Spotify id + sharer +
   * timestamp. The same track shared by a different person/date stays. */
  get dedupedShares(): XtShare[] {
    const seen = new Set<string>();
    const out: XtShare[] = [];
    for (const s of this.allShares) {
      const key = this.dedupKey(s);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(s);
    }
    return out;
  }

  /** The feed's displayed entries: exact-message dedup first, then GROUPED
   * by track so the same song shared to several people/dates collapses to
   * ONE entry (most-recent share per track). `groupCount()` gives the ×N. */
  get groupedShares(): XtShare[] {
    return this.computeGroups().reps;
  }

  groupCount(share: XtShare): number {
    return this.computeGroups().countByKey.get(xtTrackKey(share)) ?? 1;
  }

  /** Summarised distinct sharers of a track group ("Tori, Jack +1"), for the
   * shared-with-me direction only. */
  sharerSummaryFor(share: XtShare): string {
    if (this.mode !== 'in') return '';
    return this.summarizeSharers(this.groupSharers(share));
  }

  get matchedCount(): number {
    return this.groupedShares.filter(
      (s) => s.matchStatus === 'matched' || s.matchStatus === 'manual',
    ).length;
  }

  get isFiltered(): boolean {
    return this.search.trim().length > 0;
  }

  get emptyText(): string {
    if (this.unheardOnly) return "You've heard everything here — nice.";
    if (this.mode === 'rated') return "You haven't rated any tracks yet.";
    if (this.mode === 'in') return 'No songs shared with you in this window.';
    return 'No songs you shared in this window.';
  }

  // ── Genre filter ──────────────────────────────────────────────────
  get genres(): string[] {
    const set = new Set<string>();
    for (const s of this.allShares) {
      for (const raw of s.genres ?? []) {
        const g = raw?.trim();
        if (g) set.add(g);
      }
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  }

  get genreEnabled(): boolean {
    return this.genres.length > 0;
  }

  setGenre(genre: string | null): void {
    this.genre = genre || null;
    this.dataVersion++;
  }

  // ── Ratings ───────────────────────────────────────────────────────
  keyFor(share: XtShare): string {
    return xtTrackKey(share);
  }

  /**
   * Set the caller's whole-group rating for a track. Updates every
   * underlying share of the group optimistically, then persists via
   * `/ratings/set`. The server's authoritative aggregate replaces the
   * optimistic one on success; a failure reverts.
   */
  onRate(share: XtShare, value: number): void {
    const key = xtTrackKey(share);
    const group = this.allShares.filter((s) => xtTrackKey(s) === key);
    const before = group.map((s) => (s.rating ? { ...s.rating } : null));

    const optimistic = this.optimisticRating(share.rating, value);
    for (const s of group) s.rating = { ...optimistic };
    this.dataVersion++;

    this.ratingsService.set(key, value).subscribe({
      next: (agg) => {
        for (const s of group) s.rating = { ...agg };
        this.dataVersion++;
      },
      error: () => {
        group.forEach((s, i) => (s.rating = before[i]));
        this.dataVersion++;
      },
    });
  }

  // ── Heard / unheard ───────────────────────────────────────────────
  heardFor(share: XtShare): boolean {
    return !!share.heard;
  }

  onToggleHeard(share: XtShare): void {
    const key = xtTrackKey(share);
    const group = this.allShares.filter((s) => xtTrackKey(s) === key);
    const before = group.map((s) => s.heard);
    const next = !share.heard;

    for (const s of group) s.heard = next;
    this.dataVersion++;

    this.heardService.set(key, next).subscribe({
      next: (state) => {
        for (const s of group) s.heard = state.heard;
        this.dataVersion++;
      },
      error: () => {
        group.forEach((s, i) => (s.heard = before[i]));
        this.dataVersion++;
      },
    });
  }

  private optimisticRating(current: XtRating | null | undefined, value: number): XtRating {
    const avg = current?.avg ?? 0;
    const count = current?.count ?? 0;
    const my = current?.myRating ?? 0;
    const sum = avg * count - my + value;
    const nextCount = my > 0 ? count : count + 1;
    return {
      avg: nextCount > 0 ? sum / nextCount : value,
      count: nextCount,
      myRating: value,
    };
  }

  get selectedSharedTimes(): number {
    if (!this.selected) return 0;
    return this.occurrencesOf(this.selected).length;
  }

  get selectedOtherSharers(): string[] {
    if (!this.selected) return [];
    const self = xtSharerLabel(this.selected);
    const names: string[] = [];
    const seen = new Set<string>();
    for (const s of this.occurrencesOf(this.selected)) {
      const label = xtSharerLabel(s);
      if (label === self || seen.has(label)) continue;
      seen.add(label);
      names.push(label);
    }
    return names;
  }

  get selectedOccurrences(): XtShare[] {
    if (!this.selected) return [];
    return [...this.occurrencesOf(this.selected)].sort(
      (a, b) => (b.messageDate ?? 0) - (a.messageDate ?? 0),
    );
  }

  platformLabel(platform: XtShare['platform']): string {
    return xtPlatformLabel(platform);
  }

  rowTitle(share: XtShare): string {
    return xtDisplayTitle(share);
  }

  showOpenLink(share: XtShare): boolean {
    return !xtIsMatched(share);
  }

  openUrl(share: XtShare): string {
    return xtPrimaryUrl(share);
  }

  openLinkLabel(share: XtShare): string {
    return xtOpenLabel(share);
  }

  rowArtist(share: XtShare): string {
    return share.trackArtist?.trim() || '—';
  }

  sharerLabel(share: XtShare): string {
    return xtSharerLabel(share);
  }

  rowSharerLabel(share: XtShare): string {
    const summary = this.sharerSummaryFor(share);
    return summary || this.sharerLabel(share);
  }

  sharerInitial(share: XtShare): string {
    return (this.rowSharerLabel(share)[0] ?? '?').toUpperCase();
  }

  relativeDate(share: XtShare): string {
    return xtRelativeDate(share.messageDate);
  }

  hasArt(share: XtShare): boolean {
    return !!share.albumArtUrl;
  }

  trackByShareId(_index: number, share: XtShare): string {
    return share.shareId;
  }

  readonly skeletons = Array.from({ length: 10 });

  // ── Internals ───────────────────────────────────────────────────
  private occurrencesOf(share: XtShare): XtShare[] {
    const key = xtTrackKey(share);
    return this.dedupedShares.filter((s) => xtTrackKey(s) === key);
  }

  private computeGroups() {
    const q = this.search.trim().toLowerCase();
    const cacheKey = `${this.dataVersion}|${q}|${this.genre ?? ''}|${this.mode}|${this.unheardOnly}`;
    if (this.groupCache?.key === cacheKey) return this.groupCache;

    const byKey = new Map<string, XtShare[]>();
    const order: string[] = [];
    for (const s of this.dedupedShares) {
      const k = xtTrackKey(s);
      let arr = byKey.get(k);
      if (!arr) {
        arr = [];
        byKey.set(k, arr);
        order.push(k);
      }
      arr.push(s);
    }

    const countByKey = new Map<string, number>();
    const sharersByKey = new Map<string, string[]>();
    const reps: XtShare[] = [];
    for (const k of order) {
      const arr = byKey.get(k)!;
      countByKey.set(k, arr.length);
      const rep = arr.reduce((a, b) => ((b.messageDate ?? 0) > (a.messageDate ?? 0) ? b : a));
      reps.push(rep);
      const seen = new Set<string>();
      const names: string[] = [];
      for (const sh of arr) {
        const label = xtSharerLabel(sh);
        if (seen.has(label)) continue;
        seen.add(label);
        names.push(label);
      }
      sharersByKey.set(k, names);
    }

    let filteredReps = reps;
    if (q) {
      filteredReps = filteredReps.filter((rep) =>
        (byKey.get(xtTrackKey(rep)) ?? [rep]).some((s) => this.matchesSearch(s, q)),
      );
    }
    if (this.genre) {
      const g = this.genre;
      filteredReps = filteredReps.filter((rep) =>
        (byKey.get(xtTrackKey(rep)) ?? [rep]).some((s) =>
          (s.genres ?? []).some((entry) => entry?.trim() === g),
        ),
      );
    }
    if (this.mode === 'rated') {
      filteredReps = filteredReps.filter((rep) => (rep.rating?.myRating ?? 0) > 0);
    }
    if (this.unheardOnly) {
      filteredReps = filteredReps.filter((rep) => !rep.heard);
    }
    filteredReps = [...filteredReps].sort((a, b) => (b.messageDate ?? 0) - (a.messageDate ?? 0));

    this.groupCache = { key: cacheKey, reps: filteredReps, countByKey, sharersByKey };
    return this.groupCache;
  }

  private groupSharers(share: XtShare): string[] {
    return this.computeGroups().sharersByKey.get(xtTrackKey(share)) ?? [];
  }

  private summarizeSharers(names: string[]): string {
    if (names.length === 0) return '';
    if (names.length === 1) return names[0];
    if (names.length === 2) return `${names[0]}, ${names[1]}`;
    return `${names[0]}, ${names[1]} +${names.length - 2}`;
  }

  private matchesSearch(share: XtShare, q: string): boolean {
    const hay = [share.trackTitle, share.trackArtist, share.albumName, share.sharerName, share.sharerHandle]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return hay.includes(q);
  }

  private dedupKey(share: XtShare): string {
    if (share.messageGuid) return `g:${share.messageGuid}`;
    const track = share.resolvedSpotifyId ?? share.sourceUrl ?? 'x';
    const sharer = share.sharerHandle ?? share.sharerName ?? 'x';
    return `c:${track}|${sharer}|${share.messageDate ?? 0}`;
  }

  private restoreView(): void {
    try {
      const stored = localStorage.getItem(VIEW_STORAGE_KEY);
      if (stored === 'tile' || stored === 'list') this.view = stored;
    } catch {
      /* localStorage can throw in private mode — default view is fine. */
    }
  }

  private persistView(): void {
    try {
      localStorage.setItem(VIEW_STORAGE_KEY, this.view);
    } catch {
      /* non-fatal — the toggle still works for this session. */
    }
  }
}
