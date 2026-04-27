import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Subject } from 'rxjs';
import {
  debounceTime,
  distinctUntilChanged,
  switchMap,
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
  cursor: string | null = null;

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

    // Debounced search
    this.search$
      .pipe(debounceTime(350), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe((q) => {
        this.reset();
        this.loadPage(q);
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onSearchChange(q: string): void {
    this.search$.next(q);
  }

  loadMore(): void {
    if (!this.cursor || this.loadingMore) return;
    this.loadingMore = true;
    this.likesService
      .getLikesByUser(this.email!, {
        limit: PAGE_LIMIT,
        cursor: this.cursor,
        q: this.searchQuery || undefined,
      })
      .pipe(take(1))
      .subscribe({
        next: (resp) => {
          this.tracks = [...this.tracks, ...resp.tracks];
          this.cursor = resp.cursor ?? null;
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
    return !!this.cursor;
  }

  get displayName(): string {
    if (this.isSelf) return 'Your';
    return this.email ? `${this.email}'s` : "Friend's";
  }

  private reset(): void {
    this.tracks = [];
    this.cursor = null;
    this.total = 0;
    this.isPrivate = false;
    this.loading = true;
  }

  private loadPage(q?: string): void {
    if (!this.email) {
      this.loading = false;
      return;
    }
    this.likesService
      .getLikesByUser(this.email, { limit: PAGE_LIMIT, q })
      .pipe(take(1))
      .subscribe({
        next: (resp) => {
          this.tracks = resp.tracks;
          this.cursor = resp.cursor ?? null;
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
