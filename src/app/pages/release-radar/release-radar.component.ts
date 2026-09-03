import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { UserService } from 'src/app/services/user.service';
import { FriendDataService } from 'src/app/services/friend-data.service';
import { FriendsService, type Friend } from 'src/app/services/friends.service';
import { PlayerService } from 'src/app/services/player.service';
import { ToastService } from 'src/app/services/toast.service';
import { QueueService, QueueTrack } from 'src/app/services/queue.service';
import { AlbumService } from 'src/app/services/album.service';
import { PlaylistService } from 'src/app/services/playlist.service';
import { ShareService } from 'src/app/services/share.service';
import {
  ReleaseRadarService,
  ReleaseRadarHistoryResponse,
  ReleaseRadarRelease,
  ReleaseRadarWeek,
} from 'src/app/services/release-radar.service';
import { take, catchError } from 'rxjs/operators';
import { of, forkJoin } from 'rxjs';
import { environment } from 'src/environments/environment';

interface CalendarDay {
  date: Date;
  dayOfMonth: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  releases: ReleaseRadarRelease[];
}

interface WeekOption {
  weekKey: string;
  label: string;
}

@Component({
  selector: 'app-release-radar',
  templateUrl: './release-radar.component.html',
  styleUrls: ['./release-radar.component.scss'],
})
export class ReleaseRadarComponent implements OnInit {
  // Data
  // Friend scope.
  showingFriends = false;
  selectedFriendEmail: string | null = null;
  friends: Friend[] = [];
  friendDataDenied = false;

  history: ReleaseRadarHistoryResponse | null = null;
  releases: ReleaseRadarRelease[] = [];
  filteredReleases: ReleaseRadarRelease[] = [];

  // State
  loading = true;
  error: string | null = null;

  // Enrollment state
  isEnrolled = false;
  enrollmentLoading = false;

  // View controls
  viewMode: 'calendar' | 'list' = 'calendar';
  filterType: 'all' | 'album' | 'single' = 'all';

  // Week filter for list view
  weekOptions: WeekOption[] = [];
  selectedWeekKey: string = '';

  // Calendar state
  viewDate = new Date();
  calendarDays: CalendarDay[] = [];
  selectedDay: CalendarDay | null = null;
  weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // Stats - dynamic based on view
  totalReleases = 0;
  albumCount = 0;
  singleCount = 0;
  upcomingCount = 0;
  statsLabel = '';

  // User info
  private userEmail: string = '';

  // Playlist generation
  isGeneratingPlaylist = false;
  generatedPlaylistUrl: string | null = null;

  constructor(
    private router: Router,
    private userService: UserService,
    private releaseRadarService: ReleaseRadarService,
    private friendData: FriendDataService,
    private friendsService: FriendsService,
    private playerService: PlayerService,
    private toastService: ToastService,
    private queueService: QueueService,
    private albumService: AlbumService,
    private playlistService: PlaylistService,
    private shareService: ShareService
  ) {}

  /**
   * The Spotify playlist for the week on screen, when one was built.
   * Works the same for your own weeks and a friend's — the id travels with the
   * week either way. Mirrors the iOS `selectedPlaylistURL`.
   */
  get selectedPlaylistUrl(): string | null {
    const week =
      this.history?.weeks?.find((w) => w.weekKey === this.selectedWeekKey) ??
      this.history?.weeks?.[0];
    return week?.playlistId ? `https://open.spotify.com/playlist/${week.playlistId}` : null;
  }

  get scopeLabel(): string {
    if (!this.showingFriends || !this.selectedFriendEmail) return 'Your new drops';
    const friend = this.friends.find(
      (f) => (f.friendEmail ?? f.email) === this.selectedFriendEmail,
    );
    return `${friend?.displayName || this.selectedFriendEmail}'s new drops`;
  }

  onScopeChange(showingFriends: boolean): void {
    this.showingFriends = showingFriends;
    this.loadReleases();
  }

  onFriendChange(email: string): void {
    this.selectedFriendEmail = email;
    this.loadReleases();
  }

  private loadFriends(): void {
    const email = this.userService.getEmail();
    if (!email) return;
    this.friendsService
      .getFriendsList(email)
      .pipe(take(1))
      .subscribe({
        next: (response) => (this.friends = response?.accepted ?? []),
        error: () => (this.friends = []),
      });
  }

