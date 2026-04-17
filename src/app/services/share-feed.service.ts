import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';

export type ShareType = 'wrapped' | 'release_radar' | 'track' | 'playlist';
export type ReactionAction = 'like' | 'fire' | 'love' | 'none';

export interface InteractionCounts {
  [action: string]: number;
}

export interface Share {
  shareId: string;
  email: string;
  type: ShareType;
  payload: any;
  caption?: string;
  createdAt: string;
  interactionCounts: InteractionCounts;
}

export interface FeedResponse {
  email: string;
  totalCount: number;
  shares: Share[];
}

export interface CreateShareResponse {
  success: boolean;
  shareId: string;
}

export interface ReactResponse {
  success: boolean;
}

export interface CreateInviteResponse {
  success: boolean;
  inviteCode: string;
  shareUrl: string;
  expiresAt: string;
  status: string;
}

export interface AcceptInviteResponse {
  success: boolean;
  inviteCode: string;
  friendEmail: string;
}

@Injectable({
  providedIn: 'root',
})
export class ShareFeedService {
  private xomifyApiUrl = `https://${environment.apiId}.execute-api.us-east-1.amazonaws.com/dev`;
  private readonly apiAuthToken = environment.apiAuthToken;

  constructor(private http: HttpClient) {}

  private getHeaders(): HttpHeaders {
    return new HttpHeaders({
      Authorization: `Bearer ${this.apiAuthToken}`,
      'Content-Type': 'application/json',
    });
  }

  // POST /shares/create
  createShare(
    email: string,
    type: ShareType,
    payload: any,
    caption?: string,
  ): Observable<CreateShareResponse> {
    const url = `${this.xomifyApiUrl}/shares/create`;
    const body: { email: string; type: ShareType; payload: any; caption?: string } = {
      email,
      type,
      payload,
    };
    if (caption) {
      body.caption = caption;
    }
    return this.http.post<CreateShareResponse>(url, body, {
      headers: this.getHeaders(),
    });
  }

  // GET /shares/feed?email={email}
  getFeed(email: string): Observable<FeedResponse> {
    const url = `${this.xomifyApiUrl}/shares/feed?email=${encodeURIComponent(email)}`;
    return this.http.get<FeedResponse>(url, { headers: this.getHeaders() });
  }

  // POST /shares/react
  reactToShare(
    shareId: string,
    email: string,
    action: ReactionAction,
  ): Observable<ReactResponse> {
    const url = `${this.xomifyApiUrl}/shares/react`;
    const body = { shareId, email, action };
    return this.http.post<ReactResponse>(url, body, {
      headers: this.getHeaders(),
    });
  }

  // POST /invites/create
  createInvite(email: string): Observable<CreateInviteResponse> {
    const url = `${this.xomifyApiUrl}/invites/create`;
    const body = { email };
    return this.http.post<CreateInviteResponse>(url, body, {
      headers: this.getHeaders(),
    });
  }

  // POST /invites/accept
  acceptInvite(email: string, inviteCode: string): Observable<AcceptInviteResponse> {
    const url = `${this.xomifyApiUrl}/invites/accept`;
    const body = { email, inviteCode };
    return this.http.post<AcceptInviteResponse>(url, body, {
      headers: this.getHeaders(),
    });
  }
}
