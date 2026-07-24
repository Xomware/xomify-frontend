import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map, shareReplay } from 'rxjs/operators';
import { environment } from 'src/environments/environment';
import { XtMeResponse } from '../models/xomtracks-admin.model';

interface XtApiEnvelope<T> {
  data: T;
  error: { message: string; status: number } | null;
  meta: Record<string, unknown>;
}

/**
 * `GET /me/get` — the caller's own phone-link state, Spotify-connection
 * flag, and (WS6) the server-authoritative `isAdmin` flag. The Admin Portal
 * route guard and the toolbar's "Admin" nav entry both read `isAdmin` from
 * here rather than decoding the JWT client-side — the backend is the source
 * of truth (`lambdas/common/utility_helpers.py::is_admin`).
 *
 * The response is cached for the lifetime of the app (`shareReplay(1)`) since
 * admin status never changes within a session; call `refresh()` after a
 * re-login to bust it.
 */
@Injectable({ providedIn: 'root' })
export class XomtracksMeService {
  private readonly url = `${environment.xomtracksApiUrl}/me/get`;
  private cached$: Observable<XtMeResponse> | null = null;

  constructor(private http: HttpClient) {}

  /** The caller's `/me/get` record, cached after the first successful load. */
  get(): Observable<XtMeResponse> {
    if (!this.cached$) {
      this.cached$ = this.http.get<XtApiEnvelope<XtMeResponse>>(this.url).pipe(
        map((res) => res.data),
        shareReplay({ bufferSize: 1, refCount: false }),
      );
    }
    return this.cached$;
  }

  /** Drops the cached response so the next `get()` re-fetches (e.g. after login/logout). */
  refresh(): void {
    this.cached$ = null;
  }
}
