import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';

import { NotificationsService } from './notifications.service';

describe('NotificationsService — inbox', () => {
  let service: NotificationsService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [NotificationsService],
    });
    service = TestBed.inject(NotificationsService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('unwraps a `data`-envelope feed response', () => {
    let page: any;
    service.getFeed().subscribe((p) => (page = p));

    const req = httpMock.expectOne((r) => r.url.endsWith('/notifications/feed'));
    req.flush({ data: { items: [{ tsId: 'a' }], nextCursor: 'b' } });

    expect(page.items.length).toBe(1);
    expect(page.nextCursor).toBe('b');
  });

  it('also accepts an unwrapped feed response', () => {
    // Not every deployed handler version wraps in `data`; tolerating both
    // beats a runtime shape error in the UI.
    let page: any;
    service.getFeed().subscribe((p) => (page = p));

    httpMock
      .expectOne((r) => r.url.endsWith('/notifications/feed'))
      .flush({ items: [{ tsId: 'a' }], nextCursor: null });

    expect(page.items.length).toBe(1);
    expect(page.nextCursor).toBeNull();
  });

  it('defaults a malformed feed response to an empty page', () => {
    let page: any;
    service.getFeed().subscribe((p) => (page = p));

    httpMock.expectOne((r) => r.url.endsWith('/notifications/feed')).flush({});

    expect(page.items).toEqual([]);
    expect(page.nextCursor).toBeNull();
  });

  it('sends the cursor as an encoded param, not raw in the URL', () => {
    // A tsId contains '#'. Interpolated raw it terminates the query string and
    // the cursor silently vanishes — the client then re-requests page one
    // forever.
    const cursor = '2026-08-25T00:00:00+00:00#abc';
    service.getFeed(25, cursor).subscribe();

    const req = httpMock.expectOne((r) => r.url.endsWith('/notifications/feed'));
    expect(req.request.params.get('cursor')).toBe(cursor);
    expect(req.request.urlWithParams).toContain('%23abc');
    req.flush({ items: [], nextCursor: null });
  });

  it('decrements the badge when one item is marked read', () => {
    service.refreshUnreadCount().subscribe();
    httpMock
      .expectOne((r) => r.url.endsWith('/notifications/unread-count'))
      .flush({ data: { unread: 3 } });

    let unread = 0;
    service.unread$.subscribe((n) => (unread = n));
    expect(unread).toBe(3);

    service.markRead('t1').subscribe();
    httpMock.expectOne((r) => r.url.endsWith('/notifications/read')).flush({});
    expect(unread).toBe(2);
  });

  it('never lets the badge go negative', () => {
    let unread = -1;
    service.unread$.subscribe((n) => (unread = n));

    service.markRead('t1').subscribe();
    httpMock.expectOne((r) => r.url.endsWith('/notifications/read')).flush({});

    expect(unread).toBe(0);
  });

  it('zeroes the badge on mark-all-read', () => {
    service.refreshUnreadCount().subscribe();
    httpMock
      .expectOne((r) => r.url.endsWith('/notifications/unread-count'))
      .flush({ unread: 9 });

    let unread = 0;
    service.unread$.subscribe((n) => (unread = n));
    expect(unread).toBe(9);

    service.markAllRead().subscribe();
    const req = httpMock.expectOne((r) => r.url.endsWith('/notifications/read'));
    expect(req.request.body).toEqual({ all: true });
    req.flush({});

    expect(unread).toBe(0);
  });

  it('holds the previous count when the badge request fails', () => {
    // A transient 500 must not blank a badge the user was relying on.
    service.refreshUnreadCount().subscribe();
    httpMock
      .expectOne((r) => r.url.endsWith('/notifications/unread-count'))
      .flush({ unread: 5 });

    let unread = 0;
    service.unread$.subscribe((n) => (unread = n));

    service.refreshUnreadCount().subscribe();
    httpMock
      .expectOne((r) => r.url.endsWith('/notifications/unread-count'))
      .flush('boom', { status: 500, statusText: 'Server Error' });

    expect(unread).toBe(5);
  });
});
