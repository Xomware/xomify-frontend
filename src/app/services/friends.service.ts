import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import { environment } from 'src/environments/environment';

export interface Friend {
  email: string;
  friendEmail?: string; // Used in pending/requested responses
  displayName?: string;
  avatar?: string;
  addedAt?: string;
  createdAt?: string;
  status?: string;
  direction?: string;
  mutualCount?: number;
}

// API response for GET /friends/list
export interface FriendsListResponse {
  email: string;
  totalCount: number;
  accepted: Friend[];
  requested: Friend[]; // outgoing requests
  pending: Friend[]; // incoming requests
  blocked: Friend[];
  acceptedCount: number;
  requestedCount: number;
  pendingCount: number;
  blockedCount: number;
}

export interface FriendProfile {
  email: string;
  displayName?: string;
  userId?: string;
  avatar?: string;
  followersCount?: number;
  followingCount?: number;
  playlistCount?: number;
  friendsCount?: number;
  likesCount?: number;
  likesUpdatedAt?: string;
  topSongs?: {
    short_term?: any[];
    medium_term?: any[];
    long_term?: any[];
  };
  topArtists?: {
    short_term?: any[];
    medium_term?: any[];
    long_term?: any[];
  };
  topGenres?: {
    short_term?: any[];
    medium_term?: any[];
    long_term?: any[];
  };
  playlists?: any[];
}

export interface SearchResult {
  email: string;
  displayName?: string;
  avatar?: string;
  isFriend: boolean;
  isPending: boolean;
  isOutgoingRequest?: boolean; // true if you sent them a request
  isIncomingRequest?: boolean; // true if they sent you a request
  mutualCount?: number;
}

@Injectable({
  providedIn: 'root',
})
export class FriendsService {
  private xomifyApiUrl = `https://${environment.apiId}.execute-api.us-east-1.amazonaws.com/dev`;
  // Authorization for Xomify API calls is attached by AuthInterceptor (sub-feature 0e).

  // Cache subjects
  private friendsListSubject = new BehaviorSubject<FriendsListResponse | null>(
    null,
  );
  private incomingCountSubject = new BehaviorSubject<number>(0);

  friendsList$ = this.friendsListSubject.asObservable();
  incomingCount$ = this.incomingCountSubject.asObservable();

  // Cache settings
  private readonly CACHE_KEY_FRIENDS_PREFIX = 'xomify_friends_list_'; // Now includes email
  private readonly CACHE_KEY_USERS = 'xomify_all_users';
  private readonly CACHE_KEY_PROFILE_PREFIX = 'xomify_friend_profile_';
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  private readonly PROFILE_CACHE_TTL = 10 * 60 * 1000; // 10 minutes for profiles

  // Track the current user's email for cache management
  private currentUserEmail: string | null = null;

  constructor(private http: HttpClient) {
    // Don't auto-load cache - wait until we know which user
  }

  // Load cached data for a specific user
  private loadFromCache(email: string): void {
    const cacheKey = this.CACHE_KEY_FRIENDS_PREFIX + email;
    const friendsCache = this.getCache(cacheKey);
    if (friendsCache) {
      this.friendsListSubject.next(friendsCache);
      this.incomingCountSubject.next(friendsCache.pendingCount || 0);
    }
  }

  private getCache(key: string): any | null {
    try {
      const cached = localStorage.getItem(key);
      if (!cached) return null;

      const data = JSON.parse(cached);
      const now = Date.now();

      if (now - data.timestamp > this.CACHE_TTL) {
        localStorage.removeItem(key);
        return null;
      }

      return data.items;
    } catch {
      return null;
    }
  }

  private setCache(key: string, items: any): void {
    try {
      localStorage.setItem(
        key,
        JSON.stringify({
          items,
          timestamp: Date.now(),
        }),
      );
    } catch {
      console.warn(`Failed to cache ${key}`);
    }
  }

  clearCache(email?: string): void {
    // Clear specific user's friends cache if email provided
    if (email) {
      localStorage.removeItem(this.CACHE_KEY_FRIENDS_PREFIX + email);
    }
    // Also clear current user's cache if we know who they are
    if (this.currentUserEmail) {
      localStorage.removeItem(this.CACHE_KEY_FRIENDS_PREFIX + this.currentUserEmail);
    }
    localStorage.removeItem(this.CACHE_KEY_USERS);
    this.friendsListSubject.next(null);
  }

  // GET /user/all
  // Returns: [{ email, displayName, avatar, isFriend, isPending, mutualCount }]
  // The `email` arg is retained for call-site compatibility but is no longer
  // forwarded — caller identity comes from the JWT context (1i). Uses cache
  // if available and not expired.
  getAllUsers(_email: string, forceRefresh = false): Observable<SearchResult[]> {
    // Return cached data if available and not forcing refresh
    if (!forceRefresh) {
      const cached = this.getCache(this.CACHE_KEY_USERS);
      if (cached) {
        return of(cached);
      }
    }

    const url = `${this.xomifyApiUrl}/user/all`;
    return this.http.get<SearchResult[]>(url).pipe(
      tap((users) => {
        this.setCache(this.CACHE_KEY_USERS, users);
      }),
    );
  }

