import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Subject, take, takeUntil } from 'rxjs';
import { AuthService } from 'src/app/services/auth.service';
import { UserService } from 'src/app/services/user.service';
import {
  ListeningHistoryService,
  RecentlyPlayedItem,
} from 'src/app/services/listening-history.service';
import { TopItemsData, TopItemsService } from 'src/app/services/top-items.service';
import { Broadcast, BroadcastsService } from 'src/app/services/broadcasts.service';
import { SpotlightSlide } from './spotlight-rotator/spotlight-rotator.component';
import { pickAlbumImage } from 'src/app/utils/spotify-image.util';

/** `.spotlight-image` renders at 72px (56px on mobile) — needs at least the
 * 300px Spotify image, or the 64px thumbnail shows up visibly blurry. */
const SPOTLIGHT_IMAGE_MIN_PX = 144;

/**
 * Home — logged-out visitors get the existing Spotify login CTA; logged-in
 * users get a real dashboard (this used to just redirect straight to
 * /my-profile).
 *
 * This component owns every network call the dashboard modules need
 * (recently-played, top-items, broadcasts) and hands the results down as
 * `@Input`s to presentational child modules, so each service is only ever
 * called once per page load even though several modules (the spotlight
 * rotator especially) draw from the same data.
 */
@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss'],
})
export class HomeComponent implements OnInit, OnDestroy {
  title = 'XOMIFY';

  isLoggedIn = false;
  userName = '';

  recentItems: RecentlyPlayedItem[] | null = null;
  recentError = false;

  topItemsData: TopItemsData | null = null;
  topItemsError = false;

  broadcasts: Broadcast[] = [];

  spotlightSlides: SpotlightSlide[] = [];

  /**
   * True until the first of the three concurrent fetches
   * (recently-played / top-items / broadcasts) resolves. `spotlightSlides`
   * is `[]` both before anything has loaded AND, in principle, once
   * everything has loaded with nothing to show -- this flag is what lets
   * the spotlight module tell those two states apart and render a skeleton
   * instead of just vanishing on first paint.
   */
  spotlightLoading = true;

  /**
   * My Favorites (WS-D) is a sibling PR. The merge order in the plan lands
   * it before this one, but that isn't guaranteed at any given point in
   * time -- checking the router's registered top-level routes lets the
   * Favorites quick-link and spotlight teaser degrade gracefully instead of
   * linking into a 404 if this PR is deployed first.
   */
  favoritesAvailable = false;

  // `/user/top-items` is cached server-side per UTC day (see
  // TopItemsService), but that's still a full network round-trip every time
  // this page mounts. A short sessionStorage cache here means navigating
  // away and back to Home within the same session shows the top-items
  // module instantly instead of re-showing its skeleton -- mirrors the
  // pattern ListeningHistoryService already uses for recently-played.
  private readonly topItemsCacheKey = 'xomify_home_top_items';
  private readonly topItemsCacheTTL = 10 * 60 * 1000; // 10 minutes

  private destroy$ = new Subject<void>();

