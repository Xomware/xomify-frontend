import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';

import { environment } from '../../environments/environment';
import type { WrappedDataResponse } from './wrapped.service';

/**
 * Reads a friend's Wrapped, Release Radar and top items.
 *
 * The backend gates each on an accepted friendship AND the subject's
 * visibility flag, returning the SAME error for both — so a denial reveals
 * nothing about which of the two applied, and callers must not try to tell
 * them apart.
 *
 * See docs/features/friend-feed/PLAN.md in xomify-backend.
 */
@Injectable({ providedIn: 'root' })
export class FriendDataService {
  private readonly apiUrl = environment.xomifyApiUrl;

  constructor(private http: HttpClient) {}

  /** GET /friends/wrapped */
  getWrapped(email: string): Observable<WrappedDataResponse> {
    return this.http
      .get<{ email: string; wrapped: WrappedDataResponse }>(
        `${this.apiUrl}/friends/wrapped`,
        { params: new HttpParams().set('email', email) },
      )
      .pipe(map((response) => response.wrapped ?? ({ wraps: [] } as unknown as WrappedDataResponse)));
  }

  /** GET /friends/release-radar. Twelve weeks so the week picker still works. */
  getReleaseRadar(email: string, limit = 12): Observable<FriendReleaseRadar> {
    return this.http.get<FriendReleaseRadar>(`${this.apiUrl}/friends/release-radar`, {
      params: new HttpParams().set('email', email).set('limit', String(limit)),
    });
  }

  /**
   * GET /friends/top-items.
   *
   * Served from cache only. `cached: false` means the friend hasn't loaded
   * their own top items yet — a real, temporary state, not a refusal. The
   * backend never fetches Spotify on their behalf, because a friend looking at
   * your profile should not spend your API budget.
   */
  getTopItems(email: string): Observable<FriendTopItems> {
    return this.http.get<FriendTopItems>(`${this.apiUrl}/friends/top-items`, {
      params: new HttpParams().set('email', email),
    });
  }
}

export interface FriendReleaseRadar {
  email?: string;
  weeks?: unknown[];
}

export interface FriendTopItems {
  email?: string;
  cached?: boolean;
  tracks?: Record<string, unknown[]>;
  artists?: Record<string, unknown[]>;
  genres?: Record<string, Record<string, number>>;
}