  /**
   * A denial and "they have nothing" are one state: the backend returns the
   * same error for "not your friend" and "set to private".
   */
  private loadFriendRadar(email: string): void {
    this.loading = true;
    this.friendData
      .getReleaseRadar(email)
      .pipe(take(1))
      .subscribe({
        next: (response: any) => {
          this.history = response;
          this.releases = this.releaseRadarService.getAllReleasesFromHistory(response);
          this.weekOptions = this.releaseRadarService.buildWeekOptions(response);
          this.selectedWeekKey = response?.weeks?.[0]?.weekKey ?? '';
          this.friendDataDenied = (response?.weeks?.length ?? 0) === 0;
          this.loading = false;
        },
        error: () => {
          this.history = null;
          this.releases = [];
          this.weekOptions = [];
          this.friendDataDenied = true;
          this.loading = false;
        },
      });
  }

  ngOnInit(): void {
    this.loading = true;
    // Defer the email read and enrollment check until after the Spotify
    // profile + Xomify user row have been fetched. Direct navigation into
    // /release-radar without first visiting /my-profile would otherwise see
    // an empty email and default to an unpopulated calendar week.
    this.userService
      .ensureLoaded()
      .pipe(take(1))
      .subscribe({
        next: () => {
          this.isEnrolled = this.userService.getReleaseRadarEnrollment();
          this.loadUserAndReleases();
        },
        error: (err) => {
          // ensureLoaded now surfaces a genuine enrollment-load failure
          // instead of silently defaulting to "not enrolled."
          console.error('Error loading enrollment state:', err);
          this.error = 'Failed to load Release Radar. Please try again.';
          this.loading = false;
        },
      });
  }

  private loadUserAndReleases(): void {
    this.loading = true;
    this.userEmail = this.userService.getEmail();

    this.friendDataDenied = false;

    if (this.showingFriends && this.selectedFriendEmail) {
      this.loadFriendRadar(this.selectedFriendEmail);
      return;
    }

    if (!this.userEmail) {
      this.error = 'User email not available.';
      this.loading = false;
      return;
    }

    this.loadReleases();
  }

  loadReleases(forceRefresh = false): void {
    if (!this.userEmail) {
      this.error = 'User email not available.';
      this.loading = false;
      return;
    }

    if (forceRefresh) {
      this.releaseRadarService.clearCache(this.userEmail);
    }

    this.loading = true;
    this.error = null;

    const loadObservable = forceRefresh
      ? this.releaseRadarService.forceRefresh(this.userEmail)
      : this.releaseRadarService.loadReleaseRadar(this.userEmail);

    loadObservable.pipe(take(1)).subscribe({
      next: (response) => {
        if (!environment.production) {
          console.log('[ReleaseRadar] API response for', this.userEmail, response);
        }
        this.history = response;
        this.releases =
          this.releaseRadarService.getAllReleasesFromHistory(response);

        // Build week options from history
        this.weekOptions = this.releaseRadarService.buildWeekOptions(response);

        // Default to the most recent week that actually has data in DB.
        // The release-radar cron runs Saturdays, so the current calendar
        // week often has no record yet — defaulting to it would render an
        // empty page even when prior weeks have plenty of releases.
        const firstPopulatedWeek = response.weeks?.[0]?.weekKey;
        const stillValid =
          this.selectedWeekKey &&
          this.weekOptions.some((w) => w.weekKey === this.selectedWeekKey);
        if (!stillValid) {
          this.selectedWeekKey =
            firstPopulatedWeek ||
            response.currentWeek ||
            this.releaseRadarService.getCurrentWeekKey();
        }

        this.processReleases();
        this.loading = false;

        if (forceRefresh) {
          this.toastService.showPositiveToast('Releases refreshed');
        }
      },
      error: (err) => {
        console.error('Error loading releases:', err);
        this.error = 'Failed to load releases. Please try again.';
        this.loading = false;
      },
    });
  }

  private processReleases(): void {
    this.applyFilter();
    this.buildCalendar();
    this.updateStats();
  }

