// auth.interceptor.spec.ts
//
// Coverage for the global AuthInterceptor introduced in sub-feature 0e:
//   - Attaches `Authorization: Bearer <jwt>` from localStorage on Xomify calls.
//   - Falls back to the legacy static `environment.apiAuthToken` when the
//     per-user JWT is missing.
//   - Skips the header for the public `/auth/login` endpoint.
//   - Leaves non-Xomify, non-Spotify requests (e.g. accounts.spotify.com)
//     untouched.
//   - Refreshes the Spotify access token, mints a new JWT, and retries the
//     original request once on a 401. A second 401 propagates.
//   - Does not loop on a retry that itself returns 401.
//   - Direct api.spotify.com calls: proactively swaps in a valid access
//     token via AuthService.getValidAccessToken() before sending, and falls
//     back to a refresh-and-retry-once on a 401 (see responsibility 5 in
//     auth.interceptor.ts).

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
import { ImpersonationService } from '../services/impersonation.service';
import { environment } from 'src/environments/environment';
import { of } from 'rxjs';

describe('AuthInterceptor', () => {
  let httpClient: HttpClient;
  let httpMock: HttpTestingController;
  let xomifyAuth: XomifyAuthService;
  let impersonation: ImpersonationService;
  let authServiceMock: jasmine.SpyObj<AuthService>;

  // The interceptor matches Xomify calls by `environment.xomifyApiUrl`
  // prefix. Use that exact value to guarantee a match in this test.
  const xomifyBase = environment.xomifyApiUrl;
  const xomifyUrl = `${xomifyBase}/friends/list?email=test@example.com`;
  const loginUrl = `${xomifyBase}/auth/login`;
  const spotifyUrl = 'https://api.spotify.com/v1/me';
  // The Xomtracks feature calls a separate host — the interceptor must treat
  // it like a Xomify call (see `isXomifyApiRequest`).
  const xomtracksBase = environment.xomtracksApiUrl;
  const xomtracksUrl = `${xomtracksBase}/shares/list?direction=in&window=month`;

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();

    authServiceMock = jasmine.createSpyObj<AuthService>('AuthService', [
      'refreshSpotifyAccessToken',
      'getValidAccessToken',
    ]);
    // Default: token already valid, no proactive refresh needed. Individual
    // tests override this to simulate an expired/unknown-expiry token.
    authServiceMock.getValidAccessToken.and.returnValue(
      of('valid-spotify-token'),
    );

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
    impersonation = TestBed.inject(ImpersonationService);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
    sessionStorage.clear();
  });

  // ---------------------------------------------------------------------------
  // Header attach
  // ---------------------------------------------------------------------------

  it('attaches the per-user JWT from localStorage as Bearer on Xomify calls', () => {
    localStorage.setItem(XOMIFY_JWT_STORAGE_KEY, 'jwt-from-storage');

    httpClient.get(xomifyUrl).subscribe();

    const req = httpMock.expectOne(xomifyUrl);
    expect(req.request.headers.get('Authorization')).toBe(
      'Bearer jwt-from-storage',
    );
    req.flush({});
  });

  it('attaches the per-user JWT from localStorage as Bearer on Xomtracks calls', () => {
    localStorage.setItem(XOMIFY_JWT_STORAGE_KEY, 'jwt-from-storage');

    httpClient.get(xomtracksUrl).subscribe();

    const req = httpMock.expectOne(xomtracksUrl);
    expect(req.request.headers.get('Authorization')).toBe(
      'Bearer jwt-from-storage',
    );
    req.flush({ data: {}, error: null, meta: {} });
  });

  it('falls back to environment.apiAuthToken when localStorage has no JWT', () => {
    // No JWT in localStorage.
    httpClient.get(xomifyUrl).subscribe();

    const req = httpMock.expectOne(xomifyUrl);
    expect(req.request.headers.get('Authorization')).toBe(
      `Bearer ${environment.apiAuthToken}`,
    );
    req.flush({});
  });

  it('skips the Authorization header for POST /auth/login', () => {
    localStorage.setItem(XOMIFY_JWT_STORAGE_KEY, 'jwt-from-storage');

    httpClient.post(loginUrl, { spotifyAccessToken: 'sp-token' }).subscribe();

    const req = httpMock.expectOne(loginUrl);
    expect(req.request.headers.get('Authorization')).toBeNull();
    req.flush({ data: { token: 'x', expiresAt: 'y' }, error: null, meta: {} });
  });

  it('leaves non-Xomify, non-Spotify requests (accounts.spotify.com) untouched', () => {
    localStorage.setItem(XOMIFY_JWT_STORAGE_KEY, 'jwt-from-storage');
    const accountsUrl = 'https://accounts.spotify.com/api/token';

    httpClient
      .post(accountsUrl, {}, { headers: { Authorization: 'Bearer caller' } })
      .subscribe();

    const req = httpMock.expectOne(accountsUrl);
    expect(req.request.headers.get('Authorization')).toBe('Bearer caller');
    req.flush({});
  });

  // ---------------------------------------------------------------------------
  // Direct Spotify Web API calls (api.spotify.com)
  // ---------------------------------------------------------------------------

  it('proactively swaps in a valid access token on a Spotify call, replacing the caller-set (possibly stale) header', () => {
    authServiceMock.getValidAccessToken.and.returnValue(
      of('fresh-spotify-token'),
    );

    httpClient
      .get(spotifyUrl, { headers: { Authorization: 'Bearer stale-cached-token' } })
      .subscribe();

    const req = httpMock.expectOne(spotifyUrl);
    expect(req.request.headers.get('Authorization')).toBe(
      'Bearer fresh-spotify-token',
    );
    req.flush({});
  });

  it('on a Spotify 401: refreshes the access token and retries once with the fresh token swapped in', () => {
    authServiceMock.refreshSpotifyAccessToken.and.returnValue(
      of('retried-fresh-token'),
    );

    let response: unknown;
    let errored = false;
    httpClient
      .get(spotifyUrl, { headers: { Authorization: 'Bearer valid-spotify-token' } })
      .subscribe({
        next: (r) => (response = r),
        error: () => (errored = true),
      });

    const initial = httpMock.expectOne(spotifyUrl);
    initial.flush(
      { error: 'unauthorized' },
      { status: 401, statusText: 'Unauthorized' },
    );

    const retried = httpMock.expectOne(spotifyUrl);
    expect(retried.request.headers.get('Authorization')).toBe(
      'Bearer retried-fresh-token',
    );
    retried.flush({ ok: true });

    expect(response).toEqual({ ok: true });
    expect(errored).toBe(false);
    expect(authServiceMock.refreshSpotifyAccessToken).toHaveBeenCalledTimes(
      1,
    );
  });

  it('does not retry a Spotify call a second time on a repeat 401 (no infinite loop)', () => {
    authServiceMock.refreshSpotifyAccessToken.and.returnValue(
      of('retried-fresh-token'),
    );

    let lastErrorStatus: number | null = null;
    httpClient.get(spotifyUrl).subscribe({
      error: (err) => {
        lastErrorStatus = err.status ?? null;
      },
    });

    httpMock
      .expectOne(spotifyUrl)
      .flush({}, { status: 401, statusText: 'Unauthorized' });

    httpMock
      .expectOne(spotifyUrl)
      .flush({}, { status: 401, statusText: 'Unauthorized' });

    expect(lastErrorStatus).toBe(401);
    httpMock.expectNone(spotifyUrl);
  });

  it('propagates a Spotify 401 immediately when refresh returns null (no refresh token available)', () => {
    authServiceMock.refreshSpotifyAccessToken.and.returnValue(of(null));

    let lastErrorStatus: number | null = null;
    httpClient.get(spotifyUrl).subscribe({
      error: (err) => {
        lastErrorStatus = err.status ?? null;
      },
    });

    httpMock
      .expectOne(spotifyUrl)
      .flush({}, { status: 401, statusText: 'Unauthorized' });

    expect(lastErrorStatus).toBe(401);
    expect(authServiceMock.refreshSpotifyAccessToken).toHaveBeenCalledTimes(
      1,
    );
  });

  it('does not retry a Spotify call on non-401 errors (e.g. 500)', () => {
    let lastErrorStatus: number | null = null;
    httpClient.get(spotifyUrl).subscribe({
      error: (err) => {
        lastErrorStatus = err.status ?? null;
      },
    });

    httpMock
      .expectOne(spotifyUrl)
      .flush(
        { error: 'server error' },
        { status: 500, statusText: 'Server Error' },
      );

    expect(lastErrorStatus).toBe(500);
    expect(authServiceMock.refreshSpotifyAccessToken).not.toHaveBeenCalled();
  });

  it('does not clobber an Authorization header set by the caller on a Xomify call', () => {
    localStorage.setItem(XOMIFY_JWT_STORAGE_KEY, 'jwt-from-storage');

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
    localStorage.setItem(XOMIFY_JWT_STORAGE_KEY, 'stale-jwt');
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
    // localStorage now reflects the fresh JWT.
    expect(localStorage.getItem(XOMIFY_JWT_STORAGE_KEY)).toBe('fresh-jwt');
  });

  it('does not retry a second time on a repeat 401 (no infinite loop)', () => {
    localStorage.setItem(XOMIFY_JWT_STORAGE_KEY, 'stale-jwt');
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
    localStorage.setItem(XOMIFY_JWT_STORAGE_KEY, 'stale-jwt');
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
    localStorage.setItem(XOMIFY_JWT_STORAGE_KEY, 'jwt');

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

  // ---------------------------------------------------------------------------
  // Impersonation (`ImpersonationService` -> `?impersonate=<email>`)
  // ---------------------------------------------------------------------------

  describe('impersonation', () => {
    const targetEmail = 'target@example.com';
    // `xomtracksUrl` is passed to HttpClient as a single literal string
    // (embedded query string, not the `params:` option), so Angular stores
    // it verbatim as `request.url` and leaves `request.params` empty until
    // the interceptor adds to it. Match on `urlWithParams`, which reflects
    // both the original embedded query AND anything the interceptor appends.
    const matchesXomtracksWithImpersonate = (r: { urlWithParams: string }) =>
      r.urlWithParams.startsWith(xomtracksUrl) &&
      r.urlWithParams.includes('impersonate=');

    it('does not append ?impersonate= to Xomtracks calls when not impersonating', () => {
      httpClient.get(xomtracksUrl).subscribe();

      const req = httpMock.expectOne(xomtracksUrl);
      expect(req.request.urlWithParams).toBe(xomtracksUrl);
      expect(req.request.params.has('impersonate')).toBe(false);
      req.flush({ data: {}, error: null, meta: {} });
    });

    it('appends ?impersonate=<email> to Xomtracks calls while impersonating as the admin, preserving existing query params', () => {
      spyOn(xomifyAuth, 'getEmail').and.returnValue(
        'dominickj.giordano@gmail.com',
      );
      impersonation.enter(targetEmail);

      httpClient.get(xomtracksUrl).subscribe();

      const req = httpMock.expectOne(matchesXomtracksWithImpersonate);
      expect(req.request.params.get('impersonate')).toBe(targetEmail);
      // The original embedded query string (`?direction=in&window=month`) is
      // untouched — still part of the base url, now suffixed with `&impersonate=`.
      expect(req.request.urlWithParams).toContain('direction=in');
      expect(req.request.urlWithParams).toContain('window=month');
      req.flush({ data: {}, error: null, meta: {} });
    });

    it('does NOT append ?impersonate= to xomify API calls, even while impersonating', () => {
      spyOn(xomifyAuth, 'getEmail').and.returnValue(
        'dominickj.giordano@gmail.com',
      );
      impersonation.enter(targetEmail);

      httpClient.get(xomifyUrl).subscribe();

      const req = httpMock.expectOne(xomifyUrl);
      expect(req.request.urlWithParams).toBe(xomifyUrl);
      expect(req.request.params.has('impersonate')).toBe(false);
      req.flush({});
    });

    it('does NOT append ?impersonate= to direct Spotify calls, even while impersonating', () => {
      spyOn(xomifyAuth, 'getEmail').and.returnValue(
        'dominickj.giordano@gmail.com',
      );
      impersonation.enter(targetEmail);

      httpClient.get(spotifyUrl).subscribe();

      const req = httpMock.expectOne(spotifyUrl);
      expect(req.request.params.has('impersonate')).toBe(false);
      req.flush({});
    });

    it('does not append ?impersonate= when the current caller is not the admin', () => {
      // `ImpersonationService.enter` itself no-ops for a non-admin caller —
      // this end-to-end check confirms that no-op actually prevents the
      // interceptor from ever seeing an impersonated email to append.
      spyOn(xomifyAuth, 'getEmail').and.returnValue('someone-else@example.com');
      impersonation.enter(targetEmail);
      expect(impersonation.impersonatedEmail).toBeNull();

      httpClient.get(xomtracksUrl).subscribe();

      const req = httpMock.expectOne(xomtracksUrl);
      expect(req.request.params.has('impersonate')).toBe(false);
      req.flush({ data: {}, error: null, meta: {} });
    });

    it('preserves the impersonate param on the retried request after a 401', () => {
      localStorage.setItem(XOMIFY_JWT_STORAGE_KEY, 'stale-jwt');
      spyOn(xomifyAuth, 'getEmail').and.returnValue(
        'dominickj.giordano@gmail.com',
      );
      impersonation.enter(targetEmail);
      authServiceMock.refreshSpotifyAccessToken.and.returnValue(
        of('fresh-spotify-token'),
      );

      httpClient.get(xomtracksUrl).subscribe();

      const initial = httpMock.expectOne(matchesXomtracksWithImpersonate);
      initial.flush(
        { error: 'unauthorized' },
        { status: 401, statusText: 'Unauthorized' },
      );

      httpMock.expectOne(loginUrl).flush({
        data: { token: 'fresh-jwt', expiresAt: '2099-01-01T00:00:00Z' },
        error: null,
        meta: {},
      });

      const retried = httpMock.expectOne(matchesXomtracksWithImpersonate);
      expect(retried.request.params.get('impersonate')).toBe(targetEmail);
      expect(retried.request.headers.get('Authorization')).toBe(
        'Bearer fresh-jwt',
      );
      retried.flush({ ok: true });
    });
  });
});
