import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from 'src/app/services/auth.service';
import { UserService } from 'src/app/services/user.service';
import { SongService } from 'src/app/services/song.service';
import { ArtistService } from 'src/app/services/artist.service';
import { FriendsService } from 'src/app/services/friends.service';
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
  country = '';
  product = '';
  userId = '';
  spotifyProfileUrl = '';
  user: Record<string, unknown> | null = null;
  accessToken = '';
  wrappedEnrolled = false;
  releaseRadarEnrolled = false;
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
    private songService: SongService,
    private artistService: ArtistService,
    private friendsService: FriendsService,
    private toastService: ToastService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.accessToken = this.authService.getAccessToken();
    this.userName = this.userService.getUserName();

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
  }

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

    forkJoin({
      songs: this.songService.getTopTracks('short_term'),
      artists: this.artistService.getTopArtists('short_term'),
    })
      .pipe(take(1))
      .subscribe({
        next: (data) => {
          this.topSongs = (data.songs.items || []).slice(0, 10);
          this.topArtists = (data.artists.items || []).slice(0, 10);
          this.topGenres = this.extractTopGenres(data.artists.items || []);

          if (data.songs.items) {
            this.songService.setTopTracks(data.songs.items, [], []);
          }
          if (data.artists.items) {
            this.artistService.setShortTermTopArtists(data.artists.items);
          }

          this.initializeTicker();
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
