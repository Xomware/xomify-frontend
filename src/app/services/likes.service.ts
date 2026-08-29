import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, from } from 'rxjs';
import { concatMap, map, toArray } from 'rxjs/operators';
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
  /** Derived locally — backend uses offset-based pagination, not a cursor token. */
  nextOffset?: number;
  hasMore?: boolean;
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
   * Push liked tracks to the backend. Splits into BATCH_SIZE batches and
   * sends sequentially so we don't hammer the API with huge payloads.
   *
   * Backend (`lambdas/likes_push/handler.py`) requires `email`, `total`,
   * AND `tracks` on every batch — `email` must match the caller for an
   * authorization check, `total` is the user's full-library size used for
   * the throttle decision and to populate `likes_count` in DynamoDB.
   * Sending only `tracks` was failing every batch with 400, which left
   * `likes_count` permanently 0 for every web user (and made
   * /likes/by-user return empty for any friend who only used the web).
   */
  pushUserLikes(tracks: LikePushItem[]): Observable<void[]> {
    const total = tracks.length;
    const batches: LikePushItem[][] = [];
    for (let i = 0; i < tracks.length; i += BATCH_SIZE) {
      batches.push(tracks.slice(i, i + BATCH_SIZE));
    }
    if (batches.length === 0) {
      return from([[]]);
    }
    return from(batches).pipe(
      concatMap((batch) =>
        this.http.post<void>(`${this.apiUrl}/likes/push`, {
          total,
          tracks: batch,
        }),
      ),
      toArray(),
    );
  }

  /**
   * Fetch paginated liked tracks for a given user.
   * Subject to that user's `likesPublic` privacy flag (backend enforces).
   *
   * Backend contract (lambdas/likes_by_user/handler.py): query params are
   * `targetEmail` (required) + `limit` + `offset` (int). `q`/search is
   * client-side only on iOS; this service drops the query and the page
   * filters locally (mirroring iOS LikesViewModel.filteredItems).
   */
  getLikesByUser(
    targetEmail: string,
    opts: { limit?: number; offset?: number } = {},
  ): Observable<LikesByUserResponse> {
    const limit = opts.limit ?? 30;
    const offset = opts.offset ?? 0;
    const params = new HttpParams()
      .set('targetEmail', targetEmail)
      .set('limit', String(limit))
      .set('offset', String(offset));
    return this.http
      .get<LikesByUserResponse>(`${this.apiUrl}/likes/by-user`, { params })
      .pipe(
        map((resp) => {
          const itemsSoFar = offset + (resp.tracks?.length ?? 0);
          return {
            ...resp,
            nextOffset: itemsSoFar,
            hasMore: itemsSoFar < (resp.total ?? 0),
          };
        }),
      );
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
