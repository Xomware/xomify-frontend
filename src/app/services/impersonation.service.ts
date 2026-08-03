// impersonation.service.ts
//
// Full-app "step through as" impersonation mode for the admin (Dom) —
// distinct from the Admin Portal's read-only "View As" projection
// (`AdminViewasPanelComponent`, `GET /admin/view-as`), which only ever
// renders a static snapshot inside the Admin Portal itself. This service
// backs actually navigating the whole app AS the target user.
//
// State (the impersonated email) is persisted to localStorage so it survives
// route navigation and a full page refresh — the admin should be able to
// click around `/shares`, refresh, and still be impersonating. It is cleared
// on `exit()` and is defensively re-validated against the current caller's
// admin status on every read (see `readPersistedEmail`), so a stale value
// can never silently leak into a session where the signed-in caller isn't
// the admin (e.g. a different account on the same browser/profile).
//
// Consumers:
//   - `AuthInterceptor` reads `impersonatedEmail` synchronously to append
//     `?impersonate=<email>` to Xomtracks/Shares calls (and read-only Xomify
//     calls) and calls `getValidSpotifyToken()` / `refreshSpotifyToken()` to
//     swap the TARGET's Spotify access token into direct `api.spotify.com`
//     calls (see the "Spotify token" section below).
//   - `ImpersonationBannerComponent` (app shell) subscribes to
//     `isImpersonating$` / `impersonatedEmail$` / `spotifyTokenUnavailable$`
//     to render the persistent banner and drive the
//     `--impersonation-banner-h` layout offset.
//   - The Admin Portal's Users panel and View As panel call `enter()` to
//     start impersonating a given user.
//
// Spotify token:
//   Spotify-derived surfaces (top items, recently-played, now-playing,
//   playlists, the "Welcome, <name>" greeting) are direct `api.spotify.com`
//   calls made with the CALLER's own access token — impersonating the
//   *Xomify session* alone doesn't touch those, since Spotify has no concept
//   of "act as." To actually show the target's data, we mint a Spotify
//   access token FOR the target via an admin-only backend endpoint
//   (`GET {xomifyApiUrl}/admin/impersonation-token?email=<email>`, minted
//   backend-side from the target's stored refresh token) and swap it into
//   every `api.spotify.com` request while impersonating —
//   `AuthInterceptor.interceptSpotify` does the swap, this service owns
//   fetching/caching/refreshing the token itself.
//
//   The token is fetched eagerly on `enter()` (so a failure — e.g. the
//   target has no stored Spotify refresh token, or this endpoint's sibling
//   backend PR isn't deployed yet — surfaces on the banner immediately
//   rather than only once a page tries to load Spotify data) AND lazily via
//   `getValidSpotifyToken()` (mirrors `AuthService.getValidAccessToken()`'s
//   proactive-refresh pattern for the admin's own token). On fetch failure,
//   Spotify-derived surfaces fall back to the ADMIN's own token/data rather
//   than erroring — same "degrade, don't break" contract as the rest of
//   impersonation mode.
//
//   Stored in-memory + sessionStorage (NOT localStorage, unlike the
//   impersonated email) — a live Spotify access token is more sensitive and
//   short-lived than "which email am I impersonating," so it shouldn't
//   outlive the browser session.

import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { catchError, finalize, map, shareReplay } from 'rxjs/operators';
import { XomifyAuthService } from './xomify-auth.service';
import { isAdminEmail } from '../config/admin.config';
import { environment } from 'src/environments/environment';

/** localStorage key for the persisted impersonated email. */
const STORAGE_KEY = 'xomify.impersonation.email';
/** sessionStorage key for the persisted target Spotify access token. */
const TOKEN_STORAGE_KEY = 'xomify.impersonation.spotifyToken';
/** Refresh proactively this far ahead of the token's actual expiry. */
const TOKEN_EXPIRY_BUFFER_MS = 60_000;

interface ImpersonationTokenResponse {
  accessToken: string;
  expiresIn: number;
}

interface StoredSpotifyToken {
  /** The target email this token is for — guards against a token minted for
   * a previous target leaking into a session impersonating someone new. */
  email: string;
  accessToken: string;
  /** Epoch ms when the token expires. */
  expiresAt: number;
}

