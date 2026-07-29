import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, of } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';
import { environment } from 'src/environments/environment';
import { ToastService } from './toast.service';
import { XomifyAuthService } from './xomify-auth.service';

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

  constructor(
    private http: HttpClient,
    private router: Router,
    private toastService: ToastService,
    private xomifyAuth: XomifyAuthService,
  ) {
    this.restoreTokens();
  }

  private restoreTokens(): void {
    const storedAccess = sessionStorage.getItem(STORAGE_KEY_ACCESS);
    const storedRefresh = sessionStorage.getItem(STORAGE_KEY_REFRESH);
    if (storedAccess) {
      this.accessToken = storedAccess;
    }
    if (storedRefresh) {
      this.refreshToken = storedRefresh;
    }
  }

  private persistTokens(): void {
    sessionStorage.setItem(STORAGE_KEY_ACCESS, this.accessToken);
    sessionStorage.setItem(STORAGE_KEY_REFRESH, this.refreshToken);
  }

  private clearPersistedTokens(): void {
    sessionStorage.removeItem(STORAGE_KEY_ACCESS);
    sessionStorage.removeItem(STORAGE_KEY_REFRESH);
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
