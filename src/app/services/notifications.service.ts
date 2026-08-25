import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { environment } from 'src/environments/environment';

// ============================================
// Types — shapes match deployed handlers:
//   notifications_register   (POST /notifications/register)
//   notifications_unregister (POST /notifications/unregister)
//
//   notifications_feed         (GET  /notifications/feed)
//   notifications_read         (POST /notifications/read)
//   notifications_unread_count (GET  /notifications/unread-count)
//
// PUSH PREFERENCES ARE NOT MANAGEABLE FROM HERE, and that is not an omission.
// The per-kind opt-in flags live on the DEVICE-TOKEN row, and the web app has
// no device token — it has no APNs registration at all. Editing a phone's
// preferences from the browser would need a `GET /notifications/devices`
// endpoint to enumerate the user's devices first; that does not exist.
//
// What web DOES own is the inbox: it is keyed by email, not by device, which
// is precisely why the backend writes inbox rows independently of whether a
// push was deliverable. Without that, every web user would have a permanently
// empty inbox.
// ============================================

export type DevicePlatform = 'ios' | 'android' | 'web';

export interface RegisterDeviceResponse {
  ok: true;
  deviceToken: string;
}

export interface UnregisterDeviceResponse {
  ok: true;
  deviceToken: string;
}

/** One row of the inbox. Mirrors the `xomify-notifications` table. */
export interface InboxNotification {
  /** Sort key — "<iso8601>#<rand8>". Also the id used to mark one read. */
  tsId: string;
  kind: string;
  title: string;
  body: string;
  /** Deep-link route, e.g. "share:<id>". Absent for informational kinds. */
  route?: string;
  actorEmail?: string;
  actorName?: string;
  imageUrl?: string;
  read: boolean;
  createdAt: string;
}

export interface InboxPage {
  items: InboxNotification[];
  /** Null on the last page. Feed it back as `cursor` to continue. */
  nextCursor: string | null;
}

@Injectable({
  providedIn: 'root',
})
export class NotificationsService {
  private xomifyApiUrl = `https://${environment.apiId}.execute-api.us-east-1.amazonaws.com/dev`;
  // Authorization for Xomify API calls is attached by AuthInterceptor (sub-feature 0e).

  /**
   * Unread count for the toolbar badge.
   *
   * A BehaviorSubject rather than a per-consumer request: the toolbar is
   * always mounted, and the inbox needs to push the count down the moment
   * something is marked read rather than waiting for the next poll.
   */
  private readonly unreadSubject = new BehaviorSubject<number>(0);
  readonly unread$ = this.unreadSubject.asObservable();

  constructor(private http: HttpClient) {}

  // ── Inbox ──────────────────────────────────────────────────────────

  /** GET /notifications/feed — one page, newest first. */
  getFeed(limit = 25, cursor?: string | null): Observable<InboxPage> {
    // HttpParams rather than string concatenation: the cursor is a `tsId`,
    // which contains a '#'. Interpolated raw that terminates the query string
    // and the cursor silently vanishes — the client would then re-request
    // page one forever.
    let params = new HttpParams().set('limit', String(limit));
    if (cursor) params = params.set('cursor', cursor);

    const url = `${this.xomifyApiUrl}/notifications/feed`;
    return this.http.get<{ data?: InboxPage } & Partial<InboxPage>>(url, { params }).pipe(
      // Handlers wrap payloads in `data`, but not every deployed version does.
      // Tolerating both shapes here beats a runtime shape error in the UI.
      map((response) => {
        const page = (response?.data ?? response) as InboxPage;
        return {
          items: page?.items ?? [],
          nextCursor: page?.nextCursor ?? null,
        };
      }),
    );
  }

  /** POST /notifications/read — one item, or every unread item. */
  markRead(tsId: string): Observable<unknown> {
    return this.http
      .post(`${this.xomifyApiUrl}/notifications/read`, { tsId })
      .pipe(tap(() => this.adjustUnread(-1)));
  }

  markAllRead(): Observable<unknown> {
    return this.http
      .post(`${this.xomifyApiUrl}/notifications/read`, { all: true })
      .pipe(tap(() => this.unreadSubject.next(0)));
  }

  /**
   * GET /notifications/unread-count — refreshes the badge.
   *
   * Swallows failures and holds the previous count. A transient 500 should not
   * blank a badge the user was relying on, and there is nothing useful to tell
   * them about it either.
   */
  refreshUnreadCount(): Observable<number> {
    return this.http
      .get<{ data?: { unread: number }; unread?: number }>(
        `${this.xomifyApiUrl}/notifications/unread-count`,
      )
      .pipe(
        map((response) => response?.data?.unread ?? response?.unread ?? 0),
        tap((count) => this.unreadSubject.next(count)),
        catchError(() => of(this.unreadSubject.value)),
      );
  }

  /** Local badge adjustment, so marking one read is instant. */
  private adjustUnread(delta: number): void {
    this.unreadSubject.next(Math.max(0, this.unreadSubject.value + delta));
  }

  /** POST /notifications/register — opt a device into push.
   *  The `email` arg is retained for call-site compatibility but is no longer
   *  forwarded — caller identity comes from the JWT context (1f).
   *  `deviceToken` is the target identifier of the device being registered. */
  registerDevice(
    _email: string,
    deviceToken: string,
    platform: DevicePlatform = 'ios',
  ): Observable<RegisterDeviceResponse> {
    const url = `${this.xomifyApiUrl}/notifications/register`;
    return this.http.post<RegisterDeviceResponse>(url, {
      deviceToken,
      platform,
    });
  }

  /** POST /notifications/unregister — stop push to a specific device token.
   *  The `email` arg is retained for call-site compatibility but is no longer
   *  forwarded — caller identity comes from the JWT context (1f). */
  unregisterDevice(
    _email: string,
    deviceToken: string,
  ): Observable<UnregisterDeviceResponse> {
    const url = `${this.xomifyApiUrl}/notifications/unregister`;
    return this.http.post<UnregisterDeviceResponse>(url, {
      deviceToken,
    });
  }
}
