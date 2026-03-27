import { Component, OnDestroy, OnInit } from '@angular/core';
import { AuthService } from './services/auth.service';
import { Router, NavigationStart, NavigationEnd } from '@angular/router';
import { PlayerService } from './services/player.service';
import { Subject } from 'rxjs';
import { filter, takeUntil } from 'rxjs/operators';

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
    private router: Router,
    private playerService: PlayerService
  ) {}

  ngOnInit(): void {
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
