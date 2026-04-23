import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { environment } from 'src/environments/environment';

// ============================================
// Types — shapes match deployed backend handlers
// (invites_create, invites_accept, invites_pending, invites_decline).
// ============================================

export interface Invite {
  inviteCode: string;
  senderEmail: string;
  createdAt: string;
  expiresAt: string;
  consumedAt?: string;
  consumedBy?: string;
  inviteUrl?: string;
}

export interface PendingInvitesResponse {
  email: string;
  invites: Invite[];
  count: number;
}

export interface CreateInviteResponse {
  inviteCode: string;
  inviteUrl: string;
  expiresAt: string;
  createdAt: string;
}

export interface AcceptInviteResponse {
  ok: true;
  senderEmail: string;
  inviteCode: string;
}

export interface DeclineInviteResponse {
  ok: true;
  inviteCode: string;
  senderEmail: string;
}

@Injectable({
  providedIn: 'root',
})
export class InvitesService {
  private xomifyApiUrl = `https://${environment.apiId}.execute-api.us-east-1.amazonaws.com/dev`;
  private readonly apiAuthToken = environment.apiAuthToken;

  private pendingInvitesSubject = new BehaviorSubject<Invite[]>([]);
  pendingInvites$ = this.pendingInvitesSubject.asObservable();

  constructor(private http: HttpClient) {}

  private getHeaders(): HttpHeaders {
    return new HttpHeaders({
      Authorization: `Bearer ${this.apiAuthToken}`,
      'Content-Type': 'application/json',
    });
  }

  /** POST /invites/create — mint a new invite code for the caller. */
  createInvite(email: string): Observable<CreateInviteResponse> {
    const url = `${this.xomifyApiUrl}/invites/create`;
    return this.http
      .post<CreateInviteResponse>(url, { email }, { headers: this.getHeaders() })
      .pipe(
        tap((resp) => {
          // Optimistically prepend the new invite to the cache if it's populated.
          const current = this.pendingInvitesSubject.getValue();
          const invite: Invite = {
            inviteCode: resp.inviteCode,
            senderEmail: email,
            createdAt: resp.createdAt,
            expiresAt: resp.expiresAt,
            inviteUrl: resp.inviteUrl,
          };
          this.pendingInvitesSubject.next([invite, ...current]);
        }),
      );
  }

  /** POST /invites/accept — redeem an invite code, creating a friendship. */
  acceptInvite(
    email: string,
    inviteCode: string,
  ): Observable<AcceptInviteResponse> {
    const url = `${this.xomifyApiUrl}/invites/accept`;
    return this.http.post<AcceptInviteResponse>(
      url,
      { email, inviteCode },
      { headers: this.getHeaders() },
    );
  }

  /** GET /invites/pending — list outstanding invites minted by the caller. */
  listPending(email: string): Observable<PendingInvitesResponse> {
    const url = `${this.xomifyApiUrl}/invites/pending`;
    const params = new HttpParams().set('email', email);
    return this.http
      .get<PendingInvitesResponse>(url, {
        headers: this.getHeaders(),
        params,
      })
      .pipe(
        tap((resp) => {
          this.pendingInvitesSubject.next(resp.invites || []);
        }),
      );
  }

  /** POST /invites/decline — decline an invite you were handed (not your own). */
  declineInvite(
    email: string,
    inviteCode: string,
  ): Observable<DeclineInviteResponse> {
    const url = `${this.xomifyApiUrl}/invites/decline`;
    return this.http.post<DeclineInviteResponse>(
      url,
      { email, inviteCode },
      { headers: this.getHeaders() },
    );
  }

  /** Client-only removal from the in-memory cache. Backend has no revoke
   *  endpoint yet, so sender-side "revoke" is a local hide + 30-day expiry. */
  hideLocally(inviteCode: string): void {
    const current = this.pendingInvitesSubject.getValue();
    this.pendingInvitesSubject.next(
      current.filter((inv) => inv.inviteCode !== inviteCode),
    );
  }
}
