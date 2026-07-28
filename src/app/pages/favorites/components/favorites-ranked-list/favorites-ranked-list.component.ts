import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnInit,
  Output,
  SimpleChanges,
} from '@angular/core';
import { take } from 'rxjs/operators';
import {
  FavoriteCategory,
  FavoriteItem,
  FavoritesHistoryEvent,
  FavoritesRecommendation,
  FavoritesService,
} from 'src/app/services/favorites.service';
import { ToastService } from 'src/app/services/toast.service';

/** Per-item movement since the previous rank-history event: up N spots, down
 * N spots, unchanged, or brand new to the list. */
export type FavoritesMovementDirection = 'up' | 'down' | 'same' | 'new';

export interface FavoritesMovement {
  direction: FavoritesMovementDirection;
  delta: number;
}

interface ItemTimelineEntry {
  ts: string;
  rank: number;
}

/**
 * One ranked top-5 block — used for BOTH the three "Overall" buckets
 * (songs/albums/artists, `deletable=false`) and each user-created genre list
 * (`deletable=true`). Owns its own persistence: reorder/add/remove all call
 * `FavoritesService.updateListItems` (`PUT /favorites/list-set`) directly
 * (optimistic, with rollback on failure) so the parent page just seeds
 * `[year]`/`[items]` and reacts to `(listDeleted)`.
 *
 * Rank-history is fetched once on init (needed for the ↑/↓ movement badges
 * that show without any user action) and reused for the expandable
 * per-item timeline — no extra network calls when the timeline is toggled
 * open. Recommendations are fetched lazily, only when the suggestions strip
 * is expanded, since they're the most speculative/costly call.
 */
@Component({
  selector: 'app-favorites-ranked-list',
  templateUrl: './favorites-ranked-list.component.html',
  styleUrls: ['./favorites-ranked-list.component.scss'],
})
export class FavoritesRankedListComponent implements OnInit, OnChanges {
  @Input({ required: true }) year!: number;
  @Input({ required: true }) listId!: string;
  @Input({ required: true }) category!: FavoriteCategory;
  @Input({ required: true }) title = '';
  /** Shown as a subtitle for user-created lists (the free-form genre label). */
  @Input() subtitle = '';
  @Input() items: FavoriteItem[] = [];
  /** `false` for the three implicit Overall buckets — they can't be deleted. */
  @Input() deletable = false;

  @Output() listDeleted = new EventEmitter<string>();

  localItems: FavoriteItem[] = [];
  saving = false;
  deleting = false;

  historyLoaded = false;
  historyByTrack = new Map<string, ItemTimelineEntry[]>();
  timelineOpenFor: string | null = null;

  suggestionsOpen = false;
  suggestionsLoading = false;
  suggestions: FavoritesRecommendation[] = [];

  pickerOpen = false;

  readonly maxRank: number;

  constructor(
    private favoritesService: FavoritesService,
    private toastService: ToastService,
  ) {
    this.maxRank = this.favoritesService.maxRank;
  }

