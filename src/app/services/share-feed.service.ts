import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
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

/**
 * Six fixed emoji slugs supported by `/shares/reactions-toggle`. Mirrors
 * `ShareReaction` in `Xomify-iOS/Models/SocialModels.swift:836`. Order here
 * is the canonical render order for the picker + active-pill row.
 */
export type ShareReaction =
  | 'fire'
  | 'heart'
  | 'laugh'
  | 'mind_blown'
  | 'sad'
  | 'thumbs_up';

export const SHARE_REACTIONS: ReadonlyArray<ShareReaction> = [
  'fire',
  'heart',
  'laugh',
  'mind_blown',
  'sad',
  'thumbs_up',
];

export const SHARE_REACTION_EMOJI: Record<ShareReaction, string> = {
  fire: '\u{1F525}',
  heart: '\u{2764}\u{FE0F}',
  laugh: '\u{1F602}',
  mind_blown: '\u{1F92F}',
  sad: '\u{1F622}',
  thumbs_up: '\u{1F44D}',
};

export const SHARE_REACTION_LABEL: Record<ShareReaction, string> = {
  fire: 'Fire',
  heart: 'Heart',
  laugh: 'Laugh',
  mind_blown: 'Mind blown',
  sad: 'Sad',
  thumbs_up: 'Thumbs up',
};

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

  // Comments + emoji reactions enrichment (xomify-backend#139). Present on
  // shares_feed and shares_detail; absent on shares_create response.
  commentCount?: number;
  reactionCounts?: Partial<Record<ShareReaction, number>>;
  viewerReactions?: ShareReaction[];
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
  /**
   * Multi-target routing (xomify-backend#138). When omitted the backend
   * defaults to `true` for legacy single-target compatibility. Set to
   * `false` to suppress the public friends feed when targeting only groups.
   */
  isPublic?: boolean;
  /**
   * Group ids to also fan out to. Backend rejects `isPublic=false` with an
   * empty / missing `groupIds` (no target). Omitted from the wire body when
   * empty so the legacy single-target shape is preserved.
   */
  groupIds?: string[];
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
// Detail / interaction / friend-rating shapes
// (matches `lambdas/shares_detail/handler.py`).
// ============================================

/** One row under `interactions[]` from `/shares/detail`. */
export interface ShareInteractionEntry {
  email: string;
  displayName?: string | null;
  avatar?: string | null;
  /** "queued" | "rated" — backend leaves this as a free string. */
  action: string;
  createdAt?: string | null;
}

/** One row under `friendRatings[]` from `/shares/detail`. */
export interface ShareFriendRating {
  email: string;
  displayName?: string | null;
  avatar?: string | null;
  /** Backend persists as float; UI rounds to int for stars. */
  rating: number;
  review?: string | null;
  ratedAt?: string | null;
}

export interface ShareDetailResponse {
  share: Share;
  interactions: ShareInteractionEntry[];
  friendRatings: ShareFriendRating[];
}

// ============================================
// Comment shapes
// (matches `lambdas/shares_comments_*/handler.py`).
// ============================================

export interface ShareComment {
  commentId: string;
  shareId: string;
  email: string;
  displayName?: string | null;
  avatar?: string | null;
  body: string;
  createdAt?: string | null;
}

export interface CommentsListResponse {
  comments: ShareComment[];
  nextBefore: string | null;
}

export interface CommentDeleteResponse {
  deleted: boolean;
  commentId: string;
}

// ============================================
// Reaction toggle / list shapes
// (matches `lambdas/shares_reactions_toggle/handler.py`).
// ============================================

export interface ReactionToggleResponse {
  active: boolean;
  reaction: ShareReaction;
  counts: Partial<Record<ShareReaction, number>>;
  viewerReactions: ShareReaction[];
}

// ============================================
// Service
// ============================================

@Injectable({
  providedIn: 'root',
})
export class ShareFeedService {
  private xomifyApiUrl = `https://${environment.apiId}.execute-api.us-east-1.amazonaws.com/dev`;
  // Authorization for Xomify API calls is attached by AuthInterceptor (sub-feature 0e).

