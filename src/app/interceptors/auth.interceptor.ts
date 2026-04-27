// auth.interceptor.ts
//
// Sub-feature 0e of the Auth Identity Hardening epic.
//   Plan: ../../docs/features/auth-identity-and-live-top-items/REFERENCE.md
//
// Responsibilities:
//   1. Attach `Authorization: Bearer <jwt>` to every outgoing call to the
//      Xomify backend (`environment.xomifyApiUrl`).
//   2. Source the JWT from sessionStorage via XomifyAuthService. If the JWT
//      is missing, fall back to `environment.apiAuthToken` so the legacy
//      static-token path keeps working until the dual-mode authorizer is
//      retired (sub-feature 1l).
//   3. Skip the header for `POST /auth/login` itself (public route).
//   4. Skip non-Xomify hosts (Spotify Web API, Spotify accounts, etc.) — those
//      requests carry their own user-bound Spotify access token.
//   5. On a 401 from a Xomify call: refresh the Spotify access token, mint a
//      fresh JWT via `/auth/login`, and retry the original request ONCE.
//      A second 401 is propagated to the caller (no infinite loop).

import { Injectable } from '@angular/core';
import {
  HttpEvent,
  HttpHandler,
  HttpInterceptor,
  HttpRequest,
  HttpErrorResponse,
} from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';
import { environment } from 'src/environments/environment';
import { XomifyAuthService } from '../services/xomify-auth.service';
import { AuthService } from '../services/auth.service';

/** Header name used by every Xomify API call. */
const AUTH_HEADER = 'Authorization';
/** Path suffix of the public mint endpoint — never gets an Authorization header. */
const AUTH_LOGIN_PATH = '/auth/login';
/** Custom flag header marking a request as already-retried. Stripped before send. */
const RETRY_FLAG_HEADER = 'X-Xomify-Auth-Retry';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  constructor(
    private xomifyAuth: XomifyAuthService,
    private authService: AuthService,
  ) {}

  intercept(
    req: HttpRequest<unknown>,
    next: HttpHandler,
  ): Observable<HttpEvent<unknown>> {
    // Only touch calls aimed at the Xomify backend. Spotify, third-party,
    // and absolute URLs to other hosts pass through untouched.
    if (!this.isXomifyApiRequest(req)) {
      return next.handle(req);
    }

    // The `/auth/login` endpoint is public — never attach a token.
    if (this.isAuthLoginRequest(req)) {
      return next.handle(req);
    }

    const isRetry = req.headers.has(RETRY_FLAG_HEADER);
    const cleanReq = isRetry
      ? req.clone({ headers: req.headers.delete(RETRY_FLAG_HEADER) })
      : req;
    const authedReq = this.attachAuth(cleanReq);

    return next.handle(authedReq).pipe(
      catchError((err: unknown) => {
        // Retry-once on 401 — but only for original (non-retry) requests.
        if (
          err instanceof HttpErrorResponse &&
          err.status === 401 &&
          !isRetry
        ) {
          return this.handle401(req, next);
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
    // Any request whose URL begins with that prefix is ours.
    const base = environment.xomifyApiUrl;
    if (!base) return false;
    return req.url.startsWith(base);
  }

  private isAuthLoginRequest(req: HttpRequest<unknown>): boolean {
    // Match by path suffix to avoid coupling to the full base URL.
    return req.url.endsWith(AUTH_LOGIN_PATH);
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
}
