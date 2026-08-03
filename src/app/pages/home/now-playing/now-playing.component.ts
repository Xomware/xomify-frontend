import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Subject, interval, timer } from 'rxjs';
import { switchMap, takeUntil } from 'rxjs/operators';
import {
  NowPlayingService,
  NowPlayingState,
} from 'src/app/services/now-playing.service';
import { ImpersonationService } from 'src/app/services/impersonation.service';

/** How often to re-poll Spotify for the live playback state. 10s keeps the
 * widget within a track-change of reality without hammering the API; the
 * progress bar is advanced locally every second in between so it still reads
 * as smooth. */
const POLL_MS = 10_000;
/** Local progress-bar tick between server polls. */
const TICK_MS = 1_000;

/**
 * Home — live "Now playing" widget. Self-contained: owns its own polling of
 * `NowPlayingService` (unlike the sibling recently-played strip, whose data
 * HomeComponent fetches once and passes down) because it has to stay live and
 * outlive a single page-load fetch.
 *
 * Renders ONLY when something is actually playing — when nothing is, the host
 * collapses to nothing and the recently-played strip below carries the page.
 * Between server polls the progress bar advances off a local clock so it
 * moves smoothly; each poll re-syncs it to Spotify's real `progress_ms`.
 *
 * Impersonation just works via `AuthInterceptor` (direct Spotify call gets the
 * target's token); we additionally reset + refetch on every impersonation
 * enter/exit so the widget flips identity immediately instead of on the next
 * 10s tick.
 */
@Component({
  selector: 'app-home-now-playing',
  templateUrl: './now-playing.component.html',
  styleUrls: ['./now-playing.component.scss'],
})
export class NowPlayingComponent implements OnInit, OnDestroy {
  state: NowPlayingState | null = null;

  /** Spotify's `progress_ms` from the last poll, and the wall-clock time we
   * received it — together these let the 1s ticker extrapolate the current
   * position without another network call. */
  private syncedProgressMs = 0;
  private syncedAt = 0;
  /** The extrapolated position rendered by the progress bar. */
  displayProgressMs = 0;

  private destroy$ = new Subject<void>();

  constructor(
    private nowPlaying: NowPlayingService,
    private impersonation: ImpersonationService,
    private router: Router,
  ) {}

  ngOnInit(): void {
    // Server poll — immediate, then every POLL_MS.
    timer(0, POLL_MS)
      .pipe(
        switchMap(() => this.nowPlaying.getNowPlaying()),
        takeUntil(this.destroy$),
      )
      .subscribe((state) => this.applyState(state));

    // Local progress ticker.
    interval(TICK_MS)
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => this.tick());

    // Flip identity the instant impersonation starts/stops rather than on the
    // next poll — clear stale state and refetch now.
    this.impersonation.impersonatedEmail$
      .pipe(
        switchMap(() => {
          this.applyState(null);
          return this.nowPlaying.getNowPlaying();
        }),
        takeUntil(this.destroy$),
      )
      .subscribe((state) => this.applyState(state));
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private applyState(state: NowPlayingState | null): void {
    this.state = state;
    this.syncedProgressMs = state?.progressMs ?? 0;
    this.syncedAt = Date.now();
    this.displayProgressMs = this.syncedProgressMs;
  }

  private tick(): void {
    const s = this.state;
    if (!s || !s.track) return;
    if (!s.isPlaying) {
      this.displayProgressMs = this.syncedProgressMs;
      return;
    }
    const elapsed = Date.now() - this.syncedAt;
    this.displayProgressMs = Math.min(
      s.durationMs || this.syncedProgressMs,
      this.syncedProgressMs + elapsed,
    );
  }

  get progressPercent(): number {
    const s = this.state;
    if (!s || !s.durationMs) return 0;
    return Math.min(100, (this.displayProgressMs / s.durationMs) * 100);
  }

  progressLabel(): string {
    return this.formatMs(this.displayProgressMs);
  }

  durationLabel(): string {
    return this.formatMs(this.state?.durationMs ?? 0);
  }

  openTrack(): void {
    const albumId = this.state?.track?.albumId;
    if (albumId) {
      this.router.navigate(['/album', albumId]);
    }
  }

  private formatMs(ms: number): string {
    const total = Math.max(0, Math.floor(ms / 1000));
    const min = Math.floor(total / 60);
    const sec = total % 60;
    return `${min}:${sec.toString().padStart(2, '0')}`;
  }
}
