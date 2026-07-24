/**
 * Mirrors the xomtracks-backend `Share` record returned by `GET /shares/list`
 * (xomtracks-backend/lambdas/common/models.py::Share), plus the feed
 * enrichment (`trackKey`, `rating`, `heard`, `genres`) those handlers attach.
 * Only the fields the Xomtracks feature reads are typed here.
 */

export type XtDirection = 'in' | 'out';
export type XtTimeWindow = 'week' | 'month' | '6mo' | 'all';
export type XtPlatform = 'spotify' | 'soundcloud' | 'apple';
export type XtMatchStatus = 'pending' | 'matched' | 'unmatched' | 'manual';

/**
 * Whole-group rating aggregate + the caller's own rating for a track.
 * Enriched onto each share by `GET /shares/list`. Absent when a track has no
 * ratings at all — the UI degrades to an empty, settable control.
 */
export interface XtRating {
  /** Mean of all ratings for the track group. 0 when no ratings yet. */
  avg: number;
  /** How many ratings the group has. 0 when unrated. */
  count: number;
  /** The caller's own rating (1..5), 0 when the caller hasn't rated. */
  myRating: number;
}

export interface XtShare {
  shareId: string;
  messageGuid: string;
  direction: XtDirection;
  platform: XtPlatform;
  sourceUrl: string;
  messageDate: number; // unix epoch seconds

  sharerHandle?: string | null;
  sharerName?: string | null;
  chatId?: string | null;

  trackTitle?: string | null;
  trackArtist?: string | null;
  albumName?: string | null;
  albumArtUrl?: string | null;

  resolvedSpotifyId?: string | null;
  resolvedSpotifyUri?: string | null;
  matchStatus: XtMatchStatus;
  matchConfidence?: number | null;
  createdAt: string;

  /** Enriched by `ensure_genres` — always a string[] once fetched. */
  genres?: string[] | null;

  /** Whole-group rating aggregate + the caller's own rating. */
  rating?: XtRating | null;

  /** The CALLER's own "heard" state for this track. `true` once marked
   * played. Toggled via `POST /heard/set`. Absent == unheard. */
  heard?: boolean;

  /** Client-side identity for "same track" grouping — set by the feed once
   * loaded (mirrors the backend's own `trackKey`, but computed client-side
   * too so a freshly-created rated-track mapping has one immediately). */
  trackKey?: string;
}

/** One entry from `GET /ratings/list` — a track the caller has rated, in
 * EITHER direction (not scoped to one `window`/`direction` filter). */
export interface XtRatedTrack {
  trackKey: string;
  /** The caller's own rating, 1..5. */
  rating: number;
  /** When the caller last rated it (ISO or epoch — display-only). */
  ratedAt: string | number;
  trackTitle?: string | null;
  trackArtist?: string | null;
  albumArtUrl?: string | null;
  albumName?: string | null;
  platform: XtPlatform;
  direction: XtDirection;
  /** The underlying representative share's date (epoch seconds or ISO). */
  date?: string | number | null;
}

export interface XtRatedListResponse {
  rated: XtRatedTrack[];
  count: number;
}

export interface XtSharesListResponse {
  shares: XtShare[];
  direction: XtDirection;
  window: XtTimeWindow;
  count: number;
}

export const XT_TIME_WINDOWS: ReadonlyArray<{ value: XtTimeWindow; label: string }> = [
  { value: 'week', label: 'This week' },
  { value: 'month', label: 'This month' },
  { value: '6mo', label: '6 months' },
  { value: 'all', label: 'All time' },
];

export const XT_DIRECTIONS: ReadonlyArray<{ value: XtDirection; label: string }> = [
  { value: 'in', label: 'Shared with me' },
  { value: 'out', label: 'Shared by me' },
];

/** Feed source: the two share directions, plus "rated" — every track the
 * caller has rated, across both directions (from `GET /ratings/list`). The
 * `/me/shares` "Mine" tab from the original xomtracks-frontend is NOT
 * ported: it's keyed on the Dom-only admin-approval phone-linking feature
 * (xomtracks-backend `lambdas/me_shares`), which the merge plan explicitly
 * keeps out of the self-serve UI. */
export type XtFeedMode = XtDirection | 'rated';

export const XT_FEED_SOURCES: ReadonlyArray<{ value: XtFeedMode; label: string }> = [
  { value: 'in', label: 'Shared with me' },
  { value: 'out', label: 'Shared by me' },
  { value: 'rated', label: 'My rated' },
];