  // GET /friends/list
  // Returns: { accepted, requested, pending, blocked, counts... }
  // Uses cache if available and not expired.
  // IMPORTANT: Cache is now per-email to avoid mixing user data — the `email`
  // arg is retained both for cache-key partitioning AND call-site
  // compatibility, but is NOT forwarded to the backend. Caller identity comes
  // from the JWT context (1a).
  getFriendsList(email: string, forceRefresh = false): Observable<FriendsListResponse> {
    const cacheKey = this.CACHE_KEY_FRIENDS_PREFIX + email;

    // Return cached data if available and not forcing refresh
    if (!forceRefresh) {
      const cached = this.getCache(cacheKey);
      if (cached) {
        // Only update subjects if this is the current user's data
        if (email === this.currentUserEmail) {
          this.friendsListSubject.next(cached);
          this.incomingCountSubject.next(cached.pendingCount || 0);
        }
        return of(cached);
      }
    }

    const url = `${this.xomifyApiUrl}/friends/list`;
    return this.http
      .get<FriendsListResponse>(url)
      .pipe(
        tap((response) => {
          // Only update subjects if this is the current user's data
          if (email === this.currentUserEmail || !this.currentUserEmail) {
            this.friendsListSubject.next(response);
            this.incomingCountSubject.next(response.pendingCount || 0);
          }
          this.setCache(cacheKey, response);
        }),
      );
  }

  // Set the current user email (call this on app init/login)
  setCurrentUserEmail(email: string): void {
    this.currentUserEmail = email;
    this.loadFromCache(email);
  }

  // POST /friends/request
  // Body: { "requestEmail": "friend@email.com" }
  // The `email` arg is retained for call-site compatibility but is no longer
  // forwarded — caller identity comes from the JWT context (1a).
  // `requestEmail` (target) stays.
  sendFriendRequest(_email: string, requestEmail: string): Observable<any> {
    const url = `${this.xomifyApiUrl}/friends/request`;
    const body = { requestEmail };
    return this.http
      .post(url, body)
      .pipe(tap(() => this.clearCache()));
  }

  // POST /friends/accept
  // Body: { "requestEmail": "requester@email.com" }
  // The `email` arg is retained for call-site compatibility but is no longer
  // forwarded — caller identity comes from the JWT context (1a).
  // `requestEmail` (target — the original requester) stays.
  acceptFriendRequest(_email: string, requestEmail: string): Observable<any> {
    const url = `${this.xomifyApiUrl}/friends/accept`;
    const body = { requestEmail };
    return this.http
      .post(url, body)
      .pipe(tap(() => this.clearCache()));
  }

  // POST /friends/reject
  // Body: { "requestEmail": "requester@email.com" }
  // The `email` arg is retained for call-site compatibility but is no longer
  // forwarded — caller identity comes from the JWT context (1a).
  // `requestEmail` (target) stays.
  rejectFriendRequest(_email: string, requestEmail: string): Observable<any> {
    const url = `${this.xomifyApiUrl}/friends/reject`;
    const body = { requestEmail };
    return this.http
      .post(url, body)
      .pipe(tap(() => this.clearCache()));
  }

  // DELETE /friends/remove
  // The `email` arg is retained for call-site compatibility but is no longer
  // forwarded — caller identity comes from the JWT context (1a).
  // `friendEmail` (target) stays.
  removeFriend(_email: string, friendEmail: string): Observable<any> {
    const url = `${this.xomifyApiUrl}/friends/remove`;
    return this.http
      .delete(url, {
        params: {
          friendEmail: friendEmail,
        },
      })
      .pipe(tap(() => this.clearCache()));
  }

  // GET /friends/profile?friendEmail={friendEmail}
  // Returns: { displayName, email, userId, topSongs, topArtists, topGenres }
  // Uses cache if available and not expired
  getFriendProfile(friendEmail: string, forceRefresh = false): Observable<FriendProfile> {
    const cacheKey = this.CACHE_KEY_PROFILE_PREFIX + friendEmail;

    // Return cached data if available and not forcing refresh
    if (!forceRefresh) {
      const cached = this.getProfileCache(cacheKey);
      if (cached) {
        return of(cached);
      }
    }

    const url = `${this.xomifyApiUrl}/friends/profile?friendEmail=${encodeURIComponent(friendEmail)}`;
    return this.http.get<FriendProfile>(url).pipe(
      tap((profile) => {
        this.setProfileCache(cacheKey, profile);
      })
    );
  }

  private getProfileCache(key: string): FriendProfile | null {
    try {
      const cached = localStorage.getItem(key);
      if (!cached) return null;

      const data = JSON.parse(cached);
      const now = Date.now();

      if (now - data.timestamp > this.PROFILE_CACHE_TTL) {
        localStorage.removeItem(key);
        return null;
      }

      return data.profile;
    } catch {
      return null;
    }
  }

  private setProfileCache(key: string, profile: FriendProfile): void {
    try {
      localStorage.setItem(
        key,
        JSON.stringify({
          profile,
          timestamp: Date.now(),
        })
      );
    } catch {
      console.warn(`Failed to cache friend profile`);
    }
  }

  // Clear a specific friend's profile cache
  clearFriendProfileCache(friendEmail: string): void {
    const cacheKey = this.CACHE_KEY_PROFILE_PREFIX + friendEmail;
    localStorage.removeItem(cacheKey);
  }

  // Helper to get cached friends list
  getCachedFriendsList(): FriendsListResponse | null {
    return this.friendsListSubject.getValue();
  }

  // Get incoming requests count for badge
  getIncomingCount(): number {
    return this.incomingCountSubject.getValue();
  }
}
