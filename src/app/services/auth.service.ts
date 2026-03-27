import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { environment } from 'src/environments/environment';
import { ToastService } from './toast.service';

interface TokenResponse {
  access_token: string;
  refresh_token: string;
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
    'user-read-private user-read-email user-library-read user-top-read playlist-modify-public playlist-modify-private playlist-read-private playlist-read-collaborative ugc-image-upload user-follow-read user-follow-modify user-modify-playback-state user-read-playback-state streaming';
  accessToken: string = '';
  refreshToken: string = '';

  constructor(
    private http: HttpClient,
    private router: Router,
    private toastService: ToastService
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
    const tokenUrl = 'https://accounts.spotify.com/api/token';
    const body = new URLSearchParams();

    body.set('grant_type', 'authorization_code');
    body.set('code', code);
    body.set('redirect_uri', this.redirectUri);
    body.set('client_id', this.clientId);
    body.set('client_secret', this.clientSecret);

    this.http
      .post<TokenResponse>(tokenUrl, body.toString(), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      })
      .subscribe({
        next: (response: TokenResponse) => {
          this.accessToken = response.access_token;
          this.refreshToken = response.refresh_token;
          this.persistTokens();
          this.router.navigate(['/my-profile']);
        },
        error: () => {
          this.toastService.showNegativeToast('Token exchange failed.');
        },
      });
  }

  logout(): void {
    this.accessToken = '';
    this.refreshToken = '';
    this.clearPersistedTokens();
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
