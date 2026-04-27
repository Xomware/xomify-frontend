import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Observable, Subject } from 'rxjs';
import {
  debounceTime,
  distinctUntilChanged,
  map,
  take,
  takeUntil,
} from 'rxjs/operators';
import {
  LikesByUserResponse,
  LikesService,
  LikesTrackDisplayItem,
} from 'src/app/services/likes.service';
import { PlayerService } from 'src/app/services/player.service';
import { SongService } from 'src/app/services/song.service';
import { ToastService } from 'src/app/services/toast.service';
import { UserService } from 'src/app/services/user.service';

const PAGE_LIMIT = 50;

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
   *  - Self path: Spotify offset into `/me/tracks`.
   *  - Friend path: backend offset into `/likes/by-user`.
   */
  nextOffset: number | null = 0;

  searchQuery = '';
  private search$ = new Subject<string>();
  private destroy$ = new Subject<void>();

  constructor(
    private route: ActivatedRoute,
    private likesService: LikesService,
    private songService: SongService,
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
    this.search$
      .pipe(debounceTime(150), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe(() => {
        // No-op — `filteredTracks` getter recomputes on render.
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
    this.fetch(this.nextOffset)
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
    this.fetch(0)
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

  /**
   * Self path goes straight to Spotify `/me/tracks` (mirrors iOS
   * `LikesSource.spotifyDirect`) — first page lands instantly without
   * waiting for the backend likes cache to be warm.
   *
   * Friend path goes through backend `/likes/by-user` (subject to the
   * target user's `likesPublic` flag — backend enforces).
   */
  private fetch(offset: number): Observable<LikesByUserResponse> {
    if (this.isSelf) {
      return this.songService.getUserTracks(offset, PAGE_LIMIT).pipe(
        map((spotifyResp: any) => {
          const items = spotifyResp?.items ?? [];
          const tracks: LikesTrackDisplayItem[] = items.map(mapSavedTrackItem);
          const total: number = spotifyResp?.total ?? offset + tracks.length;
          const itemsSoFar = offset + tracks.length;
          return {
            tracks,
            total,
            nextOffset: itemsSoFar,
            hasMore: itemsSoFar < total,
          };
        }),
      );
    }

    return this.likesService.getLikesByUser(this.email!, {
      limit: PAGE_LIMIT,
      offset,
    });
  }
}

/**
 * Convert a Spotify saved-tracks `items[i]` into the shared display shape.
 * Spotify wraps the actual track in `.track`; `added_at` lives on the wrapper.
 */
function mapSavedTrackItem(item: any): LikesTrackDisplayItem {
  const track = item?.track ?? {};
  const artists: any[] = Array.isArray(track.artists) ? track.artists : [];
  const images: any[] = Array.isArray(track.album?.images) ? track.album.images : [];
  return {
    trackId: track.id ?? '',
    addedAt: item?.added_at ?? '',
    trackName: track.name ?? '',
    artistName: artists.map((a) => a?.name).filter(Boolean).join(', '),
    albumName: track.album?.name ?? '',
    albumArtUrl: images[0]?.url ?? '',
    trackUri: track.uri ?? '',
  };
}
