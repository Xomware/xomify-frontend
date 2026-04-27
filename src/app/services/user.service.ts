// user.service.ts
import { Injectable, OnInit } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, of, forkJoin } from 'rxjs';
import { catchError, map, shareReplay, switchMap, tap } from 'rxjs/operators';
import { AuthService } from './auth.service';
import { environment } from 'src/environments/environment';

@Injectable({
  providedIn: 'root',
})
export class UserService implements OnInit {
  accessToken: string;
  refreshToken: string;
  user: any;
  userName = '';
  id = '';
  activeWrapped: boolean = false;
  activeReleaseRadar: boolean = false;
  playlistCount: number = 0;
  followingCount: number = 0;
  likesCount: number = 0;
  likesPublic: boolean = false;
  private bootstrap$: Observable<void> | null = null;
  private baseUrl = 'https://api.spotify.com/v1';
  private xomifyApiUrl: string = `https://${environment.apiId}.execute-api.us-east-1.amazonaws.com/dev`;
  // Authorization for Xomify API calls is attached by AuthInterceptor (sub-feature 0e).

  constructor(
    private http: HttpClient,
    private AuthService: AuthService,
  ) {}

  ngOnInit() {
    this.accessToken = this.AuthService.getAccessToken();
    this.refreshToken = this.AuthService.getRefreshToken();
  }

  private getAuthHeaders(): HttpHeaders {
    this.accessToken = this.AuthService.getAccessToken();
    return new HttpHeaders({
      Authorization: `Bearer ${this.accessToken}`,
    });
  }

  getUserData(): Observable<any> {
    return this.http.get(`${this.baseUrl}/me`, {
      headers: this.getAuthHeaders(),
    });
  }

  /**
   * Ensure user profile + Xomify enrollment flags are populated before a
   * page that depends on them runs its own load. Safe to call from any
   * number of pages — the underlying HTTP work runs once and is shared.
   * Resolves to `void` once both the Spotify profile and the Xomify user
   * row have been fetched (or failed gracefully).
   */
  ensureLoaded(): Observable<void> {
    if (this.user?.email) {
      return of(void 0);
    }
    if (!this.bootstrap$) {
      this.bootstrap$ = this.getUserData().pipe(
        tap((data) => this.setUser(data)),
        catchError(() => of(null)),
        switchMap((data: any) => {
          const email = data?.email;
          if (!email) return of(void 0);
          return this.getUserTableData(email).pipe(
            tap((xomifyData: any) => {
              this.activeWrapped = xomifyData?.activeWrapped ?? false;
              this.activeReleaseRadar =
                xomifyData?.activeReleaseRadar ?? false;
              this.likesCount = xomifyData?.likesCount ?? 0;
              this.likesPublic = xomifyData?.likesPublic ?? false;
            }),
            catchError(() => of(null)),
            map(() => void 0),
          );
        }),
        shareReplay(1),
      );
    }
    return this.bootstrap$;
  }

  // Get user's playlists (limit=1 to just get total count, or higher for actual list)
  getUserPlaylists(limit: number = 1, offset: number = 0): Observable<any> {
    return this.http.get(`${this.baseUrl}/me/playlists`, {
      headers: this.getAuthHeaders(),
      params: {
        limit: limit.toString(),
        offset: offset.toString(),
      },
    });
  }

  // Get followed artists with pagination support
  getFollowedArtists(limit: number = 20, after?: string): Observable<any> {
    const params: any = {
      type: 'artist',
      limit: limit.toString(),
    };

    if (after) {
      params.after = after;
    }

    return this.http.get(`${this.baseUrl}/me/following`, {
      headers: this.getAuthHeaders(),
      params,
    });
  }

  // Get all followed artists (handles pagination)
  getAllFollowedArtists(): Observable<any[]> {
    return new Observable((observer) => {
      const allArtists: any[] = [];

      const fetchPage = (after?: string) => {
        this.getFollowedArtists(50, after).subscribe({
          next: (data) => {
            const artists = data.artists?.items || [];
            allArtists.push(...artists);

            // Check if there are more artists (Spotify uses cursor-based pagination)
            const nextCursor = data.artists?.cursors?.after;
            if (nextCursor && artists.length === 50) {
              fetchPage(nextCursor);
            } else {
              observer.next(allArtists);
              observer.complete();
            }
          },
          error: (err) => {
            observer.error(err);
          },
        });
      };

      fetchPage();
    });
  }

