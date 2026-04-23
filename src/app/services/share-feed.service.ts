import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';

// ============================================
// Types — canonical shapes match the deployed
// backend (see xomify-backend/lambdas/shares_*).
// ============================================

export type MoodTag =
  | 'hype'
  | 'chill'
  | 'sad'
  | 'party'
  | 'focus'
  | 'discovery';

export type ReactionAction = 'queued' | 'rated' | 'unqueued' | 'unrated';

/** A denormalized track share. Backend emits this shape from
 *  shares_create, shares_feed, and shares_user. */
export interface Share {
  shareId: string;
  /** Author email — the `sharedBy` in the epic doc is `email` on the wire. */
  email: string;
  trackId: string;
  trackUri: string;
  trackName: string;
  artistName: string;
  albumName: string;
  albumArtUrl: string;
  caption?: string;
  moodTag?: MoodTag;
  genreTags?: string[];
  createdAt: string;
  sharedAt?: string;

  // Enrichment fields (present on feed responses, may be absent on create response)
  queuedCount?: number;
  ratedCount?: number;
  viewerHasQueued?: boolean;
  viewerRating?: number | null;
  sharerRating?: number | null;
}

export interface FeedResponse {
  shares: Share[];
  nextBefore: string | null;
}

export interface FeedQueryOptions {
  groupId?: string;
  limit?: number;
  before?: string;
}

export interface CreateShareRequest {
  trackId: string;
  trackUri: string;
  trackName: string;
  artistName: string;
  albumName: string;
  albumArtUrl: string;
  caption?: string;
  moodTag?: MoodTag;
  genreTags?: string[];
}

export interface CreateShareResponse {
  shareId: string;
  email: string;
  trackId: string;
  trackUri: string;
  trackName: string;
  artistName: string;
  albumName: string;
  albumArtUrl: string;
  caption?: string;
  moodTag?: MoodTag;
  genreTags?: string[];
  createdAt: string;
  sharedAt?: string;
}

export interface ReactRequest {
  shareId: string;
  action: ReactionAction;
  rating?: number;
}

/** Enrichment echoed back by /shares/react. */
export interface ReactResponse {
  queuedCount: number;
  ratedCount: number;
  viewerHasQueued: boolean;
  viewerRating: number | null;
  sharerRating: number | null;
}

// ============================================
// Service
// ============================================

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

  /**
   * POST /shares/create
   * Create a new track share. Caller provides denormalized track metadata and
   * optional caption / mood / genre tags (validated server-side).
   */
  createShare(
    email: string,
    track: CreateShareRequest,
  ): Observable<CreateShareResponse> {
    const url = `${this.xomifyApiUrl}/shares/create`;
    const body: Record<string, unknown> = {
      email,
      trackId: track.trackId,
      trackUri: track.trackUri,
      trackName: track.trackName,
      artistName: track.artistName,
      albumName: track.albumName,
      albumArtUrl: track.albumArtUrl,
    };
    if (track.caption !== undefined && track.caption !== '') {
      body['caption'] = track.caption;
    }
    if (track.moodTag) {
      body['moodTag'] = track.moodTag;
    }
    if (track.genreTags && track.genreTags.length > 0) {
      body['genreTags'] = track.genreTags;
    }
    return this.http.post<CreateShareResponse>(url, body, {
      headers: this.getHeaders(),
    });
  }

  /**
   * GET /shares/feed?email=...&groupId=...&limit=...&before=...
   * Returns the merged feed (self + accepted friends), newest first.
   */
  getFeed(email: string, opts: FeedQueryOptions = {}): Observable<FeedResponse> {
    const url = `${this.xomifyApiUrl}/shares/feed`;
    let params = new HttpParams().set('email', email);
    if (opts.groupId) {
      params = params.set('groupId', opts.groupId);
    }
    if (opts.limit !== undefined) {
      params = params.set('limit', String(opts.limit));
    }
    if (opts.before) {
      params = params.set('before', opts.before);
    }
    return this.http.get<FeedResponse>(url, {
      headers: this.getHeaders(),
      params,
    });
  }

  /**
   * POST /shares/react
   * Queue / un-queue a share, or set / clear a rating. `rating` is required
   * when `action === 'rated'` (1..5).
   */
  reactToShare(
    email: string,
    shareId: string,
    action: ReactionAction,
    rating?: number,
  ): Observable<ReactResponse> {
    const url = `${this.xomifyApiUrl}/shares/react`;
    const body: Record<string, unknown> = { email, shareId, action };
    if (action === 'rated' && rating !== undefined) {
      body['rating'] = rating;
    }
    return this.http.post<ReactResponse>(url, body, {
      headers: this.getHeaders(),
    });
  }
}
