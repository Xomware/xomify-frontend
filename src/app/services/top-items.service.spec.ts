import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';

import {
  TopItemsArtist,
  TopItemsResponse,
  TopItemsService,
  TopItemsTrack,
} from './top-items.service';

describe('TopItemsService', () => {
  let service: TopItemsService;
  let httpMock: HttpTestingController;

  function mkTrack(id: string): TopItemsTrack {
    return {
      id,
      name: `Track ${id}`,
      artists: [{ id: 'a1', name: 'Artist 1' }],
      album: {
        id: 'al1',
        name: 'Album',
        images: [{ url: 'https://art/' + id }],
        release_date: '2026-01-01',
      },
      duration_ms: 180_000,
      popularity: 70,
      explicit: false,
      preview_url: null,
      external_urls: { spotify: 'https://open.spotify.com/track/' + id },
    };
  }

  function mkArtist(id: string): TopItemsArtist {
    return {
      id,
      name: `Artist ${id}`,
      images: [{ url: 'https://art/artist/' + id }],
      genres: ['indie rock'],
      popularity: 65,
      external_urls: { spotify: 'https://open.spotify.com/artist/' + id },
    };
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [TopItemsService],
    });
    service = TestBed.inject(TopItemsService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('GETs the configured /user/top-items URL', (done) => {
    const mockResponse: TopItemsResponse = {
      data: {
        tracks: { short_term: [], medium_term: [], long_term: [] },
        artists: { short_term: [], medium_term: [], long_term: [] },
        genres: { short_term: {}, medium_term: {}, long_term: {} },
      },
      error: null,
      meta: {},
    };

    service.getTopItems().subscribe((resp) => {
      expect(resp).toEqual(mockResponse);
      done();
    });

    const req = httpMock.expectOne((r) => r.url.endsWith('/user/top-items'));
    expect(req.request.method).toBe('GET');
    // Auth is the interceptor's job, not this service's.
    req.flush(mockResponse);
  });

  it('decodes a full success response (tracks, artists, genres for all ranges)', (done) => {
    const mockResponse: TopItemsResponse = {
      data: {
        tracks: {
          short_term: [mkTrack('s1'), mkTrack('s2')],
          medium_term: [mkTrack('m1')],
          long_term: [mkTrack('l1')],
        },
        artists: {
          short_term: [mkArtist('as1')],
          medium_term: [mkArtist('am1')],
          long_term: [mkArtist('al1')],
        },
        genres: {
          short_term: { 'indie rock': 12, pop: 4 },
          medium_term: { pop: 9 },
          long_term: { 'classic rock': 20 },
        },
      },
      error: null,
      meta: {},
    };

    service.getTopItems().subscribe((resp) => {
      expect(resp.data.tracks.short_term?.length).toBe(2);
      expect(resp.data.tracks.short_term?.[0].id).toBe('s1');
      expect(resp.data.artists.medium_term?.[0].name).toBe('Artist am1');
      expect(resp.data.genres.long_term?.['classic rock']).toBe(20);
      expect(resp.data.meta?.failed_ranges).toBeUndefined();
      done();
    });

    httpMock
      .expectOne((r) => r.url.endsWith('/user/top-items'))
      .flush(mockResponse);
  });

  it('surfaces partial-failure metadata (meta.failed_ranges)', (done) => {
    const mockResponse: TopItemsResponse = {
      data: {
        tracks: {
          short_term: [mkTrack('s1')],
          medium_term: null,
          long_term: [mkTrack('l1')],
        },
        artists: {
          short_term: [mkArtist('as1')],
          medium_term: null,
          long_term: [mkArtist('al1')],
        },
        genres: {
          short_term: { pop: 1 },
          medium_term: null,
          long_term: { jazz: 3 },
        },
        meta: { failed_ranges: ['medium_term'] },
      },
      error: null,
      meta: {},
    };

    service.getTopItems().subscribe((resp) => {
      expect(resp.data.tracks.medium_term).toBeNull();
      expect(resp.data.meta?.failed_ranges).toEqual(['medium_term']);
      done();
    });

    httpMock
      .expectOne((r) => r.url.endsWith('/user/top-items'))
      .flush(mockResponse);
  });

  it('surfaces an HTTP error to the caller', (done) => {
    service.getTopItems().subscribe({
      next: () => {
        fail('expected an error');
      },
      error: (err) => {
        expect(err.status).toBe(500);
        done();
      },
    });

    httpMock
      .expectOne((r) => r.url.endsWith('/user/top-items'))
      .flush(
        { error: { code: 'INTERNAL', message: 'boom' } },
        { status: 500, statusText: 'Server Error' },
      );
  });
});