  /**
   * Update stats based on current view mode and selection
   */
  private updateStats(): void {
    let releasesToCount: ReleaseRadarRelease[] = [];

    if (this.viewMode === 'calendar') {
      // Calendar view: show stats for the currently viewed MONTH
      releasesToCount = this.getReleasesForMonth(this.viewDate);
      this.statsLabel = this.viewDate.toLocaleString('default', {
        month: 'long',
        year: 'numeric',
      });
    } else {
      // List view: show stats for the selected WEEK
      if (this.history && this.selectedWeekKey) {
        const weekData = this.history.weeks.find(
          (w) => w.weekKey === this.selectedWeekKey
        );
        if (weekData) {
          releasesToCount = weekData.releases;
          // Get week label from options or weekDisplay
          const weekOption = this.weekOptions.find(
            (w) => w.weekKey === this.selectedWeekKey
          );
          this.statsLabel =
            weekOption?.label || weekData.weekDisplay || this.selectedWeekKey;
        }
      }
    }

    // Calculate stats from the relevant releases
    this.totalReleases = releasesToCount.length;
    this.albumCount = releasesToCount.filter(
      (r) => r.albumType === 'album'
    ).length;
    this.singleCount = releasesToCount.filter(
      (r) => r.albumType === 'single'
    ).length;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    this.upcomingCount = releasesToCount.filter(
      (r) => new Date(r.releaseDate) >= today
    ).length;
  }

  /**
   * Get all releases for a specific month
   */
  private getReleasesForMonth(date: Date): ReleaseRadarRelease[] {
    const year = date.getFullYear();
    const month = date.getMonth();

    return this.releases.filter((release) => {
      const releaseDate = new Date(release.releaseDate);
      return (
        releaseDate.getFullYear() === year && releaseDate.getMonth() === month
      );
    });
  }

  private applyFilter(): void {
    let filtered = [...this.releases];

    // Apply type filter
    if (this.filterType !== 'all') {
      filtered = filtered.filter((r) => r.albumType === this.filterType);
    }

    // Apply week filter (only in list view)
    if (this.viewMode === 'list' && this.selectedWeekKey && this.history) {
      const weekData = this.history.weeks.find(
        (w) => w.weekKey === this.selectedWeekKey
      );
      if (weekData) {
        // Use albumId (the actual field from DynamoDB)
        const weekReleaseIds = new Set(weekData.releases.map((r) => r.albumId));
        filtered = filtered.filter((r) => weekReleaseIds.has(r.albumId));
      }
    }

    this.filteredReleases = filtered;
  }

  buildCalendar(): void {
    const year = this.viewDate.getFullYear();
    const month = this.viewDate.getMonth();

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - startDate.getDay());

    const endDate = new Date(lastDay);
    endDate.setDate(endDate.getDate() + (6 - endDate.getDay()));

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    this.calendarDays = [];
    const current = new Date(startDate);

    // For calendar, use type-filtered releases (not week-filtered)
    const calendarReleases =
      this.filterType === 'all'
        ? this.releases
        : this.releases.filter((r) => r.albumType === this.filterType);

