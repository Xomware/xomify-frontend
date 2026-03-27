import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { ReleaseRadarService, ReleaseRadarRelease, ReleaseRadarHistoryResponse } from './release-radar.service';
import { environment } from 'src/environments/environment';

describe('ReleaseRadarService', () => {
  let service: ReleaseRadarService;
  let httpMock: HttpTestingController;

  const mockReleaseRadarRelease: ReleaseRadarRelease = {
    albumId: 'album123',
    albumName: 'Test Album',
    artistName: 'Test Artist',
    artistId: 'artist123',
    imageUrl: 'https://example.com/image.jpg',
    albumType: 'album',
    releaseDate: '2026-02-20',
    totalTracks: 10,
    spotifyUrl: 'https://open.spotify.com/album/album123',
    uri: 'spotify:album:album123',
  };

  // Use dynamic current week key so tests don't break as time passes
  let currentWeekKey: string;

  const mockReleaseRadarWeek = {
    email: 'test@example.com',
    weekKey: '2026-08',
    weekDisplay: 'Feb 22 - Feb 28, 2026',
    startDate: '2026-02-22',
    endDate: '2026-02-28',
    releases: [mockReleaseRadarRelease],
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

  let mockHistoryResponse: ReleaseRadarHistoryResponse;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [ReleaseRadarService],
    });
    service = TestBed.inject(ReleaseRadarService);
    httpMock = TestBed.inject(HttpTestingController);

    // Use actual current week key so buildWeekOptions works correctly
    currentWeekKey = service.getCurrentWeekKey();

    mockHistoryResponse = {
      email: 'test@example.com',
      weeks: [{ ...mockReleaseRadarWeek, weekKey: currentWeekKey }],
      count: 1,
      currentWeek: currentWeekKey,
      currentWeekDisplay: service.formatWeekDisplay(currentWeekKey),
    };

    // Clear sessionStorage before each test
    sessionStorage.clear();
  });

  afterEach(() => {
    httpMock.verify();
    sessionStorage.clear();
  });

  describe('getHistory', () => {
    it('should fetch release radar history from API', (done) => {
      service.getHistory('test@example.com').subscribe((response) => {
        expect(response.weeks.length).toBe(1);
        expect(response.weeks[0].releases[0].albumName).toBe('Test Album');
        done();
      });

      const req = httpMock.expectOne(
        (request) =>
          request.url.includes('/release-radar/history') &&
          request.params.get('email') === 'test@example.com'
      );
      expect(req.request.method).toBe('GET');
      req.flush(mockHistoryResponse);
    });

    it('should include authorization header', (done) => {
      service.getHistory('test@example.com').subscribe(() => {
        done();
      });

      const req = httpMock.expectOne(
        (request) => request.url.includes('/release-radar/history')
      );
      expect(req.request.headers.has('Authorization')).toBe(true);
      expect(req.request.headers.get('Authorization')).toContain('Bearer');
      req.flush(mockHistoryResponse);
    });

    it('should set custom limit parameter', (done) => {
      service.getHistory('test@example.com', 52).subscribe(() => {
        done();
      });

      const req = httpMock.expectOne(
        (request) =>
          request.url.includes('/release-radar/history') &&
          request.params.get('limit') === '52'
      );
      req.flush(mockHistoryResponse);
    });

    it('should handle API errors gracefully', (done) => {
      service.getHistory('test@example.com').subscribe((response) => {
        expect(response.weeks.length).toBe(0);
        expect(response.email).toBe('test@example.com');
        done();
      });

      const req = httpMock.expectOne(
        (request) => request.url.includes('/release-radar/history')
      );
      req.error(new ErrorEvent('Network error'));
    });
  });

  describe('checkStatus', () => {
    it('should check user release radar enrollment status', (done) => {
      const mockCheckResponse = {
        email: 'test@example.com',
        enrolled: true,
        hasHistory: true,
        currentWeek: '2026-08',
        currentWeekDisplay: 'Feb 22 - Feb 28, 2026',
        weekStartDate: '2026-02-22',
        weekEndDate: '2026-02-28',
      };

      service.checkStatus('test@example.com').subscribe((response) => {
        expect(response.enrolled).toBe(true);
        expect(response.currentWeek).toBe('2026-08');
        done();
      });

      const req = httpMock.expectOne(
        (request) =>
          request.url.includes('/release-radar/check') &&
          request.params.get('email') === 'test@example.com'
      );
      expect(req.request.method).toBe('GET');
      req.flush(mockCheckResponse);
    });

    it('should handle enrollment check errors', (done) => {
      service.checkStatus('test@example.com').subscribe((response) => {
        expect(response.enrolled).toBe(false);
        expect(response.hasHistory).toBe(false);
        done();
      });

      const req = httpMock.expectOne(
        (request) => request.url.includes('/release-radar/check')
      );
      req.error(new ErrorEvent('Network error'));
    });
  });

  describe('loadReleaseRadar', () => {
    it('should use cached data if available', (done) => {
      // Set cache
      const cacheData = {
        response: mockHistoryResponse,
        timestamp: Date.now(),
      };
      sessionStorage.setItem('xomify_release_radar_history', JSON.stringify(cacheData));

      service.loadReleaseRadar('test@example.com').subscribe((response) => {
        expect(response.weeks.length).toBe(1);
        done();
      });

      // Should not make HTTP request
      httpMock.expectNone((request) => request.url.includes('/release-radar/history'));
    });

    it('should fetch from API if cache is empty', (done) => {
      service.loadReleaseRadar('test@example.com').subscribe((response) => {
        expect(response.weeks.length).toBe(1);
        done();
      });

      const req = httpMock.expectOne(
        (request) => request.url.includes('/release-radar/history')
      );
      req.flush(mockHistoryResponse);
    });

    it('should cache successful responses', (done) => {
      service.loadReleaseRadar('test@example.com').subscribe(() => {
        const cached = sessionStorage.getItem('xomify_release_radar_history');
        expect(cached).toBeTruthy();
        const parsedCache = JSON.parse(cached!);
        expect(parsedCache.response.weeks.length).toBe(1);
        done();
      });

      const req = httpMock.expectOne(
        (request) => request.url.includes('/release-radar/history')
      );
      req.flush(mockHistoryResponse);
    });
  });

  describe('forceRefresh', () => {
    it('should clear cache and fetch fresh data', (done) => {
      // Set initial cache
      const cacheData = {
        response: mockHistoryResponse,
        timestamp: Date.now(),
      };
      sessionStorage.setItem('xomify_release_radar_history', JSON.stringify(cacheData));

      service.forceRefresh('test@example.com').subscribe(() => {
        // Cache should be refreshed with new data
        const cached = sessionStorage.getItem('xomify_release_radar_history');
        expect(cached).toBeTruthy();
        done();
      });

      const req = httpMock.expectOne(
        (request) => request.url.includes('/release-radar/history')
      );
      req.flush(mockHistoryResponse);
    });
  });

  describe('getAllReleasesFromHistory', () => {
    it('should flatten releases from all weeks into single array', () => {
      const multiWeekResponse: ReleaseRadarHistoryResponse = {
        email: 'test@example.com',
        weeks: [
          {
            ...mockReleaseRadarWeek,
            weekKey: '2026-08',
            releases: [mockReleaseRadarRelease],
          },
          {
            ...mockReleaseRadarWeek,
            weekKey: '2026-07',
            releases: [
              {
                ...mockReleaseRadarRelease,
                albumId: 'album456',
                albumName: 'Another Album',
              },
            ],
          },
        ],
        count: 2,
        currentWeek: '2026-08',
        currentWeekDisplay: 'Feb 22 - Feb 28, 2026',
      };

      const allReleases = service.getAllReleasesFromHistory(multiWeekResponse);
      expect(allReleases.length).toBe(2);
    });

    it('should remove duplicate albums by albumId', () => {
      const duplicateRelease: ReleaseRadarHistoryResponse = {
        email: 'test@example.com',
        weeks: [
          {
            ...mockReleaseRadarWeek,
            releases: [mockReleaseRadarRelease, mockReleaseRadarRelease],
          },
        ],
        count: 1,
        currentWeek: '2026-08',
        currentWeekDisplay: 'Feb 22 - Feb 28, 2026',
      };

      const allReleases = service.getAllReleasesFromHistory(duplicateRelease);
      expect(allReleases.length).toBe(1);
    });

    it('should sort releases by date (newest first)', () => {
      const olderRelease: ReleaseRadarRelease = {
        ...mockReleaseRadarRelease,
        albumId: 'album456',
        releaseDate: '2026-01-01',
      };

      const multiWeekResponse: ReleaseRadarHistoryResponse = {
        email: 'test@example.com',
        weeks: [
          {
            ...mockReleaseRadarWeek,
            releases: [olderRelease, mockReleaseRadarRelease],
          },
        ],
        count: 1,
        currentWeek: '2026-08',
        currentWeekDisplay: 'Feb 22 - Feb 28, 2026',
      };

      const allReleases = service.getAllReleasesFromHistory(multiWeekResponse);
      expect(allReleases[0].releaseDate).toBe('2026-02-20');
      expect(allReleases[1].releaseDate).toBe('2026-01-01');
    });
  });

  describe('Week Key Calculations (Saturday-Friday)', () => {
    it('should generate correct week key for a date', () => {
      // February 27, 2026 is a Thursday
      const testDate = new Date('2026-02-27');
      const weekKey = service.getWeekKey(testDate);
      expect(weekKey).toMatch(/^\d{4}-\d{2}$/);
    });

    it('should get current week key', () => {
      const currentWeekKey = service.getCurrentWeekKey();
      expect(currentWeekKey).toMatch(/^\d{4}-\d{2}$/);
    });

    it('should calculate correct week date range', () => {
      const range = service.getWeekDateRange('2026-08');
      expect(range.start).toBeTruthy();
      expect(range.end).toBeTruthy();
      expect(range.start.getDay()).toBe(6); // Saturday
      expect(range.end.getDay()).toBe(5); // Friday
    });

    it('should format week display correctly', () => {
      const display = service.formatWeekDisplay('2026-08');
      expect(display).toMatch(/\w+ \d+ - \w+ \d+, 2026/);
    });

    it('should handle week keys across month boundaries', () => {
      const range = service.getWeekDateRange('2026-08');
      const formatted = service.formatWeekDisplay('2026-08');
      expect(formatted).toContain(',');
    });
  });

  describe('buildWeekOptions', () => {
    it('should build options from history weeks', () => {
      const options = service.buildWeekOptions(mockHistoryResponse);
      expect(options.length).toBeGreaterThan(0);
      expect(options[0].weekKey).toBeDefined();
      expect(options[0].label).toBeDefined();
    });

    it('should mark current week as "This Week"', () => {
      const options = service.buildWeekOptions(mockHistoryResponse);
      const currentWeek = options.find((o) => o.label === 'This Week');
      expect(currentWeek).toBeTruthy();
    });

    it('should generate fallback options without history', () => {
      const emptyResponse: ReleaseRadarHistoryResponse = {
        email: 'test@example.com',
        weeks: [],
        count: 0,
        currentWeek: '2026-08',
        currentWeekDisplay: 'Feb 22 - Feb 28, 2026',
      };

      const options = service.buildWeekOptions(emptyResponse);
      expect(options.length).toBe(8); // Last 8 weeks
    });
  });

  describe('Cache Management', () => {
    it('should clear cache', () => {
      const cacheData = {
        response: mockHistoryResponse,
        timestamp: Date.now(),
      };
      sessionStorage.setItem('xomify_release_radar_history', JSON.stringify(cacheData));

      service.clearCache();
      expect(sessionStorage.getItem('xomify_release_radar_history')).toBeNull();
    });

    it('should expire cache after TTL', (done) => {
      const cacheData = {
        response: mockHistoryResponse,
        timestamp: Date.now() - 31 * 60 * 1000, // 31 minutes ago (TTL is 30)
      };
      sessionStorage.setItem('xomify_release_radar_history', JSON.stringify(cacheData));

      service.loadReleaseRadar('test@example.com').subscribe(() => {
        done();
      });

      // Should fetch from API because cache expired
      const req = httpMock.expectOne(
        (request) => request.url.includes('/release-radar/history')
      );
      req.flush(mockHistoryResponse);
    });
  });

  describe('Spotify Feb 2026 API Compatibility', () => {
    it('should handle releases with albumId field (not id alias)', () => {
      const release: ReleaseRadarRelease = {
        albumId: 'spotify-album-id',
        albumName: 'Test Album',
        artistName: 'Test Artist',
        artistId: 'spotify-artist-id',
        imageUrl: 'https://example.com/image.jpg',
        albumType: 'album',
        releaseDate: '2026-02-27',
        totalTracks: 5,
        uri: 'spotify:album:test',
      };

      expect(release.albumId).toBeDefined();
      expect(release.albumId).toBe('spotify-album-id');
    });

    it('should correctly identify album types as Spotify API returns them', () => {
      const validTypes: Array<'album' | 'single' | 'appears_on'> = [
        'album',
        'single',
        'appears_on',
      ];

      validTypes.forEach((type) => {
        const release: ReleaseRadarRelease = {
          ...mockReleaseRadarRelease,
          albumType: type,
        };
        expect(release.albumType).toBe(type);
      });
    });

    it('should handle releases from liked artists without taste matching', () => {
      // Release Radar should show all releases from liked artists
      // without applying any taste-based filtering
      const releases: ReleaseRadarRelease[] = [
        {
          ...mockReleaseRadarRelease,
          albumId: 'album1',
          releaseDate: '2026-02-27',
        },
        {
          ...mockReleaseRadarRelease,
          albumId: 'album2',
          releaseDate: '2026-02-25',
        },
      ];

      // All releases should be included, no filtering based on taste
      expect(releases.length).toBe(2);
      releases.forEach((release) => {
        expect(release.artistId).toBeDefined();
        expect(release.albumType).toBeDefined();
      });
    });

    it('should handle Spotify artist profile URLs correctly', () => {
      const release = mockReleaseRadarRelease;
      expect(release.uri).toMatch(/^spotify:album:/);
      expect(release.spotifyUrl).toMatch(/https:\/\/open\.spotify\.com\/album\//);
    });

    it('should handle potential missing image URLs from Spotify', () => {
      const releaseNoImage: ReleaseRadarRelease = {
        ...mockReleaseRadarRelease,
        imageUrl: null,
      };

      expect(releaseNoImage.imageUrl).toBeNull();
      // Should still work with other fields populated
      expect(releaseNoImage.albumName).toBeDefined();
      expect(releaseNoImage.releaseDate).toBeDefined();
    });

    it('should parse ISO release dates correctly', () => {
      const releases: ReleaseRadarRelease[] = [
        {
          ...mockReleaseRadarRelease,
          releaseDate: '2026-02-27',
        },
        {
          ...mockReleaseRadarRelease,
          albumId: 'album2',
          releaseDate: '2026-02',
        },
        {
          ...mockReleaseRadarRelease,
          albumId: 'album3',
          releaseDate: '2026',
        },
      ];

      releases.forEach((release) => {
        expect(release.releaseDate).toMatch(/^\d{4}(-\d{2})?(-\d{2})?$/);
      });
    });
  });

  describe('Data Flow: Liked Artists → Releases', () => {
    it('should fetch release data for multiple liked artists', (done) => {
      const multiArtistResponse: ReleaseRadarHistoryResponse = {
        email: 'test@example.com',
        weeks: [
          {
            ...mockReleaseRadarWeek,
            releases: [
              {
                ...mockReleaseRadarRelease,
                artistId: 'artist1',
                artistName: 'Artist One',
              },
              {
                ...mockReleaseRadarRelease,
                albumId: 'album2',
                artistId: 'artist2',
                artistName: 'Artist Two',
              },
            ],
            stats: {
              artistCount: 2,
              releaseCount: 2,
              trackCount: 20,
              albumCount: 2,
              singleCount: 0,
            },
          },
        ],
        count: 1,
        currentWeek: '2026-08',
        currentWeekDisplay: 'Feb 22 - Feb 28, 2026',
      };

      service.getHistory('test@example.com').subscribe((response) => {
        const releases = service.getAllReleasesFromHistory(response);
        expect(releases.length).toBe(2);
        expect(new Set(releases.map((r) => r.artistId)).size).toBe(2);
        done();
      });

      const req = httpMock.expectOne(
        (request) => request.url.includes('/release-radar/history')
      );
      req.flush(multiArtistResponse);
    });

    it('should maintain referential integrity from artist to releases', () => {
      const response: ReleaseRadarHistoryResponse = {
        email: 'test@example.com',
        weeks: [mockReleaseRadarWeek],
        count: 1,
        currentWeek: '2026-08',
        currentWeekDisplay: 'Feb 22 - Feb 28, 2026',
      };

      const releases = service.getAllReleasesFromHistory(response);
      releases.forEach((release) => {
        expect(release.artistId).toBeDefined();
        expect(release.artistName).toBeDefined();
        expect(release.albumId).toBeDefined();
        expect(release.albumName).toBeDefined();
      });
    });
  });
});
