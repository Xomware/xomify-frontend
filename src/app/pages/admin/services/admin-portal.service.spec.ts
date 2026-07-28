import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { AdminPortalService } from './admin-portal.service';
import { environment } from 'src/environments/environment';
import { AdminCron, AdminHealthSummary, AdminNotification, AdminUser, AdminUserVisit, AdminViewAs } from '../models/admin-portal.model';

describe('AdminPortalService', () => {
  let service: AdminPortalService;
  let httpMock: HttpTestingController;

  const baseUrl = `${environment.xomifyApiUrl}/admin`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [AdminPortalService],
    });
    service = TestBed.inject(AdminPortalService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('GET /admin/health sends windowHours and returns the summary', (done) => {
    const sample: AdminHealthSummary = {
      windowHours: 24,
      totalCalls: 10,
      errorCount: 1,
      byRoute: [{ path: '/me/get', count: 10, errors: 1, p50ms: 42 }],
      recentErrors: [],
    };
    service.health(24).subscribe((res) => {
      expect(res).toEqual(sample);
      done();
    });
    const req = httpMock.expectOne((r) => r.url === `${baseUrl}/health`);
    expect(req.request.params.get('windowHours')).toBe('24');
    req.flush(sample);
  });

  it('GET /admin/users-list returns the raw array when the backend responds with one', (done) => {
    const sample: AdminUser[] = [
      {
        email: 'dominickj.giordano@gmail.com',
        displayName: 'Dom',
        lastSeen: '2026-07-28T00:00:00Z',
        optIns: { wrapped: true, releaseRadar: false, likesPublic: true, favoritesReminder: false },
        spotifyConnected: true,
      },
    ];
    service.usersList().subscribe((res) => {
      expect(res).toEqual(sample);
      done();
    });
    const req = httpMock.expectOne(`${baseUrl}/users-list`);
    req.flush(sample);
  });

  it('GET /admin/users-list unwraps a { users } shape', (done) => {
    const sample: AdminUser[] = [];
    service.usersList().subscribe((res) => {
      expect(res).toEqual(sample);
      done();
    });
    const req = httpMock.expectOne(`${baseUrl}/users-list`);
    req.flush({ users: sample });
  });

  it('GET /admin/user-visits sends email and unwraps a { visits } shape', (done) => {
    const sample: AdminUserVisit[] = [{ ts: '2026-07-28T00:00:00Z', path: '/my-profile' }];
    service.userVisits('a@b.com').subscribe((res) => {
      expect(res).toEqual(sample);
      done();
    });
    const req = httpMock.expectOne((r) => r.url === `${baseUrl}/user-visits`);
    expect(req.request.params.get('email')).toBe('a@b.com');
    req.flush({ visits: sample });
  });

  it('GET /admin/view-as sends email and returns the snapshot', (done) => {
    const sample: AdminViewAs = {
      email: 'a@b.com',
      profile: { displayName: 'A' },
      optIns: { wrapped: true },
      recentVisits: [],
      favorites: null,
      activeBroadcasts: [],
      note: "Spotify-derived surfaces aren't impersonated.",
    };
    service.viewAs('a@b.com').subscribe((res) => {
      expect(res).toEqual(sample);
      done();
    });
    const req = httpMock.expectOne((r) => r.url === `${baseUrl}/view-as`);
    expect(req.request.params.get('email')).toBe('a@b.com');
    req.flush(sample);
  });

  it('GET /admin/crons unwraps a { crons } shape', (done) => {
    const sample: AdminCron[] = [
      { cronName: 'wrapped-refresh', lastRun: null, recentRuns: [] },
    ];
    service.crons().subscribe((res) => {
      expect(res).toEqual(sample);
      done();
    });
    const req = httpMock.expectOne(`${baseUrl}/crons`);
    req.flush({ crons: sample });
  });

  it('GET /admin/notifications sends limit and unwraps a { notifications } shape', (done) => {
    const sample: AdminNotification[] = [
      {
        ts: '2026-07-28T00:00:00Z',
        channel: 'email',
        toEmail: 'a@b.com',
        subject: 'Hi',
        bodyPreview: 'Hello…',
        status: 'sent',
        error: null,
      },
    ];
    service.notifications(50).subscribe((res) => {
      expect(res).toEqual(sample);
      done();
    });
    const req = httpMock.expectOne((r) => r.url === `${baseUrl}/notifications`);
    expect(req.request.params.get('limit')).toBe('50');
    req.flush({ notifications: sample });
  });

  it('propagates a 404 (endpoint not live yet) to the caller', (done) => {
    service.crons().subscribe({
      next: () => fail('expected error'),
      error: (err) => {
        expect(err.status).toBe(404);
        done();
      },
    });
    const req = httpMock.expectOne(`${baseUrl}/crons`);
    req.flush('not found', { status: 404, statusText: 'Not Found' });
  });
});
