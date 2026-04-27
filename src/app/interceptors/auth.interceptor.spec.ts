// auth.interceptor.spec.ts
//
// Coverage for the global AuthInterceptor introduced in sub-feature 0e:
//   - Attaches `Authorization: Bearer <jwt>` from sessionStorage on Xomify calls.
//   - Falls back to the legacy static `environment.apiAuthToken` when the
//     per-user JWT is missing.
//   - Skips the header for the public `/auth/login` endpoint.
//   - Leaves non-Xomify requests (e.g. Spotify Web API) untouched.
//   - Refreshes the Spotify access token, mints a new JWT, and retries the
//     original request once on a 401. A second 401 propagates.
//   - Does not loop on a retry that itself returns 401.

import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { HttpClient, HTTP_INTERCEPTORS } from '@angular/common/http';

import { AuthInterceptor } from './auth.interceptor';
import {
  XomifyAuthService,
  XOMIFY_JWT_STORAGE_KEY,
} from '../services/xomify-auth.service';
import { AuthService } from '../services/auth.service';
import { environment } from 'src/environments/environment';
import { of } from 'rxjs';

describe('AuthInterceptor', () => {
  let httpClient: HttpClient;
  let httpMock: HttpTestingController;
  let xomifyAuth: XomifyAuthService;
  let authServiceMock: jasmine.SpyObj<AuthService>;

  // The interceptor matches Xomify calls by `environment.xomifyApiUrl`
  // prefix. Use that exact value to guarantee a match in this test.
  const xomifyBase = environment.xomifyApiUrl;
  const xomifyUrl = `${xomifyBase}/friends/list?email=test@example.com`;
  const loginUrl = `${xomifyBase}/auth/login`;
  const spotifyUrl = 'https://api.spotify.com/v1/me';

  beforeEach(() => {
    sessionStorage.clear();

    authServiceMock = jasmine.createSpyObj<AuthService>('AuthService', [
      'refreshSpotifyAccessToken',
    ]);

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        XomifyAuthService,
        { provide: AuthService, useValue: authServiceMock },
        {
          provide: HTTP_INTERCEPTORS,
          useClass: AuthInterceptor,
          multi: true,
        },
      ],
    });

    httpClient = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
    xomifyAuth = TestBed.inject(XomifyAuthService);
  });

  afterEach(() => {
    httpMock.verify();
    sessionStorage.clear();
  });

  // ---------------------------------------------------------------------------
  // Header attach
  // ---------------------------------------------------------------------------

  it('attaches the per-user JWT from sessionStorage as Bearer on Xomify calls', () => {
    sessionStorage.setItem(XOMIFY_JWT_STORAGE_KEY, 'jwt-from-session');

    httpClient.get(xomifyUrl).subscribe();

    const req = httpMock.expectOne(xomifyUrl);
    expect(req.request.headers.get('Authorization')).toBe(
      'Bearer jwt-from-session',
    );
    req.flush({});
  });

  it('falls back to environment.apiAuthToken when sessionStorage has no JWT', () => {
    // No JWT in sessionStorage.
    httpClient.get(xomifyUrl).subscribe();

    const req = httpMock.expectOne(xomifyUrl);
    expect(req.request.headers.get('Authorization')).toBe(
      `Bearer ${environment.apiAuthToken}`,
    );
    req.flush({});
  });

  it('skips the Authorization header for POST /auth/login', () => {
    sessionStorage.setItem(XOMIFY_JWT_STORAGE_KEY, 'jwt-from-session');

    httpClient.post(loginUrl, { spotifyAccessToken: 'sp-token' }).subscribe();

    const req = httpMock.expectOne(loginUrl);
    expect(req.request.headers.get('Authorization')).toBeNull();
    req.flush({ data: { token: 'x', expiresAt: 'y' }, error: null, meta: {} });
  });

  it('leaves non-Xomify requests (Spotify) untouched', () => {
    sessionStorage.setItem(XOMIFY_JWT_STORAGE_KEY, 'jwt-from-session');

    httpClient
      .get(spotifyUrl, { headers: { Authorization: 'Bearer spotify-tok' } })
      .subscribe();

    const req = httpMock.expectOne(spotifyUrl);
    // Spotify call keeps its own caller-set token.
    expect(req.request.headers.get('Authorization')).toBe(
      'Bearer spotify-tok',
    );
    req.flush({});
  });

  it('does not clobber an Authorization header set by the caller on a Xomify call', () => {
    sessionStorage.setItem(XOMIFY_JWT_STORAGE_KEY, 'jwt-from-session');

    httpClient
      .get(xomifyUrl, { headers: { Authorization: 'Bearer caller-set' } })
      .subscribe();

    const req = httpMock.expectOne(xomifyUrl);
    expect(req.request.headers.get('Authorization')).toBe('Bearer caller-set');
    req.flush({});
  });

  // ---------------------------------------------------------------------------
  // 401 retry
  // ---------------------------------------------------------------------------

  it('on 401: refreshes Spotify access token, re-mints the JWT, and retries once', () => {
    sessionStorage.setItem(XOMIFY_JWT_STORAGE_KEY, 'stale-jwt');
    authServiceMock.refreshSpotifyAccessToken.and.returnValue(
      of('fresh-spotify-token'),
    );

    let response: unknown;
    let errored = false;
    httpClient.get(xomifyUrl).subscribe({
      next: (r) => (response = r),
      error: () => (errored = true),
    });

    // 1) Initial call — JWT attached, returns 401.
    const initial = httpMock.expectOne(xomifyUrl);
    expect(initial.request.headers.get('Authorization')).toBe(
      'Bearer stale-jwt',
    );
    initial.flush(
      { error: 'unauthorized' },
      { status: 401, statusText: 'Unauthorized' },
    );

    // 2) Interceptor calls /auth/login with the freshly-refreshed Spotify
    //    access token.
    const mintCall = httpMock.expectOne(loginUrl);
    expect(mintCall.request.method).toBe('POST');
    expect(mintCall.request.body).toEqual({
      spotifyAccessToken: 'fresh-spotify-token',
    });
    mintCall.flush({
      data: { token: 'fresh-jwt', expiresAt: '2099-01-01T00:00:00Z' },
      error: null,
      meta: {},
    });

    // 3) Original request is retried with the fresh JWT (and the internal
    //    retry-flag header).
    const retried = httpMock.expectOne(xomifyUrl);
    expect(retried.request.headers.get('Authorization')).toBe(
      'Bearer fresh-jwt',
    );
    retried.flush({ ok: true });

    expect(response).toEqual({ ok: true });
    expect(errored).toBe(false);
    expect(authServiceMock.refreshSpotifyAccessToken).toHaveBeenCalledTimes(1);
    // sessionStorage now reflects the fresh JWT.
    expect(sessionStorage.getItem(XOMIFY_JWT_STORAGE_KEY)).toBe('fresh-jwt');
  });

  it('does not retry a second time on a repeat 401 (no infinite loop)', () => {
    sessionStorage.setItem(XOMIFY_JWT_STORAGE_KEY, 'stale-jwt');
    authServiceMock.refreshSpotifyAccessToken.and.returnValue(
      of('fresh-spotify-token'),
    );

    let lastErrorStatus: number | null = null;
    httpClient.get(xomifyUrl).subscribe({
      next: () => {
        // not expected
      },
      error: (err) => {
        lastErrorStatus = err.status ?? null;
      },
    });

    httpMock
      .expectOne(xomifyUrl)
      .flush({}, { status: 401, statusText: 'Unauthorized' });

    httpMock.expectOne(loginUrl).flush({
      data: { token: 'fresh-jwt', expiresAt: '2099-01-01T00:00:00Z' },
      error: null,
      meta: {},
    });

    // Retry — also 401. Interceptor must propagate (NOT loop).
    httpMock
      .expectOne(xomifyUrl)
      .flush({}, { status: 401, statusText: 'Unauthorized' });

    expect(lastErrorStatus).toBe(401);
    // No third call.
    httpMock.expectNone(xomifyUrl);
  });

  it('propagates the 401 immediately when Spotify refresh returns null (no refresh token available)', () => {
    sessionStorage.setItem(XOMIFY_JWT_STORAGE_KEY, 'stale-jwt');
    authServiceMock.refreshSpotifyAccessToken.and.returnValue(of(null));

    let lastErrorStatus: number | null = null;
    httpClient.get(xomifyUrl).subscribe({
      error: (err) => {
        lastErrorStatus = err.status ?? null;
      },
    });

    httpMock
      .expectOne(xomifyUrl)
      .flush({}, { status: 401, statusText: 'Unauthorized' });

    // No /auth/login call — refresh failed.
    httpMock.expectNone(loginUrl);
    expect(lastErrorStatus).toBe(401);
    expect(authServiceMock.refreshSpotifyAccessToken).toHaveBeenCalledTimes(1);
  });

  it('does not retry on non-401 errors (e.g. 500)', () => {
    sessionStorage.setItem(XOMIFY_JWT_STORAGE_KEY, 'jwt');

    let lastErrorStatus: number | null = null;
    httpClient.get(xomifyUrl).subscribe({
      error: (err) => {
        lastErrorStatus = err.status ?? null;
      },
    });

    httpMock
      .expectOne(xomifyUrl)
      .flush(
        { error: 'server error' },
        { status: 500, statusText: 'Server Error' },
      );

    expect(lastErrorStatus).toBe(500);
    expect(authServiceMock.refreshSpotifyAccessToken).not.toHaveBeenCalled();
  });
});
