import { Component, OnDestroy, OnInit } from '@angular/core';
import { AuthService } from './services/auth.service';
import { UserService } from './services/user.service';
import { LikesPushCoordinatorService } from './services/likes-push-coordinator.service';
import { Router, NavigationStart, NavigationEnd } from '@angular/router';
import { PlayerService } from './services/player.service';
import { Subject } from 'rxjs';
import { filter, switchMap, take, takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class AppComponent implements OnDestroy, OnInit {
  title = 'XOMIFY';
  private destroy$ = new Subject<void>();

  constructor(
    private authService: AuthService,
    private userService: UserService,
    private likesPushCoordinator: LikesPushCoordinatorService,
    private router: Router,
    private playerService: PlayerService
  ) {}

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
        this.playerService.stopSong();
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
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.authService.logout();
  }
}