  constructor(private http: HttpClient) {}

  /**
   * POST /shares/create
   * Create a new track share. Caller provides denormalized track metadata and
   * optional caption / mood / genre tags (validated server-side).
   *
   * The `email` arg is retained for call-site compatibility but is no longer
   * forwarded — caller identity comes from the JWT context (1c).
   */
  createShare(
    _email: string,
    track: CreateShareRequest,
  ): Observable<CreateShareResponse> {
    const url = `${this.xomifyApiUrl}/shares/create`;
    const body: Record<string, unknown> = {
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
    // Multi-target routing — only forward when the caller explicitly opts
    // out of the public default or names at least one group, so the legacy
    // single-target wire shape is preserved when neither was set.
    if (track.isPublic === false) {
      body['public'] = false;
    } else if (track.isPublic === true) {
      body['public'] = true;
    }
    if (track.groupIds && track.groupIds.length > 0) {
      body['groupIds'] = track.groupIds;
    }
    return this.http.post<CreateShareResponse>(url, body);
  }

  /**
   * GET /shares/feed?groupId=...&limit=...&before=...
   * Returns the merged feed (self + accepted friends), newest first.
   *
   * The `email` arg is retained for call-site compatibility but is no longer
   * forwarded — caller identity comes from the JWT context (1c).
   */
  getFeed(_email: string, opts: FeedQueryOptions = {}): Observable<FeedResponse> {
    const url = `${this.xomifyApiUrl}/shares/feed`;
    let params = new HttpParams();
    if (opts.groupId) {
      params = params.set('groupId', opts.groupId);
    }
    if (opts.limit !== undefined) {
      params = params.set('limit', String(opts.limit));
    }
    if (opts.before) {
      params = params.set('before', opts.before);
    }
    return this.http.get<FeedResponse>(url, { params });
  }

  /**
   * GET /shares/user?targetEmail=&limit=&before=
   * Returns shares authored by `targetEmail`, newest first. Used for the
   * Posts tab on profile pages (own + friend). Backend hides group-only
   * shares automatically — public + accepted-friends-only shares come back.
   * Caller identity is on the JWT context; only `targetEmail` (the author
   * being viewed) goes on the wire.
   */
  getSharesByUser(
    targetEmail: string,
    opts: { limit?: number; before?: string } = {},
  ): Observable<FeedResponse> {
    const url = `${this.xomifyApiUrl}/shares/user`;
    let params = new HttpParams().set('targetEmail', targetEmail);
    if (opts.limit !== undefined) {
      params = params.set('limit', String(opts.limit));
    }
    if (opts.before) {
      params = params.set('before', opts.before);
    }
    return this.http.get<FeedResponse>(url, { params });
  }

  /**
   * DELETE /shares/delete
   * Hard-delete a share by id. Owner-only — backend reads caller identity
   * from the JWT and returns 403 otherwise. Body-on-DELETE matches the
   * deployed lambda contract (`lambdas/shares_delete/handler.py:_extract_share_id`)
   * which reads `shareId` from the JSON body, falling back to query params.
   * `sharedAt` is accepted for forward compat but unused server-side.
   *
   * iOS counterpart was POST -> DELETE method swap; the web service uses
   * DELETE explicitly so we don't repeat that bug.
   */
  deleteShare(shareId: string, sharedAt?: string): Observable<void> {
    const url = `${this.xomifyApiUrl}/shares/delete`;
    const body: Record<string, unknown> = { shareId };
    if (sharedAt) body['sharedAt'] = sharedAt;
    return this.http.request<void>('DELETE', url, { body });
  }

  /**
   * POST /shares/react
   * Queue / un-queue a share, or set / clear a rating. `rating` is required
   * when `action === 'rated'` (1..5).
   *
   * The `email` arg is retained for call-site compatibility but is no longer
   * forwarded — caller identity comes from the JWT context (1c).
   */
  reactToShare(
    _email: string,
    shareId: string,
    action: ReactionAction,
    rating?: number,
  ): Observable<ReactResponse> {
    const url = `${this.xomifyApiUrl}/shares/react`;
    const body: Record<string, unknown> = { shareId, action };
    if (action === 'rated' && rating !== undefined) {
      body['rating'] = rating;
    }
    return this.http.post<ReactResponse>(url, body);
  }

  // ============================================
  // Share-detail (xomify-backend/lambdas/shares_detail)
  // ============================================

  /**
   * GET /shares/detail?shareId=&sharedBy?=&sharedAt?=
   * Returns the full detail payload for one share — the share row (re-fetched
   * with viewer enrichment), `interactions[]` (queued/rated friends) and
   * `friendRatings[]` (the viewer's friends + the author who have rated this
   * track). `sharedBy` / `sharedAt` are accepted for forward-compat with iOS
   * but currently ignored server-side.
   */
  getShareDetail(
    shareId: string,
    sharedBy?: string,
    sharedAt?: string,
  ): Observable<ShareDetailResponse> {
    const url = `${this.xomifyApiUrl}/shares/detail`;
    let params = new HttpParams().set('shareId', shareId);
    if (sharedBy) params = params.set('sharedBy', sharedBy);
    if (sharedAt) params = params.set('sharedAt', sharedAt);
    return this.http.get<ShareDetailResponse>(url, { params });
  }

  // ============================================
  // Comments (xomify-backend#139)
  //
  // Endpoints are verb-disambiguated (`/shares/comments-list` etc.) because
  // the backend `api-gateway-service` Terraform module keys API GW resources
  // by `path_part` and doesn't share a node across HTTP verbs yet. Mirrors
  // the iOS notes in `XomifyService.swift:457`.
  // ============================================

  /**
   * GET /shares/comments-list?shareId=&limit?=&before?=
   * Newest-first paginated list. `before` is the ISO8601 createdAt cursor
   * from the previous page. Backend caps `limit` at 100; default 20.
   */
  listComments(
    shareId: string,
    limit?: number,
    before?: string,
  ): Observable<CommentsListResponse> {
    const url = `${this.xomifyApiUrl}/shares/comments-list`;
    let params = new HttpParams().set('shareId', shareId);
    if (limit !== undefined) params = params.set('limit', String(limit));
    if (before) params = params.set('before', before);
    return this.http.get<CommentsListResponse>(url, { params });
  }

  /**
   * POST /shares/comments-create
   * Posts a new comment. Backend trims, requires non-empty after trim, and
   * caps at 500 chars. Returns the persisted, profile-hydrated row.
   */
  createComment(shareId: string, body: string): Observable<ShareComment> {
    const url = `${this.xomifyApiUrl}/shares/comments-create`;
    return this.http.post<ShareComment>(url, { shareId, body });
  }

  /**
   * DELETE /shares/comments-delete
   * Hard-deletes a comment. Backend allows the comment author OR the share
   * author; everyone else gets 403.
   *
   * Body-on-DELETE (per the deployed backend contract).
   */
  deleteComment(
    shareId: string,
    commentId: string,
  ): Observable<CommentDeleteResponse> {
    const url = `${this.xomifyApiUrl}/shares/comments-delete`;
    return this.http.request<CommentDeleteResponse>('DELETE', url, {
      body: { shareId, commentId },
    });
  }

  // ============================================
  // Emoji reactions (xomify-backend#139)
  //
  // Distinct from `/shares/react` (Spotify queued/rated). Six fixed slugs:
  // fire / heart / laugh / mind_blown / sad / thumbs_up. Per (viewer, share,
  // slug) toggle — multiple slugs per viewer per share is allowed.
  // ============================================

  /**
   * POST /shares/reactions-toggle
   * Toggle one reaction. Returns the canonical post-toggle counts +
   * viewerReactions list so the caller can replace local state.
   */
  toggleReaction(
    shareId: string,
    reaction: ShareReaction,
  ): Observable<ReactionToggleResponse> {
    const url = `${this.xomifyApiUrl}/shares/reactions-toggle`;
    return this.http.post<ReactionToggleResponse>(url, {
      shareId,
      reaction,
    });
  }
}
