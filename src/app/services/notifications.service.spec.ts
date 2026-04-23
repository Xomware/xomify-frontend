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

  it('registerDevice posts email + deviceToken + platform (defaults to ios)', (done) => {
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
      email,
      deviceToken: token,
      platform: 'ios',
    });
    expect(req.request.headers.get('Authorization')).toContain('Bearer');
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

  it('unregisterDevice posts email + deviceToken', (done) => {
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
    expect(req.request.body).toEqual({ email, deviceToken: token });
    req.flush(mockResponse);
  });
});