  constructor(
    private authService: AuthService,
    private userService: UserService,
    private listeningHistoryService: ListeningHistoryService,
    private topItemsService: TopItemsService,
    private broadcastsService: BroadcastsService,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.isLoggedIn = this.authService.isLoggedIn();
    if (!this.isLoggedIn) return;

    this.favoritesAvailable = this.hasTopLevelRoute('favorites');
    this.loadUserName();
    this.loadRecentlyPlayed();
    this.loadTopItems();
    this.loadBroadcasts();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  login(): void {
    this.authService.login();
  }

  private hasTopLevelRoute(path: string): boolean {
    return this.router.config.some((route) => route.path === path);
  }

  private loadUserName(): void {
    const cached = this.userService.getUserName();
    if (cached) {
      this.userName = cached;
      return;
    }
    this.userService
      .ensureLoaded()
      .pipe(take(1), takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.userName = this.userService.getUserName();
        },
        error: () => {
          // Greeting just falls back to the generic title -- non-critical.
        },
      });
  }

  private loadRecentlyPlayed(): void {
    this.listeningHistoryService
      .getRecentlyPlayed()
      .pipe(take(1), takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.recentItems = response?.items ?? [];
          this.rebuildSpotlightSlides();
        },
        error: () => {
          this.recentItems = [];
          this.recentError = true;
          this.rebuildSpotlightSlides();
        },
      });
  }

  private loadTopItems(): void {
    const cached = this.getCachedTopItems();
    if (cached) {
      this.topItemsData = cached;
      this.rebuildSpotlightSlides();
      return;
    }

    this.topItemsService
      .getTopItems()
      .pipe(take(1), takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.topItemsData = response.data;
          this.setCachedTopItems(response.data);
          this.rebuildSpotlightSlides();
        },
        error: () => {
          this.topItemsError = true;
          this.rebuildSpotlightSlides();
        },
      });
  }

  private getCachedTopItems(): TopItemsData | null {
    try {
      const raw = sessionStorage.getItem(this.topItemsCacheKey);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as { data: TopItemsData; timestamp: number };
      if (Date.now() - parsed.timestamp > this.topItemsCacheTTL) {
        sessionStorage.removeItem(this.topItemsCacheKey);
        return null;
      }
      return parsed.data;
    } catch {
      return null;
    }
  }

  private setCachedTopItems(data: TopItemsData): void {
    try {
      sessionStorage.setItem(
        this.topItemsCacheKey,
        JSON.stringify({ data, timestamp: Date.now() }),
      );
    } catch {
      // Storage unavailable (private mode, quota) -- just skip caching,
      // the page still works, it re-fetches next visit.
    }
  }

  private loadBroadcasts(): void {
    this.broadcastsService
      .getActiveBroadcasts()
      .pipe(take(1), takeUntil(this.destroy$))
      .subscribe((broadcasts) => {
        this.broadcasts = broadcasts;
        this.rebuildSpotlightSlides();
      });
  }

  /**
   * Recomputed after each independent fetch resolves (success or failure)
   * so the spotlight can start showing whatever's ready first rather than
   * waiting on the slowest of three unrelated network calls.
   */
  private rebuildSpotlightSlides(): void {
    this.spotlightLoading = false;

    const slides: SpotlightSlide[] = [];

    const mostRecent = this.recentItems?.[0];
    if (mostRecent) {
      slides.push({
        id: `recent-${mostRecent.track.id}`,
        kind: 'recent',
        eyebrow: 'Just played',
        title: mostRecent.track.name,
        subtitle: mostRecent.track.artists?.map((a) => a.name).join(', '),
        image: pickAlbumImage(mostRecent.track.album?.images, SPOTLIGHT_IMAGE_MIN_PX),
        cta: 'View recent activity',
        link: ['/my-profile'],
        queryParams: { tab: 'recent' },
      });
    }

    const topTrack = this.topItemsData?.tracks.short_term?.[0];
    if (topTrack) {
      slides.push({
        id: `top-${topTrack.id}`,
        kind: 'top',
        eyebrow: "This month's #1",
        title: topTrack.name,
        subtitle: topTrack.artists?.map((a) => a.name).join(', '),
        image: pickAlbumImage(topTrack.album?.images, SPOTLIGHT_IMAGE_MIN_PX),
        cta: 'See your top songs',
        link: ['/top-songs'],
      });
    }

    slides.push({
      id: 'favorites-teaser',
      kind: 'favorites',
      eyebrow: this.favoritesAvailable ? 'My Favorites' : 'Coming soon',
      title: 'Build your all-time Favorites',
      subtitle: 'Curate ranked top songs, albums & artists by year.',
      cta: this.favoritesAvailable ? 'Open My Favorites' : undefined,
      link: this.favoritesAvailable ? ['/favorites'] : undefined,
    });

    // No `link` here -- the full broadcast is already shown in the
    // dismissible banner at the top of the page (`#app-updates`), so this
    // slide is informational only rather than duplicating navigation.
    const broadcast = this.broadcasts[0];
    if (broadcast) {
      slides.push({
        id: `broadcast-${broadcast.id}`,
        kind: 'broadcast',
        eyebrow: 'App update',
        title: broadcast.title,
        subtitle: broadcast.body,
      });
    }

    this.spotlightSlides = slides;
  }
}
