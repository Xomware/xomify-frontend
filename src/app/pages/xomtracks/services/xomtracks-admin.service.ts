import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from 'src/environments/environment';
import { XtDirection, XtTimeWindow } from '../models/xomtracks-share.model';
import {
  XtAdminCallsSummary,
  XtAdminRevokeTokenResult,
  XtAdminRunsResponse,
  XtAdminTokensResponse,
  XtAdminUserFeedResponse,
  XtAdminUsersResponse,
} from '../models/xomtracks-admin.model';

interface XtApiEnvelope<T> {
  data: T;
  error: { message: string; status: number } | null;
  meta: Record<string, unknown>;
}

/**
 * Typed client for the Dom-only Admin Portal's five `/admin/*` calls. Every
 * endpoint is admin-gated server-side (`require_admin` — 401 unauthenticated,
 * 403 non-admin), so a non-admin caller never gets useful data even if this
 * service is somehow reached; the route guard (`XomtracksAdminGuard`) is the
 * UI-side enforcement, this is just the transport.
 */
@Injectable({ providedIn: 'root' })
export class XomtracksAdminService {
  private readonly baseUrl = `${environment.xomtracksApiUrl}/admin`;

  constructor(private http: HttpClient) {}

  /** GET /admin/users — the full user directory. */
  listUsers(): Observable<XtAdminUsersResponse> {
    return this.http
      .get<XtApiEnvelope<XtAdminUsersResponse>>(`${this.baseUrl}/users`)
      .pipe(map((res) => res.data));
  }

  /** GET /admin/user-feed — view-as (read-only): the target user's feed
   * exactly as they'd see it. 404s (surfaced as an HTTP error) when the
   * target isn't a known user. */
  userFeed(
    email: string,
    direction: XtDirection,
    window: XtTimeWindow,
  ): Observable<XtAdminUserFeedResponse> {
    const params = new HttpParams()
      .set('email', email.trim().toLowerCase())
      .set('direction', direction)
      .set('window', window);
    return this.http
      .get<XtApiEnvelope<XtAdminUserFeedResponse>>(`${this.baseUrl}/user-feed`, { params })
      .pipe(map((res) => res.data));
  }

  /** GET /admin/calls — the calls & errors dashboard over a trailing window. */
  calls(windowDays: number, recentLimit = 25): Observable<XtAdminCallsSummary> {
    const params = new HttpParams()
      .set('windowDays', String(windowDays))
      .set('recentLimit', String(recentLimit));
    return this.http
      .get<XtApiEnvelope<XtAdminCallsSummary>>(`${this.baseUrl}/calls`, { params })
      .pipe(map((res) => res.data));
  }

  /** GET /admin/tokens — every ingest token's metadata (never plaintext), grouped by owner. */
  listTokens(): Observable<XtAdminTokensResponse> {
    return this.http
      .get<XtApiEnvelope<XtAdminTokensResponse>>(`${this.baseUrl}/tokens`)
      .pipe(map((res) => res.data));
  }

  /** GET /admin/runs — recent extractor run summaries, grouped by owner. */
  listRuns(): Observable<XtAdminRunsResponse> {
    return this.http
      .get<XtApiEnvelope<XtAdminRunsResponse>>(`${this.baseUrl}/runs`)
      .pipe(map((res) => res.data));
  }

  /** POST /admin/revoke-token — admin override revoke of ANY user's ingest token by hash. */
  revokeToken(tokenHash: string): Observable<XtAdminRevokeTokenResult> {
    return this.http
      .post<XtApiEnvelope<XtAdminRevokeTokenResult>>(`${this.baseUrl}/revoke-token`, { tokenHash })
      .pipe(map((res) => res.data));
  }
}
