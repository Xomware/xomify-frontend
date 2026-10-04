import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';

import { AuthService } from './auth.service';
import { XomifyAuthService } from './xomify-auth.service';
import { ToastService } from './toast.service';
import { of } from 'rxjs';
import { environment } from 'src/environments/environment';

const REFRESH_URL = `${environment.xomifyApiUrl}/auth/spotify-refresh`;

describe('AuthService.ensureXomifyJwt', () => {
  let service: AuthService;
  let xomifyAuth: jasmine.SpyObj<XomifyAuthService>;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    const xomifyAuthSpy = jasmine.createSpyObj<XomifyAuthService>(
      'XomifyAuthService',
      ['hasJwt', 'getJwt', 'mintFromSpotifyAccessToken', 'persist', 'clear'],
    );

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule, RouterTestingModule],
      providers: [
        AuthService,
        { provide: XomifyAuthService, useValue: xomifyAuthSpy },
        { provide: ToastService, useValue: { showNegativeToast: () => {} } },
      ],
    });

    service = TestBed.inject(AuthService);
    xomifyAuth = TestBed.inject(
      XomifyAuthService,
    ) as jasmine.SpyObj<XomifyAuthService>;
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('returns existing JWT without minting when hasJwt() is true', (done) => {
    xomifyAuth.hasJwt.and.returnValue(true);
    xomifyAuth.getJwt.and.returnValue('existing-jwt');

    service.ensureXomifyJwt().subscribe((jwt) => {
      expect(jwt).toBe('existing-jwt');
      expect(xomifyAuth.mintFromSpotifyAccessToken).not.toHaveBeenCalled();
      done();
    });
  });

  it('refreshes Spotify access token then mints when hasJwt() is false and refreshToken is set', (done) => {
    xomifyAuth.hasJwt.and.returnValue(false);
    xomifyAuth.mintFromSpotifyAccessToken.and.returnValue(of('new-jwt'));
    service.refreshToken = 'spotify-refresh-token';

    service.ensureXomifyJwt().subscribe((jwt) => {
      expect(jwt).toBe('new-jwt');
      // The mint call must use the FRESH access token, not the previously
      // stored one — that's the whole point of the bootstrap hotfix.
      expect(xomifyAuth.mintFromSpotifyAccessToken).toHaveBeenCalledWith(
        'fresh-access-token',
      );
      done();
    });

    const tokenReq = httpMock.expectOne(REFRESH_URL);
    expect(tokenReq.request.method).toBe('POST');
    // The secret lives on the backend; the browser sends only the refresh token.
    expect(tokenReq.request.body).toEqual({ refreshToken: 'spotify-refresh-token' });
    tokenReq.flush({
      access_token: 'fresh-access-token',
      token_type: 'Bearer',
      expires_in: 3600,
      scope: '',
    });
  });

  it('returns null when hasJwt() is false and no Spotify refreshToken', (done) => {
    xomifyAuth.hasJwt.and.returnValue(false);
    service.refreshToken = '';

    service.ensureXomifyJwt().subscribe((jwt) => {
      expect(jwt).toBeNull();
      expect(xomifyAuth.mintFromSpotifyAccessToken).not.toHaveBeenCalled();
      done();
    });
  });

  it('returns null when Spotify refresh fails', (done) => {
    xomifyAuth.hasJwt.and.returnValue(false);
    service.refreshToken = 'spotify-refresh-token';

    service.ensureXomifyJwt().subscribe((jwt) => {
      expect(jwt).toBeNull();
      expect(xomifyAuth.mintFromSpotifyAccessToken).not.toHaveBeenCalled();
      done();
    });

    const tokenReq = httpMock.expectOne(REFRESH_URL);
    tokenReq.flush(
      { error: { message: 'Spotify rejected the code or refresh token.', status: 401 } },
      { status: 401, statusText: 'Unauthorized' },
    );
  });
});

