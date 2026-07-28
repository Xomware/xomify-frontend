import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';

import { Broadcast, BroadcastsService } from './broadcasts.service';

describe('BroadcastsService', () => {
  let service: BroadcastsService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [BroadcastsService],
    });
    service = TestBed.inject(BroadcastsService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('GETs the configured /broadcasts/active URL', (done) => {
    service.getActiveBroadcasts().subscribe((broadcasts) => {
      expect(broadcasts).toEqual([]);
      done();
    });

    const req = httpMock.expectOne((r) => r.url.endsWith('/broadcasts/active'));
    expect(req.request.method).toBe('GET');
    req.flush({ broadcasts: [] });
  });

  it('unwraps the { broadcasts: [...] } envelope', (done) => {
    const future = new Date(Date.now() + 60_000).toISOString();
    const mock: Broadcast[] = [
      { id: '1', title: 'New feature', body: 'Check it out', activeUntil: future, createdAt: future },
      { id: '2', title: 'No expiry', body: 'Still active' },
    ];

    service.getActiveBroadcasts().subscribe((broadcasts) => {
      expect(broadcasts.length).toBe(2);
      expect(broadcasts[0].id).toBe('1');
      done();
    });

    httpMock
      .expectOne((r) => r.url.endsWith('/broadcasts/active'))
      .flush({ broadcasts: mock });
  });

  it('filters out broadcasts whose activeUntil is in the past', (done) => {
    const past = new Date(Date.now() - 60_000).toISOString();
    const future = new Date(Date.now() + 60_000).toISOString();
    const mock: Broadcast[] = [
      { id: 'expired', title: 'Old', body: 'Old news', activeUntil: past },
      { id: 'live', title: 'Fresh', body: 'Still going', activeUntil: future },
    ];

    service.getActiveBroadcasts().subscribe((broadcasts) => {
      expect(broadcasts.length).toBe(1);
      expect(broadcasts[0].id).toBe('live');
      done();
    });

    httpMock
      .expectOne((r) => r.url.endsWith('/broadcasts/active'))
      .flush({ broadcasts: mock });
  });

  it('degrades to [] on a 404 (endpoint not deployed yet)', (done) => {
    service.getActiveBroadcasts().subscribe((broadcasts) => {
      expect(broadcasts).toEqual([]);
      done();
    });

    httpMock
      .expectOne((r) => r.url.endsWith('/broadcasts/active'))
      .flush('Not Found', { status: 404, statusText: 'Not Found' });
  });

  it('degrades to [] when the response has no broadcasts array', (done) => {
    service.getActiveBroadcasts().subscribe((broadcasts) => {
      expect(broadcasts).toEqual([]);
      done();
    });

    httpMock
      .expectOne((r) => r.url.endsWith('/broadcasts/active'))
      .flush({ unexpected: 'shape' } as unknown as { broadcasts: Broadcast[] });
  });
});
