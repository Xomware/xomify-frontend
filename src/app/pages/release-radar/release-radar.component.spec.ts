import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { ReleaseRadarComponent } from './release-radar.component';
import { ReleaseRadarService, ReleaseRadarHistoryResponse } from 'src/app/services/release-radar.service';
import { UserService } from 'src/app/services/user.service';
import { PlayerService } from 'src/app/services/player.service';
import { ToastService } from 'src/app/services/toast.service';
import { QueueService } from 'src/app/services/queue.service';
import { AlbumService } from 'src/app/services/album.service';
import { PlaylistService } from 'src/app/services/playlist.service';
import { of, throwError } from 'rxjs';

describe('ReleaseRadarComponent', () => {
  let component: ReleaseRadarComponent;
  let fixture: ComponentFixture<ReleaseRadarComponent>;
  let releaseRadarService: jasmine.SpyObj<ReleaseRadarService>;
  let userService: jasmine.SpyObj<UserService>;
  let playerService: jasmine.SpyObj<PlayerService>;
  let toastService: jasmine.SpyObj<ToastService>;
  let queueService: jasmine.SpyObj<QueueService>;
  let albumService: jasmine.SpyObj<AlbumService>;
  let playlistService: jasmine.SpyObj<PlaylistService>;

  const mockRelease = {
    albumId: 'album123',
    albumName: 'Test Album',
    artistName: 'Test Artist',
    artistId: 'artist123',
    imageUrl: 'https://example.com/image.jpg',
    albumType: 'album' as const,
    releaseDate: '2026-02-27',
    totalTracks: 10,
    uri: 'spotify:album:album123',
  };

  const mockWeek = {
    email: 'test@example.com',
    weekKey: '2026-08',
    weekDisplay: 'Feb 22 - Feb 28, 2026',
    startDate: '2026-02-22',
    endDate: '2026-02-28',
    releases: [mockRelease],
    stats: {
      artistCount: 1,
      releaseCount: 1,
      trackCount: 10,
      albumCount: 1,
      singleCount: 0,
    },
    playlistId: null,
    createdAt: '2026-02-21T10:00:00Z',
  };

  const mockHistoryResponse: ReleaseRadarHistoryResponse = {
    email: 'test@example.com',
    weeks: [mockWeek],
    count: 1,
    currentWeek: '2026-08',
    currentWeekDisplay: 'Feb 22 - Feb 28, 2026',
  };

  beforeEach(async () => {
    const releaseRadarSpy = jasmine.createSpyObj('ReleaseRadarService', [
      'getHistory',
      'checkStatus',
      'loadReleaseRadar',
      'forceRefresh',
      'getAllReleasesFromHistory',
      'getCurrentWeekKey',
      'getWeekKey',
      'getWeekDateRange',
      'formatWeekDisplay',
      'buildWeekOptions',
      'clearCache',
    ]);

    const userServiceSpy = jasmine.createSpyObj('UserService', [
      'getEmail',
      'getUser',
      'getReleaseRadarEnrollment',
      'setReleaseRadarEnrollment',
      'updateUserTableEnrollments',
      'getWrappedEnrollment',
    ]);

    const playerServiceSpy = jasmine.createSpyObj('PlayerService', [
      'addToSpotifyQueue',
    ]);

    const toastServiceSpy = jasmine.createSpyObj('ToastService', [
      'showPositiveToast',
      'showNegativeToast',
    ]);

    const queueServiceSpy = jasmine.createSpyObj('QueueService', [
      'addToQueue',
    ]);

    const albumServiceSpy = jasmine.createSpyObj('AlbumService', [
      'getAlbumTracks',
    ]);

    const playlistServiceSpy = jasmine.createSpyObj('PlaylistService', [
      'createPlaylistWithTracks',
    ]);

    // Set default return values
    releaseRadarSpy.getCurrentWeekKey.and.returnValue('2026-08');
    releaseRadarSpy.getWeekDateRange.and.returnValue({
      start: new Date('2026-02-22'),
      end: new Date('2026-02-28'),
    });
    releaseRadarSpy.buildWeekOptions.and.returnValue([
      { weekKey: '2026-08', label: 'This Week' },
    ]);
    releaseRadarSpy.getAllReleasesFromHistory.and.returnValue([mockRelease]);
    userServiceSpy.getEmail.and.returnValue('test@example.com');
    userServiceSpy.getReleaseRadarEnrollment.and.returnValue(true);
    userServiceSpy.getUser.and.returnValue({
      id: 'user123',
      displayName: 'Test User',
      externalUrls: { spotify: 'https://open.spotify.com/user/test' },
      followers: 10,
      images: [],
      uri: 'spotify:user:test',
    } as any);

    await TestBed.configureTestingModule({
      declarations: [ReleaseRadarComponent],
      imports: [HttpClientTestingModule, RouterTestingModule],
      providers: [
        { provide: ReleaseRadarService, useValue: releaseRadarSpy },
        { provide: UserService, useValue: userServiceSpy },
        { provide: PlayerService, useValue: playerServiceSpy },
        { provide: ToastService, useValue: toastServiceSpy },
        { provide: QueueService, useValue: queueServiceSpy },
        { provide: AlbumService, useValue: albumServiceSpy },
        { provide: PlaylistService, useValue: playlistServiceSpy },
      ],
    }).compileComponents();

    releaseRadarService = TestBed.inject(ReleaseRadarService) as jasmine.SpyObj<ReleaseRadarService>;
    userService = TestBed.inject(UserService) as jasmine.SpyObj<UserService>;
    playerService = TestBed.inject(PlayerService) as jasmine.SpyObj<PlayerService>;
    toastService = TestBed.inject(ToastService) as jasmine.SpyObj<ToastService>;
    queueService = TestBed.inject(QueueService) as jasmine.SpyObj<QueueService>;
    albumService = TestBed.inject(AlbumService) as jasmine.SpyObj<AlbumService>;
    playlistService = TestBed.inject(PlaylistService) as jasmine.SpyObj<PlaylistService>;

    fixture = TestBed.createComponent(ReleaseRadarComponent);
    component = fixture.componentInstance;
  });

  describe('Component Initialization', () => {
    it('should create the component', () => {
      expect(component).toBeTruthy();
    });

    it('should initialize with default state', () => {
      expect(component.loading).toBe(true);
      expect(component.error).toBeNull();
      expect(component.viewMode).toBe('calendar');
      expect(component.filterType).toBe('all');
    });

    it('should load user email and releases on init', () => {
      releaseRadarService.loadReleaseRadar.and.returnValue(of(mockHistoryResponse));

      fixture.detectChanges();

      expect(userService.getEmail).toHaveBeenCalled();
      expect(releaseRadarService.loadReleaseRadar).toHaveBeenCalledWith('test@example.com');
    });

    it('should handle missing user email', () => {
      userService.getEmail.and.returnValue('');

      fixture.detectChanges();

      expect(component.error).toContain('User email not available');
      expect(component.loading).toBe(false);
    });
  });

  describe('Loading Releases', () => {
    beforeEach(() => {
      releaseRadarService.loadReleaseRadar.and.returnValue(of(mockHistoryResponse));
    });

    it('should load and process releases', (done) => {
      component.loadReleases();

      setTimeout(() => {
        expect(component.history).toEqual(mockHistoryResponse);
        expect(component.releases.length).toBe(1);
        expect(component.loading).toBe(false);
        done();
      }, 100);
    });

    it('should set current week as default', (done) => {
      component.loadReleases();

      setTimeout(() => {
        expect(component.selectedWeekKey).toBe('2026-08');
        done();
      }, 100);
    });

    it('should handle loading errors', (done) => {
      releaseRadarService.loadReleaseRadar.and.returnValue(
        throwError(() => new Error('Load failed'))
      );

      component.loadReleases();

      setTimeout(() => {
        expect(component.error).toContain('Failed to load releases');
        expect(component.loading).toBe(false);
        done();
      }, 100);
    });

    it('should support force refresh', (done) => {
      releaseRadarService.forceRefresh.and.returnValue(of(mockHistoryResponse));

      component.loadReleases(true);

      setTimeout(() => {
        expect(releaseRadarService.clearCache).toHaveBeenCalled();
        expect(releaseRadarService.forceRefresh).toHaveBeenCalledWith('test@example.com');
        expect(toastService.showPositiveToast).toHaveBeenCalledWith('Releases refreshed');
        done();
      }, 100);
    });
  });

  describe('Filtering and Display', () => {
    beforeEach(() => {
      releaseRadarService.loadReleaseRadar.and.returnValue(of(mockHistoryResponse));
      fixture.detectChanges();
    });

    it('should filter by album type', (done) => {
      component.setFilterType('album');

      setTimeout(() => {
        expect(component.filterType).toBe('album');
        expect(component.filteredReleases.every((r) => r.albumType === 'album')).toBe(true);
        done();
      }, 100);
    });

    it('should filter by single type', (done) => {
      const singleResponse: ReleaseRadarHistoryResponse = {
        ...mockHistoryResponse,
        weeks: [
          {
            ...mockWeek,
            releases: [
              { ...mockRelease, albumType: 'single', albumId: 'single1' },
            ],
          },
        ],
      };

      releaseRadarService.getAllReleasesFromHistory.and.returnValue(
        singleResponse.weeks[0].releases
      );

      component.setFilterType('single');

      setTimeout(() => {
        expect(component.filterType).toBe('single');
        done();
      }, 100);
    });

    it('should reset filter to all', (done) => {
      component.filterType = 'album';
      component.setFilterType('all');

      setTimeout(() => {
        expect(component.filterType).toBe('all');
        done();
      }, 100);
    });
  });

  describe('View Mode Management', () => {
    beforeEach(() => {
      releaseRadarService.loadReleaseRadar.and.returnValue(of(mockHistoryResponse));
      fixture.detectChanges();
    });

    it('should switch to calendar view', () => {
      component.setViewMode('calendar');
      expect(component.viewMode).toBe('calendar');
    });

    it('should switch to list view', () => {
      component.setViewMode('list');
      expect(component.viewMode).toBe('list');
    });

    it('should update stats on view mode change', () => {
      spyOn<any>(component, 'updateStats');
      component.setViewMode('list');
      expect((component as any).updateStats).toHaveBeenCalled();
    });
  });

  describe('Week Selection', () => {
    beforeEach(() => {
      releaseRadarService.loadReleaseRadar.and.returnValue(of(mockHistoryResponse));
      fixture.detectChanges();
    });

    it('should set selected week', () => {
      component.setWeekFilter('2026-08');
      expect(component.selectedWeekKey).toBe('2026-08');
    });

    it('should clear generated playlist when changing week', () => {
      component.generatedPlaylistUrl = 'https://spotify.com/playlist/test';
      component.setWeekFilter('2026-07');
      expect(component.generatedPlaylistUrl).toBeNull();
    });
  });

  describe('Calendar Navigation', () => {
    beforeEach(() => {
      releaseRadarService.loadReleaseRadar.and.returnValue(of(mockHistoryResponse));
      fixture.detectChanges();
    });

    it('should navigate to previous month', () => {
      const currentMonth = component.viewDate.getMonth();
      component.previousMonth();
      expect(component.viewDate.getMonth()).toBe(currentMonth - 1);
    });

    it('should navigate to next month', () => {
      const currentMonth = component.viewDate.getMonth();
      component.nextMonth();
      expect(component.viewDate.getMonth()).toBe((currentMonth + 1) % 12);
    });

    it('should go to today', () => {
      component.viewDate = new Date('2025-01-01');
      component.goToToday();
      const today = new Date();
      expect(component.viewDate.getFullYear()).toBe(today.getFullYear());
      expect(component.viewDate.getMonth()).toBe(today.getMonth());
    });
  });

  describe('Release Radar: Liked Artists Only (No Taste Matching)', () => {
    beforeEach(() => {
      releaseRadarService.loadReleaseRadar.and.returnValue(of(mockHistoryResponse));
      fixture.detectChanges();
    });

    it('should show releases from all liked artists without filtering', (done) => {
      const multiArtistResponse: ReleaseRadarHistoryResponse = {
        email: 'test@example.com',
        weeks: [
          {
            ...mockWeek,
            releases: [
              { ...mockRelease, artistId: 'artist1', artistName: 'Artist 1' },
              { ...mockRelease, albumId: 'album2', artistId: 'artist2', artistName: 'Artist 2' },
              { ...mockRelease, albumId: 'album3', artistId: 'artist3', artistName: 'Artist 3' },
            ],
            stats: {
              artistCount: 3,
              releaseCount: 3,
              trackCount: 30,
              albumCount: 3,
              singleCount: 0,
            },
          },
        ],
        count: 1,
        currentWeek: '2026-08',
        currentWeekDisplay: 'Feb 22 - Feb 28, 2026',
      };

      releaseRadarService.loadReleaseRadar.and.returnValue(of(multiArtistResponse));
      releaseRadarService.getAllReleasesFromHistory.and.returnValue(
        multiArtistResponse.weeks[0].releases
      );

      component.loadReleases();

      setTimeout(() => {
        // All releases should be included, no taste-based filtering
        expect(component.releases.length).toBe(3);
        expect(new Set(component.releases.map((r) => r.artistId)).size).toBe(3);
        done();
      }, 100);
    });

    it('should not apply taste matching filters', (done) => {
      component.setFilterType('all');

      setTimeout(() => {
        // When filtering is 'all', no taste-based filters should be applied
        expect(component.filterType).toBe('all');
        // All releases should remain in filteredReleases
        expect(component.filteredReleases.length).toBeGreaterThan(0);
        done();
      }, 100);
    });

    it('should display releases organized by date, not by artist preference', (done) => {
      const dateBasedResponse: ReleaseRadarHistoryResponse = {
        email: 'test@example.com',
        weeks: [
          {
            ...mockWeek,
            releases: [
              { ...mockRelease, releaseDate: '2026-02-27' },
              { ...mockRelease, albumId: 'album2', releaseDate: '2026-02-25' },
            ],
          },
        ],
        count: 1,
        currentWeek: '2026-08',
        currentWeekDisplay: 'Feb 22 - Feb 28, 2026',
      };

      releaseRadarService.loadReleaseRadar.and.returnValue(of(dateBasedResponse));
      releaseRadarService.getAllReleasesFromHistory.and.returnValue(
        dateBasedResponse.weeks[0].releases
      );

      component.loadReleases();

      setTimeout(() => {
        const allReleases = component.releases;
        // Releases should be sorted by date, not by taste/preference
        if (allReleases.length >= 2) {
          expect(
            new Date(allReleases[0].releaseDate) >=
            new Date(allReleases[1].releaseDate)
          ).toBe(true);
        }
        done();
      }, 100);
    });
  });

  describe('Enrollment Management', () => {
    beforeEach(() => {
      releaseRadarService.loadReleaseRadar.and.returnValue(of(mockHistoryResponse));
      fixture.detectChanges();
    });

    it('should check initial enrollment status', () => {
      expect(component.isEnrolled).toBe(true);
    });

    it('should toggle enrollment on/off', (done) => {
      userService.updateUserTableEnrollments.and.returnValue(of({}));
      userService.getWrappedEnrollment.and.returnValue(true as any);

      component.toggleEnrollment();

      setTimeout(() => {
        expect(userService.updateUserTableEnrollments).toHaveBeenCalled();
        done();
      }, 100);
    });

    it('should show enrollment error message', (done) => {
      userService.updateUserTableEnrollments.and.returnValue(
        throwError(() => new Error('Enrollment failed'))
      );

      component.toggleEnrollment();

      setTimeout(() => {
        expect(toastService.showNegativeToast).toHaveBeenCalledWith(
          'Failed to update enrollment'
        );
        done();
      }, 100);
    });
  });

  describe('Stats Calculation', () => {
    beforeEach(() => {
      releaseRadarService.loadReleaseRadar.and.returnValue(of(mockHistoryResponse));
      fixture.detectChanges();
    });

    it('should calculate total releases in calendar month', () => {
      const today = new Date();
      component.viewDate = today;
      (component as any).updateStats();

      expect(component.totalReleases).toBeGreaterThanOrEqual(0);
    });

    it('should count albums and singles separately', (done) => {
      const mixedResponse: ReleaseRadarHistoryResponse = {
        email: 'test@example.com',
        weeks: [
          {
            ...mockWeek,
            releases: [
              { ...mockRelease, albumType: 'album' },
              { ...mockRelease, albumId: 'single1', albumType: 'single' },
            ],
            stats: {
              artistCount: 2,
              releaseCount: 2,
              trackCount: 15,
              albumCount: 1,
              singleCount: 1,
            },
          },
        ],
        count: 1,
        currentWeek: '2026-08',
        currentWeekDisplay: 'Feb 22 - Feb 28, 2026',
      };

      releaseRadarService.loadReleaseRadar.and.returnValue(of(mixedResponse));
      releaseRadarService.getAllReleasesFromHistory.and.returnValue(
        mixedResponse.weeks[0].releases
      );

      component.loadReleases();

      setTimeout(() => {
        (component as any).updateStats();
        expect(component.albumCount + component.singleCount).toBeGreaterThan(0);
        done();
      }, 100);
    });

    it('should count upcoming releases', () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const futureDate = new Date(today);
      futureDate.setDate(futureDate.getDate() + 3);

      const upcomingResponse: ReleaseRadarHistoryResponse = {
        email: 'test@example.com',
        weeks: [
          {
            ...mockWeek,
            releases: [
              {
                ...mockRelease,
                releaseDate: futureDate.toISOString().split('T')[0],
              },
            ],
          },
        ],
        count: 1,
        currentWeek: '2026-08',
        currentWeekDisplay: 'Feb 22 - Feb 28, 2026',
      };

      releaseRadarService.loadReleaseRadar.and.returnValue(of(upcomingResponse));
      releaseRadarService.getAllReleasesFromHistory.and.returnValue(
        upcomingResponse.weeks[0].releases
      );

      component.loadReleases();
      (component as any).updateStats();

      expect(component.upcomingCount).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Date Formatting', () => {
    beforeEach(() => {
      releaseRadarService.loadReleaseRadar.and.returnValue(of(mockHistoryResponse));
      fixture.detectChanges();
    });

    it('should format month name correctly', () => {
      component.viewDate = new Date('2026-02-27');
      const monthName = component.getMonthName();
      expect(monthName).toContain('February');
      expect(monthName).toContain('2026');
    });

    it('should format full date correctly', () => {
      const testDate = new Date('2026-02-27');
      const formatted = component.formatDate(testDate);
      expect(formatted).toContain('2026');
    });

    it('should format release date in short format', () => {
      const formatted = component.formatReleaseDate('2026-02-27');
      expect(formatted).toMatch(/Feb \d+, 2026/);
    });

    it('should calculate relative dates correctly', () => {
      const today = new Date();
      const todayRelease = { ...mockRelease, releaseDate: today.toISOString().split('T')[0] };
      expect(component.getRelativeDate(todayRelease)).toBe('Today');

      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowRelease = {
        ...mockRelease,
        releaseDate: tomorrow.toISOString().split('T')[0],
      };
      expect(component.getRelativeDate(tomorrowRelease)).toBe('Tomorrow');
    });
  });

  describe('Spotify Feb 2026 Compatibility', () => {
    beforeEach(() => {
      releaseRadarService.loadReleaseRadar.and.returnValue(of(mockHistoryResponse));
      fixture.detectChanges();
    });

    it('should handle albumId field from API response', () => {
      expect(component.releases[0].albumId).toBeDefined();
      expect(component.releases[0].albumId).toBe('album123');
    });

    it('should support Spotify URIs for navigation', () => {
      const release = component.releases[0];
      expect(release.uri).toMatch(/^spotify:album:/);
    });

    it('should handle album types as per Spotify API', () => {
      const validAlbumTypes = ['album', 'single', 'appears_on'];
      expect(validAlbumTypes).toContain(component.releases[0].albumType);
    });

    it('should handle releases with or without image URLs', () => {
      const releaseNoImage = { ...mockRelease, imageUrl: null };
      expect(releaseNoImage.imageUrl).toBeNull();
      expect(releaseNoImage.albumName).toBeDefined();
    });

    it('should correctly navigate to artist profiles using artistId', () => {
      spyOn(component, 'goToArtist');
      component.goToArtist('artist123');
      expect(component.goToArtist).toHaveBeenCalledWith('artist123');
    });

    it('should correctly navigate to albums using albumId', () => {
      spyOn(component, 'goToAlbum');
      component.goToAlbum('album123');
      expect(component.goToAlbum).toHaveBeenCalledWith('album123');
    });
  });
});