    while (current <= endDate) {
      const dayReleases = this.getReleasesForDate(current, calendarReleases);
      const currentDate = new Date(current);

      this.calendarDays.push({
        date: currentDate,
        dayOfMonth: current.getDate(),
        isCurrentMonth: current.getMonth() === month,
        isToday: current.getTime() === today.getTime(),
        releases: dayReleases,
      });

      if (
        today.getDate() === currentDate.getDate() &&
        today.getMonth() === currentDate.getMonth() &&
        today.getFullYear() === currentDate.getFullYear()
      ) {
        this.selectedDay = this.calendarDays[this.calendarDays.length - 1];
      }

      current.setDate(current.getDate() + 1);
    }
  }

  private getReleasesForDate(
    date: Date,
    releases: ReleaseRadarRelease[]
  ): ReleaseRadarRelease[] {
    // Format the calendar cell's LOCAL date as YYYY-MM-DD. Using
    // toISOString() here converts to UTC and shifts the day backward/forward
    // for users west/east of UTC, causing releases to land on the wrong cell.
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;
    return releases.filter((release) => {
      const releaseStr = release.releaseDate;
      return releaseStr === dateStr;
    });
  }

  // ============================================
  // Enrollment
  // ============================================

  /**
   * On-page opt-in used only from the empty/no-content prompt. Enrolls in
   * Release Radar via a targeted single-flag update (cannot clobber Monthly
   * Wrapped). The persistent toggle lives in Settings.
   */
  enableReleaseRadar(): void {
    if (this.enrollmentLoading) return;
    this.enrollmentLoading = true;

    this.userService
      .updateReleaseRadarEnrollment(true)
      .pipe(take(1))
      .subscribe({
        next: () => {
          this.isEnrolled = true;
          this.userService.setReleaseRadarEnrollment(true);
          this.toastService.showPositiveToast('Enrolled in Release Radar!');
          this.enrollmentLoading = false;
        },
        error: (err) => {
          console.error('Error updating enrollment:', err);
          this.toastService.showNegativeToast('Failed to update enrollment');
          this.enrollmentLoading = false;
        },
      });
  }

  // ============================================
  // View Controls
  // ============================================

  setWeekFilter(weekKey: string): void {
    this.selectedWeekKey = weekKey;
    this.generatedPlaylistUrl = null;
    this.applyFilter();
    this.updateStats();
  }

  setFilterType(type: 'all' | 'album' | 'single'): void {
    this.filterType = type;
    this.applyFilter();
    this.buildCalendar();
  }

  setViewMode(mode: 'calendar' | 'list'): void {
    this.viewMode = mode;
    this.selectedDay = null;
    this.applyFilter();
    this.updateStats();
  }

  // ============================================
  // Calendar Navigation
  // ============================================

  previousMonth(): void {
    this.viewDate = new Date(
      this.viewDate.getFullYear(),
      this.viewDate.getMonth() - 1,
      1
    );
    this.buildCalendar();
    this.updateStats();
    this.selectedDay = null;
  }

  nextMonth(): void {
    this.viewDate = new Date(
      this.viewDate.getFullYear(),
      this.viewDate.getMonth() + 1,
      1
    );
    this.buildCalendar();
    this.updateStats();
    this.selectedDay = null;
  }

  goToToday(): void {
    this.viewDate = new Date();
    this.buildCalendar();
    this.updateStats();
    this.selectedDay = null;
  }

  selectDay(day: CalendarDay): void {
    if (day.releases.length > 0) {
      this.selectedDay = this.selectedDay === day ? null : day;
    }
  }

  // ============================================
  // Actions
  // ============================================

  refresh(): void {
    this.loadReleases(true);
  }

  async shareWeek(): Promise<void> {
    if (!this.history || !this.selectedWeekKey) return;
    const weekData = this.history.weeks.find((w) => w.weekKey === this.selectedWeekKey);
    if (!weekData) return;

    const label =
      this.weekOptions.find((w) => w.weekKey === this.selectedWeekKey)?.label ||
      weekData.weekDisplay ||
      this.selectedWeekKey;

    const topFive = weekData.releases
      .slice(0, 5)
      .map((r, i) => `${i + 1}. ${r.albumName} — ${r.artistName}`)
      .join('\n');

    // Note: Release Radar digests are no longer persisted as backend shares —
    // the new feed schema only accepts per-track shares. The native Web Share
    // flow below is unchanged.

    const shared = await this.shareService.share({
      title: `Xomify Release Radar — ${label}`,
      text: `New this week on my Xomify Release Radar (${label}):\n${topFive}`,
      url: window.location.href,
    });
    this.toastService.showPositiveToast(shared ? 'Shared!' : 'Copied to clipboard');
  }

  goToAlbum(albumId: string): void {
    this.router.navigate(['/album', albumId]);
  }

  goToArtist(artistId: string, event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    this.router.navigate(['/artist-profile', artistId]);
  }

  openInSpotify(uri: string, event: Event): void {
    event.stopPropagation();
    const parts = uri.split(':');
    if (parts.length === 3) {
      const url = `https://open.spotify.com/${parts[1]}/${parts[2]}`;
      window.open(url, '_blank');
    }
  }

  // ============================================
  // Helpers
  // ============================================

  getMonthName(): string {
    return this.viewDate.toLocaleString('default', {
      month: 'long',
      year: 'numeric',
    });
  }

  formatDate(date: Date): string {
    return date.toLocaleDateString('default', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    });
  }

  formatReleaseDate(dateString: string): string {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  getRelativeDate(release: ReleaseRadarRelease): string {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    // Parse YYYY-MM-DD as local date (not UTC) by splitting parts
    const parts = release.releaseDate.split('-');
    const releaseDate = new Date(
      parseInt(parts[0], 10),
      parseInt(parts[1], 10) - 1,
      parseInt(parts[2], 10)
    );
    releaseDate.setHours(0, 0, 0, 0);

    const diffTime = releaseDate.getTime() - today.getTime();
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Tomorrow';
    if (diffDays === -1) return 'Yesterday';
    if (diffDays > 0) return `In ${diffDays} days`;
    return `${Math.abs(diffDays)} days ago`;
  }

  isUpcoming(date: Date): boolean {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date >= today;
  }

  getSelectedWeekCount(): number {
    if (!this.history || !this.selectedWeekKey) return 0;

    const weekData = this.history.weeks.find(
      (w) => w.weekKey === this.selectedWeekKey
    );
    if (!weekData) return 0;

    if (this.filterType === 'all') {
      return weekData.releases.length;
    }

    return weekData.releases.filter((r) => r.albumType === this.filterType)
      .length;
  }

  getSelectedWeekStats(): ReleaseRadarWeek['stats'] | null {
    if (!this.history || !this.selectedWeekKey) return null;

    const weekData = this.history.weeks.find(
      (w) => w.weekKey === this.selectedWeekKey
    );
    return weekData?.stats || null;
  }

  // ============================================
  // Queue Management
  // ============================================

  addAlbumToQueue(release: ReleaseRadarRelease, event?: Event): void {
    if (event) {
      event.stopPropagation();
    }

    this.toastService.showPositiveToast('Adding tracks to Playlist Builder...');

    this.albumService
      .getAlbumTracks(release.albumId)
      .pipe(
        take(1),
        catchError((error) => {
          console.error('Error fetching album tracks:', error);
          this.toastService.showNegativeToast('Failed to add tracks to Playlist Builder');
          return of(null);
        })
      )
      .subscribe((response) => {
        if (!response || !response.items) {
          return;
        }

        let addedCount = 0;
        response.items.forEach((track: any) => {
          const queueTrack: QueueTrack = {
            id: track.id,
            name: track.name,
            artists: track.artists || [],
            album: {
              id: release.albumId,
              name: release.albumName,
              images: release.imageUrl ? [{ url: release.imageUrl }] : [],
            },
            duration_ms: track.duration_ms,
            external_urls: track.external_urls,
          };

          const added = this.queueService.addToQueue(queueTrack);
          if (added) {
            addedCount++;
          }
        });

        if (addedCount > 0) {
          this.toastService.showPositiveToast(
            `Added ${addedCount} track${addedCount !== 1 ? 's' : ''} to Playlist Builder`
          );
        } else {
          this.toastService.showPositiveToast('Tracks already in Playlist Builder');
        }
      });
  }

  /**
   * Add every track from the currently filtered releases to the Playlist Builder.
   */
  addAllToPlaylistBuilder(): void {
    if (this.filteredReleases.length === 0) {
      this.toastService.showNegativeToast('No releases to add');
      return;
    }

    this.toastService.showPositiveToast(
      `Adding tracks from ${this.filteredReleases.length} release(s) to Playlist Builder…`
    );

    const releases = [...this.filteredReleases];
    const albumRequests = releases.map(release =>
      this.albumService
        .getAlbumTracks(release.albumId)
        .pipe(catchError(() => of({ items: [] })))
    );

    forkJoin(albumRequests)
      .pipe(take(1))
      .subscribe({
        next: (albumResponses: any[]) => {
          let addedCount = 0;
          albumResponses.forEach((response, index) => {
            const release = releases[index];
            (response?.items || []).forEach((track: any) => {
              const queueTrack: QueueTrack = {
                id: track.id,
                name: track.name,
                artists: track.artists || [],
                album: {
                  id: release.albumId,
                  name: release.albumName,
                  images: release.imageUrl ? [{ url: release.imageUrl }] : [],
                },
                duration_ms: track.duration_ms,
                external_urls: track.external_urls,
              };

              if (this.queueService.addToQueue(queueTrack)) {
                addedCount++;
              }
            });
          });

          if (addedCount > 0) {
            this.toastService.showPositiveToast(
              `Added ${addedCount} track${addedCount !== 1 ? 's' : ''} to Playlist Builder`
            );
          } else {
            this.toastService.showPositiveToast('Tracks already in Playlist Builder');
          }
        },
        error: (err) => {
          console.error('Error fetching album tracks:', err);
          this.toastService.showNegativeToast('Failed to add tracks. Please try again.');
        },
      });
  }

  // ============================================
  // Playlist Generation
  // ============================================

  /**
   * Generate a Spotify playlist from all releases in the currently selected week.
   * Fetches tracks for each album, then creates the playlist.
   */
  generateWeekPlaylist(): void {
    if (!this.history || !this.selectedWeekKey) {
      this.toastService.showNegativeToast('No week selected');
      return;
    }

    const weekData = this.history.weeks.find(w => w.weekKey === this.selectedWeekKey);
    if (!weekData || weekData.releases.length === 0) {
      this.toastService.showNegativeToast('No releases found for this week');
      return;
    }

    const user = this.userService.getUser();
    const userId = user?.id;
    if (!userId) {
      this.toastService.showNegativeToast('Could not get user info. Please log in again.');
      return;
    }

    this.isGeneratingPlaylist = true;
    this.generatedPlaylistUrl = null;

    const weekLabel =
      this.weekOptions.find(w => w.weekKey === this.selectedWeekKey)?.label ||
      weekData.weekDisplay ||
      this.selectedWeekKey;

    const playlistName = `Xomify Release Radar — ${weekLabel}`;
    const description = `New releases from my followed artists for ${weekLabel}, generated by Xomify`;

    // Apply type filter if active
    const releases = this.filterType === 'all'
      ? weekData.releases
      : weekData.releases.filter(r => r.albumType === this.filterType);

    if (releases.length === 0) {
      this.toastService.showNegativeToast('No releases match the current filter');
      this.isGeneratingPlaylist = false;
      return;
    }

    this.toastService.showPositiveToast(`Fetching tracks for ${releases.length} release(s)…`);

    // Fetch all album tracks in parallel
    const albumRequests = releases.map(release =>
      this.albumService.getAlbumTracks(release.albumId).pipe(
        catchError(() => of({ items: [] }))
      )
    );

    forkJoin(albumRequests).pipe(take(1)).subscribe({
      next: (albumResponses: any[]) => {
        const trackUris: string[] = [];
        albumResponses.forEach(response => {
          if (response?.items) {
            response.items.forEach((track: any) => {
              trackUris.push(`spotify:track:${track.id}`);
            });
          }
        });

        if (trackUris.length === 0) {
          this.toastService.showNegativeToast('No tracks found for this week\'s releases');
          this.isGeneratingPlaylist = false;
          return;
        }

        this.playlistService
          .createPlaylistWithTracks(userId, playlistName, description, trackUris, {
            isPublic: false,
            addXomifyLogo: true,
          })
          .pipe(take(1))
          .subscribe({
            next: (playlist: any) => {
              this.isGeneratingPlaylist = false;
              this.generatedPlaylistUrl = playlist?.external_urls?.spotify || null;
              this.toastService.showPositiveToast(
                `Playlist "${playlistName}" created with ${trackUris.length} tracks!`
              );
            },
            error: (err) => {
              console.error('Error generating release radar playlist:', err);
              this.isGeneratingPlaylist = false;
              this.toastService.showNegativeToast('Failed to create playlist. Please try again.');
            },
          });
      },
      error: (err) => {
        console.error('Error fetching album tracks:', err);
        this.isGeneratingPlaylist = false;
        this.toastService.showNegativeToast('Failed to fetch tracks. Please try again.');
      },
    });
  }

  // Add first track of album to Spotify queue
  addAlbumToSpotifyQueue(release: ReleaseRadarRelease, event?: Event): void {
    if (event) {
      event.stopPropagation();
    }

    // For albums, add the first track to Spotify queue
    this.albumService
      .getAlbumTracks(release.albumId)
      .pipe(
        take(1),
        catchError((error) => {
          console.error('Error fetching album tracks:', error);
          this.toastService.showNegativeToast('Failed to add to Spotify queue');
          return of(null);
        })
      )
      .subscribe((response) => {
        if (!response || !response.items || response.items.length === 0) {
          this.toastService.showNegativeToast('No tracks found in album');
          return;
        }

        const firstTrack = response.items[0];
        this.playerService.addToSpotifyQueue(firstTrack.id).pipe(take(1)).subscribe({
          next: (success) => {
            if (success) {
              this.toastService.showPositiveToast(`Added "${release.albumName}" to Spotify queue`);
            } else {
              this.toastService.showNegativeToast('Could not add to queue. Open Spotify on any device and try again.');
            }
          },
          error: () => {
            this.toastService.showNegativeToast('Error adding to queue. Check console for details.');
          },
        });
      });
  }
}
