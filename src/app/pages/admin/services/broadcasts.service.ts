import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from 'src/environments/environment';
import {
  Broadcast,
  CreateBroadcastRequest,
  DeleteBroadcastResponse,
  ListBroadcastsResponse,
} from '../models/broadcast.model';

/**
 * Typed client for the admin Broadcasts CRUD surface
 * (`docs/features/xomify-favorites-home-admin/PLAN.md` WS-B /
 * WS-Backend). Every call is admin-gated server-side; `AdminGuard` is just
 * the UI-side enforcement, this is the transport.
 *
 * The backend ships flat, verb-suffixed routes — no `{id}` path params —
 * and `delete` takes `id` as a query param.
 */
@Injectable({ providedIn: 'root' })
export class BroadcastsService {
  private readonly baseUrl = `${environment.xomifyApiUrl}/admin`;

  constructor(private http: HttpClient) {}

  /** GET /admin/broadcasts-list — every broadcast, newest-first is the backend's job. */
  list(): Observable<Broadcast[]> {
    return this.http
      .get<ListBroadcastsResponse | Broadcast[]>(`${this.baseUrl}/broadcasts-list`)
      .pipe(map((res) => (Array.isArray(res) ? res : res?.broadcasts ?? [])));
  }

  /** POST /admin/broadcasts-create — create a new broadcast. */
  create(broadcast: CreateBroadcastRequest): Observable<Broadcast> {
    return this.http.post<Broadcast>(`${this.baseUrl}/broadcasts-create`, broadcast);
  }

  /** DELETE /admin/broadcasts-delete?id=... */
  delete(id: string): Observable<DeleteBroadcastResponse> {
    const params = new HttpParams().set('id', id);
    return this.http.delete<DeleteBroadcastResponse>(`${this.baseUrl}/broadcasts-delete`, { params });
  }
}
