// xomify-auth.service.ts
//
// Owns the per-user Xomify JWT lifecycle: mint via POST /auth/login, persist
// in sessionStorage, expose to the AuthInterceptor, clear on logout.
//
// This service is intentionally separate from `AuthService` (which owns the
// Spotify OAuth flow) so the AuthInterceptor can depend on it without pulling
// the full Spotify auth surface, and so we avoid a DI cycle between the
// interceptor and the service that triggers the mint.
//
// Sub-feature 0e of the Auth Identity Hardening epic.
//   Plan: ../../docs/features/auth-identity-and-live-top-items/REFERENCE.md

import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { environment } from 'src/environments/environment';

/**
 * Raw response shape returned by `POST /auth/login`.
 *
 * Note: the backend's `success_response` helper does NOT wrap the body in a
 * `{ data, error, meta }` envelope — the body is the raw dict the handler
 * returned. Tolerate both shapes (with/without `data` wrapper) so a future
 * envelope migration doesn't break us.
 */
export interface AuthLoginResponse {
  // Wrapped shape (envelope), in case backend ever adopts one.
  data?: {
    token?: string;
    expiresAt?: string | null;
  } | null;
  // Unwrapped shape — current backend.
  token?: string;
  expiresAt?: string | null;
  error?: { code?: string; message?: string } | null;
  meta?: Record<string, unknown>;
}

/** sessionStorage key for the per-user Xomify JWT (Q3 in the epic plan). */
export const XOMIFY_JWT_STORAGE_KEY = 'xomify_jwt';
/** sessionStorage key for the JWT's expiry timestamp (ISO 8601). */
export const XOMIFY_JWT_EXPIRES_AT_STORAGE_KEY = 'xomify_jwt_expires_at';

@Injectable({
  providedIn: 'root',
})
export class XomifyAuthService {
  private readonly loginUrl = `${environment.xomifyApiUrl}/auth/login`;

  constructor(private http: HttpClient) {}

  /**
   * Read the current JWT from sessionStorage. Returns `null` if absent.
   * Synchronous so the interceptor can use it without subscribing.
   */
  getJwt(): string | null {
    try {
      return sessionStorage.getItem(XOMIFY_JWT_STORAGE_KEY);
    } catch {
      // sessionStorage can throw in private-mode browsers; treat as missing.
      return null;
    }
  }

  /** ISO timestamp at which the current JWT expires, or `null` if unknown. */
  getExpiresAt(): string | null {
    try {
      return sessionStorage.getItem(XOMIFY_JWT_EXPIRES_AT_STORAGE_KEY);
    } catch {
      return null;
    }
  }

  /**
   * Mint a fresh Xomify JWT from the user's Spotify access token.
   * Persists the JWT (+ expiry) to sessionStorage on success.
   */
  mintFromSpotifyAccessToken(spotifyAccessToken: string): Observable<string | null> {
    if (!spotifyAccessToken || spotifyAccessToken.trim().length === 0) {
      return of(null);
    }

    // Use a plain Content-Type header — no Authorization. The auth.interceptor
    // is configured to skip /auth/login (the endpoint is public).
    const headers = new HttpHeaders({ 'Content-Type': 'application/json' });

    return this.http
      .post<AuthLoginResponse>(this.loginUrl, { spotifyAccessToken }, { headers })
      .pipe(
        map((resp) => {
          // success_response returns the body raw — no `data` envelope.
          // Tolerate both shapes for safety.
          const token = resp?.token ?? resp?.data?.token ?? null;
          const expiresAt = resp?.expiresAt ?? resp?.data?.expiresAt ?? null;
          if (token) {
            this.persist(token, expiresAt);
          }
          return token;
        }),
        catchError((err) => {
          // Don't blow up the caller — the legacy static token in
          // `environment.apiAuthToken` is still accepted by the backend
          // authorizer during the migration window. Surface the error in the
          // console so it shows up in dev tools.
          console.warn('[XomifyAuthService] /auth/login failed', err);
          return of(null);
        }),
      );
  }

  /**
   * Persist a JWT (+ expiry) to sessionStorage. Public so callers (e.g. the
   * 401-retry path) can stash a re-minted token without going through
   * `mintFromSpotifyAccessToken`.
   */
  persist(token: string, expiresAt: string | null): void {
    try {
      sessionStorage.setItem(XOMIFY_JWT_STORAGE_KEY, token);
      if (expiresAt) {
        sessionStorage.setItem(XOMIFY_JWT_EXPIRES_AT_STORAGE_KEY, expiresAt);
      } else {
        sessionStorage.removeItem(XOMIFY_JWT_EXPIRES_AT_STORAGE_KEY);
      }
    } catch (err) {
      console.warn('[XomifyAuthService] failed to persist JWT', err);
    }
  }

  /** Wipe the JWT (+ expiry). Called on logout and when re-mint fails. */
  clear(): void {
    try {
      sessionStorage.removeItem(XOMIFY_JWT_STORAGE_KEY);
      sessionStorage.removeItem(XOMIFY_JWT_EXPIRES_AT_STORAGE_KEY);
    } catch {
      // Best-effort.
    }
  }

  /**
   * True iff sessionStorage holds a JWT that is:
   *   1. structurally valid (decodes as `header.payload.signature`)
   *   2. carries both `email` and `userId` claims (sub-feature 0a contract)
   *   3. is not expired or within 60s of expiring.
   *
   * Anything else is wiped as a side-effect so the bootstrap mint flow
   * doesn't short-circuit on a token the backend will then reject.
   *
   * Notably this rejects the legacy static `apiAuthToken` if it ever ends
   * up in this slot — it decodes but has no `email`/`userId` claims, and
   * the backend handler then 401s on every authorized call.
   */
  hasJwt(): boolean {
    const token = this.getJwt();
    if (!token || token.trim().length === 0) {
      return false;
    }
    const claims = decodeJwtPayload(token);
    if (!claims || !claims.email || !claims.userId) {
      // Token doesn't have the per-user claims this app requires. Wipe so
      // the next bootstrap re-mints from a fresh Spotify access token.
      this.clear();
      return false;
    }
    const nowSec = Math.floor(Date.now() / 1000);
    if (typeof claims.exp === 'number' && claims.exp - nowSec < 60) {
      this.clear();
      return false;
    }
    // Belt-and-suspenders: also honor the persisted ISO `expiresAt` field.
    const expiresAt = this.getExpiresAt();
    if (expiresAt) {
      const expiryMs = Date.parse(expiresAt);
      if (!isNaN(expiryMs) && expiryMs - Date.now() < 60_000) {
        this.clear();
        return false;
      }
    }
    return true;
  }
}

/** Best-effort base64url-decode of a JWT payload. Returns `null` on any failure. */
function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    // base64url -> base64
    let b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4 !== 0) {
      b64 += '=';
    }
    const json = atob(b64);
    return JSON.parse(json);
  } catch {
    return null;
  }
}
