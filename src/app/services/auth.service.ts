import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, of } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';
import { environment } from 'src/environments/environment';
import { ToastService } from './toast.service';
import { XomifyAuthService } from './xomify-auth.service';
import {
  readPersistedToken,
  writePersistedToken,
  removePersistedToken,
} from '../utils/persisted-token-storage';

interface TokenResponse {
  access_token: string;
  /** Spotify only returns this on the initial code-exchange, not on refresh. */
  refresh_token?: string;
  token_type: string;
  expires_in: number;
  scope: string;
}

const STORAGE_KEY_ACCESS = 'xomify_access_token';
const STORAGE_KEY_REFRESH = 'xomify_refresh_token';
const STORAGE_KEY_EXPIRES_AT = 'xomify_access_token_expires_at';
/** Refresh proactively this far ahead of the actual expiry. */
const EXPIRY_BUFFER_MS = 60_000;

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly clientId = environment.spotifyClientId;
  private readonly clientSecret = environment.spotifyClientSecret;
  private readonly redirectUri = `${environment.baseCallbackUrl}/callback`;
  private readonly scope =
    'user-read-private user-read-email user-library-read user-top-read playlist-modify-public playlist-modify-private playlist-read-private playlist-read-collaborative ugc-image-upload user-follow-read user-follow-modify user-modify-playback-state user-read-playback-state user-read-recently-played streaming';
  private readonly spotifyTokenUrl = 'https://accounts.spotify.com/api/token';
  accessToken: string = '';
  refreshToken: string = '';
  /**
   * Epoch ms when `accessToken` expires. `0` means unknown (e.g. a session
   * restored from a build that predates this field) — treated as expired so
   * we refresh once rather than trusting a token we can't verify.
   */
  private accessTokenExpiresAt: number = 0;

  constructor(
    private http: HttpClient,
    private router: Router,
    private toastService: ToastService,
    private xomifyAuth: XomifyAuthService,
  ) {
    this.restoreTokens();
  }

  private restoreTokens(): void {
    // localStorage survives a browser restart — critical for the refresh
    // token, since that's what lets `ensureXomifyJwt()` re-mint a Xomify JWT
    // without forcing the user back through the Spotify OAuth screen.
    // `readPersistedToken` also migrates forward any value still sitting in
    // the legacy sessionStorage slot from before this change.
    const storedAccess = readPersistedToken(STORAGE_KEY_ACCESS);
    const storedRefresh = readPersistedToken(STORAGE_KEY_REFRESH);
    const storedExpiresAt = readPersistedToken(STORAGE_KEY_EXPIRES_AT);
    if (storedAccess) {
      this.accessToken = storedAccess;
    }
    if (storedRefresh) {
      this.refreshToken = storedRefresh;
    }
    // A missing/unparseable value leaves accessTokenExpiresAt at its default
    // `0` (unknown -> treated as expired). This is the case for sessions
    // persisted before this field existed, and for the localStorage
    // migration — an access token restored across a browser restart with no
    // known expiry gets refreshed once rather than trusted blindly, which is
    // what actually fixes the direct-Spotify-call 401s.
    const parsedExpiresAt = storedExpiresAt ? Number(storedExpiresAt) : NaN;
    if (!Number.isNaN(parsedExpiresAt)) {
      this.accessTokenExpiresAt = parsedExpiresAt;
    }
  }

  private persistTokens(): void {
    writePersistedToken(STORAGE_KEY_ACCESS, this.accessToken);
    writePersistedToken(STORAGE_KEY_REFRESH, this.refreshToken);
    writePersistedToken(
      STORAGE_KEY_EXPIRES_AT,
      String(this.accessTokenExpiresAt),
    );
  }

  private clearPersistedTokens(): void {
    removePersistedToken(STORAGE_KEY_ACCESS);
    removePersistedToken(STORAGE_KEY_REFRESH);
    removePersistedToken(STORAGE_KEY_EXPIRES_AT);
  }

  /**
   * `true` when the current Spotify access token is missing, unknown-expiry,
   * or within `bufferMs` of expiring. Spotify access tokens last 1h; the
   * default 60s buffer avoids a token expiring mid-flight to Spotify's API.
   */
  isAccessTokenExpired(bufferMs: number = EXPIRY_BUFFER_MS): boolean {
    if (!this.accessToken || this.accessToken.trim().length === 0) {
      return true;
    }
    if (!this.accessTokenExpiresAt) {
      return true;
    }
    return Date.now() + bufferMs >= this.accessTokenExpiresAt;
  }

  /**
   * Returns a Spotify access token known to be valid for at least
   * `EXPIRY_BUFFER_MS`, refreshing first if the current one is expired,
   * about to expire, or of unknown expiry. Used by the AuthInterceptor to
   * proactively refresh before a direct `api.spotify.com` call, so `/me` and
   * `/recently-played` don't 401 on the first load after a browser restart
   * (Spotify access tokens now persist in localStorage, so a stale one can
   * stick around instead of forcing a fresh login).
   */
  getValidAccessToken(): Observable<string | null> {
    if (!this.isAccessTokenExpired()) {
      return of(this.accessToken);
    }
    return this.refreshSpotifyAccessToken();
  }

  login(): void {
    const authUrl = `https://accounts.spotify.com/authorize?client_id=${
      this.clientId
    }&redirect_uri=${encodeURIComponent(
      this.redirectUri
    )}&scope=${encodeURIComponent(this.scope)}&response_type=code`;
    window.location.href = authUrl;
  }

  handleCallback(): void {
    const code = new URL(window.location.href).searchParams.get('code');

    if (code) {
      this.exchangeCodeForToken(code);
    }
  }

  private exchangeCodeForToken(code: string): void {
    const body = new URLSearchParams();

    body.set('grant_type', 'authorization_code');
    body.set('code', code);
    body.set('redirect_uri', this.redirectUri);
    body.set('client_id', this.clientId);
    body.set('client_secret', this.clientSecret);

    this.http
      .post<TokenResponse>(this.spotifyTokenUrl, body.toString(), {
        headers: new HttpHeaders({
          'Content-Type': 'application/x-www-form-urlencoded',
        }),
      })
      .subscribe({
        next: (response: TokenResponse) => {
          this.accessToken = response.access_token;
          if (response.refresh_token) {
            this.refreshToken = response.refresh_token;
          }
          this.accessTokenExpiresAt =
            Date.now() + response.expires_in * 1000;
          this.persistTokens();

          // Sub-feature 0e: mint a per-user Xomify JWT from the Spotify
          // access token. Fire-and-forget — the AuthInterceptor falls back
          // to the legacy static token while this round-trip completes,
          // and the backend authorizer accepts both during the migration.
          this.xomifyAuth
            .mintFromSpotifyAccessToken(this.accessToken)
            .subscribe({
              error: () => {
                // Errors are already logged inside XomifyAuthService.
              },
            });

          // Land on the Home dashboard after login, not the profile page.
          this.router.navigate(['/']);
        },
        error: () => {
          this.toastService.showNegativeToast('Token exchange failed.');
        },
      });
  }

  /**
   * Refresh the Spotify access token using the stored refresh token. Returns
   * the new access token (or `null` if no refresh token is available / the
   * call fails). Used by the AuthInterceptor on a 401 to bootstrap a fresh
   * `/auth/login` round-trip.
   */
  refreshSpotifyAccessToken(): Observable<string | null> {
    if (!this.refreshToken || this.refreshToken.trim().length === 0) {
      return of(null);
    }

    const body = new URLSearchParams();
    body.set('grant_type', 'refresh_token');
    body.set('refresh_token', this.refreshToken);
    body.set('client_id', this.clientId);
    body.set('client_secret', this.clientSecret);

    return this.http
      .post<TokenResponse>(this.spotifyTokenUrl, body.toString(), {
        headers: new HttpHeaders({
          'Content-Type': 'application/x-www-form-urlencoded',
        }),
      })
      .pipe(
        map((response) => {
          this.accessToken = response.access_token;
          // Spotify may rotate the refresh token; persist whichever we got.
          if (response.refresh_token) {
            this.refreshToken = response.refresh_token;
          }
          this.accessTokenExpiresAt =
            Date.now() + response.expires_in * 1000;
          this.persistTokens();
          return this.accessToken;
        }),
        catchError((err) => {
          console.warn('[AuthService] Spotify refresh failed', err);
          return of(null);
        }),
      );
  }

  /**
   * Mint a Xomify JWT for the current session if one is not already present.
   * Safe to call on every app boot — no-ops when the JWT is already valid.
   * Returns the existing or freshly-minted JWT, or `null` when the user is
   * not logged in via Spotify.
   *
   * On bootstrap of an existing session, the stored Spotify access token is
   * usually expired (Spotify access tokens last 1h). Minting against a stale
   * token returns 401 from `/auth/login`. Always refresh Spotify first when
   * we don't already have a JWT, then mint with the fresh access token.
   */
  ensureXomifyJwt(): Observable<string | null> {
    if (this.xomifyAuth.hasJwt()) {
      return of(this.xomifyAuth.getJwt());
    }
    if (!this.refreshToken || this.refreshToken.trim().length === 0) {
      // No path to a fresh access token — user is not logged in via Spotify.
      return of(null);
    }
    return this.refreshSpotifyAccessToken().pipe(
      switchMap((freshAccessToken) => {
        if (!freshAccessToken || freshAccessToken.trim().length === 0) {
          return of(null);
        }
        return this.xomifyAuth.mintFromSpotifyAccessToken(freshAccessToken);
      }),
    );
  }

  logout(): void {
    this.accessToken = '';
    this.refreshToken = '';
    this.accessTokenExpiresAt = 0;
    this.clearPersistedTokens();
    this.xomifyAuth.clear();
  }

  getAccessToken(): string {
    return this.accessToken;
  }

  getRefreshToken(): string {
    return this.refreshToken;
  }

  isLoggedIn(): boolean {
    return this.accessToken.trim().length > 0;
  }
}