@Injectable({ providedIn: 'root' })
export class ImpersonationService {
  private readonly emailSubject = new BehaviorSubject<string | null>(null);
  private readonly tokenUnavailableSubject = new BehaviorSubject<boolean>(false);

  /** The currently-impersonated target email, or `null` when not impersonating. */
  readonly impersonatedEmail$: Observable<string | null> = this.emailSubject.asObservable();

  /** Derived convenience stream — `true` any time an impersonation target is set. */
  readonly isImpersonating$: Observable<boolean> = this.impersonatedEmail$.pipe(
    map((email) => !!email),
  );

  /**
   * `true` when impersonating AND the most recent attempt to mint the
   * target's Spotify access token failed (backend endpoint not deployed
   * yet, target has no stored refresh token, etc). Spotify-derived surfaces
   * fall back to showing the ADMIN's own data in this case — the banner
   * uses this to surface that rather than silently showing wrong data.
   */
  readonly spotifyTokenUnavailable$: Observable<boolean> = this.tokenUnavailableSubject.asObservable();

  private spotifyToken: StoredSpotifyToken | null = null;
  private inFlightFetch: Observable<string | null> | null = null;
  /**
   * Sticky flag: `true` once a mint attempt for the CURRENT target has
   * failed, until `enter()`/`exit()`/`refreshSpotifyToken()` clears it.
   * Without this, `getValidSpotifyToken()` would re-attempt the network call
   * on every single subsequent Spotify request for the rest of the session
   * (top items, recently-played, now-playing polling, playlists all call in
   * independently) — hammering a broken/undeployed endpoint instead of just
   * degrading once and staying degraded until an explicit retry.
   */
  private tokenMintFailed = false;

  constructor(
    private xomifyAuth: XomifyAuthService,
    private http: HttpClient,
  ) {
    const persistedEmail = this.readPersistedEmail();
    this.emailSubject.next(persistedEmail);
    if (persistedEmail) {
      this.spotifyToken = this.readPersistedSpotifyToken(persistedEmail);
    }
  }

  /** Synchronous read for callers that can't subscribe (e.g. the interceptor,
   * which runs on the hot HTTP path for every request). */
  get impersonatedEmail(): string | null {
    return this.emailSubject.value;
  }

  get isImpersonating(): boolean {
    return !!this.emailSubject.value;
  }

  /**
   * Admin-only: begin stepping through the entire app as `email`. No-ops (and
   * clears any pre-existing state) if the current caller isn't the admin —
   * callers should still gate the entry point itself (nav link, button) on
   * admin status; this is the belt-and-suspenders backstop.
   */
  enter(email: string): void {
    if (!this.isAdmin()) {
      this.exit();
      return;
    }
    const normalized = email.trim().toLowerCase();
    if (!normalized) {
      return;
    }
    this.persistEmail(normalized);
    this.emailSubject.next(normalized);

    // Reset any token left over from a previous target, then warm the cache
    // eagerly so a failure surfaces on the banner right away.
    this.spotifyToken = null;
    this.persistSpotifyToken(null);
    this.tokenMintFailed = false;
    this.tokenUnavailableSubject.next(false);
    this.fetchSpotifyToken(normalized).subscribe();
  }

  /** Clears impersonation state, locally and in localStorage/sessionStorage. */
  exit(): void {
    this.persistEmail(null);
    this.persistSpotifyToken(null);
    this.spotifyToken = null;
    this.inFlightFetch = null;
    this.tokenMintFailed = false;
    this.tokenUnavailableSubject.next(false);
    this.emailSubject.next(null);
  }

  /**
   * The target's Spotify access token, valid for at least
   * `TOKEN_EXPIRY_BUFFER_MS`, fetching/refreshing first if the cached one is
   * missing, expired, or belongs to a different target. Resolves `null`
   * (never throws) when not impersonating, the caller isn't the admin, a
   * mint attempt for the current target has already failed this session
   * (see `tokenMintFailed`), or the mint call fails right now — callers
   * (the interceptor) should fall back to the admin's own token in that
   * case rather than blocking the request.
   */
  getValidSpotifyToken(): Observable<string | null> {
    const email = this.impersonatedEmail;
    if (!email || !this.isAdmin() || this.tokenMintFailed) {
      return of(null);
    }
    if (
      this.spotifyToken &&
      this.spotifyToken.email === email &&
      Date.now() + TOKEN_EXPIRY_BUFFER_MS < this.spotifyToken.expiresAt
    ) {
      return of(this.spotifyToken.accessToken);
    }
    return this.fetchSpotifyToken(email);
  }

