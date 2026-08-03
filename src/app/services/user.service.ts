// user.service.ts
import { Injectable, OnInit } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, of, forkJoin, throwError } from 'rxjs';
import { catchError, map, shareReplay, switchMap, tap } from 'rxjs/operators';
import { AuthService } from './auth.service';
import { ImpersonationService } from './impersonation.service';
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
  // True only once the Xomify enrollment row has actually been fetched.
  // `user?.email` alone proves the Spotify profile loaded, NOT the enrollment
  // row — gating on it made enrolled users see "not enrolled" (issue: flaky
  // opt-in). ensureLoaded() gates on this flag instead.
  private enrollmentLoaded = false;
  private bootstrap$: Observable<void> | null = null;
  private baseUrl = 'https://api.spotify.com/v1';
  private xomifyApiUrl: string = `https://${environment.apiId}.execute-api.us-east-1.amazonaws.com/dev`;
  // Authorization for Xomify API calls is attached by AuthInterceptor (sub-feature 0e).

  constructor(
    private http: HttpClient,
    private AuthService: AuthService,
    private impersonation: ImpersonationService,
  ) {
    // Every transition in/out of impersonation (or between two different
    // targets) means `getUserData()`'s next call must hit `/me` again with
    // the newly-swapped Spotify token (see AuthInterceptor) — otherwise the
    // "Welcome, <name>" greeting and enrollment flags would keep showing
    // whichever profile was cached before the switch, since `ensureLoaded()`
    // otherwise short-circuits on an already-populated cache.
    this.impersonation.impersonatedEmail$.subscribe(() => {
      this.resetProfileCache();
    });
  }

  ngOnInit() {
    this.accessToken = this.AuthService.getAccessToken();
    this.refreshToken = this.AuthService.getRefreshToken();
  }

  /** See constructor — clears the in-memory Spotify-profile/enrollment cache
   * so the next `ensureLoaded()` call re-fetches instead of replaying stale
   * data across an impersonation enter/exit. */
  private resetProfileCache(): void {
    this.enrollmentLoaded = false;
    this.bootstrap$ = null;
    this.userName = '';
    this.user = undefined;
    this.id = '';
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
    // Gate on the ENROLLMENT row, not the Spotify profile. A populated
    // `user.email` only proves the Spotify /me call succeeded; the enrollment
    // flags may still be at their default `false`. Early-returning here was
    // the root cause of enrolled users seeing "not enrolled."
    if (this.enrollmentLoaded) {
      return of(void 0);
    }
    if (!this.bootstrap$) {
      this.bootstrap$ = this.getUserData().pipe(
        tap((data) => this.setUser(data)),
        switchMap((data: any) => {
          const email = data?.email;
          if (!email) {
            return throwError(
              () => new Error('Spotify profile returned no email'),
            );
          }
          return this.getUserTableData(email).pipe(
            tap((xomifyData: any) => this.applyEnrollmentRow(xomifyData)),
            map(() => void 0),
            catchError((err: any) => {
              // A brand-new user has no Xomify row yet (404). That is a
              // legitimate "not enrolled" state, not a failure — apply
              // defaults and mark loaded.
              if (err?.status === 404) {
                this.applyEnrollmentRow(null);
                return of(void 0);
              }
              // Any other error is a genuine load failure. Surface it (so the
              // page can show an error / retry) instead of silently defaulting
              // to `false`, and drop the shared pipeline so the next call
              // re-fetches rather than replaying the cached error.
              this.bootstrap$ = null;
              return throwError(() => err);
            }),
          );
        }),
        catchError((err: any) => {
          this.bootstrap$ = null;
          return throwError(() => err);
        }),
        shareReplay(1),
      );
    }
    return this.bootstrap$;
  }

  /**
   * Apply a fetched Xomify user row (or `null` for a brand-new user with no
   * row yet) to the in-memory enrollment/likes state and mark the enrollment
   * as authoritatively loaded.
   */
  private applyEnrollmentRow(xomifyData: any): void {
    this.activeWrapped = xomifyData?.activeWrapped ?? false;
    this.activeReleaseRadar = xomifyData?.activeReleaseRadar ?? false;
    this.likesCount =
      xomifyData?.likes_count ?? xomifyData?.likesCount ?? 0;
    this.likesPublic =
      xomifyData?.likes_public ?? xomifyData?.likesPublic ?? false;
    this.enrollmentLoaded = true;
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
    // NOTE: `email` is included as a safety fallback for the race condition
    // where the authorizer context isn't yet populated on the first call
    // after login (see #433).
    const body = {
      email: this.user.email,
      userId: this.id,
      displayName: this.user.display_name || this.user.email,
      refreshToken: this.refreshToken,
      avatar: this.getProfilePic(),
    };
    return this.http.post(url, body);
  }

  /**
   * Update ONLY the Monthly Wrapped enrollment flag. Sends a partial body so
   * the backend leaves the Release Radar flag untouched — this is the fix for
   * the double-flag clobber where toggling one enrollment overwrote the other
   * from possibly-stale in-memory state.
   */
  updateWrappedEnrollment(wrappedEnrolled: boolean): Observable<any> {
    const url = `${this.xomifyApiUrl}/user/update`;
    // Caller email comes from JWT context on the backend (1i).
    return this.http.post(url, { wrappedEnrolled });
  }

  /**
   * Update ONLY the Release Radar enrollment flag (partial body — leaves the
   * Wrapped flag untouched). See {@link updateWrappedEnrollment}.
   */
  updateReleaseRadarEnrollment(releaseRadarEnrolled: boolean): Observable<any> {
    const url = `${this.xomifyApiUrl}/user/update`;
    return this.http.post(url, { releaseRadarEnrolled });
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
