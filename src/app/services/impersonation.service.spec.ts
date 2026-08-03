import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { ImpersonationService } from './impersonation.service';
import { XomifyAuthService } from './xomify-auth.service';
import { environment } from 'src/environments/environment';

describe('ImpersonationService', () => {
  let service: ImpersonationService;
  let authSpy: jasmine.SpyObj<XomifyAuthService>;
  let httpMock: HttpTestingController;

  const ADMIN_EMAIL = 'dominickj.giordano@gmail.com';
  const STORAGE_KEY = 'xomify.impersonation.email';
  const TOKEN_STORAGE_KEY = 'xomify.impersonation.spotifyToken';
  const tokenUrl = `${environment.xomifyApiUrl}/admin/impersonation-token`;

  function configure(): void {
    // Safe to call more than once per test (e.g. to simulate a fresh page
    // load/service construction while localStorage/sessionStorage persist)
    // -- `resetTestingModule` un-freezes TestBed so a second
    // `configureTestingModule` + `inject` pair doesn't throw.
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        ImpersonationService,
        { provide: XomifyAuthService, useValue: authSpy },
      ],
    });
    service = TestBed.inject(ImpersonationService);
    httpMock = TestBed.inject(HttpTestingController);
  }

  /** Flushes the eager token-mint request `enter()` fires, so `httpMock`
   * doesn't see it as an unhandled/unflushed request. */
  function flushTokenRequest(
    email: string,
    response: { accessToken: string; expiresIn: number } | null = {
      accessToken: 'target-spotify-token',
      expiresIn: 3600,
    },
  ): void {
    const req = httpMock.expectOne(
      (r) => r.url === tokenUrl && r.params.get('email') === email,
    );
    if (response) {
      req.flush(response);
    } else {
      req.flush(
        { message: 'not found' },
        { status: 404, statusText: 'Not Found' },
      );
    }
  }

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    authSpy = jasmine.createSpyObj('XomifyAuthService', ['getEmail']);
    authSpy.getEmail.and.returnValue(ADMIN_EMAIL);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
    sessionStorage.clear();
  });

  it('starts not impersonating when localStorage is empty', () => {
    configure();
    expect(service.impersonatedEmail).toBeNull();
    expect(service.isImpersonating).toBe(false);
  });

  it('enter() persists and exposes the (lowercased/trimmed) target email for the admin caller', () => {
    configure();
    service.enter('  Someone@Example.com  ');

    expect(service.impersonatedEmail).toBe('someone@example.com');
    expect(service.isImpersonating).toBe(true);
    expect(localStorage.getItem(STORAGE_KEY)).toBe('someone@example.com');

    flushTokenRequest('someone@example.com');
  });

  it('enter() is a no-op for a non-admin caller', () => {
    authSpy.getEmail.and.returnValue('someone-else@example.com');
    configure();

    service.enter('target@example.com');

    expect(service.impersonatedEmail).toBeNull();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    httpMock.expectNone(tokenUrl);
  });

  it('enter() ignores a blank/whitespace-only email', () => {
    configure();
    service.enter('   ');

    expect(service.impersonatedEmail).toBeNull();
    httpMock.expectNone(tokenUrl);
  });

  it('exit() clears state, locally and in localStorage/sessionStorage', () => {
    configure();
    service.enter('target@example.com');
    flushTokenRequest('target@example.com');
    expect(service.isImpersonating).toBe(true);

    service.exit();

    expect(service.impersonatedEmail).toBeNull();
    expect(service.isImpersonating).toBe(false);
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(sessionStorage.getItem(TOKEN_STORAGE_KEY)).toBeNull();
  });

  it('isImpersonating$ emits true/false in step with enter()/exit()', () => {
    configure();
    const seen: boolean[] = [];
    service.isImpersonating$.subscribe((v) => seen.push(v));

    service.enter('target@example.com');
    flushTokenRequest('target@example.com');
    service.exit();

    expect(seen).toEqual([false, true, false]);
  });

  it('restores a persisted email on construction when the caller is (still) the admin', () => {
    localStorage.setItem(STORAGE_KEY, 'persisted@example.com');
    configure();

    expect(service.impersonatedEmail).toBe('persisted@example.com');
  });

  it('discards a persisted email on construction if the current caller is not the admin, and wipes it from localStorage', () => {
    localStorage.setItem(STORAGE_KEY, 'persisted@example.com');
    authSpy.getEmail.and.returnValue('someone-else@example.com');
    configure();

    expect(service.impersonatedEmail).toBeNull();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  // ---------------------------------------------------------------------------
  // Target Spotify access token (upgrade: real Spotify data while impersonating)
  // ---------------------------------------------------------------------------

  describe('target Spotify access token', () => {
    it('mints and caches the target token on enter()', () => {
      configure();
      service.enter('target@example.com');
      flushTokenRequest('target@example.com', {
        accessToken: 'target-spotify-token',
        expiresIn: 3600,
      });

      let resolved: string | null | undefined;
      service.getValidSpotifyToken().subscribe((t) => (resolved = t));

      // Cached from enter() -- no second network call.
      httpMock.expectNone(tokenUrl);
      expect(resolved).toBe('target-spotify-token');
    });

    it('getValidSpotifyToken() resolves null when not impersonating', () => {
      configure();
      let resolved: string | null | undefined = 'unset';
      service.getValidSpotifyToken().subscribe((t) => (resolved = t));
      expect(resolved).toBeNull();
      httpMock.expectNone(tokenUrl);
    });

    it('persists the target token to sessionStorage and restores it on a fresh construction (same target, not expired)', () => {
      configure();
      service.enter('target@example.com');
      flushTokenRequest('target@example.com', {
        accessToken: 'persisted-token',
        expiresIn: 3600,
      });

      expect(sessionStorage.getItem(TOKEN_STORAGE_KEY)).toContain(
        'persisted-token',
      );

      // Simulate a page refresh: localStorage/sessionStorage survive, a
      // fresh ImpersonationService instance reads them back.
      configure();
      let resolved: string | null | undefined;
      service.getValidSpotifyToken().subscribe((t) => (resolved = t));

      httpMock.expectNone(tokenUrl);
      expect(resolved).toBe('persisted-token');
    });

    it('falls back to null (caller degrades to admin token) when the mint call fails, and flags spotifyTokenUnavailable$', () => {
      configure();
      const unavailable: boolean[] = [];
      service.spotifyTokenUnavailable$.subscribe((v) => unavailable.push(v));

      service.enter('target@example.com');
      flushTokenRequest('target@example.com', null);

      // [initial false] -> [enter() resets to false eagerly] -> [mint fails -> true]
      expect(unavailable).toEqual([false, false, true]);

      let resolved: string | null | undefined = 'unset';
      service.getValidSpotifyToken().subscribe((t) => (resolved = t));
      // Still cached-as-failed -- no new request until refreshSpotifyToken().
      httpMock.expectNone(tokenUrl);
      expect(resolved).toBeNull();
    });

    it('refreshSpotifyToken() forces a fresh mint, bypassing the cache', () => {
      configure();
      service.enter('target@example.com');
      flushTokenRequest('target@example.com', {
        accessToken: 'first-token',
        expiresIn: 3600,
      });

      let resolved: string | null | undefined;
      service.refreshSpotifyToken().subscribe((t) => (resolved = t));
      flushTokenRequest('target@example.com', {
        accessToken: 'refreshed-token',
        expiresIn: 3600,
      });

      expect(resolved).toBe('refreshed-token');
    });

    it('clears the cached token and stops reporting it unavailable on exit()', () => {
      configure();
      service.enter('target@example.com');
      flushTokenRequest('target@example.com', null);

      let unavailableAfterExit: boolean | undefined;
      service.exit();
      service.spotifyTokenUnavailable$.subscribe(
        (v) => (unavailableAfterExit = v),
      );
      expect(unavailableAfterExit).toBe(false);
    });

    it('discards a token cached for a different target when entering a new one', () => {
      configure();
      service.enter('first@example.com');
      flushTokenRequest('first@example.com', {
        accessToken: 'first-token',
        expiresIn: 3600,
      });

      service.enter('second@example.com');
      flushTokenRequest('second@example.com', {
        accessToken: 'second-token',
        expiresIn: 3600,
      });

      let resolved: string | null | undefined;
      service.getValidSpotifyToken().subscribe((t) => (resolved = t));
      httpMock.expectNone(tokenUrl);
      expect(resolved).toBe('second-token');
    });
  });
});
