/**
 * Types for the xomify-level Broadcasts admin surface (WS-B, "Elevate Admin
 * + App Broadcasts"). App-update messages Dom writes that show up on Home
 * once WS-C ships. Backend: `xomify-backend`, table `xomify-broadcasts` —
 * see `docs/features/xomify-favorites-home-admin/PLAN.md`.
 *
 * Endpoints (no path params — the backend ships flat, verb-suffixed routes):
 *   POST   /admin/broadcasts-create
 *   GET    /admin/broadcasts-list
 *   DELETE /admin/broadcasts-delete?id=...
 *
 * xomify's API returns raw JSON (no `{data,error,meta}` envelope), unlike
 * xomtracks-backend — these interfaces describe the response body directly.
 */
export interface Broadcast {
  id: string;
  title: string;
  body: string;
  /** ISO timestamp. Absent/null means the broadcast never expires on its own. */
  activeUntil: string | null;
  createdAt: string;
  createdBy: string;
}

/** Body for `POST /admin/broadcasts-create`. */
export interface CreateBroadcastRequest {
  title: string;
  body: string;
  activeUntil?: string | null;
}

/** `GET /admin/broadcasts-list` response shape. Tolerates a bare array too,
 * in case the backend ever ships that instead of `{ broadcasts: [...] }`. */
export interface ListBroadcastsResponse {
  broadcasts: Broadcast[];
}

/** `DELETE /admin/broadcasts-delete?id=...` response shape. */
export interface DeleteBroadcastResponse {
  deleted: boolean;
  id: string;
}
