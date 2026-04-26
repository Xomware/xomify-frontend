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

/** Raw response shape returned by `POST /auth/login`. */
export interface AuthLoginResponse {
  data: {
    token: string;
    expiresAt: string;
  } | null;
  error: { code?: string; message?: string } | null;
  meta: Record<string, unknown>;
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
          const token = resp?.data?.token ?? null;
          const expiresAt = resp?.data?.expiresAt ?? null;
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

  /** Convenience: true iff a non-empty JWT is present in sessionStorage. */
  hasJwt(): boolean {
    const token = this.getJwt();
    return token !== null && token.trim().length > 0;
  }
}
