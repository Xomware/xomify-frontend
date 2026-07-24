import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { XomtracksAdminService } from './xomtracks-admin.service';
import { environment } from 'src/environments/environment';
import {
  XtAdminCallsSummary,
  XtAdminRevokeTokenResult,
  XtAdminTokensResponse,
  XtAdminUserFeedResponse,
  XtAdminUsersResponse,
} from '../models/xomtracks-admin.model';

describe('XomtracksAdminService', () => {
  let service: XomtracksAdminService;
  let httpMock: HttpTestingController;

  const baseUrl = `${environment.xomtracksApiUrl}/admin`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [XomtracksAdminService],
    });
    service = TestBed.inject(XomtracksAdminService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('GET /admin/users unwraps the envelope', (done) => {
    const mock: XtAdminUsersResponse = {
      users: [{ email: 'a@b.com', firstSeen: '2026-01-01', lastSeen: '2026-01-02', ownIngest: true, spotifyConnected: false }],
      count: 1,
    };
    service.listUsers().subscribe((res) => {
      expect(res).toEqual(mock);
      done();
    });
    httpMock.expectOne(`${baseUrl}/users`).flush({ data: mock, error: null, meta: {} });
  });

  it('GET /admin/user-feed sends email/direction/window params, lowercased email', (done) => {
    const mock: XtAdminUserFeedResponse = { email: 'target@x.com', shares: [], direction: 'in', window: 'month', count: 0 };
    service.userFeed('Target@X.com', 'in', 'month').subscribe((res) => {
      expect(res).toEqual(mock);
      done();
    });
    const req = httpMock.expectOne(
      (r) => r.url === `${baseUrl}/user-feed` && r.params.get('email') === 'target@x.com',
    );
    expect(req.request.params.get('direction')).toBe('in');
    expect(req.request.params.get('window')).toBe('month');
    req.flush({ data: mock, error: null, meta: {} });
  });

  it('GET /admin/calls sends windowDays/recentLimit params', (done) => {
    const mock: XtAdminCallsSummary = {
      windowDays: 7,
      totalCalls: 10,
      errorCount: 1,
      byPath: [],
      byStatus: {},
      recentErrors: [],
    };
    service.calls(7, 25).subscribe((res) => {
      expect(res).toEqual(mock);
      done();
    });
    const req = httpMock.expectOne((r) => r.url === `${baseUrl}/calls`);
    expect(req.request.params.get('windowDays')).toBe('7');
    expect(req.request.params.get('recentLimit')).toBe('25');
    req.flush({ data: mock, error: null, meta: {} });
  });

  it('GET /admin/tokens unwraps the envelope', (done) => {
    const mock: XtAdminTokensResponse = { tokens: [], byOwner: {}, count: 0 };
    service.listTokens().subscribe((res) => {
      expect(res).toEqual(mock);
      done();
    });
    httpMock.expectOne(`${baseUrl}/tokens`).flush({ data: mock, error: null, meta: {} });
  });

  it('POST /admin/revoke-token sends the tokenHash body and unwraps the result', (done) => {
    const mock: XtAdminRevokeTokenResult = { tokenHash: 'hash123', revoked: true, ownerEmail: 'owner@x.com' };
    service.revokeToken('hash123').subscribe((res) => {
      expect(res).toEqual(mock);
      done();
    });
    const req = httpMock.expectOne(`${baseUrl}/revoke-token`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ tokenHash: 'hash123' });
    req.flush({ data: mock, error: null, meta: {} });
  });
});
