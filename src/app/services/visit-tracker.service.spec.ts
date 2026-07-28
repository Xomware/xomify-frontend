import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { VisitTrackerService } from './visit-tracker.service';
import { AuthService } from './auth.service';
import { environment } from 'src/environments/environment';

describe('VisitTrackerService', () => {
  let service: VisitTrackerService;
  let httpMock: HttpTestingController;
  let authSpy: jasmine.SpyObj<AuthService>;

  const url = `${environment.xomifyApiUrl}/visits/log`;

  beforeEach(() => {
    authSpy = jasmine.createSpyObj('AuthService', ['isLoggedIn']);
    authSpy.isLoggedIn.and.returnValue(true);

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [VisitTrackerService, { provide: AuthService, useValue: authSpy }],
    });
    service = TestBed.inject(VisitTrackerService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('logs a single visit after the throttle window', fakeAsync(() => {
    service.log('/home');
    tick(500);
    const req = httpMock.expectOne(url);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ path: '/home' });
    req.flush({});
  }));

  it('dedupes identical consecutive paths', fakeAsync(() => {
    service.log('/home');
    tick(50);
    service.log('/home');
    tick(500);
    httpMock.expectOne(url).flush({});
    httpMock.verify();
  }));

  it('throttles a rapid-fire navigation burst into one call for the final path', fakeAsync(() => {
    service.log('/a');
    tick(50);
    service.log('/b');
    tick(50);
    service.log('/c');
    tick(500);
    const req = httpMock.expectOne(url);
    expect(req.request.body).toEqual({ path: '/c' });
    req.flush({});
  }));

  it('skips logging entirely when logged out', fakeAsync(() => {
    authSpy.isLoggedIn.and.returnValue(false);
    service.log('/home');
    tick(500);
    httpMock.expectNone(url);
  }));

  it('swallows a failed log call without throwing', fakeAsync(() => {
    service.log('/home');
    tick(500);
    const req = httpMock.expectOne(url);
    req.flush('boom', { status: 500, statusText: 'Server Error' });

    // A subsequent visit should still log fine — the stream wasn't killed.
    service.log('/next');
    tick(500);
    httpMock.expectOne(url).flush({});
  }));
});
