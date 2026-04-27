import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';

import {
  CreateShareRequest,
  CreateShareResponse,
  FeedResponse,
  ReactResponse,
  ShareFeedService,
} from './share-feed.service';

describe('ShareFeedService', () => {
  let service: ShareFeedService;
  let httpMock: HttpTestingController;

  const email = 'dom@example.com';

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [ShareFeedService],
    });
    service = TestBed.inject(ShareFeedService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  describe('createShare', () => {
    it('POSTs the denormalized track body without caller email (caller comes from JWT)', (done) => {
      const request: CreateShareRequest = {
        trackId: 'track123',
        trackUri: 'spotify:track:track123',
        trackName: 'Test Song',
        artistName: 'Test Artist',
        albumName: 'Test Album',
        albumArtUrl: 'https://example.com/art.jpg',
        caption: 'Great vibes',
        moodTag: 'chill',
        genreTags: ['indie', 'lo-fi'],
      };

      const mockResponse: CreateShareResponse = {
        shareId: 'share-1',
        email,
        ...request,
        createdAt: '2026-04-23T10:00:00Z',
        sharedAt: '2026-04-23T10:00:00Z',
      };

      service.createShare(email, request).subscribe((resp) => {
        expect(resp.shareId).toBe('share-1');
        done();
      });

      const req = httpMock.expectOne((r) => r.url.endsWith('/shares/create'));
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({
        trackId: request.trackId,
        trackUri: request.trackUri,
        trackName: request.trackName,
        artistName: request.artistName,
        albumName: request.albumName,
        albumArtUrl: request.albumArtUrl,
        caption: request.caption,
        moodTag: request.moodTag,
        genreTags: request.genreTags,
      });
      // Caller email must NOT be in the body — sourced from JWT context.
      expect((req.request.body as Record<string, unknown>)['email']).toBeUndefined();
      // Authorization header is attached globally by AuthInterceptor (sub-feature
      // 0e). The interceptor is not registered in this isolated TestBed; header
      // attachment is covered by `auth.interceptor.spec.ts`.
      req.flush(mockResponse);
    });

    it('omits caption / moodTag / genreTags when empty (and never sends caller email)', (done) => {
      const request: CreateShareRequest = {
        trackId: 't',
        trackUri: 'spotify:track:t',
        trackName: 'T',
        artistName: 'A',
        albumName: 'B',
        albumArtUrl: 'https://x/y',
      };

      service.createShare(email, request).subscribe(() => done());

      const req = httpMock.expectOne((r) => r.url.endsWith('/shares/create'));
      expect(req.request.body['caption']).toBeUndefined();
      expect(req.request.body['moodTag']).toBeUndefined();
      expect(req.request.body['genreTags']).toBeUndefined();
      // Caller email must NOT be in the body.
      expect(req.request.body['email']).toBeUndefined();
      req.flush({
        shareId: 'x',
        email,
        ...request,
        createdAt: '2026-04-23T10:00:00Z',
      });
    });
  });

  describe('getFeed', () => {
    const mockResponse: FeedResponse = {
      shares: [
        {
          shareId: 's1',
          email,
          trackId: 't1',
          trackUri: 'spotify:track:t1',
          trackName: 'Name',
          artistName: 'Artist',
          albumName: 'Album',
          albumArtUrl: 'https://art/1',
          createdAt: '2026-04-23T10:00:00Z',
          sharedAt: '2026-04-23T10:00:00Z',
          queuedCount: 0,
          ratedCount: 0,
          viewerHasQueued: false,
          viewerRating: null,
          sharerRating: null,
        },
      ],
      nextBefore: null,
    };

    it('GETs with no query params (caller comes from JWT) when no opts', (done) => {
      service.getFeed(email).subscribe((resp) => {
        expect(resp.shares.length).toBe(1);
        done();
      });

      const req = httpMock.expectOne((r) => r.url.endsWith('/shares/feed'));
      expect(req.request.method).toBe('GET');
      // Caller email must NOT be in the query string.
      expect(req.request.params.get('email')).toBeNull();
      expect(req.request.params.get('groupId')).toBeNull();
      expect(req.request.params.get('limit')).toBeNull();
      expect(req.request.params.get('before')).toBeNull();
      req.flush(mockResponse);
    });

    it('encodes groupId / limit / before when provided (still no caller email)', (done) => {
      service
        .getFeed(email, { groupId: 'g1', limit: 25, before: '2026-04-22T10:00:00Z' })
        .subscribe(() => done());

      const req = httpMock.expectOne((r) => r.url.endsWith('/shares/feed'));
      expect(req.request.params.get('groupId')).toBe('g1');
      expect(req.request.params.get('limit')).toBe('25');
      expect(req.request.params.get('before')).toBe('2026-04-22T10:00:00Z');
      // Caller email must NOT be in the query string.
      expect(req.request.params.get('email')).toBeNull();
      req.flush(mockResponse);
    });
  });

  describe('reactToShare', () => {
    const mockEnrichment: ReactResponse = {
      queuedCount: 1,
      ratedCount: 0,
      viewerHasQueued: true,
      viewerRating: null,
      sharerRating: null,
    };

    it('POSTs queued action without rating and without caller email', (done) => {
      service
        .reactToShare(email, 's1', 'queued')
        .subscribe((resp) => {
          expect(resp.viewerHasQueued).toBe(true);
          done();
        });

      const req = httpMock.expectOne((r) => r.url.endsWith('/shares/react'));
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({
        shareId: 's1',
        action: 'queued',
      });
      // Caller email must NOT be in the body.
      expect((req.request.body as Record<string, unknown>)['email']).toBeUndefined();
      req.flush(mockEnrichment);
    });

    it('POSTs rated action with rating in body (no caller email)', (done) => {
      service
        .reactToShare(email, 's1', 'rated', 4)
        .subscribe(() => done());

      const req = httpMock.expectOne((r) => r.url.endsWith('/shares/react'));
      expect(req.request.body).toEqual({
        shareId: 's1',
        action: 'rated',
        rating: 4,
      });
      // Caller email must NOT be in the body.
      expect((req.request.body as Record<string, unknown>)['email']).toBeUndefined();
      req.flush({
        ...mockEnrichment,
        ratedCount: 1,
        viewerRating: 4,
      });
    });

    it('does not include rating on unrated (and never sends caller email)', (done) => {
      service
        .reactToShare(email, 's1', 'unrated')
        .subscribe(() => done());

      const req = httpMock.expectOne((r) => r.url.endsWith('/shares/react'));
      expect(req.request.body['rating']).toBeUndefined();
      // Caller email must NOT be in the body.
      expect(req.request.body['email']).toBeUndefined();
      req.flush(mockEnrichment);
    });
  });
});
