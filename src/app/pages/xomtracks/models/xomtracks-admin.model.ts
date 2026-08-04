import { XtDirection, XtShare, XtTimeWindow } from './xomtracks-share.model';

/**
 * Types for the Dom-only Admin Portal (`/shares/admin`) — mirrors the five
 * `xomtracks-backend` `/admin/*` handlers (all `require_admin`-gated
 * in-handler: 401 unauthenticated, 403 non-admin). See
 * `xomtracks-backend/lambdas/admin_*` and
 * `docs/features/xomtracks-xomify-merge/PLAN.md` WS6.
 */

// ── GET /me/get ─────────────────────────────────────────────────────────

/** The caller's own phone-link + admin/ingest state. Only `isAdmin` and
 * `email` are read by the admin portal; the rest backs the (separate)
 * "link your number" UI. */
export interface XtMeResponse {
  email: string;
  linkStatus: 'none' | 'pending' | 'linked';
  linked: boolean;
  linkedHandles: string[];
  shareCount: number;
  spotifyConnected: boolean;
  spotifyUserId: string | null;
  /** True only for the admin (Dom) — server-authoritative, never inferred
   * client-side from the JWT. */
  isAdmin: boolean;
  ownIngest: boolean;
  /** ISO 8601 of the most recent extractor push across the caller's active
   * ingest tokens, or `null` until the first scan lands. Drives the
   * onboarding "Connected" panel's "last scan" readout. */
  lastScanAt: string | null;
}

// ── GET /admin/users ─────────────────────────────────────────────────────

export interface XtAdminUser {
  email: string;
  /** ISO timestamp of the user's first authed call. */
  firstSeen: string;
  /** ISO timestamp of the user's most recent authed call. */
  lastSeen: string;
  /** True if they run their own extractor (live ingest token or own shares). */
  ownIngest: boolean;
  spotifyConnected: boolean;
}

export interface XtAdminUsersResponse {
  users: XtAdminUser[];
  count: number;
}

// ── GET /admin/user-feed ─────────────────────────────────────────────────

export interface XtAdminUserFeedResponse {
  email: string;
  shares: XtShare[];
  direction: XtDirection;
  window: XtTimeWindow;
  count: number;
}

// ── GET /admin/calls ─────────────────────────────────────────────────────

export interface XtAdminCallsByPath {
  path: string;
  count: number;
  errors: number;
}

export interface XtAdminRecentError {
  id: string;
  /** ISO timestamp. */
  ts: string;
  path: string;
  method: string;
  status: number;
  email: string | null;
  error: string | null;
}

export interface XtAdminCallsSummary {
  windowDays: number;
  totalCalls: number;
  errorCount: number;
  byPath: XtAdminCallsByPath[];
  byStatus: Record<string, number>;
  recentErrors: XtAdminRecentError[];
}

// ── GET /admin/tokens ─────────────────────────────────────────────────────

export interface XtAdminToken {
  ownerEmail: string;
  /** Non-secret hash id — the plaintext token is never returned. */
  tokenHash: string;
  label: string | null;
  createdAt: string;
  lastUsedAt: string | null;
  revoked: boolean;
}

export interface XtAdminTokensResponse {
  tokens: XtAdminToken[];
  byOwner: Record<string, XtAdminToken[]>;
  count: number;
  /** Owners (emails) that are Spotify-connected in xomtracks — the rolling
   * cron can build their OWN playlists. An owner with a token but not here
   * ingests shares but gets no own playlists. */
  spotifyConnectedOwners?: string[];
}

// ── POST /admin/revoke-token ─────────────────────────────────────────────

export interface XtAdminRevokeTokenResult {
  tokenHash: string;
  revoked: boolean;
  ownerEmail: string | null;
}

/** The four admin portal sections/tabs. */
export type XtAdminTab = 'users' | 'viewas' | 'calls' | 'tokens';

export const XT_ADMIN_TABS: ReadonlyArray<{ value: XtAdminTab; label: string }> = [
  { value: 'users', label: 'Users' },
  { value: 'viewas', label: 'View as' },
  { value: 'calls', label: 'Calls & errors' },
  { value: 'tokens', label: 'Tokens' },
];

/** `windowDays` choices for the calls dashboard (backend clamps to 1..30). */
export const XT_ADMIN_CALLS_WINDOWS: ReadonlyArray<{ value: number; label: string }> = [
  { value: 1, label: '24h' },
  { value: 7, label: '7 days' },
  { value: 30, label: '30 days' },
];
