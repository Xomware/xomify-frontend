import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from 'src/app/services/auth.service';
import { UserService } from 'src/app/services/user.service';
import { LikesService } from 'src/app/services/likes.service';
import { SongService } from 'src/app/services/song.service';
import { ArtistService } from 'src/app/services/artist.service';
import { FriendsService } from 'src/app/services/friends.service';
import { TopItemsService } from 'src/app/services/top-items.service';
import { RatingsService } from 'src/app/services/ratings.service';
import { ShareFeedService, Share } from 'src/app/services/share-feed.service';
import {
  ListeningHistoryService,
  RecentlyPlayedItem,
} from 'src/app/services/listening-history.service';
import { forkJoin, Subject } from 'rxjs';
import { take, takeUntil } from 'rxjs/operators';
import { ToastService } from 'src/app/services/toast.service';

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

  /** In-page tab: `overview` (default), `recent`, or `settings`. Synced to `?tab=` query. */
  activeTab: 'overview' | 'recent' | 'settings' = 'overview';

  // Recent tab state — lazy-loaded the first time the tab opens.
  recentLoading = false;
  recentLoaded = false;
  recentItems: RecentlyPlayedItem[] = [];
  recentError = false;
  maxEnrollAttempts = 5;
  enrollAttempts = 0;
  disableEnrollButtons = false;
  maxReached = false;

  // Ticker state
  tickerItems: TickerItem[] = [];
  currentTickerType: 'song' | 'artist' | 'genre' = 'song';
  tickerLabel = 'Top Songs';
  tickerPaused = false;
  tickerLoaded = false;

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
    const images = item.track.album?.images ?? [];
    if (images.length === 0) return '';
    return images[images.length - 1]?.url || images[0]?.url || '';
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

  toggleWrapped(): void {
    this.wrappedEnrolled = !this.wrappedEnrolled;
    this.toggleEnrollments();
  }

  toggleReleaseRadar(): void {
    this.releaseRadarEnrolled = !this.releaseRadarEnrolled;
    this.toggleEnrollments();
  }

  toggleEnrollments(): void {
    if (this.maxReached) return;

    this.disableEnrollButtons = true;
    this.enrollAttempts++;

    this.userService
      .updateUserTableEnrollments(
        this.wrappedEnrolled,
        this.releaseRadarEnrolled
      )
      .pipe(take(1))
      .subscribe({
        next: () => {
          this.userService.setReleaseRadarEnrollment(
            this.releaseRadarEnrolled
          );
          this.userService.setWrappedEnrollment(this.wrappedEnrolled);
        },
        error: () => {
          this.toastService.showNegativeToast('Error Updating User Table');
          if (
            this.wrappedEnrolled !== this.userService.getWrappedEnrollment()
          ) {
            this.wrappedEnrolled = !this.wrappedEnrolled;
          }
          if (
            this.releaseRadarEnrolled !==
            this.userService.getReleaseRadarEnrollment()
          ) {
            this.releaseRadarEnrolled = !this.releaseRadarEnrolled;
          }
          this.disableEnrollButtons = false;
        },
        complete: () => {
          this.toastService.showPositiveToast(
            'Preferences updated successfully!'
          );
          if (this.enrollAttempts >= this.maxEnrollAttempts) {
            this.maxReached = true;
            this.disableEnrollButtons = true;
          } else {
            setTimeout(() => {
              if (!this.maxReached) {
                this.disableEnrollButtons = false;
              }
            }, 1000);
          }
        },
      });
  }
}
