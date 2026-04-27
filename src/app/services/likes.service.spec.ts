import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { LikesService, LikePushItem } from './likes.service';
import { environment } from 'src/environments/environment';

const API = environment.xomifyApiUrl;

describe('LikesService', () => {
  let service: LikesService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [LikesService],
    });
    service = TestBed.inject(LikesService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  describe('pushUserLikes', () => {
    it('sends a single batch when tracks <= BATCH_SIZE', (done) => {
      const tracks: LikePushItem[] = [
        { trackId: 't1', addedAt: '2026-01-01T00:00:00Z' },
        { trackId: 't2', addedAt: '2026-01-02T00:00:00Z' },
      ];

      service.pushUserLikes(tracks).subscribe(() => done());

      const req = httpMock.expectOne(`${API}/likes/push`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body.tracks.length).toBe(2);
      req.flush(null);
    });

    it('splits into batches of 25 (WAF body-size limit)', (done) => {
      // BATCH_SIZE is 25 — kept under the 8 KB WAF SizeRestrictions_BODY rule.
      // 60 tracks => 25 + 25 + 10.
      const tracks: LikePushItem[] = Array.from({ length: 60 }, (_, i) => ({
        trackId: `t${i}`,
        addedAt: '2026-01-01T00:00:00Z',
      }));

      service.pushUserLikes(tracks).subscribe(() => done());

      const req1 = httpMock.expectOne(`${API}/likes/push`);
      expect(req1.request.body.tracks.length).toBe(25);
      req1.flush(null);

      const req2 = httpMock.expectOne(`${API}/likes/push`);
      expect(req2.request.body.tracks.length).toBe(25);
      req2.flush(null);

      const req3 = httpMock.expectOne(`${API}/likes/push`);
      expect(req3.request.body.tracks.length).toBe(10);
      req3.flush(null);
    });

    it('completes immediately with empty array when no tracks', (done) => {
      service.pushUserLikes([]).subscribe((result) => {
        expect(result).toEqual([]);
        done();
      });
      httpMock.expectNone(`${API}/likes/push`);
    });
  });

  describe('getLikesByUser', () => {
    const mockResponse = {
      tracks: [
        {
          trackId: 't1',
          addedAt: '2026-01-01T00:00:00Z',
          trackName: 'Song 1',
          artistName: 'Artist 1',
        },
      ],
      total: 1,
    };

    it('GETs with targetEmail + default offset/limit', (done) => {
      service.getLikesByUser('dom@example.com').subscribe((resp) => {
        expect(resp.total).toBe(1);
        // hasMore derived locally — 1 of 1 -> no more.
        expect(resp.hasMore).toBe(false);
        expect(resp.nextOffset).toBe(1);
        done();
      });

      const req = httpMock.expectOne((r) =>
        r.url.endsWith('/likes/by-user') &&
        r.params.get('targetEmail') === 'dom@example.com' &&
        r.params.get('offset') === '0' &&
        r.params.get('limit') === '30',
      );
      expect(req.request.method).toBe('GET');
      req.flush(mockResponse);
    });

    it('passes custom limit + offset when provided', (done) => {
      service
        .getLikesByUser('dom@example.com', { limit: 20, offset: 40 })
        .subscribe((resp) => {
          // 40 + 1 of 1 total -> still no more.
          expect(resp.nextOffset).toBe(41);
          done();
        });

      const req = httpMock.expectOne((r) => r.url.endsWith('/likes/by-user'));
      expect(req.request.params.get('targetEmail')).toBe('dom@example.com');
      expect(req.request.params.get('limit')).toBe('20');
      expect(req.request.params.get('offset')).toBe('40');
      req.flush(mockResponse);
    });

    it('marks hasMore=true when offset+page < total', (done) => {
      service
        .getLikesByUser('dom@example.com', { limit: 10, offset: 0 })
        .subscribe((resp) => {
          expect(resp.hasMore).toBe(true);
          expect(resp.nextOffset).toBe(10);
          done();
        });

      const req = httpMock.expectOne((r) => r.url.endsWith('/likes/by-user'));
      req.flush({
        tracks: Array.from({ length: 10 }, (_, i) => ({
          trackId: `t${i}`,
          addedAt: '2026-01-01T00:00:00Z',
        })),
        total: 100,
      });
    });
  });

  describe('setLikesPublic', () => {
    it('POSTs to /users/likes-public with correct body', (done) => {
      service.setLikesPublic(true).subscribe(() => done());

      const req = httpMock.expectOne((r) =>
        r.url.endsWith('/users/likes-public'),
      );
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ public: true });
      req.flush(null);
    });

    it('sends false correctly', (done) => {
      service.setLikesPublic(false).subscribe(() => done());

      const req = httpMock.expectOne((r) =>
        r.url.endsWith('/users/likes-public'),
      );
      expect(req.request.body).toEqual({ public: false });
      req.flush(null);
    });
  });
});
