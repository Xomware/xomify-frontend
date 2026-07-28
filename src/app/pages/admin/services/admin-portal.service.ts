import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from 'src/environments/environment';
import {
  AdminCron,
  AdminHealthSummary,
  AdminNotification,
  AdminUser,
  AdminUserVisit,
  AdminViewAs,
} from '../models/admin-portal.model';

/**
 * Typed client for the Admin Portal observability endpoints — Health,
 * Users, Crons, Notifications. Every call is admin-gated server-side (403
 * for non-admins); `AdminGuard` is only the UI-side enforcement.
 *
 * Same defensive-unwrap pattern as `BroadcastsService`: every list-shaped
 * endpoint tolerates either a bare array or a wrapper object, since these
 * routes deploy on a separate backend workstream and the exact envelope can
 * drift before this PR merges.
 */
@Injectable({ providedIn: 'root' })
export class AdminPortalService {
  private readonly baseUrl = `${environment.xomifyApiUrl}/admin`;

  constructor(private http: HttpClient) {}

  /** GET /admin/health?windowHours= */
  health(windowHours: number): Observable<AdminHealthSummary> {
    const params = new HttpParams().set('windowHours', windowHours);
    return this.http.get<AdminHealthSummary>(`${this.baseUrl}/health`, { params });
  }

  /** GET /admin/users-list */
  usersList(): Observable<AdminUser[]> {
    return this.http
      .get<AdminUser[] | { users: AdminUser[] }>(`${this.baseUrl}/users-list`)
      .pipe(map((res) => (Array.isArray(res) ? res : res?.users ?? [])));
  }

  /** GET /admin/user-visits?email= */
  userVisits(email: string): Observable<AdminUserVisit[]> {
    const params = new HttpParams().set('email', email);
    return this.http
      .get<AdminUserVisit[] | { visits: AdminUserVisit[] }>(`${this.baseUrl}/user-visits`, { params })
      .pipe(map((res) => (Array.isArray(res) ? res : res?.visits ?? [])));
  }

  /** GET /admin/view-as?email= — read-only impersonation snapshot. */
  viewAs(email: string): Observable<AdminViewAs> {
    const params = new HttpParams().set('email', email);
    return this.http.get<AdminViewAs>(`${this.baseUrl}/view-as`, { params });
  }

  /** GET /admin/crons */
  crons(): Observable<AdminCron[]> {
    return this.http
      .get<AdminCron[] | { crons: AdminCron[] }>(`${this.baseUrl}/crons`)
      .pipe(map((res) => (Array.isArray(res) ? res : res?.crons ?? [])));
  }

  /** GET /admin/notifications?limit= */
  notifications(limit: number): Observable<AdminNotification[]> {
    const params = new HttpParams().set('limit', limit);
    return this.http
      .get<AdminNotification[] | { notifications: AdminNotification[] }>(`${this.baseUrl}/notifications`, { params })
      .pipe(map((res) => (Array.isArray(res) ? res : res?.notifications ?? [])));
  }
}