  ngOnInit(): void {
    this.localItems = [...this.items];
    this.loadHistory();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['items'] && !changes['items'].firstChange) {
      this.localItems = [...this.items];
    }
    const listChanged =
      (changes['listId'] && !changes['listId'].firstChange) ||
      (changes['year'] && !changes['year'].firstChange);
    if (listChanged) {
      this.historyLoaded = false;
      this.historyByTrack.clear();
      this.suggestions = [];
      this.loadHistory();
    }
  }

  get isFull(): boolean {
    return this.localItems.length >= this.maxRank;
  }

  get isEmpty(): boolean {
    return this.localItems.length === 0;
  }

  trackByRank(_index: number, item: FavoriteItem): string {
    return item.spotifyId;
  }

  // ── Reorder / remove ──────────────────────────────────────────────
  moveUp(index: number): void {
    if (index <= 0) return;
    this.reorder(index, index - 1);
  }

  moveDown(index: number): void {
    if (index >= this.localItems.length - 1) return;
    this.reorder(index, index + 1);
  }

  private reorder(from: number, to: number): void {
    const next = [...this.localItems];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    this.persist(next, 'Could not reorder — try again.');
  }

  removeItem(item: FavoriteItem): void {
    const next = this.localItems.filter((i) => i.spotifyId !== item.spotifyId);
    this.persist(next, 'Could not remove that track — try again.');
  }

  addItem(item: FavoriteItem): void {
    if (this.isFull) return;
    if (this.localItems.some((i) => i.spotifyId === item.spotifyId)) return;
    const next = [...this.localItems, item];
    this.persist(next, 'Could not add that track — try again.');
    this.pickerOpen = false;
  }

  addFromSuggestion(rec: FavoritesRecommendation): void {
    this.addItem({
      rank: 0,
      spotifyId: rec.spotifyId,
      name: rec.name,
      artist: rec.artist,
      imageUrl: rec.imageUrl,
    });
    this.suggestions = this.suggestions.filter((s) => s.spotifyId !== rec.spotifyId);
  }

  private persist(next: FavoriteItem[], errorMessage: string): void {
    const previous = this.localItems;
    this.localItems = next.map((item, i) => ({ ...item, rank: i + 1 }));
    this.saving = true;

    this.favoritesService
      .updateListItems(this.year, this.listId, this.localItems)
      .pipe(take(1))
      .subscribe({
        next: (resp) => {
          this.localItems = resp?.items?.length ? resp.items : this.localItems;
          this.saving = false;
          // A change in membership/order invalidates the cached history view.
          this.historyLoaded = false;
          this.loadHistory();
        },
        error: () => {
          this.localItems = previous;
          this.saving = false;
          this.toastService.showNegativeToast(errorMessage);
        },
      });
  }

  // ── Add picker (Spotify search) ─────────────────────────────────────
  openPicker(): void {
    if (this.isFull) return;
    this.pickerOpen = true;
  }

  closePicker(): void {
    this.pickerOpen = false;
  }

  // ── Delete whole list (custom lists only) ───────────────────────────
  confirmDelete(): void {
    if (!this.deletable || this.deleting) return;
    // `title` is the list's name (genreLabel for custom lists); `subtitle`
    // is just the category badge ("Albums") — prefer title for the
    // human-readable confirm/aria text.
    const label = this.title || this.subtitle;
    if (!window.confirm(`Delete "${label}"? This can't be undone.`)) return;

    this.deleting = true;
    this.favoritesService
      .deleteList(this.year, this.listId)
      .pipe(take(1))
      .subscribe({
        next: () => {
          this.deleting = false;
          this.listDeleted.emit(this.listId);
        },
        error: () => {
          this.deleting = false;
          this.toastService.showNegativeToast('Could not delete this list — try again.');
        },
      });
  }

  // ── Suggestions ──────────────────────────────────────────────────────
  toggleSuggestions(): void {
    this.suggestionsOpen = !this.suggestionsOpen;
    if (this.suggestionsOpen && this.suggestions.length === 0 && !this.suggestionsLoading) {
      this.suggestionsLoading = true;
      this.favoritesService
        .getRecommendations(this.year, this.category, this.listId)
        .pipe(take(1))
        .subscribe((recs) => {
          this.suggestions = recs.filter(
            (r) => !this.localItems.some((i) => i.spotifyId === r.spotifyId),
          );
          this.suggestionsLoading = false;
        });
    }
  }

  // ── Rank history / movement ─────────────────────────────────────────
  private loadHistory(): void {
    this.favoritesService
      .getListHistory(this.listId)
      .pipe(take(1))
      .subscribe((events) => {
        this.historyByTrack = this.groupHistory(events);
        this.historyLoaded = true;
      });
  }

  private groupHistory(events: FavoritesHistoryEvent[]): Map<string, ItemTimelineEntry[]> {
    const byTrack = new Map<string, ItemTimelineEntry[]>();
    const sorted = [...events].sort((a, b) => Date.parse(a.ts) - Date.parse(b.ts));
    for (const ev of sorted) {
      const arr = byTrack.get(ev.spotifyId) ?? [];
      arr.push({ ts: ev.ts, rank: ev.toRank });
      byTrack.set(ev.spotifyId, arr);
    }
    return byTrack;
  }

  /** ↑/↓/new/unchanged since the previous logged rank-change for this item. */
  movementFor(item: FavoriteItem): FavoritesMovement | null {
    if (!this.historyLoaded) return null;
    const timeline = this.historyByTrack.get(item.spotifyId);
    if (!timeline || timeline.length === 0) return { direction: 'new', delta: 0 };
    if (timeline.length === 1) return { direction: 'new', delta: 0 };
    const current = timeline[timeline.length - 1].rank;
    const previous = timeline[timeline.length - 2].rank;
    if (current === previous) return { direction: 'same', delta: 0 };
    return {
      direction: current < previous ? 'up' : 'down',
      delta: Math.abs(current - previous),
    };
  }

  hasTimeline(item: FavoriteItem): boolean {
    return (this.historyByTrack.get(item.spotifyId)?.length ?? 0) > 0;
  }

  timelineFor(item: FavoriteItem): ItemTimelineEntry[] {
    return this.historyByTrack.get(item.spotifyId) ?? [];
  }

  toggleTimeline(item: FavoriteItem): void {
    this.timelineOpenFor = this.timelineOpenFor === item.spotifyId ? null : item.spotifyId;
  }

  timelineMonthLabel(ts: string): string {
    const ms = Date.parse(ts);
    if (Number.isNaN(ms)) return ts;
    return new Date(ms).toLocaleDateString(undefined, { month: 'short', year: '2-digit' });
  }
}
