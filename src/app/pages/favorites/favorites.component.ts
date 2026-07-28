import { Component, OnInit } from '@angular/core';
import { take } from 'rxjs/operators';
import {
  FavoriteCategory,
  FavoritesList,
  FavoritesOverall,
  FavoritesService,
} from 'src/app/services/favorites.service';
import { ToastService } from 'src/app/services/toast.service';
import { NewListPayload } from './components/favorites-new-list-modal/favorites-new-list-modal.component';

type LoadState = 'loading' | 'loaded' | 'error';

const CATEGORY_LABELS: Record<FavoriteCategory, string> = {
  songs: 'Songs',
  albums: 'Albums',
  artists: 'Artists',
};

const EARLIEST_YEAR_OFFSET = 5;

/**
 * My Favorites — user-CURATED best-of lists, per year. Distinct from
 * "Music Taste" (Spotify-derived, see top-songs/top-artists/top-genres):
 * every item here was hand-picked and hand-ranked by the user.
 *
 * Page owns: year selection + the top-level fetch/loading/error/empty
 * states. Each ranked top-5 (the 3 Overall buckets + every custom genre
 * list) is a self-contained `FavoritesRankedListComponent` that owns its
 * own add/reorder/remove/history/recommendations calls.
 */
@Component({
  selector: 'app-favorites',
  templateUrl: './favorites.component.html',
  styleUrls: ['./favorites.component.scss'],
})
export class FavoritesComponent implements OnInit {
  state: LoadState = 'loading';
  year: number;
  readonly years: number[];

  overall: FavoritesOverall = { songs: [], albums: [], artists: [] };
  lists: FavoritesList[] = [];

  newListOpen = false;
  creatingList = false;

  constructor(
    private favoritesService: FavoritesService,
    private toastService: ToastService,
  ) {
    const now = new Date().getFullYear();
    this.year = now;
    this.years = Array.from({ length: EARLIEST_YEAR_OFFSET + 1 }, (_, i) => now - i);
  }

  ngOnInit(): void {
    this.load();
  }

  onYearChange(year: number): void {
    if (year === this.year) return;
    this.year = year;
    this.load();
  }

  retry(): void {
    this.load();
  }

  private load(): void {
    this.state = 'loading';
    this.favoritesService
      .getFavorites(this.year)
      .pipe(take(1))
      .subscribe({
        next: (resp) => {
          this.overall = resp.overall;
          this.lists = resp.lists;
          this.state = 'loaded';
        },
        error: () => {
          this.state = 'error';
        },
      });
  }

  overallListId(category: FavoriteCategory): string {
    return this.favoritesService.overallListId(this.year, category);
  }

  categoryLabel(category: FavoriteCategory): string {
    return CATEGORY_LABELS[category];
  }

  trackByListId(_index: number, list: FavoritesList): string {
    return list.listId;
  }

  // ── New list ─────────────────────────────────────────────────────
  openNewList(): void {
    this.newListOpen = true;
  }

  closeNewList(): void {
    if (this.creatingList) return;
    this.newListOpen = false;
  }

  createList(payload: NewListPayload): void {
    this.creatingList = true;
    this.favoritesService
      .createList(this.year, payload.category, payload.genreLabel)
      .pipe(take(1))
      .subscribe({
        next: (list) => {
          this.lists = [...this.lists, list];
          this.creatingList = false;
          this.newListOpen = false;
          this.toastService.showPositiveToast(`Created "${list.genreLabel}".`);
        },
        error: () => {
          this.creatingList = false;
          this.toastService.showNegativeToast('Could not create that list — try again.');
        },
      });
  }

  onListDeleted(listId: string): void {
    this.lists = this.lists.filter((l) => l.listId !== listId);
  }
}
