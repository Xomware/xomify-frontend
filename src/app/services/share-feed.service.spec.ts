import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';

import {
  CommentDeleteResponse,
  CommentsListResponse,
  CreateShareRequest,
  CreateShareResponse,
  FeedResponse,
  ReactResponse,
  ReactionToggleResponse,
  ShareComment,
  ShareDetailResponse,
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

  // ============================================
  // Delete share (#275)
  // ============================================

  describe('deleteShare', () => {
    it('issues DELETE /shares/delete with shareId in the body (not POST)', (done) => {
      service.deleteShare('s1').subscribe(() => done());

      const req = httpMock.expectOne((r) => r.url.endsWith('/shares/delete'));
      // Method must be DELETE — iOS bug-fix lineage swapped POST -> DELETE
      // and this guards against the same regression on web.
      expect(req.request.method).toBe('DELETE');
      expect(req.request.body).toEqual({ shareId: 's1' });
      // Caller email must NOT be in the body — sourced from the JWT.
      expect((req.request.body as Record<string, unknown>)['email']).toBeUndefined();
      req.flush(null, { status: 204, statusText: 'No Content' });
    });

    it('forwards sharedAt when provided (forward-compat with iOS)', (done) => {
      service.deleteShare('s1', '2026-04-23T10:00:00Z').subscribe(() => done());
      const req = httpMock.expectOne((r) => r.url.endsWith('/shares/delete'));
      expect(req.request.method).toBe('DELETE');
      expect(req.request.body).toEqual({
        shareId: 's1',
        sharedAt: '2026-04-23T10:00:00Z',
      });
      req.flush(null, { status: 204, statusText: 'No Content' });
    });
  });

  // ============================================
  // Share-detail
  // ============================================

  describe('getShareDetail', () => {
    const mockResponse: ShareDetailResponse = {
      share: {
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
        queuedCount: 1,
        ratedCount: 2,
        viewerHasQueued: false,
        viewerRating: null,
        sharerRating: 4,
        commentCount: 3,
        reactionCounts: { fire: 2, heart: 1 },
        viewerReactions: ['fire'],
      },
      interactions: [
        {
          email: 'a@b.com',
          displayName: 'Alice',
          avatar: null,
          action: 'queued',
          createdAt: '2026-04-23T10:00:00Z',
        },
      ],
      friendRatings: [
        {
          email: 'c@d.com',
          displayName: 'Cara',
          avatar: null,
          rating: 5,
          review: null,
          ratedAt: '2026-04-23T09:00:00Z',
        },
      ],
    };

    it('GETs /shares/detail with only shareId when no extras', (done) => {
      service.getShareDetail('s1').subscribe((resp) => {
        expect(resp.share.shareId).toBe('s1');
        expect(resp.interactions.length).toBe(1);
        expect(resp.friendRatings.length).toBe(1);
        done();
      });

      const req = httpMock.expectOne((r) => r.url.endsWith('/shares/detail'));
      expect(req.request.method).toBe('GET');
      expect(req.request.params.get('shareId')).toBe('s1');
      expect(req.request.params.get('sharedBy')).toBeNull();
      expect(req.request.params.get('sharedAt')).toBeNull();
      req.flush(mockResponse);
    });

    it('forwards sharedBy / sharedAt when provided (forward-compat)', (done) => {
      service
        .getShareDetail('s1', 'author@example.com', '2026-04-23T10:00:00Z')
        .subscribe(() => done());

      const req = httpMock.expectOne((r) => r.url.endsWith('/shares/detail'));
      expect(req.request.params.get('shareId')).toBe('s1');
      expect(req.request.params.get('sharedBy')).toBe('author@example.com');
      expect(req.request.params.get('sharedAt')).toBe('2026-04-23T10:00:00Z');
      req.flush(mockResponse);
    });
  });

  // ============================================
  // Comments
  // ============================================

  describe('listComments', () => {
    const mockResponse: CommentsListResponse = {
      comments: [
        {
          commentId: 'c1',
          shareId: 's1',
          email: 'a@b.com',
          displayName: 'Alice',
          avatar: null,
          body: 'Hello',
          createdAt: '2026-04-23T10:00:00Z',
        },
      ],
      nextBefore: null,
    };

    it('GETs /shares/comments-list with shareId only when no paging', (done) => {
      service.listComments('s1').subscribe((resp) => {
        expect(resp.comments.length).toBe(1);
        done();
      });

      const req = httpMock.expectOne((r) =>
        r.url.endsWith('/shares/comments-list'),
      );
      expect(req.request.method).toBe('GET');
      expect(req.request.params.get('shareId')).toBe('s1');
      expect(req.request.params.get('limit')).toBeNull();
      expect(req.request.params.get('before')).toBeNull();
      req.flush(mockResponse);
    });

    it('forwards limit and before when given', (done) => {
      service.listComments('s1', 25, '2026-04-23T09:00:00Z').subscribe(() => done());

      const req = httpMock.expectOne((r) =>
        r.url.endsWith('/shares/comments-list'),
      );
      expect(req.request.params.get('shareId')).toBe('s1');
      expect(req.request.params.get('limit')).toBe('25');
      expect(req.request.params.get('before')).toBe('2026-04-23T09:00:00Z');
      req.flush(mockResponse);
    });
  });

  describe('createComment', () => {
    it('POSTs /shares/comments-create with shareId + body (no caller email)', (done) => {
      const mockResponse: ShareComment = {
        commentId: 'c1',
        shareId: 's1',
        email,
        displayName: 'Dom',
        avatar: null,
        body: 'Hello',
        createdAt: '2026-04-23T10:00:00Z',
      };
      service.createComment('s1', 'Hello').subscribe((resp) => {
        expect(resp.commentId).toBe('c1');
        done();
      });

      const req = httpMock.expectOne((r) =>
        r.url.endsWith('/shares/comments-create'),
      );
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ shareId: 's1', body: 'Hello' });
      expect((req.request.body as Record<string, unknown>)['email']).toBeUndefined();
      req.flush(mockResponse);
    });
  });

  describe('deleteComment', () => {
    it('DELETEs /shares/comments-delete with shareId + commentId in the body', (done) => {
      const mockResponse: CommentDeleteResponse = {
        deleted: true,
        commentId: 'c1',
      };
      service.deleteComment('s1', 'c1').subscribe((resp) => {
        expect(resp.deleted).toBe(true);
        done();
      });

      const req = httpMock.expectOne((r) =>
        r.url.endsWith('/shares/comments-delete'),
      );
      expect(req.request.method).toBe('DELETE');
      expect(req.request.body).toEqual({ shareId: 's1', commentId: 'c1' });
      req.flush(mockResponse);
    });
  });

  // ============================================
  // Emoji reactions
  // ============================================

  describe('toggleReaction', () => {
    it('POSTs /shares/reactions-toggle with the shareId + reaction slug', (done) => {
      const mockResponse: ReactionToggleResponse = {
        active: true,
        reaction: 'fire',
        counts: { fire: 1 },
        viewerReactions: ['fire'],
      };
      service.toggleReaction('s1', 'fire').subscribe((resp) => {
        expect(resp.active).toBe(true);
        expect(resp.counts.fire).toBe(1);
        expect(resp.viewerReactions).toEqual(['fire']);
        done();
      });

      const req = httpMock.expectOne((r) =>
        r.url.endsWith('/shares/reactions-toggle'),
      );
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ shareId: 's1', reaction: 'fire' });
      // Caller email must NOT be in the body.
      expect((req.request.body as Record<string, unknown>)['email']).toBeUndefined();
      req.flush(mockResponse);
    });

    it('passes the underscored slug for mind_blown', (done) => {
      const mockResponse: ReactionToggleResponse = {
        active: true,
        reaction: 'mind_blown',
        counts: { mind_blown: 1 },
        viewerReactions: ['mind_blown'],
      };
      service.toggleReaction('s1', 'mind_blown').subscribe(() => done());

      const req = httpMock.expectOne((r) =>
        r.url.endsWith('/shares/reactions-toggle'),
      );
      expect((req.request.body as Record<string, unknown>)['reaction']).toBe(
        'mind_blown',
      );
      req.flush(mockResponse);
    });
  });
});
