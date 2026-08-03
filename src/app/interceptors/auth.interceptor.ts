// auth.interceptor.ts
//
// Sub-feature 0e of the Auth Identity Hardening epic.
//   Plan: ../../docs/features/auth-identity-and-live-top-items/REFERENCE.md
//
// Responsibilities:
//   1. Attach `Authorization: Bearer <jwt>` to every outgoing call to the
//      Xomify backend (`environment.xomifyApiUrl`) AND the Xomtracks backend
//      (`environment.xomtracksApiUrl`). The two are separate hosts, but
//      xomtracks-backend now validates xomify's own HS256 token in-handler
//      (the WS-AUTH re-base — see `docs/features/xomtracks-xomify-merge/PLAN.md`),
//      so the same Bearer token is correct for both.
//   2. Source the JWT from localStorage via XomifyAuthService. If the JWT
//      is missing, fall back to `environment.apiAuthToken` so the legacy
//      static-token path keeps working until the dual-mode authorizer is
//      retired (sub-feature 1l).
//   3. Skip the header for `POST /auth/login` itself (public route).
//   4. On a 401 from a Xomify/Xomtracks call: refresh the Spotify access
//      token, mint a fresh JWT via `/auth/login`, and retry the original
//      request ONCE. A second 401 is propagated to the caller (no infinite
//      loop).
//   5. Direct `api.spotify.com` calls (services build these themselves, e.g.
//      UserService.getUserData, ListeningHistoryService.getRecentlyPlayed —
//      they set their own `Authorization` header since they predate this
//      interceptor). Spotify access tokens now persist in localStorage
//      across browser restarts (see `persisted-token-storage.ts`), so a
//      stale/expired one can sit there instead of forcing a re-login. Fix:
//        a. Proactively check `AuthService.getValidAccessToken()` before
//           sending — if the stored token is expired/near-expiry/unknown, it
//           is refreshed first, and the (possibly stale) header the caller
//           set is REPLACED with the fresh one.
//        b. As a fallback, a 401 on a Spotify call still refreshes and
//           retries ONCE, same as the Xomify path — belt and suspenders in
//           case the proactive check's clock/expiry tracking is off.
//      All other hosts (Spotify accounts.spotify.com token endpoint, etc.)
//      pass through untouched.
//   6. Impersonation (full-app "step through as" mode, distinct from the
//      read-only Admin Portal "View As" projection): while the admin is
//      impersonating (`ImpersonationService.impersonatedEmail`):
//        a. Every request to the Xomtracks/Shares backend
//           (`environment.xomtracksApiUrl`, any method) gets
//           `?impersonate=<email>` appended — the backend contract honors
//           this for admin-issued JWTs and scopes Shares data/actions to
//           that user.
//        b. Every READ (GET) request to Xomify's own backend
//           (`environment.xomifyApiUrl`) ALSO gets `?impersonate=<email>`
//           appended — e.g. `/user/top-items`, `/user/data`, which compute
//           Spotify-derived data server-side keyed off the CALLER's identity
//           and need the same scoping to return the target's data instead of
//           the admin's own. Writes (POST/PUT/DELETE) are deliberately
//           excluded so impersonation can never silently mutate xomify
//           account state for/as the target via this param — Shares actions
//           are the one place impersonation is meant to act as the target,
//           and that's `xomtracksApiUrl`, covered by (a).
//        c. Direct `api.spotify.com` calls get the TARGET's Spotify access
//           token swapped in instead of the admin's own (see responsibility
//           5's `interceptSpotify`/`getSpotifyAuthToken`) — this is what
//           actually makes top items, recently-played, now-playing,
//           playlists, and the "Welcome, <name>" greeting reflect the target,
//           since those are all direct Spotify Web API calls.
//      (a)/(b) are applied once, up front, before the retry/auth machinery
//      below, so a 401-triggered retry still carries the param.

import { Injectable } from '@angular/core';
import {
  HttpEvent,
  HttpHandler,
  HttpInterceptor,
  HttpRequest,
  HttpErrorResponse,
} from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';
import { environment } from 'src/environments/environment';
import { XomifyAuthService } from '../services/xomify-auth.service';
import { AuthService } from '../services/auth.service';
import { ImpersonationService } from '../services/impersonation.service';
import { isAdminEmail } from '../config/admin.config';

