import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';

import {
  FavoriteItem,
  FavoritesResponse,
  FavoritesService,
} from './favorites.service';

describe('FavoritesService', () => {
  let service: FavoritesService;
  let httpMock: HttpTestingController;

  function mkItem(rank: number, id = `sp${rank}`): FavoriteItem {
    return { rank, spotifyId: id, name: `Track ${rank}`, artist: 'Artist', imageUrl: 'https://art/' + id };
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [FavoritesService],
    });
    service = TestBed.inject(FavoritesService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('GETs /favorites/get?year=YYYY and passes the envelope through', (done) => {
    const mockResponse: FavoritesResponse = {
      year: 2026,
      overall: { songs: [mkItem(1)], albums: [], artists: [] },
      lists: [{ listId: 'l1', category: 'songs', genreLabel: 'Top Rap', items: [mkItem(1)] }],
    };

    service.getFavorites(2026).subscribe((resp) => {
      expect(resp).toEqual(mockResponse);
      done();
    });

    const req = httpMock.expectOne(
      (r) => r.url.endsWith('/favorites/get') && r.params.get('year') === '2026',
    );
    expect(req.request.method).toBe('GET');
    req.flush(mockResponse);
  });

  it('treats a 404 as "no favorites yet" and resolves an empty envelope instead of erroring', (done) => {
    service.getFavorites(2026).subscribe({
      next: (resp) => {
        expect(resp).toEqual({
          year: 2026,
          overall: { songs: [], albums: [], artists: [] },
          lists: [],
        });
        done();
      },
      error: () => fail('expected 404 to resolve, not error'),
    });

    httpMock
      .expectOne((r) => r.url.endsWith('/favorites/get'))
      .flush({ message: 'not found' }, { status: 404, statusText: 'Not Found' });
  });

  it('propagates non-404 errors', (done) => {
    service.getFavorites(2026).subscribe({
      next: () => fail('expected an error'),
      error: (err) => {
        expect(err.status).toBe(500);
        done();
      },
    });

    httpMock
      .expectOne((r) => r.url.endsWith('/favorites/get'))
      .flush({ message: 'boom' }, { status: 500, statusText: 'Server Error' });
  });

  it('POSTs a new list to /favorites/list-create', (done) => {
    const created = { listId: 'l2', category: 'albums' as const, genreLabel: 'Top EDM', items: [] };

    service.createList(2026, 'albums', 'Top EDM').subscribe((resp) => {
      expect(resp).toEqual(created);
      done();
    });

    const req = httpMock.expectOne((r) => r.url.endsWith('/favorites/list-create'));
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ year: 2026, category: 'albums', genreLabel: 'Top EDM' });
    req.flush(created);
  });

  it('PUTs items to /favorites/list-set with year + listId in the body, normalizing ranks 1..N and capping at 5', (done) => {
    const items = [mkItem(9, 'a'), mkItem(3, 'b'), mkItem(1, 'c'), mkItem(2, 'd'), mkItem(4, 'e'), mkItem(5, 'f')];

    service.updateListItems(2026, 'l1', items).subscribe(() => done());

    const req = httpMock.expectOne((r) => r.url.endsWith('/favorites/list-set'));
    expect(req.request.method).toBe('PUT');
    expect(req.request.body.year).toBe(2026);
    expect(req.request.body.listId).toBe('l1');
    expect(req.request.body.items.length).toBe(5);
    expect(req.request.body.items.map((i: FavoriteItem) => i.rank)).toEqual([1, 2, 3, 4, 5]);
    req.flush({ listId: 'l1', category: 'songs', genreLabel: 'x', items: [] });
  });

  it('GETs list-history?listId= and returns [] on error rather than throwing', (done) => {
    service.getListHistory('l1').subscribe((events) => {
      expect(events).toEqual([]);
      done();
    });

    httpMock
      .expectOne((r) => r.url.endsWith('/favorites/list-history') && r.params.get('listId') === 'l1')
      .flush({ message: 'boom' }, { status: 500, statusText: 'Server Error' });
  });

  it('GETs history events on success', (done) => {
    const events = [{ ts: '2026-03-01T00:00:00Z', spotifyId: 'a', fromRank: null, toRank: 1 }];

    service.getListHistory('l1').subscribe((resp) => {
      expect(resp).toEqual(events);
      done();
    });

    httpMock
      .expectOne((r) => r.url.endsWith('/favorites/list-history'))
      .flush({ listId: 'l1', events });
  });

  it('GETs recommendations with category + listId + year params and returns [] on error', (done) => {
    service.getRecommendations(2026, 'songs', 'l1').subscribe((recs) => {
      expect(recs).toEqual([]);
      done();
    });

    const req = httpMock.expectOne(
      (r) =>
        r.url.endsWith('/favorites/recommendations') &&
        r.params.get('category') === 'songs' &&
        r.params.get('listId') === 'l1' &&
        r.params.get('year') === '2026',
    );
    req.flush({ message: 'boom' }, { status: 500, statusText: 'Server Error' });
  });

  it('DELETEs /favorites/list-delete with listId + year query params', (done) => {
    service.deleteList(2026, 'l1').subscribe(() => done());

    const req = httpMock.expectOne(
      (r) =>
        r.url.endsWith('/favorites/list-delete') &&
        r.params.get('listId') === 'l1' &&
        r.params.get('year') === '2026',
    );
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });

  it('builds a deterministic id for the implicit Overall lists, matching the backend\'s auto-create scheme', () => {
    expect(service.overallListId(2026, 'songs')).toBe('overall:2026:songs');
  });
});
