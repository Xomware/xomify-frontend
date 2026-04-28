import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { SearchService } from './search.service';
import { AuthService } from './auth.service';

describe('SearchService', () => {
  let service: SearchService;
  let httpMock: HttpTestingController;
  let authSpy: jasmine.SpyObj<AuthService>;

  const SPOTIFY_BASE = 'https://api.spotify.com/v1';

  beforeEach(() => {
    authSpy = jasmine.createSpyObj('AuthService', ['getAccessToken']);
    authSpy.getAccessToken.and.returnValue('test-token');

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        SearchService,
        { provide: AuthService, useValue: authSpy },
      ],
    });

    service = TestBed.inject(SearchService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('hits /search with q, type=track, limit=20 by default', (done) => {
    service.search('daft punk', 'track').subscribe((res) => {
      expect(res.tracks.length).toBe(1);
      expect(res.tracks[0].id).toBe('track1');
      done();
    });

    const req = httpMock.expectOne((r) => r.url === `${SPOTIFY_BASE}/search`);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('q')).toBe('daft punk');
    expect(req.request.params.get('type')).toBe('track');
    expect(req.request.params.get('limit')).toBe('20');
    expect(req.request.headers.get('Authorization')).toBe('Bearer test-token');

    req.flush({
      tracks: {
        items: [
          {
            id: 'track1',
            name: 'Around the World',
            uri: 'spotify:track:track1',
            artists: [{ id: 'a1', name: 'Daft Punk' }],
            album: { id: 'al1', name: 'Homework', images: [] },
          },
        ],
        total: 1,
      },
    });
  });

  it('passes a custom limit when provided', (done) => {
    service.search('test', 'artist', 5).subscribe(() => done());

    const req = httpMock.expectOne((r) => r.url === `${SPOTIFY_BASE}/search`);
    expect(req.request.params.get('type')).toBe('artist');
    expect(req.request.params.get('limit')).toBe('5');
    req.flush({ artists: { items: [], total: 0 } });
  });

  it('trims whitespace before sending the query', (done) => {
    service.search('  hello  ', 'album').subscribe(() => done());

    const req = httpMock.expectOne((r) => r.url === `${SPOTIFY_BASE}/search`);
    expect(req.request.params.get('q')).toBe('hello');
    expect(req.request.params.get('type')).toBe('album');
    req.flush({ albums: { items: [], total: 0 } });
  });

  it('short-circuits empty queries without making a network call', (done) => {
    service.search('   ', 'track').subscribe((res) => {
      expect(res.tracks).toEqual([]);
      expect(res.artists).toEqual([]);
      expect(res.albums).toEqual([]);
      expect(res.total).toBe(0);
      done();
    });

    httpMock.expectNone((r) => r.url === `${SPOTIFY_BASE}/search`);
  });

  it('normalizes the artists response into the artists field', (done) => {
    service.search('radiohead', 'artist').subscribe((res) => {
      expect(res.artists.length).toBe(2);
      expect(res.tracks).toEqual([]);
      expect(res.albums).toEqual([]);
      expect(res.total).toBe(2);
      done();
    });

    const req = httpMock.expectOne((r) => r.url === `${SPOTIFY_BASE}/search`);
    req.flush({
      artists: {
        items: [
          { id: 'a1', name: 'Radiohead', uri: 'spotify:artist:a1', images: [] },
          { id: 'a2', name: 'Radio Dept', uri: 'spotify:artist:a2', images: [] },
        ],
        total: 2,
      },
    });
  });

  it('normalizes the albums response into the albums field', (done) => {
    service.search('ok computer', 'album').subscribe((res) => {
      expect(res.albums.length).toBe(1);
      expect(res.albums[0].id).toBe('al1');
      done();
    });

    const req = httpMock.expectOne((r) => r.url === `${SPOTIFY_BASE}/search`);
    req.flush({
      albums: {
        items: [
          {
            id: 'al1',
            name: 'OK Computer',
            uri: 'spotify:album:al1',
            artists: [{ id: 'a1', name: 'Radiohead' }],
            images: [],
          },
        ],
        total: 1,
      },
    });
  });

  it('propagates HTTP errors to the subscriber', (done) => {
    service.search('boom', 'track').subscribe({
      next: () => fail('expected error'),
      error: (err) => {
        expect(err.status).toBe(500);
        done();
      },
    });

    const req = httpMock.expectOne((r) => r.url === `${SPOTIFY_BASE}/search`);
    req.flush('server exploded', { status: 500, statusText: 'Server Error' });
  });
});