  // Check if user follows specific artists
  checkFollowingArtists(artistIds: string[]): Observable<any> {
    return this.http.get(`${this.baseUrl}/me/following/contains`, {
      headers: this.getAuthHeaders(),
      params: {
        type: 'artist',
        ids: artistIds.join(','),
      },
    });
  }

  // Follow an artist
  followArtist(artistId: string): Observable<any> {
    return this.http.put(`${this.baseUrl}/me/following`, null, {
      headers: this.getAuthHeaders(),
      params: {
        type: 'artist',
        ids: artistId,
      },
    });
  }

  // Unfollow an artist
  unfollowArtist(artistId: string): Observable<any> {
    return this.http.delete(`${this.baseUrl}/me/following`, {
      headers: this.getAuthHeaders(),
      params: {
        type: 'artist',
        ids: artistId,
      },
    });
  }

  // Get a user's public profile by ID
  getUserProfile(userId: string): Observable<any> {
    return this.http.get(`${this.baseUrl}/users/${userId}`, {
      headers: this.getAuthHeaders(),
    });
  }

  // Get another user's public playlists
  getUserPublicPlaylists(userId: string, limit: number = 1): Observable<any> {
    return this.http.get(`${this.baseUrl}/users/${userId}/playlists`, {
      headers: this.getAuthHeaders(),
      params: {
        limit: limit.toString(),
      },
    });
  }

  updateUserTableRefreshToken(): Observable<any> {
    this.refreshToken = this.AuthService.getRefreshToken();
    const url = `${this.xomifyApiUrl}/user/update`;
    // Caller email comes from JWT context on the backend (1i). `userId` and
    // `refreshToken` are token-persistence fields — these stay.
    const body = {
      userId: this.id,
      displayName: this.user.display_name || this.user.email,
      refreshToken: this.refreshToken,
      avatar: this.getProfilePic(),
    };
    return this.http.post(url, body);
  }

  updateUserTableEnrollments(
    wrappedEnrolled: boolean,
    releaseRadarEnrolled: boolean,
  ): Observable<any> {
    this.refreshToken = this.AuthService.getRefreshToken();
    const url = `${this.xomifyApiUrl}/user/update`;
    // Caller email comes from JWT context on the backend (1i).
    const body = {
      wrappedEnrolled: wrappedEnrolled,
      releaseRadarEnrolled: releaseRadarEnrolled,
    };
    return this.http.post(url, body);
  }

  // The `email` arg is retained for call-site compatibility but is no longer
  // forwarded to the backend — caller identity is sourced from the JWT (1i).
  getUserTableData(_email: string): Observable<any> {
    const url = `${this.xomifyApiUrl}/user/data`;
    return this.http.get(url);
  }

  setUser(data: Record<string, unknown>): void {
    this.userName = (data['display_name'] as string) || '';
    this.id = (data['id'] as string) || '';
    this.user = data;
  }

  getUser(): any {
    return this.user;
  }

  getProfilePic(): string {
    if (this.user?.images && this.user.images.length > 0) {
      // Get the largest image available
      return this.user.images[0].url;
    }
    return '';
  }

  getUserName(): string {
    return this.userName;
  }

  getEmail(): string {
    return this.user?.email || '';
  }

  getFollowers(): number {
    return this.user?.followers?.total || 0;
  }

  getAccessToken(): string {
    return this.accessToken;
  }

  getRefreshToken(): string {
    return this.refreshToken;
  }

  getUserId(): string {
    return this.id;
  }

  getWrappedEnrollment(): boolean {
    return this.activeWrapped;
  }

  getReleaseRadarEnrollment(): boolean {
    return this.activeReleaseRadar;
  }

  setWrappedEnrollment(enrolled: boolean): void {
    this.activeWrapped = enrolled;
  }

  setReleaseRadarEnrollment(enrolled: boolean): void {
    this.activeReleaseRadar = enrolled;
  }

  setPlaylistCount(count: number): void {
    this.playlistCount = count;
  }

  getPlaylistCount(): number {
    return this.playlistCount;
  }

  setFollowingCount(count: number): void {
    this.followingCount = count;
  }

  getFollowingCount(): number {
    return this.followingCount;
  }

  getLikesCount(): number {
    return this.likesCount;
  }

  setLikesCount(count: number): void {
    this.likesCount = count;
  }

  getLikesPublic(): boolean {
    return this.likesPublic;
  }

  setLikesPublic(value: boolean): void {
    this.likesPublic = value;
  }
}
