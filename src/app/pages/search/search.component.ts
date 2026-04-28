import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
} from '@angular/core';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import {
  debounceTime,
  distinctUntilChanged,
  switchMap,
  takeUntil,
} from 'rxjs/operators';
import { of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import {
  SearchAlbum,
  SearchArtist,
  SearchResults,
  SearchService,
  SearchTrack,
  SearchType,
} from 'src/app/services/search.service';
import { PlayerService } from 'src/app/services/player.service';

const MIN_QUERY_LENGTH = 2;
const DEBOUNCE_MS = 300;
const RESULT_LIMIT = 20;

interface Tab {
  key: SearchType;
  label: string;
}

@Component({
  selector: 'app-search',
  templateUrl: './search.component.html',
  styleUrls: ['./search.component.scss'],
})
export class SearchComponent implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild('searchInput') searchInputRef?: ElementRef<HTMLInputElement>;

  readonly tabs: Tab[] = [
    { key: 'track', label: 'Tracks' },
    { key: 'artist', label: 'Artists' },
    { key: 'album', label: 'Albums' },
  ];

  query = '';
  activeTab: SearchType = 'track';
  loading = false;
  /**
   * `null` until the first successful response. Used to distinguish
   * "haven't searched yet" from "got an empty response".
   */
  hasSearched = false;
  errorMessage: string | null = null;

  tracks: SearchTrack[] = [];
  artists: SearchArtist[] = [];
  albums: SearchAlbum[] = [];

  /** All input changes flow through this stream so debouncing is centralised. */
  private readonly query$ = new Subject<string>();
  private readonly destroy$ = new Subject<void>();

  constructor(
    private searchService: SearchService,
    private router: Router,
    private playerService: PlayerService,
  ) {}

  ngOnInit(): void {
    this.query$
      .pipe(
        debounceTime(DEBOUNCE_MS),
        distinctUntilChanged(),
        switchMap((q) => {
          if (q.trim().length < MIN_QUERY_LENGTH) {
            // Reset state so the template can show the min-length hint.
            this.tracks = [];
            this.artists = [];
            this.albums = [];
            this.hasSearched = false;
            this.loading = false;
            this.errorMessage = null;
            return of<SearchResults | null>(null);
          }
          this.loading = true;
          this.errorMessage = null;
          return this.searchService.search(q, this.activeTab, RESULT_LIMIT).pipe(
            catchError((err) => {
              // Surface the error in-place so the user can retry by typing.
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
      .subscribe((results) => {
        if (!results) return;
        this.applyResults(results);
        this.loading = false;
        this.hasSearched = true;
      });
  }

  ngAfterViewInit(): void {
    // Defer so it runs after Angular finishes binding — autofocus attribute
    // alone isn't honoured on every browser when a route transition steals focus.
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

  /**
   * Re-issues the current query against the new tab. When the query is too
   * short we just clear the visible results — keeps the UI consistent with the
   * normal debounce path.
   */
  setTab(tab: SearchType): void {
    if (this.activeTab === tab) return;
    this.activeTab = tab;
    this.tracks = [];
    this.artists = [];
    this.albums = [];
    this.hasSearched = false;
    this.errorMessage = null;
    if (this.query.trim().length >= MIN_QUERY_LENGTH) {
      // Skip the debounce — tab switch is an explicit user action.
      this.runImmediate(this.query);
    }
  }

  /** Triggered by Enter — bypasses debounce so the user gets instant feedback. */
  onSubmit(): void {
    if (this.query.trim().length < MIN_QUERY_LENGTH) return;
    this.runImmediate(this.query);
  }

  /** True while the user is typing under the min-length floor. */
  get showMinLengthHint(): boolean {
    const len = this.query.trim().length;
    return len > 0 && len < MIN_QUERY_LENGTH;
  }

  /** True only after a successful search returned zero matches. */
  get showEmptyState(): boolean {
    if (!this.hasSearched || this.loading || this.errorMessage) return false;
    return this.currentResults.length === 0;
  }

  get currentResults(): unknown[] {
    if (this.activeTab === 'track') return this.tracks;
    if (this.activeTab === 'artist') return this.artists;
    return this.albums;
  }

  // ============================================
  // Result row click handlers
  // ============================================

  onTrackClick(track: SearchTrack): void {
    if (track.id) {
      this.playerService.playSong(track.id);
    }
  }

  openTrackInSpotify(track: SearchTrack, event: MouseEvent): void {
    event.stopPropagation();
    if (track.id) {
      window.open(
        `https://open.spotify.com/track/${track.id}`,
        '_blank',
        'noopener',
      );
    }
  }

  onArtistClick(artist: SearchArtist): void {
    if (artist.id) {
      this.router.navigate(['/artist-profile', artist.id]);
    }
  }

  onAlbumClick(album: SearchAlbum): void {
    if (album.id) {
      this.router.navigate(['/album', album.id]);
    }
  }

  /** Smallest image URL that's still bigger than the rendered thumb. */
  artworkFor(images: { url: string }[] | undefined): string {
    if (!images || images.length === 0) return '';
    // Spotify returns largest first; pick the middle one to balance bandwidth.
    const middle = Math.floor(images.length / 2);
    return images[middle]?.url ?? images[0].url;
  }

  trackArtists(track: SearchTrack): string {
    return (track.artists ?? []).map((a) => a.name).filter(Boolean).join(', ');
  }

  albumArtists(album: SearchAlbum): string {
    return (album.artists ?? []).map((a) => a.name).filter(Boolean).join(', ');
  }

  trackByIndex(index: number): number {
    return index;
  }

  trackByItemId(_index: number, item: { id: string }): string {
    return item.id;
  }

  private runImmediate(value: string): void {
    this.loading = true;
    this.errorMessage = null;
    this.searchService
      .search(value, this.activeTab, RESULT_LIMIT)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (results) => {
          this.applyResults(results);
          this.loading = false;
          this.hasSearched = true;
        },
        error: (err) => {
          this.errorMessage =
            err?.status === 401
              ? 'Your Spotify session expired. Reload to sign back in.'
              : 'Search failed. Try again.';
          this.loading = false;
        },
      });
  }

  private applyResults(results: SearchResults): void {
    this.tracks = results.tracks ?? [];
    this.artists = results.artists ?? [];
    this.albums = results.albums ?? [];
  }
}
