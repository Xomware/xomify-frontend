import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, from } from 'rxjs';
import { concatMap, toArray } from 'rxjs/operators';
import { environment } from 'src/environments/environment';

// ============================================
// Models
// ============================================

export interface LikePushItem {
  trackId: string;
  addedAt: string;
  trackName?: string;
  artistName?: string;
  albumName?: string;
  albumArtUrl?: string;
  trackUri?: string;
}

export interface LikesTrackDisplayItem {
  trackId: string;
  addedAt: string;
  trackName?: string;
  artistName?: string;
  albumName?: string;
  albumArtUrl?: string;
  trackUri?: string;
}

export interface LikesByUserResponse {
  tracks: LikesTrackDisplayItem[];
  total: number;
  cursor?: string | null;
}

// AWS Managed WAF rules' default `SizeRestrictions_BODY` rejects request
// bodies > 8 KB with a 403 ForbiddenException — measured before the lambda
// is even invoked. 100 tracks per batch was hitting that ceiling on /likes/push.
// 25 keeps the body well under 8 KB while still amortizing round-trip cost.
const BATCH_SIZE = 25;

@Injectable({
  providedIn: 'root',
})
export class LikesService {
  private readonly apiUrl = environment.xomifyApiUrl;

  constructor(private http: HttpClient) {}

  /**
   * Push liked tracks to the backend. Splits into batches of 100 and sends
   * sequentially so we don't hammer the API with huge payloads.
   */
  pushUserLikes(tracks: LikePushItem[]): Observable<void[]> {
    const batches: LikePushItem[][] = [];
    for (let i = 0; i < tracks.length; i += BATCH_SIZE) {
      batches.push(tracks.slice(i, i + BATCH_SIZE));
    }
    if (batches.length === 0) {
      return from([[]]);
    }
    return from(batches).pipe(
      concatMap((batch) =>
        this.http.post<void>(`${this.apiUrl}/likes/push`, { tracks: batch }),
      ),
      toArray(),
    );
  }

  /**
   * Fetch paginated liked tracks for a given user email.
   * Subject to that user's `likesPublic` privacy flag (backend enforces).
   */
  getLikesByUser(
    email: string,
    opts: { limit?: number; cursor?: string; q?: string } = {},
  ): Observable<LikesByUserResponse> {
    let params = new HttpParams().set('email', email);
    if (opts.limit != null) {
      params = params.set('limit', String(opts.limit));
    }
    if (opts.cursor) {
      params = params.set('cursor', opts.cursor);
    }
    if (opts.q) {
      params = params.set('q', opts.q);
    }
    return this.http.get<LikesByUserResponse>(`${this.apiUrl}/likes/by-user`, {
      params,
    });
  }

  /**
   * Update the calling user's likes-public privacy flag.
   * Caller identity is sourced from JWT context on the backend.
   */
  setLikesPublic(isPublic: boolean): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/users/likes-public`, {
      public: isPublic,
    });
  }
}
