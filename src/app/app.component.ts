import { Component, OnDestroy, OnInit } from '@angular/core';
import { AuthService } from './services/auth.service';
import { UserService } from './services/user.service';
import { LikesPushCoordinatorService } from './services/likes-push-coordinator.service';
import { VisitTrackerService } from './services/visit-tracker.service';
import { ImpersonationService } from './services/impersonation.service';
import { Router, NavigationStart, NavigationEnd } from '@angular/router';
import { PreviewPlayerService } from './services/preview-player.service';
import { Observable, Subject } from 'rxjs';
import { filter, switchMap, take, takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class AppComponent implements OnDestroy, OnInit {
  title = 'XOMIFY';
  private destroy$ = new Subject<void>();

  /** Drives `.app-container--impersonating` (see app.component.scss), which
   * reserves layout space for the impersonation banner and shifts the
   * toolbar + page content down to stay clear of it. */
  readonly isImpersonating$: Observable<boolean>;

  constructor(
    private authService: AuthService,
    private userService: UserService,
    private likesPushCoordinator: LikesPushCoordinatorService,
    private visitTracker: VisitTrackerService,
    private impersonation: ImpersonationService,
    private router: Router,
    private previewPlayer: PreviewPlayerService
  ) {
    this.isImpersonating$ = this.impersonation.isImpersonating$;
  }

  ngOnInit(): void {
    // On app boot, if a session already exists:
    // 1. Mint a Xomify JWT preemptively (restored sessions lack one until the
    //    OAuth callback fires again, causing 401s on the first API call).
    // 2. Then preload Spotify user + enrollment flags so pages like
    //    Wrapped/Release Radar don't render empty on a direct-URL visit.
    if (this.authService.isLoggedIn()) {
      this.authService
        .ensureXomifyJwt()
        .pipe(
          take(1),
          switchMap(() => this.userService.ensureLoaded()),
          take(1),
        )
        .subscribe();

      // Fire-and-forget likes push (max once per 24h).
      // Errors are swallowed inside the coordinator — push failure must not
      // block UI or other initialization paths.
      this.likesPushCoordinator.runIfDue().subscribe();
    }

    // Stop music playback when navigating between pages
    this.router.events
      .pipe(
        filter((event) => event instanceof NavigationStart),
        takeUntil(this.destroy$)
      )
      .subscribe(() => {
        this.previewPlayer.stop();
      });

    // Move focus to main content on route change for accessibility
    this.router.events
      .pipe(
        filter((event) => event instanceof NavigationEnd),
        takeUntil(this.destroy$)
      )
      .subscribe(() => {
        const main = document.getElementById('main-content');
        if (main) {
          main.focus({ preventScroll: true });
        }
      });

    // Log page visits (throttled/deduped, skips logged-out) — backs the
    // Admin Portal's Users→visits view. See VisitTrackerService.
    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntil(this.destroy$)
      )
      .subscribe((event) => {
        const path = event.urlAfterRedirects.split('?')[0].split('#')[0];
        this.visitTracker.log(path);
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.authService.logout();
  }
}
