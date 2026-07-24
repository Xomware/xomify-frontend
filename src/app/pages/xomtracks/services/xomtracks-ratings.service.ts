import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from 'src/environments/environment';
import { XtRatedListResponse, XtRating } from '../models/xomtracks-share.model';

interface XtApiEnvelope<T> {
  data: T;
  error: { message: string; status: number } | null;
  meta: Record<string, unknown>;
}

/**
 * Whole-group ratings. ANY logged-in xomify user can rate a track; the
 * rating is keyed on the shared `trackKey`
 * (`utils/xomtracks-track-display.ts::xtTrackKey`) so every share of the
 * same song rolls into one aggregate.
 *
 * Backs `POST /ratings/set` with `{ trackKey, rating }` (1..5, whole
 * numbers — xomtracks-backend/lambdas/common/models.py::SetRatingRequest);
 * the enriched aggregate (`avg`, `count`, `myRating`) rides back on each
 * share via `GET /shares/list`.
 */
@Injectable({ providedIn: 'root' })
export class XomtracksRatingsService {
  private readonly baseUrl = `${environment.xomtracksApiUrl}/ratings`;

  constructor(private http: HttpClient) {}

  /** POST /ratings/set — set the caller's rating (1..5) for a track group.
   * Returns the updated whole-group aggregate for that track. */
  set(trackKey: string, rating: number): Observable<XtRating> {
    return this.http
      .post<XtApiEnvelope<{ trackKey: string; rating: XtRating }>>(`${this.baseUrl}/set`, {
        trackKey,
        rating,
      })
      .pipe(map((res) => res.data.rating));
  }

  /** GET /ratings/list — every track the caller has rated, across BOTH
   * share directions (the "My rated" feed source). */
  list(): Observable<XtRatedListResponse> {
    return this.http
      .get<XtApiEnvelope<XtRatedListResponse>>(`${this.baseUrl}/list`)
      .pipe(map((res) => res.data));
  }
}
