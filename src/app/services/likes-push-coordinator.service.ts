import { Injectable } from '@angular/core';
import { Observable, EMPTY, forkJoin } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';
import { LikesService, LikePushItem } from './likes.service';
import { SongService } from './song.service';
import { AuthService } from './auth.service';
import { UserService } from './user.service';

const PUSHED_AT_KEY = 'xomify_likes_pushed_at';
const PUSH_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours

@Injectable({
  providedIn: 'root',
})
export class LikesPushCoordinatorService {
  constructor(
    private likesService: LikesService,
    private songService: SongService,
    private authService: AuthService,
    private userService: UserService,
  ) {}

  /**
   * Run the push if more than 24 hours have elapsed since the last run (or if
   * it has never run). Errors are swallowed so a push failure never blocks UI.
   */
  runIfDue(): Observable<void> {
    if (!this.isDue()) {
      return EMPTY;
    }

    const email = this.userService.getEmail();
    if (!email) {
      // No session yet — nothing to push for. Don't mark pushed.
      return EMPTY;
    }

    return this.fetchAllSavedTracks().pipe(
      switchMap((tracks) => this.likesService.pushUserLikes(email, tracks)),
      map(() => {
        this.markPushed();
      }),
      catchError((err) => {
        console.warn('[LikesPushCoordinator] push failed', err);
        return EMPTY;
      }),
    );
  }

  private isDue(): boolean {
    try {
      // localStorage so the 24h gate persists across tabs/refreshes.
      // sessionStorage was per-tab and re-fired the heavy push flow on
      // every refresh / new tab.
      const raw = localStorage.getItem(PUSHED_AT_KEY);
      if (!raw) return true;
      const pushedAt = new Date(raw).getTime();
      return Date.now() - pushedAt >= PUSH_INTERVAL_MS;
    } catch {
      return true;
    }
  }

  private markPushed(): void {
    try {
      localStorage.setItem(PUSHED_AT_KEY, new Date().toISOString());
    } catch {
      // best-effort
    }
  }

  /**
   * Paginate through `/me/tracks` and collect all saved tracks.
   * Returns an empty array (not an error) if the user has no saved tracks.
   */
  private fetchAllSavedTracks(): Observable<LikePushItem[]> {
    const accessToken = this.authService.getAccessToken();
    // Re-use SongService which already knows how to call /me/tracks.
    // getAllUserTracks starts at offset 0 and pages until done.
    return this.songService.getAllUserTracks(0).pipe(
      map((items: any[]) =>
        items.map((item: any) => ({
          trackId: item.track?.id ?? item.id ?? '',
          addedAt: item.added_at ?? new Date().toISOString(),
          trackName: item.track?.name ?? item.name ?? '',
          artistName:
            item.track?.artists?.[0]?.name ??
            item.artists?.[0]?.name ??
            '',
          albumName: item.track?.album?.name ?? item.album?.name ?? '',
          albumArtUrl:
            item.track?.album?.images?.[0]?.url ??
            item.album?.images?.[0]?.url ??
            '',
          trackUri: item.track?.uri ?? item.uri ?? '',
        })),
      ),
      catchError(() => {
        console.warn('[LikesPushCoordinator] failed to fetch saved tracks');
        return [[]];
      }),
    );
  }
}
