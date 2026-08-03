/**
 * Types for the xomify Admin Portal observability surface (Health, Users,
 * Crons, Notifications). `docs/features/xomify-admin-portal/PLAN.md`.
 *
 * Same house style as `broadcast.model.ts`: xomify's API returns raw JSON
 * (no `{data,error,meta}` envelope), and these endpoints deploy on a
 * separate backend workstream — every list-shaped response is read
 * defensively in `admin-portal.service.ts` (bare array OR a wrapper object)
 * so a contract drift doesn't hard-break the panel.
 */

// ── GET /admin/health?windowHours= ──────────────────────────────────────

export interface AdminHealthByRoute {
  path: string;
  count: number;
  errors: number;
  p50ms: number;
}

export interface AdminHealthRecentError {
  ts: string;
  path: string;
  status: number;
  email: string | null;
  error: string | null;
}

export interface AdminHealthSummary {
  windowHours: number;
  totalCalls: number;
  errorCount: number;
  byRoute: AdminHealthByRoute[];
  recentErrors: AdminHealthRecentError[];
}

export const AX_HEALTH_WINDOWS: ReadonlyArray<{ value: number; label: string }> = [
  { value: 24, label: '24h' },
  { value: 72, label: '72h' },
  { value: 720, label: '30d' },
];

// ── GET /admin/users-list ────────────────────────────────────────────────

export interface AdminUserOptIns {
  wrapped: boolean;
  releaseRadar: boolean;
  likesPublic: boolean;
  favoritesReminder: boolean;
}

export interface AdminUser {
  email: string;
  displayName: string | null;
  lastSeen: string;
  optIns: AdminUserOptIns;
  spotifyConnected: boolean;
}

// ── GET /admin/user-visits?email= ────────────────────────────────────────

export interface AdminUserVisit {
  ts: string;
  path: string;
}

// ── GET /admin/view-as?email= ────────────────────────────────────────────

/**
 * Read-only "view as" snapshot. Only `email`, `optIns`, `recentVisits`, and
 * `note` have a guaranteed shape server-side; `profile`, `favorites`, and
 * `activeBroadcasts` are rendered defensively (best-effort key/value) since
 * the backend doesn't pin them down further.
 */
export interface AdminViewAs {
  email: string;
  profile: unknown;
  optIns: Partial<AdminUserOptIns> | Record<string, unknown> | null;
  recentVisits: AdminUserVisit[];
  favorites: unknown;
  activeBroadcasts: unknown[];
  /** Explains that Spotify-derived surfaces (top items, etc.) are NOT
   * impersonated — this view is limited to what the backend can read
   * server-side for the target user. Always render this to the admin. */
  note: string;
}

// ── GET /admin/crons ──────────────────────────────────────────────────────

export type AdminCronStatus = 'ok' | 'error' | string;

export interface AdminCronRun {
  startedAt: string;
  finishedAt: string | null;
  status: AdminCronStatus;
  error: string | null;
  itemsProcessed: number | null;
}

export interface AdminCron {
  cronName: string;
  lastRun: AdminCronRun | null;
  recentRuns: AdminCronRun[];
}

// ── GET /admin/notifications?limit= ──────────────────────────────────────

export type AdminNotificationChannel = 'email' | 'push' | string;

export interface AdminNotification {
  ts: string;
  channel: AdminNotificationChannel;
  toEmail: string;
  subject: string;
  bodyPreview: string;
  status: string;
  error: string | null;
}

export const AX_NOTIFICATIONS_LIMITS: ReadonlyArray<{ value: number; label: string }> = [
  { value: 25, label: '25' },
  { value: 50, label: '50' },
  { value: 100, label: '100' },
];

// ── Tab shell ─────────────────────────────────────────────────────────────

export type AdminTab = 'overview' | 'health' | 'users' | 'viewas' | 'crons' | 'notifications' | 'broadcasts';

/** `icon` is a name from the shared `app-icon` registry (`components/icon/`). */
export const AX_ADMIN_TABS: ReadonlyArray<{ value: AdminTab; label: string; icon: string }> = [
  { value: 'overview', label: 'Overview', icon: 'chart' },
  { value: 'health', label: 'Health', icon: 'trending-up' },
  { value: 'users', label: 'Users', icon: 'people' },
  { value: 'viewas', label: 'View As', icon: 'eye' },
  { value: 'crons', label: 'Crons', icon: 'refresh' },
  { value: 'notifications', label: 'Notifications', icon: 'bell' },
  { value: 'broadcasts', label: 'Broadcasts', icon: 'megaphone' },
];

/** The default landing tab — deep-linkable at `/admin` with no `?tab=`. */
export const AX_ADMIN_DEFAULT_TAB: AdminTab = 'overview';
