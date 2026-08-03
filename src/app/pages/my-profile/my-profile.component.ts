import {
  Component,
  ElementRef,
  HostListener,
  OnInit,
  OnDestroy,
  QueryList,
  ViewChild,
  ViewChildren,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from 'src/app/services/auth.service';
import { UserService } from 'src/app/services/user.service';
import { LikesService } from 'src/app/services/likes.service';
import { SongService } from 'src/app/services/song.service';
import { ArtistService } from 'src/app/services/artist.service';
import { FriendsService } from 'src/app/services/friends.service';
import { TopItemsService } from 'src/app/services/top-items.service';
import { RatingsService } from 'src/app/services/ratings.service';
import {
  FavoriteItem,
  FavoritesOverall,
  FavoritesService,
} from 'src/app/services/favorites.service';
import { ShareFeedService, Share } from 'src/app/services/share-feed.service';
import {
  ListeningHistoryService,
  RecentlyPlayedItem,
} from 'src/app/services/listening-history.service';
import { forkJoin, Subject } from 'rxjs';
import { take, takeUntil } from 'rxjs/operators';
import { ToastService } from 'src/app/services/toast.service';
import { pickAlbumImage } from 'src/app/utils/spotify-image.util';

/** `.recent-art` renders at 56px — needs at least the 300px Spotify image,
 * or the 64px thumbnail shows up visibly blurry (especially on retina). */
const RECENT_ART_MIN_PX = 112;

interface TickerItem {
  id: string;
  name: string;
  image?: string;
  subtitle?: string;
  type: 'song' | 'artist' | 'genre';
}

interface SpotifyArtistRef {
  name: string;
  id?: string;
}

interface SpotifyTrackRef {
  id: string;
  name: string;
  album?: { images?: { url: string }[] };
  artists?: SpotifyArtistRef[];
  genres?: string[];
}

interface SpotifyArtistRef2 {
  id: string;
  name: string;
  images?: { url: string }[];
  genres?: string[];
}

@Component({
  selector: 'app-my-profile-page',
  templateUrl: './my-profile.component.html',
  styleUrls: ['./my-profile.component.scss'],
})
export class MyProfileComponent implements OnInit, OnDestroy {
  loading = true;
  profilePicture = '';
  userName = '';
  email = '';
  followersCount = 0;
  followingCount = 0;
  friendsCount = 0;
  playlistCount = 0;
  likesCount = 0;
  ratingsCount = 0;
  sharesCount = 0;
  likesPublic = false;
  likesPublicSaving = false;
  country = '';
  product = '';
  userId = '';
  spotifyProfileUrl = '';
  user: Record<string, unknown> | null = null;
  accessToken = '';
  wrappedEnrolled = false;
  releaseRadarEnrolled = false;
  wrappedSaving = false;
  releaseRadarSaving = false;

  /** In-page tab: `overview` (default), `recent`, or `settings`. Synced to `?tab=` query. */
  activeTab: 'overview' | 'recent' | 'settings' = 'overview';

  /** Tab options for the name dropdown, in display order. */
  readonly tabOptions: { id: 'overview' | 'recent' | 'settings'; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'recent', label: 'Recent' },
    { id: 'settings', label: 'Settings' },
  ];

  /** Tabs are chosen from a dropdown opened off the profile name/heading
   * (rather than an always-visible tab bar) — `false` until the trigger is
   * clicked. */
  tabsMenuOpen = false;

  @ViewChild('tabsMenuTrigger') tabsMenuTriggerRef?: ElementRef<HTMLButtonElement>;
  @ViewChildren('tabsMenuItem') tabsMenuItemRefs?: QueryList<ElementRef<HTMLButtonElement>>;

  // Recent tab state — lazy-loaded the first time the tab opens.
  recentLoading = false;
  recentLoaded = false;
  recentItems: RecentlyPlayedItem[] = [];
  recentError = false;

  // Ticker state
  tickerItems: TickerItem[] = [];
  currentTickerType: 'song' | 'artist' | 'genre' = 'song';
  tickerLabel = 'Top Songs';
  tickerPaused = false;
  tickerLoaded = false;

  // My Favorites summary card (curated best-of — separate from the derived
  // ticker above). Loaded independently and non-blocking: a slow/unmerged
  // favorites endpoint should never hold up the rest of the profile.
  readonly favoritesYear = new Date().getFullYear();
  favoritesOverall: FavoritesOverall = { songs: [], albums: [], artists: [] };
  favoritesLoaded = false;

  private topSongs: SpotifyTrackRef[] = [];
  private topArtists: SpotifyArtistRef2[] = [];
  private topGenres: { name: string; count: number }[] = [];
  private destroy$ = new Subject<void>();
  private tickerInterval: ReturnType<typeof setInterval> | null = null;

  constructor(
    private authService: AuthService,
    private userService: UserService,
    private likesService: LikesService,
    private songService: SongService,
    private artistService: ArtistService,
    private friendsService: FriendsService,
    private topItemsService: TopItemsService,
    private ratingsService: RatingsService,
    private favoritesService: FavoritesService,
    private shareFeedService: ShareFeedService,
    private listeningHistoryService: ListeningHistoryService,
    private toastService: ToastService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    this.accessToken = this.authService.getAccessToken();
    this.userName = this.userService.getUserName();

    // Drive tab selection from the URL so /my-profile?tab=settings is a deep link.
    this.route.queryParamMap.pipe(takeUntil(this.destroy$)).subscribe((params) => {
      const tab = params.get('tab');
      if (tab === 'settings') {
        this.activeTab = 'settings';
      } else if (tab === 'recent') {
        this.activeTab = 'recent';
        this.ensureRecentLoaded();
      } else {
        this.activeTab = 'overview';
      }
    });

    this.friendsService.friendsList$
      .pipe(takeUntil(this.destroy$))
      .subscribe((friendsList) => {
        if (friendsList) {
          this.friendsCount = friendsList.acceptedCount || 0;
        }
      });

    const email = this.userService.getEmail();
    if (email) {
      this.friendsService.setCurrentUserEmail(email);
    }

    if (this.userName.length === 0) {
      this.loadUser();
    } else {
      this.populateUserData();
      this.loadAdditionalData();
    }

    this.loadFavoritesSummary();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    if (this.tickerInterval) {
      clearInterval(this.tickerInterval);
    }
  }

  selectTab(tab: 'overview' | 'recent' | 'settings'): void {
    this.activeTab = tab;
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: tab === 'overview' ? {} : { tab },
      queryParamsHandling: '',
      replaceUrl: true,
    });
    if (tab === 'recent') {
      this.ensureRecentLoaded();
    }
  }

  /** Label shown next to the profile name for the currently active tab. */
  get activeTabLabel(): string {
    return this.tabOptions.find((t) => t.id === this.activeTab)?.label ?? 'Overview';
  }

  /**
   * Tabs live in a dropdown opened off the profile name/heading rather than
   * an always-visible tab bar. `selectTab` (query-param sync + lazy loads)
   * is unchanged — this dropdown is just a different control wired to it.
   */
  toggleTabsMenu(event: Event): void {
    event.stopPropagation();
    if (this.tabsMenuOpen) {
      this.closeTabsMenu();
    } else {
      this.openTabsMenu();
    }
  }

  openTabsMenu(): void {
    this.tabsMenuOpen = true;
    // Wait for the *ngIf'd menu to render before moving focus into it.
    queueMicrotask(() => this.focusActiveMenuItem());
  }

  closeTabsMenu(refocusTrigger = false): void {
    if (!this.tabsMenuOpen) return;
    this.tabsMenuOpen = false;
    if (refocusTrigger) {
      this.tabsMenuTriggerRef?.nativeElement.focus();
    }
  }

  selectTabFromMenu(tab: 'overview' | 'recent' | 'settings'): void {
    this.selectTab(tab);
    this.closeTabsMenu(true);
  }

  /** Opening the menu from the trigger button: Down/Enter/Space open it and
   * move focus to the active tab's item (native `click` already handles
   * mouse/touch and Enter/Space on the button itself). */
  onTriggerKeydown(event: KeyboardEvent): void {
    if (event.key === 'ArrowDown' && !this.tabsMenuOpen) {
      event.preventDefault();
      this.openTabsMenu();
    }
  }

  /** Roving arrow-key navigation + Home/End/Escape inside the open menu. */
  onMenuKeydown(event: KeyboardEvent): void {
    const items = this.tabsMenuItemRefs?.toArray().map((r) => r.nativeElement) ?? [];
    if (items.length === 0) return;
    const currentIndex = items.indexOf(document.activeElement as HTMLButtonElement);

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        items[(currentIndex + 1 + items.length) % items.length]?.focus();
        break;
      case 'ArrowUp':
        event.preventDefault();
        items[(currentIndex - 1 + items.length) % items.length]?.focus();
        break;
      case 'Home':
        event.preventDefault();
        items[0]?.focus();
        break;
      case 'End':
        event.preventDefault();
        items[items.length - 1]?.focus();
        break;
      case 'Escape':
        event.preventDefault();
        this.closeTabsMenu(true);
        break;
      case 'Tab':
        // Let focus leave naturally, just collapse the menu behind it.
        this.closeTabsMenu();
        break;
    }
  }

  private focusActiveMenuItem(): void {
    const items = this.tabsMenuItemRefs?.toArray() ?? [];
    const activeIndex = this.tabOptions.findIndex((t) => t.id === this.activeTab);
    (items[activeIndex]?.nativeElement ?? items[0]?.nativeElement)?.focus();
  }

  /** Click-outside-to-close, mirroring the toolbar's nav-group dropdown pattern. */
  @HostListener('document:click', ['$event'])
  onDocumentClickForTabsMenu(event: MouseEvent): void {
    if (!this.tabsMenuOpen) return;
    const target = event.target as HTMLElement;
    if (!target.closest('.profile-name-control')) {
      this.closeTabsMenu();
    }
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/home']);
  }

  private populateUserData(): void {
    this.user = this.userService.getUser();
    this.userName = this.userService.getUserName();
    this.profilePicture = this.userService.getProfilePic();
    this.email = this.userService.getEmail();
    this.followersCount = this.userService.getFollowers();
    this.wrappedEnrolled = this.userService.getWrappedEnrollment();
    this.releaseRadarEnrolled = this.userService.getReleaseRadarEnrollment();

    const cachedPlaylistCount = this.userService.getPlaylistCount();
    const cachedFollowingCount = this.userService.getFollowingCount();
    const cachedFriendsList = this.friendsService.getCachedFriendsList();

    this.likesCount = this.userService.getLikesCount();
    this.likesPublic = this.userService.getLikesPublic();

    if (cachedPlaylistCount > 0) {
      this.playlistCount = cachedPlaylistCount;
    }
    if (cachedFollowingCount > 0) {
      this.followingCount = cachedFollowingCount;
    }
    if (cachedFriendsList) {
      this.friendsCount = cachedFriendsList.acceptedCount || 0;
    }

    if (this.user) {
      this.country = (this.user['country'] as string) || 'Unknown';
      this.product = (this.user['product'] as string) || 'free';
      this.userId = (this.user['id'] as string) || '';
      const externalUrls = this.user['external_urls'] as Record<string, string> | undefined;
      this.spotifyProfileUrl = externalUrls?.['spotify'] || 'https://open.spotify.com';
    }
  }

  loadUser(): void {
    this.loading = true;
    this.userService
      .getUserData()
      .pipe(take(1))
      .subscribe({
        next: (data) => {
          this.userService.setUser(data);
          this.populateUserData();

          if (data.email) {
            this.friendsService.setCurrentUserEmail(data.email);
          }

          this.loadAdditionalData();
          this.updateUserTable();

          this.userService
            .getUserTableData(data.email)
            .pipe(take(1))
            .subscribe({
              next: (xomifyData) => {
                this.wrappedEnrolled = xomifyData?.activeWrapped ?? false;
                this.releaseRadarEnrolled =
                  xomifyData?.activeReleaseRadar ?? false;
                this.userService.setWrappedEnrollment(this.wrappedEnrolled);
                this.userService.setReleaseRadarEnrollment(
                  this.releaseRadarEnrolled
                );
              },
              error: () => {
                // New user -- no xomify data yet
              },
            });
        },
        error: () => {
          this.toastService.showNegativeToast('Error fetching User');
          this.loading = false;
        },
      });
  }

  private loadAdditionalData(): void {
    // Cache fast-path: both counts persist on UserService for the session.
    // If we already have non-zero values, skip the Spotify round-trip --
    // these are display-only counters that don't change mid-session.
    const cachedPlaylistCount = this.userService.getPlaylistCount();
    const cachedFollowingCount = this.userService.getFollowingCount();

    if (cachedPlaylistCount > 0 && cachedFollowingCount > 0) {
      this.playlistCount = cachedPlaylistCount;
      this.followingCount = cachedFollowingCount;
      this.loading = false;
      this.loadTickerData();
      this.loadFriendsCount();
      return;
    }

    forkJoin({
      playlists: this.userService.getUserPlaylists(1),
      following: this.userService.getFollowedArtists(1),
    })
      .pipe(take(1))
      .subscribe({
        next: (data) => {
          this.playlistCount = data.playlists?.total || 0;
          this.userService.setPlaylistCount(this.playlistCount);

          this.followingCount = data.following?.artists?.total || 0;
          this.userService.setFollowingCount(this.followingCount);

          this.loading = false;
          this.loadTickerData();
          this.loadFriendsCount();
        },
        error: () => {
          this.loading = false;
        },
      });
  }

  private loadFriendsCount(): void {
    const email = this.email || this.userService.getEmail();
    if (!email) return;

    const cached = this.friendsService.getCachedFriendsList();
    if (cached) {
      this.friendsCount = cached.acceptedCount || 0;
    }

    this.friendsService
      .getFriendsList(email, true)
      .pipe(take(1))
      .subscribe({
        next: (response) => {
          this.friendsCount = response.acceptedCount || 0;
        },
        error: () => {
          // Silently fail -- cached count is already displayed
        },
      });

    // Refresh the likes count from Spotify directly. We previously called
    // `/likes/by-user?targetEmail=self&limit=1` for the chip, but that hit
    // the backend likes-cache table which stays empty until a successful
    // /likes/push. The web push has been failing on every batch (missing
    // body fields — fixed in this branch), so most users had a 0 cache.
    // `/me/tracks?limit=1` returns `total` in O(1) and matches what iOS
    // does for its own count.
    this.songService
      .getUserTracks(0, 1)
      .pipe(take(1))
      .subscribe({
        next: (resp: { total?: number } | null) => {
          const fresh = resp?.total ?? 0;
          if (fresh > 0) {
            this.likesCount = fresh;
            this.userService.setLikesCount(fresh);
          }
        },
        error: () => {
          // Silent — cached value (if any) stays on screen.
        },
      });

    // Ratings count — `/ratings/all` returns every rating the caller has made;
    // the chip just shows .length. RatingsService caches the array, so
    // subsequent visits to this page or the Ratings page reuse it.
    this.ratingsService
      .getAllRatings(email)
      .pipe(take(1))
      .subscribe({
        next: (ratings) => {
          this.ratingsCount = Array.isArray(ratings) ? ratings.length : 0;
        },
        error: () => {
          // Silent — chip just stays at 0.
        },
      });

    // Posts (shares) count — backend has no dedicated count endpoint, but
    // `/shares/user?limit=100` returns the most recent page; for the vast
    // majority of users this is the entire history. If a user has 100+
    // shares we under-count slightly — acceptable for a profile chip.
    this.shareFeedService
      .getSharesByUser(email, { limit: 100 })
      .pipe(take(1))
      .subscribe({
        next: (response) => {
          this.sharesCount = response?.shares?.length ?? 0;
        },
        error: () => {
          // Silent.
        },
      });
  }

  /**
   * Lazy-load the Recent tab's listening history. We use Spotify's
   * `/me/player/recently-played` (last 50 plays) directly through
   * ListeningHistoryService. The service has its own 10-min sessionStorage
   * cache so opening + closing the tab in the same session is instant.
   */
  private ensureRecentLoaded(): void {
    if (this.recentLoaded || this.recentLoading) return;
    this.recentLoading = true;
    this.recentError = false;

    this.listeningHistoryService
      .getRecentlyPlayed()
      .pipe(take(1))
      .subscribe({
        next: (response) => {
          this.recentItems = response?.items ?? [];
          this.recentLoaded = true;
          this.recentLoading = false;
        },
        error: () => {
          this.recentError = true;
          this.recentLoading = false;
        },
      });
  }

  trackByPlayedAt(_index: number, item: RecentlyPlayedItem): string {
    return `${item.played_at}-${item.track.id}`;
  }

  recentTrackImage(item: RecentlyPlayedItem): string {
    return pickAlbumImage(item.track.album?.images, RECENT_ART_MIN_PX);
  }

  recentTrackArtists(item: RecentlyPlayedItem): string {
    return (item.track.artists ?? []).map((a) => a.name).join(', ');
  }

  recentTrackPlayedLabel(item: RecentlyPlayedItem): string {
    return this.listeningHistoryService.getRelativeTime(item.played_at);
  }

  openRecentTrack(item: RecentlyPlayedItem): void {
    const albumId = item.track.album?.id;
    if (albumId) {
      this.router.navigate(['/album', albumId]);
    }
  }

  /**
   * Hydrate the profile ticker from the consolidated `/user/top-items`
   * endpoint via {@link TopItemsService}. Same source as the Music Taste
   * pages (top-songs/top-artists/top-genres), server-cached per UTC day.
   *
   * Fast-path: if SongService + ArtistService already have short-term
   * caches populated by a prior visit to top-songs/top-artists, reuse
   * them and skip the network call. We never WRITE back to those caches
   * here — partial writes (short only, medium/long empty) used to poison
   * the cache and trigger duplicate `/user/top-items` fetches on the
   * Music Taste pages. TopItemsService owns the source of truth.
   */
  private loadTickerData(): void {
    const cachedSongs = this.songService.getShortTermTopTracks();
    const cachedArtists = this.artistService.getShortTermTopArtists();

    if (cachedSongs.length > 0 && cachedArtists.length > 0) {
      this.topSongs = cachedSongs.slice(0, 10);
      this.topArtists = cachedArtists.slice(0, 10);
      this.topGenres = this.extractTopGenres(cachedArtists);
      this.initializeTicker();
      return;
    }

    this.topItemsService
      .getTopItems()
      .pipe(take(1))
      .subscribe({
        next: (response) => {
          const tracks = response.data.tracks.short_term ?? [];
          const artists = response.data.artists.short_term ?? [];

          this.topSongs = tracks.slice(0, 10);
          this.topArtists = artists.slice(0, 10);
          this.topGenres = this.extractTopGenres(artists);

          this.initializeTicker();
        },
        error: () => {
          // Ticker is non-critical UI -- swallow the error so the rest of
          // the profile page still renders. Surfacing here would duplicate
          // toasts already shown by other surfaces that share this endpoint.
        },
      });
  }

  /**
   * Compact "My Favorites" summary — the curated Overall top-5s for the
   * current year, plus a link into the full `/favorites` page. `getFavorites`
   * already resolves a 404 (no favorites saved yet) to an empty envelope
   * rather than erroring, so this never needs its own error state — an empty
   * result just renders the "set up your favorites" prompt.
   */
  private loadFavoritesSummary(): void {
    this.favoritesService
      .getFavorites(this.favoritesYear)
      .pipe(take(1))
      .subscribe({
        next: (resp) => {
          this.favoritesOverall = resp.overall;
          this.favoritesLoaded = true;
        },
        error: () => {
          // Non-critical card — leave it showing the "set up" prompt.
          this.favoritesLoaded = true;
        },
      });
  }

  get hasAnyFavorites(): boolean {
    return (
      this.favoritesOverall.songs.length > 0 ||
      this.favoritesOverall.albums.length > 0 ||
      this.favoritesOverall.artists.length > 0
    );
  }

  get favoritesSummaryGroups(): { label: string; items: FavoriteItem[] }[] {
    return [
      { label: 'Songs', items: this.favoritesOverall.songs },
      { label: 'Albums', items: this.favoritesOverall.albums },
      { label: 'Artists', items: this.favoritesOverall.artists },
    ];
  }

  private extractTopGenres(
    artists: SpotifyArtistRef2[]
  ): { name: string; count: number }[] {
    const genreMap = new Map<string, number>();

    artists.forEach((artist) => {
      (artist.genres || []).forEach((genre: string) => {
        genreMap.set(genre, (genreMap.get(genre) || 0) + 1);
      });
    });

    return Array.from(genreMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, count]) => ({ name, count }));
  }

  private initializeTicker(): void {
    this.updateTickerItems('song');
    this.tickerLoaded = true;

    this.tickerInterval = setInterval(() => {
      this.rotateTickerType();
    }, 15000);
  }

  private rotateTickerType(): void {
    switch (this.currentTickerType) {
      case 'song':
        this.updateTickerItems('artist');
        break;
      case 'artist':
        this.updateTickerItems('genre');
        break;
      case 'genre':
        this.updateTickerItems('song');
        break;
    }
  }

  private updateTickerItems(type: 'song' | 'artist' | 'genre'): void {
    this.currentTickerType = type;

    switch (type) {
      case 'song':
        this.tickerLabel = 'Top Songs';
        this.tickerItems = this.topSongs.map((song) => ({
          id: song.id,
          name: song.name,
          image: song.album?.images?.[2]?.url || song.album?.images?.[0]?.url,
          subtitle: song.artists
            ?.map((a: SpotifyArtistRef) => a.name)
            .join(', '),
          type: 'song' as const,
        }));
        break;

      case 'artist':
        this.tickerLabel = 'Top Artists';
        this.tickerItems = this.topArtists.map((artist) => ({
          id: artist.id,
          name: artist.name,
          image: artist.images?.[2]?.url || artist.images?.[0]?.url,
          subtitle: artist.genres?.[0] || 'Artist',
          type: 'artist' as const,
        }));
        break;

      case 'genre':
        this.tickerLabel = 'Top Genres';
        this.tickerItems = this.topGenres.map((genre, index) => ({
          id: `genre-${index}`,
          name: genre.name,
          subtitle: `${genre.count} artists`,
          type: 'genre' as const,
        }));
        break;
    }
  }

  onTickerItemClick(item: TickerItem): void {
    switch (item.type) {
      case 'song':
        this.router.navigate(['/top-songs']);
        break;
      case 'artist':
        this.router.navigate(['/artist-profile', item.id]);
        break;
      case 'genre':
        this.router.navigate(['/top-genres']);
        break;
    }
  }

  updateUserTable(): void {
    this.userService
      .updateUserTableRefreshToken()
      .pipe(take(1))
      .subscribe({
        next: (xomUser) => {
          this.wrappedEnrolled = xomUser.activeWrapped ?? false;
          this.releaseRadarEnrolled = xomUser.activeReleaseRadar ?? false;
          this.userService.setReleaseRadarEnrollment(
            this.releaseRadarEnrolled
          );
          this.userService.setWrappedEnrollment(this.wrappedEnrolled);
        },
        error: (err: unknown) => {
          console.error('Error Updating User Table', err);
        },
      });
  }

  toggleLikesPublic(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    const previous = this.likesPublic;
    this.likesPublic = checked;
    this.likesPublicSaving = true;

    this.likesService
      .setLikesPublic(checked)
      .pipe(take(1))
      .subscribe({
        next: () => {
          this.userService.setLikesPublic(checked);
          this.likesPublicSaving = false;
          this.toastService.showPositiveToast(
            checked ? 'Likes are now visible to friends.' : 'Likes are now private.',
          );
        },
        error: () => {
          // Rollback
          this.likesPublic = previous;
          this.likesPublicSaving = false;
          this.toastService.showNegativeToast('Could not update likes privacy.');
        },
      });
  }

  /**
   * Toggle Monthly Wrapped enrollment. Sends a TARGETED single-flag update so
   * it can never clobber the Release Radar flag (the double-flag clobber bug).
   * Optimistic UI with rollback on error, mirroring toggleLikesPublic.
   */
  toggleWrapped(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    const previous = this.wrappedEnrolled;
    this.wrappedEnrolled = checked;
    this.wrappedSaving = true;

    this.userService
      .updateWrappedEnrollment(checked)
      .pipe(take(1))
      .subscribe({
        next: () => {
          this.userService.setWrappedEnrollment(checked);
          this.wrappedSaving = false;
          this.toastService.showPositiveToast(
            checked
              ? 'Enrolled in Monthly Wrapped.'
              : 'Unenrolled from Monthly Wrapped.'
          );
        },
        error: () => {
          this.wrappedEnrolled = previous;
          this.wrappedSaving = false;
          this.toastService.showNegativeToast(
            'Could not update Monthly Wrapped.'
          );
        },
      });
  }

  /**
   * Toggle Release Radar enrollment (targeted single-flag update — leaves the
   * Wrapped flag untouched). See {@link toggleWrapped}.
   */
  toggleReleaseRadar(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    const previous = this.releaseRadarEnrolled;
    this.releaseRadarEnrolled = checked;
    this.releaseRadarSaving = true;

    this.userService
      .updateReleaseRadarEnrollment(checked)
      .pipe(take(1))
      .subscribe({
        next: () => {
          this.userService.setReleaseRadarEnrollment(checked);
          this.releaseRadarSaving = false;
          this.toastService.showPositiveToast(
            checked
              ? 'Enrolled in Release Radar.'
              : 'Unenrolled from Release Radar.'
          );
        },
        error: () => {
          this.releaseRadarEnrolled = previous;
          this.releaseRadarSaving = false;
          this.toastService.showNegativeToast(
            'Could not update Release Radar.'
          );
        },
      });
  }
}
