import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from 'src/environments/environment';
import { XtDirection, XtSharesListResponse, XtTimeWindow } from '../models/xomtracks-share.model';
import { unwrapEnvelope } from './xomtracks-envelope';

/**
 * The org-wide `{ data, error, meta }` envelope every xomtracks-backend
 * handler returns (utility_helpers.py::success_response).
 */
interface XtApiEnvelope<T> {
  data: T;
  error: { message: string; status: number } | null;
  meta: Record<string, unknown>;
}

/**
 * Reads the cross-conversation share feed. Maps to xomtracks-backend's
 * `shares_list` handler (`GET /shares/list?direction=&window=`). Authed —
 * the caller's xomify JWT is attached by `AuthInterceptor` (extended to
 * cover `environment.xomtracksApiUrl`).
 */
@Injectable({ providedIn: 'root' })
export class XomtracksSharesService {
  private readonly baseUrl = `${environment.xomtracksApiUrl}/shares`;

  constructor(private http: HttpClient) {}

  /** GET /shares/list — the shares for one direction within a time window,
   * newest-first (the backend sorts). */
  list(direction: XtDirection, window: XtTimeWindow): Observable<XtSharesListResponse> {
    const params = new HttpParams().set('direction', direction).set('window', window);
    return this.http
      .get<XtApiEnvelope<XtSharesListResponse>>(`${this.baseUrl}/list`, { params })
      .pipe(map((res) => unwrapEnvelope(res)));
  }
}