/** Query param the Xomtracks/Shares backend reads to scope a request to the
 * impersonated user's data instead of the calling admin's own. */
const IMPERSONATE_PARAM = 'impersonate';

/** Header name used by every Xomify API call. */
const AUTH_HEADER = 'Authorization';
/** Path suffix of the public mint endpoint — never gets an Authorization header. */
const AUTH_LOGIN_PATH = '/auth/login';
/** Path suffix of the admin-only endpoint that mints the TARGET's Spotify
 * access token (see `ImpersonationService`). It already takes its own
 * `email` query param — never gets `?impersonate=` appended too, which would
 * be self-referential/confusing (and is the one xomify-backend GET call that
 * must always run as the ADMIN, not scoped to the target). */
const IMPERSONATION_TOKEN_PATH = '/admin/impersonation-token';
/** Custom flag header marking a request as already-retried. Stripped before send. */
const RETRY_FLAG_HEADER = 'X-Xomify-Auth-Retry';
/** Base URL of the Spotify Web API — distinct from accounts.spotify.com. */
const SPOTIFY_API_BASE = 'https://api.spotify.com';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  constructor(
    private xomifyAuth: XomifyAuthService,
    private authService: AuthService,
    private impersonation: ImpersonationService,
  ) {}

  intercept(
    req: HttpRequest<unknown>,
    next: HttpHandler,
  ): Observable<HttpEvent<unknown>> {
    // Direct Spotify Web API calls get their own proactive-refresh +
    // 401-retry handling (see file header, responsibility 5).
    if (this.isSpotifyApiRequest(req)) {
      return this.interceptSpotify(req, next);
    }

    // Only touch calls aimed at the Xomify backend. Third-party and
    // absolute URLs to other hosts (e.g. accounts.spotify.com) pass through
    // untouched.
    if (!this.isXomifyApiRequest(req)) {
      return next.handle(req);
    }

    // The `/auth/login` endpoint is public — never attach a token.
    if (this.isAuthLoginRequest(req)) {
      return next.handle(req);
    }

    // Applied first (see responsibility 6) so it's baked into `cleanReq`,
    // which both the happy path AND the 401 retry path below derive from.
    const impersonatedReq = this.applyImpersonation(req);

    const isRetry = impersonatedReq.headers.has(RETRY_FLAG_HEADER);
    const cleanReq = isRetry
      ? impersonatedReq.clone({ headers: impersonatedReq.headers.delete(RETRY_FLAG_HEADER) })
      : impersonatedReq;
    const authedReq = this.attachAuth(cleanReq);

    return next.handle(authedReq).pipe(
      catchError((err: unknown) => {
        // Retry-once on 401 — but only for original (non-retry) requests.
        if (
          err instanceof HttpErrorResponse &&
          err.status === 401 &&
          !isRetry
        ) {
          return this.handle401(cleanReq, next);
        }
        return throwError(() => err);
      }),
    );
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  private isXomifyApiRequest(req: HttpRequest<unknown>): boolean {
    // The `xomifyApiUrl` getter returns e.g.
    //   https://abc123.execute-api.us-east-1.amazonaws.com/dev
    // `xomtracksApiUrl` is the separate Xomtracks backend host
    // (api.xomtracks.xomware.com). Any request whose URL begins with either
    // prefix is ours — do NOT widen this to arbitrary hosts.
    const xomifyBase = environment.xomifyApiUrl;
    const xomtracksBase = environment.xomtracksApiUrl;
    return (
      (!!xomifyBase && req.url.startsWith(xomifyBase)) ||
      (!!xomtracksBase && req.url.startsWith(xomtracksBase))
    );
  }

  private isAuthLoginRequest(req: HttpRequest<unknown>): boolean {
    // Match by path suffix to avoid coupling to the full base URL.
    return req.url.endsWith(AUTH_LOGIN_PATH);
  }

  private isXomtracksApiRequest(req: HttpRequest<unknown>): boolean {
    const xomtracksBase = environment.xomtracksApiUrl;
    return !!xomtracksBase && req.url.startsWith(xomtracksBase);
  }

  private isXomifyOwnApiRequest(req: HttpRequest<unknown>): boolean {
    const xomifyBase = environment.xomifyApiUrl;
    return !!xomifyBase && req.url.startsWith(xomifyBase);
  }

  /**
   * While impersonating, appends `?impersonate=<email>` to Xomtracks/Shares
   * calls (any method) and to READ (GET) calls against Xomify's own backend
   * — never Spotify, never a write against `xomifyApiUrl` (see
   * responsibility 6b). `HttpParams.set` URL-encodes the value. Re-checks
   * admin status here too (belt and suspenders alongside
   * `ImpersonationService.enter`'s own gate) so a stale value can never leak
   * a scoped request for a non-admin caller. Never clobbers a value the
   * caller already set explicitly.
   */
  private applyImpersonation(req: HttpRequest<unknown>): HttpRequest<unknown> {
    const email = this.impersonation.impersonatedEmail;
    if (!email || !isAdminEmail(this.xomifyAuth.getEmail())) {
      return req;
    }
    if (req.params.has(IMPERSONATE_PARAM)) {
      return req;
    }
    if (req.url.endsWith(IMPERSONATION_TOKEN_PATH)) {
      return req;
    }

    if (this.isXomtracksApiRequest(req)) {
      return req.clone({ params: req.params.set(IMPERSONATE_PARAM, email) });
    }

    if (this.isXomifyOwnApiRequest(req) && req.method === 'GET') {
      return req.clone({ params: req.params.set(IMPERSONATE_PARAM, email) });
    }

    return req;
  }

  private isSpotifyApiRequest(req: HttpRequest<unknown>): boolean {
    // Only the Web API host — NOT accounts.spotify.com (the OAuth
    // token/refresh endpoint AuthService itself calls; that request has no
    // Bearer-token-swap concept and must pass through unmodified).
    return req.url.startsWith(SPOTIFY_API_BASE);
  }

  private attachAuth(req: HttpRequest<unknown>): HttpRequest<unknown> {
    // Don't clobber an Authorization header the caller explicitly set.
    if (req.headers.has(AUTH_HEADER)) {
      return req;
    }

    const jwt = this.xomifyAuth.getJwt();
    const token = jwt && jwt.length > 0 ? jwt : environment.apiAuthToken;

    // If neither the JWT nor the legacy token is available, send the request
    // unmodified. The backend will 401 and the interceptor's catch will
    // surface that to the caller.
    if (!token || token.length === 0) {
      return req;
    }

    return req.clone({
      setHeaders: { [AUTH_HEADER]: `Bearer ${token}` },
    });
  }

  /**
   * 401 path: refresh Spotify token -> mint a new Xomify JWT -> retry the
   * original request once with the freshly-stored JWT. If any step fails,
   * propagate the original 401.
   */
  private handle401(
    originalReq: HttpRequest<unknown>,
    next: HttpHandler,
  ): Observable<HttpEvent<unknown>> {
    return this.authService.refreshSpotifyAccessToken().pipe(
      switchMap((freshSpotifyToken) => {
        if (!freshSpotifyToken) {
          // No path to a fresh Spotify token (e.g. user logged out) —
          // surface the 401.
          return throwError(
            () =>
              new HttpErrorResponse({
                status: 401,
                statusText: 'Unauthorized (no Spotify refresh token)',
              }),
          );
        }
        return this.xomifyAuth
          .mintFromSpotifyAccessToken(freshSpotifyToken)
          .pipe(
            switchMap((newJwt) => {
              if (!newJwt) {
                return throwError(
                  () =>
                    new HttpErrorResponse({
                      status: 401,
                      statusText: 'Unauthorized (mint failed)',
                    }),
                );
              }
              // Mark the retry so we don't recurse on a second 401.
              const retried = originalReq.clone({
                setHeaders: {
                  [AUTH_HEADER]: `Bearer ${newJwt}`,
                  [RETRY_FLAG_HEADER]: '1',
                },
              });
              return next.handle(retried);
            }),
          );
      }),
      catchError((err: unknown) => throwError(() => err)),
    );
  }

  /**
   * Handles a direct `api.spotify.com` request (see file header,
   * responsibility 5): proactively refreshes an expired/near-expiry access
   * token BEFORE sending, swapping it into the `Authorization` header
   * regardless of whatever (possibly stale) header the calling service set.
   * Falls back to a reactive refresh-and-retry-once on a 401, in case the
   * proactive expiry check missed a still-invalid token.
   *
   * While impersonating (responsibility 6c), the token swapped in is the
   * TARGET's Spotify access token, not the admin's own — this is the entire
   * mechanism behind top items / recently-played / now-playing / playlists /
   * the greeting reflecting the impersonated user, since every one of those
   * is a direct Spotify Web API call.
   */
  private interceptSpotify(
    req: HttpRequest<unknown>,
    next: HttpHandler,
  ): Observable<HttpEvent<unknown>> {
    const isRetry = req.headers.has(RETRY_FLAG_HEADER);
    const cleanReq = isRetry
      ? req.clone({ headers: req.headers.delete(RETRY_FLAG_HEADER) })
      : req;

    if (isRetry) {
      // Already carrying a freshly-refreshed token from handleSpotify401 —
      // send as-is. A 401 here is NOT retried again (no infinite loop).
      return next.handle(cleanReq);
    }

    return this.getSpotifyAuthToken().pipe(
      switchMap((validToken) => {
        // Swap in a known-fresh token when we have one — this is what
        // actually fixes the stale-localStorage-token 401s, since the
        // calling service builds this header itself before the interceptor
        // ever sees the request. If no token is available (logged out),
        // send unmodified and let the 401 (if any) surface normally.
        const outgoing =
          validToken && validToken.length > 0
            ? cleanReq.clone({
                setHeaders: { [AUTH_HEADER]: `Bearer ${validToken}` },
              })
            : cleanReq;

        return next.handle(outgoing).pipe(
          catchError((err: unknown) => {
            if (err instanceof HttpErrorResponse && err.status === 401) {
              return this.handleSpotify401(cleanReq, next);
            }
            return throwError(() => err);
          }),
        );
      }),
    );
  }

  /**
   * Resolves the Spotify access token to use for an outgoing
   * `api.spotify.com` request. While impersonating, prefers the target's
   * token (`ImpersonationService.getValidSpotifyToken`); if that mint has
   * failed (endpoint not deployed yet, target has no stored refresh token),
   * falls back to the admin's own token rather than sending an unauthorized
   * request — same "degrade, don't break" contract as the rest of
   * impersonation mode. Outside impersonation, this is just the caller's own
   * token, unchanged from before.
   */
  private getSpotifyAuthToken(): Observable<string | null> {
    if (this.impersonation.isImpersonating) {
      return this.impersonation.getValidSpotifyToken().pipe(
        switchMap((impersonatedToken) =>
          impersonatedToken
            ? of(impersonatedToken)
            : this.authService.getValidAccessToken(),
        ),
      );
    }
    return this.authService.getValidAccessToken();
  }

  /**
   * Reactive fallback for a Spotify 401: refresh the access token and retry
   * the original request ONCE with the fresh token swapped into the
   * `Authorization` header. If there's no refresh token (or refresh fails),
   * propagate the 401 — same contract as the Xomify `handle401` path. While
   * impersonating, refreshes the TARGET's token first (falling back to the
   * admin's own refresh if that fails), mirroring `getSpotifyAuthToken`.
   */
  private handleSpotify401(
    originalReq: HttpRequest<unknown>,
    next: HttpHandler,
  ): Observable<HttpEvent<unknown>> {
    const refresh$ = this.impersonation.isImpersonating
      ? this.impersonation.refreshSpotifyToken().pipe(
          switchMap((impersonatedToken) =>
            impersonatedToken
              ? of(impersonatedToken)
              : this.authService.refreshSpotifyAccessToken(),
          ),
        )
      : this.authService.refreshSpotifyAccessToken();

    return refresh$.pipe(
      switchMap((freshToken) => {
        if (!freshToken) {
          return throwError(
            () =>
              new HttpErrorResponse({
                status: 401,
                statusText: 'Unauthorized (no Spotify refresh token)',
              }),
          );
        }
        const retried = originalReq.clone({
          setHeaders: {
            [AUTH_HEADER]: `Bearer ${freshToken}`,
            [RETRY_FLAG_HEADER]: '1',
          },
        });
        return next.handle(retried);
      }),
      catchError((err: unknown) => throwError(() => err)),
    );
  }
}