  /**
   * Forces a fresh mint of the target's Spotify access token, bypassing both
   * the cache AND the sticky failure flag — used by the interceptor's
   * 401-retry path (mirrors `AuthService.refreshSpotifyAccessToken()`'s role
   * for the admin's own token) so a transient failure doesn't permanently
   * wall off retrying for the rest of the session. Resolves `null` when not
   * impersonating or the mint fails again.
   */
  refreshSpotifyToken(): Observable<string | null> {
    const email = this.impersonatedEmail;
    if (!email || !this.isAdmin()) {
      return of(null);
    }
    this.spotifyToken = null;
    this.tokenMintFailed = false;
    return this.fetchSpotifyToken(email);
  }

  private fetchSpotifyToken(email: string): Observable<string | null> {
    if (this.inFlightFetch) {
      return this.inFlightFetch;
    }
    const url = `${environment.xomifyApiUrl}/admin/impersonation-token`;
    const req$ = this.http
      .get<ImpersonationTokenResponse>(url, { params: { email } })
      .pipe(
        map((res) => {
          const expiresAt =
            Date.now() + Math.max(0, (res.expiresIn ?? 0) * 1000);
          const token: StoredSpotifyToken = {
            email,
            accessToken: res.accessToken,
            expiresAt,
          };
          this.spotifyToken = token;
          this.persistSpotifyToken(token);
          this.tokenMintFailed = false;
          this.tokenUnavailableSubject.next(false);
          return token.accessToken;
        }),
        catchError((err) => {
          // Expected while the sibling backend PR is unmerged (404), or for
          // a target with no stored Spotify refresh token yet — degrade
          // gracefully rather than blocking impersonation entirely.
          console.warn(
            '[ImpersonationService] failed to mint target Spotify access token',
            err,
          );
          this.spotifyToken = null;
          this.persistSpotifyToken(null);
          this.tokenMintFailed = true;
          this.tokenUnavailableSubject.next(true);
          return of(null);
        }),
        finalize(() => {
          this.inFlightFetch = null;
        }),
        shareReplay(1),
      );
    this.inFlightFetch = req$;
    return req$;
  }

  private isAdmin(): boolean {
    return isAdminEmail(this.xomifyAuth.getEmail());
  }

  private readPersistedEmail(): string | null {
    let stored: string | null = null;
    try {
      stored = localStorage.getItem(STORAGE_KEY);
    } catch {
      // localStorage can throw in private-mode/embedded webviews — treat as
      // "not impersonating".
      return null;
    }
    if (!stored) {
      return null;
    }
    if (!this.isAdmin()) {
      // Defensive: don't let a stale impersonation email survive into a
      // session where the signed-in caller isn't the admin.
      this.persistEmail(null);
      return null;
    }
    return stored;
  }

  private persistEmail(email: string | null): void {
    try {
      if (email) {
        localStorage.setItem(STORAGE_KEY, email);
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      // Best-effort — private-mode/embedded webviews can throw.
    }
  }

  private readPersistedSpotifyToken(email: string): StoredSpotifyToken | null {
    let raw: string | null = null;
    try {
      raw = sessionStorage.getItem(TOKEN_STORAGE_KEY);
    } catch {
      return null;
    }
    if (!raw) {
      return null;
    }
    try {
      const parsed = JSON.parse(raw) as StoredSpotifyToken;
      if (!parsed || parsed.email !== email) {
        // Stale token from a previous target — ignore, will refetch lazily.
        return null;
      }
      if (!parsed.expiresAt || Date.now() >= parsed.expiresAt) {
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  }

  private persistSpotifyToken(token: StoredSpotifyToken | null): void {
    try {
      if (token) {
        sessionStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(token));
      } else {
        sessionStorage.removeItem(TOKEN_STORAGE_KEY);
      }
    } catch {
      // Best-effort — private-mode/embedded webviews can throw.
    }
  }
}
