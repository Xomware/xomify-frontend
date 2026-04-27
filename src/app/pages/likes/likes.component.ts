import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Subject } from 'rxjs';
import {
  debounceTime,
  distinctUntilChanged,
  take,
  takeUntil,
} from 'rxjs/operators';
import {
  LikesService,
  LikesTrackDisplayItem,
} from 'src/app/services/likes.service';
import { PlayerService } from 'src/app/services/player.service';
import { ToastService } from 'src/app/services/toast.service';
import { UserService } from 'src/app/services/user.service';

const PAGE_LIMIT = 30;

@Component({
  selector: 'app-likes',
  templateUrl: './likes.component.html',
  styleUrls: ['./likes.component.scss'],
})
export class LikesComponent implements OnInit, OnDestroy {
  /** `null` until loaded from route + userService. */
  email: string | null = null;
  isSelf = false;
  isPrivate = false;
  loading = true;
  loadingMore = false;

  tracks: LikesTrackDisplayItem[] = [];
  total = 0;
  /**
   * Next offset to request, or `null` when no more pages.
   * Backend uses offset-based pagination (see lambdas/likes_by_user/handler.py).
   */
  nextOffset: number | null = 0;

  searchQuery = '';
  private search$ = new Subject<string>();
  private destroy$ = new Subject<void>();

  constructor(
    private route: ActivatedRoute,
    private likesService: LikesService,
    private playerService: PlayerService,
    private toastService: ToastService,
    private userService: UserService,
  ) {}

  ngOnInit(): void {
    this.route.params.pipe(takeUntil(this.destroy$)).subscribe((params) => {
      const routeEmail = params['email'];
      const selfEmail = this.userService.getEmail();
      this.isSelf = !routeEmail || routeEmail === selfEmail;
      this.email = this.isSelf ? selfEmail : routeEmail;
      this.reset();
      this.loadPage();
    });

    // Search is client-side (mirroring iOS LikesViewModel.filteredItems).
    // Debounce stays so we don't thrash the filter on every keystroke, but
    // we no longer re-fetch from the server.
    this.search$
      .pipe(debounceTime(150), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe(() => {
        // No-op subscription; `filteredTracks` getter recomputes on render.
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onSearchChange(q: string): void {
    this.searchQuery = q;
    this.search$.next(q);
  }

  loadMore(): void {
    if (this.nextOffset == null || this.loadingMore || !this.email) return;
    this.loadingMore = true;
    this.likesService
      .getLikesByUser(this.email, {
        limit: PAGE_LIMIT,
        offset: this.nextOffset,
      })
      .pipe(take(1))
      .subscribe({
        next: (resp) => {
          this.tracks = [...this.tracks, ...resp.tracks];
          this.nextOffset = resp.hasMore ? resp.nextOffset ?? null : null;
          this.total = resp.total;
          this.loadingMore = false;
        },
        error: () => {
          this.loadingMore = false;
        },
      });
  }

  playSong(track: LikesTrackDisplayItem): void {
    if (track.trackId) {
      this.playerService.playSong(track.trackId);
    }
  }

  openInSpotify(track: LikesTrackDisplayItem): void {
    const url = track.trackUri
      ? `https://open.spotify.com/track/${track.trackId}`
      : '';
    if (url) {
      window.open(url, '_blank', 'noopener');
    }
  }

  get hasMore(): boolean {
    return this.nextOffset != null;
  }

  get displayName(): string {
    if (this.isSelf) return 'Your';
    return this.email ? `${this.email}'s` : "Friend's";
  }

  /** Client-side search filter — matches iOS LikesViewModel.filteredItems. */
  get filteredTracks(): LikesTrackDisplayItem[] {
    const q = this.searchQuery.trim().toLowerCase();
    if (!q) return this.tracks;
    return this.tracks.filter((t) => {
      const haystack = [t.trackName, t.artistName, t.albumName]
        .filter((s): s is string => !!s)
        .map((s) => s.toLowerCase())
        .join(' ');
      return haystack.includes(q);
    });
  }

  private reset(): void {
    this.tracks = [];
    this.nextOffset = 0;
    this.total = 0;
    this.isPrivate = false;
    this.loading = true;
  }

  private loadPage(): void {
    if (!this.email) {
      this.loading = false;
      return;
    }
    this.likesService
      .getLikesByUser(this.email, { limit: PAGE_LIMIT, offset: 0 })
      .pipe(take(1))
      .subscribe({
        next: (resp) => {
          this.tracks = resp.tracks;
          this.nextOffset = resp.hasMore ? resp.nextOffset ?? null : null;
          this.total = resp.total;
          this.loading = false;
        },
        error: (err) => {
          if (err?.status === 403) {
            this.isPrivate = true;
          }
          this.loading = false;
        },
      });
  }
}