describe('AuthService.isAccessTokenExpired / getValidAccessToken', () => {
  // Covers the direct-Spotify-API-call 401 fix: access tokens now persist in
  // localStorage across browser restarts, so a stale one can stick around.
  // These prove the expiry tracking and proactive-refresh helper the
  // AuthInterceptor relies on before every `api.spotify.com` call.
  let service: AuthService;
  let xomifyAuth: jasmine.SpyObj<XomifyAuthService>;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();

    const xomifyAuthSpy = jasmine.createSpyObj<XomifyAuthService>(
      'XomifyAuthService',
      ['hasJwt', 'getJwt', 'mintFromSpotifyAccessToken', 'persist', 'clear'],
    );

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule, RouterTestingModule],
      providers: [
        AuthService,
        { provide: XomifyAuthService, useValue: xomifyAuthSpy },
        { provide: ToastService, useValue: { showNegativeToast: () => {} } },
      ],
    });

    service = TestBed.inject(AuthService);
    xomifyAuth = TestBed.inject(
      XomifyAuthService,
    ) as jasmine.SpyObj<XomifyAuthService>;
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
    sessionStorage.clear();
  });

  it('treats a missing access token as expired', () => {
    service.accessToken = '';
    expect(service.isAccessTokenExpired()).toBe(true);
  });

  it('treats a present token with unknown expiry (no expires_at tracked) as expired', () => {
    // Simulates a session persisted before this field existed.
    service.accessToken = 'some-token';
    expect(service.isAccessTokenExpired()).toBe(true);
  });

  it('treats a token within the 60s buffer of expiring as expired', () => {
    service.accessToken = 'some-token';
    (service as any).accessTokenExpiresAt = Date.now() + 30_000;
    expect(service.isAccessTokenExpired()).toBe(true);
  });

  it('treats a token safely beyond the buffer as valid', () => {
    service.accessToken = 'some-token';
    (service as any).accessTokenExpiresAt = Date.now() + 10 * 60 * 1000;
    expect(service.isAccessTokenExpired()).toBe(false);
  });

  it('getValidAccessToken returns the current token without refreshing when still valid', (done) => {
    service.accessToken = 'still-valid';
    (service as any).accessTokenExpiresAt = Date.now() + 10 * 60 * 1000;

    service.getValidAccessToken().subscribe((token) => {
      expect(token).toBe('still-valid');
      done();
    });

    httpMock.expectNone(REFRESH_URL);
  });

  it('getValidAccessToken refreshes when the token is expired', (done) => {
    service.accessToken = 'stale-token';
    service.refreshToken = 'spotify-refresh-token';
    (service as any).accessTokenExpiresAt = Date.now() - 1000;

    service.getValidAccessToken().subscribe((token) => {
      expect(token).toBe('refreshed-token');
      done();
    });

    const tokenReq = httpMock.expectOne(REFRESH_URL);
    tokenReq.flush({
      access_token: 'refreshed-token',
      token_type: 'Bearer',
      expires_in: 3600,
      scope: '',
    });
  });

  it('getValidAccessToken resolves null when expired and no refresh token is available', (done) => {
    service.accessToken = 'stale-token';
    service.refreshToken = '';

    service.getValidAccessToken().subscribe((token) => {
      expect(token).toBeNull();
      done();
    });

    httpMock.expectNone(REFRESH_URL);
  });

  it('refreshSpotifyAccessToken updates isAccessTokenExpired() to false via the returned expires_in', (done) => {
    service.accessToken = 'stale-token';
    service.refreshToken = 'spotify-refresh-token';

    service.refreshSpotifyAccessToken().subscribe(() => {
      expect(service.isAccessTokenExpired()).toBe(false);
      done();
    });

    const tokenReq = httpMock.expectOne(REFRESH_URL);
    tokenReq.flush({
      access_token: 'refreshed-token',
      token_type: 'Bearer',
      expires_in: 3600,
      scope: '',
    });
  });
});
