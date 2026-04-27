import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';

import {
  NotificationsService,
  RegisterDeviceResponse,
  UnregisterDeviceResponse,
} from './notifications.service';

describe('NotificationsService', () => {
  let service: NotificationsService;
  let httpMock: HttpTestingController;

  const email = 'dom@example.com';
  const token = 'abc123token';

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [NotificationsService],
    });
    service = TestBed.inject(NotificationsService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('registerDevice posts deviceToken + platform (defaults to ios) — caller comes from JWT', (done) => {
    const mockResponse: RegisterDeviceResponse = {
      ok: true,
      deviceToken: token,
    };

    service.registerDevice(email, token).subscribe((resp) => {
      expect(resp.ok).toBe(true);
      done();
    });

    const req = httpMock.expectOne((r) =>
      r.url.endsWith('/notifications/register'),
    );
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      deviceToken: token,
      platform: 'ios',
    });
    // Caller email must NOT be sent — sourced from JWT context.
    expect((req.request.body as Record<string, unknown>)['email']).toBeUndefined();
    // Authorization header is attached globally by AuthInterceptor (sub-feature
    // 0e). The interceptor is not registered in this isolated TestBed; header
    // attachment is covered by `auth.interceptor.spec.ts`.
    req.flush(mockResponse);
  });

  it('registerDevice accepts a non-default platform', (done) => {
    service.registerDevice(email, token, 'android').subscribe(() => done());

    const req = httpMock.expectOne((r) =>
      r.url.endsWith('/notifications/register'),
    );
    expect(req.request.body.platform).toBe('android');
    req.flush({ ok: true, deviceToken: token });
  });

  it('unregisterDevice posts deviceToken — caller comes from JWT', (done) => {
    const mockResponse: UnregisterDeviceResponse = {
      ok: true,
      deviceToken: token,
    };

    service.unregisterDevice(email, token).subscribe((resp) => {
      expect(resp.ok).toBe(true);
      done();
    });

    const req = httpMock.expectOne((r) =>
      r.url.endsWith('/notifications/unregister'),
    );
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ deviceToken: token });
    // Caller email must NOT be sent.
    expect((req.request.body as Record<string, unknown>)['email']).toBeUndefined();
    req.flush(mockResponse);
  });
});
