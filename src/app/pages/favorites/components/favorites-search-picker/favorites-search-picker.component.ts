import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  OnDestroy,
  OnInit,
  Output,
  ViewChild,
} from '@angular/core';
import { Subject, of } from 'rxjs';
import { catchError, debounceTime, distinctUntilChanged, switchMap, takeUntil } from 'rxjs/operators';
import {
  SearchAlbum,
  SearchArtist,
  SearchResults,
  SearchService,
  SearchTrack,
  SearchType,
} from 'src/app/services/search.service';
import { FavoriteCategory, FavoriteItem } from 'src/app/services/favorites.service';

const MIN_QUERY_LENGTH = 2;
const DEBOUNCE_MS = 300;
const RESULT_LIMIT = 15;

const CATEGORY_TO_SEARCH_TYPE: Record<FavoriteCategory, SearchType> = {
  songs: 'track',
  albums: 'album',
  artists: 'artist',
};

interface PickerResult {
  spotifyId: string;
  name: string;
  artist: string;
  imageUrl?: string;
}

/**
 * Accessible modal for adding a Spotify track/album/artist to a Favorites
 * list. Search type is locked to the list's `category` — no tabs, unlike
 * the general-purpose Search page. Same focus-trap/Esc/backdrop pattern as
 * `XomtracksTrackDetailModalComponent`.
 */
@Component({
  selector: 'app-favorites-search-picker',
  templateUrl: './favorites-search-picker.component.html',
  styleUrls: ['./favorites-search-picker.component.scss'],
})
export class FavoritesSearchPickerComponent implements OnInit, AfterViewInit, OnDestroy {
  @Input({ required: true }) category!: FavoriteCategory;
  @Output() picked = new EventEmitter<FavoriteItem>();
  @Output() closed = new EventEmitter<void>();

  @ViewChild('dialog') dialogRef!: ElementRef<HTMLElement>;
  @ViewChild('searchInput') searchInputRef?: ElementRef<HTMLInputElement>;

  query = '';
  loading = false;
  hasSearched = false;
  errorMessage: string | null = null;
  results: PickerResult[] = [];

  private readonly query$ = new Subject<string>();
  private readonly destroy$ = new Subject<void>();
  private previouslyFocused: HTMLElement | null = null;

  constructor(private searchService: SearchService) {}

  ngOnInit(): void {
    this.query$
      .pipe(
        debounceTime(DEBOUNCE_MS),
        distinctUntilChanged(),
        switchMap((q) => {
          if (q.trim().length < MIN_QUERY_LENGTH) {
            this.results = [];
            this.hasSearched = false;
            this.loading = false;
            this.errorMessage = null;
            return of<SearchResults | null>(null);
          }
          this.loading = true;
          this.errorMessage = null;
          return this.searchService
            .search(q, CATEGORY_TO_SEARCH_TYPE[this.category], RESULT_LIMIT)
            .pipe(
              catchError((err) => {
                this.errorMessage =
                  err?.status === 401
                    ? 'Your Spotify session expired. Reload to sign back in.'
                    : 'Search failed. Try again.';
                this.loading = false;
                return of<SearchResults | null>(null);
              }),
            );
        }),
        takeUntil(this.destroy$),
      )
      .subscribe((res) => {
        if (!res) return;
        this.results = this.normalize(res);
        this.loading = false;
        this.hasSearched = true;
      });
  }

  ngAfterViewInit(): void {
    this.previouslyFocused = document.activeElement as HTMLElement | null;
    queueMicrotask(() => this.searchInputRef?.nativeElement.focus());
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onQueryChange(value: string): void {
    this.query = value;
    this.query$.next(value);
  }

  clearSearch(): void {
    this.query = '';
    this.query$.next('');
    this.searchInputRef?.nativeElement.focus();
  }

  select(result: PickerResult): void {
    this.picked.emit({
      rank: 0,
      spotifyId: result.spotifyId,
      name: result.name,
      artist: result.artist,
      imageUrl: result.imageUrl,
    });
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.requestClose();
  }

  onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) this.requestClose();
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Tab') return;
    const focusables = this.focusableElements();
    if (focusables.length === 0) {
      event.preventDefault();
      return;
    }
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const active = document.activeElement;

    if (event.shiftKey && active === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  }

  requestClose(): void {
    this.previouslyFocused?.focus?.();
    this.closed.emit();
  }

  get categoryLabel(): string {
    switch (this.category) {
      case 'songs':
        return 'songs';
      case 'albums':
        return 'albums';
      case 'artists':
        return 'artists';
    }
  }

  trackByResultId(_index: number, r: PickerResult): string {
    return r.spotifyId;
  }

  private focusableElements(): HTMLElement[] {
    const root = this.dialogRef?.nativeElement;
    if (!root) return [];
    const selector =
      'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';
    return Array.from(root.querySelectorAll<HTMLElement>(selector)).filter(
      (el) => el.offsetParent !== null || el === document.activeElement,
    );
  }

  private normalize(res: SearchResults): PickerResult[] {
    switch (this.category) {
      case 'songs':
        return res.tracks.map((t) => this.trackToResult(t));
      case 'albums':
        return res.albums.map((a) => this.albumToResult(a));
      case 'artists':
        return res.artists.map((a) => this.artistToResult(a));
    }
  }

  private trackToResult(t: SearchTrack): PickerResult {
    return {
      spotifyId: t.id,
      name: t.name,
      artist: t.artists?.map((a) => a.name).join(', ') || 'Unknown artist',
      imageUrl: this.smallestImage(t.album?.images),
    };
  }

  private albumToResult(a: SearchAlbum): PickerResult {
    return {
      spotifyId: a.id,
      name: a.name,
      artist: a.artists?.map((ar) => ar.name).join(', ') || 'Unknown artist',
      imageUrl: this.smallestImage(a.images),
    };
  }

  private artistToResult(a: SearchArtist): PickerResult {
    return {
      spotifyId: a.id,
      name: a.name,
      artist: a.genres?.[0] || 'Artist',
      imageUrl: this.smallestImage(a.images),
    };
  }

  private smallestImage(images?: { url: string }[]): string | undefined {
    if (!images || images.length === 0) return undefined;
    return images[images.length - 1]?.url || images[0]?.url;
  }
}
