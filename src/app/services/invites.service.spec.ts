import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';

import {
  AcceptInviteResponse,
  CreateInviteResponse,
  DeclineInviteResponse,
  InvitesService,
  PendingInvitesResponse,
} from './invites.service';

describe('InvitesService', () => {
  let service: InvitesService;
  let httpMock: HttpTestingController;

  const email = 'dom@example.com';

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [InvitesService],
    });
    service = TestBed.inject(InvitesService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('createInvite posts email and updates the pending cache optimistically', (done) => {
    const mockResponse: CreateInviteResponse = {
      inviteCode: 'ABC-123',
      inviteUrl: 'https://xomify.app/invite/ABC-123',
      createdAt: '2026-04-23T10:00:00Z',
      expiresAt: '2026-05-23T10:00:00Z',
    };

    service.createInvite(email).subscribe((resp) => {
      expect(resp.inviteCode).toBe('ABC-123');

      const cached = (service as any).pendingInvitesSubject.getValue() as any[];
      expect(cached.length).toBe(1);
      expect(cached[0].inviteCode).toBe('ABC-123');
      expect(cached[0].senderEmail).toBe(email);
      expect(cached[0].inviteUrl).toBe(mockResponse.inviteUrl);
      done();
    });

    const req = httpMock.expectOne((r) => r.url.endsWith('/invites/create'));
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ email });
    // Authorization header is attached globally by AuthInterceptor (sub-feature
    // 0e). The interceptor is not registered in this isolated TestBed; header
    // attachment is covered by `auth.interceptor.spec.ts`.
    req.flush(mockResponse);
  });

  it('acceptInvite posts email + inviteCode and returns backend response', (done) => {
    const mockResponse: AcceptInviteResponse = {
      ok: true,
      senderEmail: 'sender@example.com',
      inviteCode: 'XYZ-999',
    };

    service.acceptInvite(email, 'XYZ-999').subscribe((resp) => {
      expect(resp.senderEmail).toBe('sender@example.com');
      done();
    });

    const req = httpMock.expectOne((r) => r.url.endsWith('/invites/accept'));
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ email, inviteCode: 'XYZ-999' });
    req.flush(mockResponse);
  });

  it('listPending GETs with email query param and populates cache', (done) => {
    const mockResponse: PendingInvitesResponse = {
      email,
      count: 2,
      invites: [
        {
          inviteCode: 'A',
          senderEmail: email,
          createdAt: '2026-04-23T10:00:00Z',
          expiresAt: '2026-05-23T10:00:00Z',
        },
        {
          inviteCode: 'B',
          senderEmail: email,
          createdAt: '2026-04-22T10:00:00Z',
          expiresAt: '2026-05-22T10:00:00Z',
        },
      ],
    };

    service.listPending(email).subscribe((resp) => {
      expect(resp.invites.length).toBe(2);

      const cached = (service as any).pendingInvitesSubject.getValue() as any[];
      expect(cached.map((i) => i.inviteCode)).toEqual(['A', 'B']);
      done();
    });

    const req = httpMock.expectOne((r) => r.url.endsWith('/invites/pending'));
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('email')).toBe(email);
    req.flush(mockResponse);
  });

  it('declineInvite posts email + inviteCode', (done) => {
    const mockResponse: DeclineInviteResponse = {
      ok: true,
      inviteCode: 'DEC-1',
      senderEmail: 'someone@example.com',
    };

    service.declineInvite(email, 'DEC-1').subscribe((resp) => {
      expect(resp.inviteCode).toBe('DEC-1');
      done();
    });

    const req = httpMock.expectOne((r) => r.url.endsWith('/invites/decline'));
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ email, inviteCode: 'DEC-1' });
    req.flush(mockResponse);
  });

  it('hideLocally removes a single invite from the cache only', () => {
    // Seed the cache directly.
    (service as any).pendingInvitesSubject.next([
      {
        inviteCode: 'A',
        senderEmail: email,
        createdAt: '',
        expiresAt: '',
      },
      {
        inviteCode: 'B',
        senderEmail: email,
        createdAt: '',
        expiresAt: '',
      },
    ]);

    service.hideLocally('A');

    const cached = (service as any).pendingInvitesSubject.getValue() as any[];
    expect(cached.map((i) => i.inviteCode)).toEqual(['B']);

    // No HTTP traffic for this operation.
    httpMock.expectNone((r) => r.url.includes('/invites'));
  });
});
