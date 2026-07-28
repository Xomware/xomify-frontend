/**
 * Single, xomify-level source of truth for "is this caller the admin (Dom)".
 * Client-side only — every server endpoint that actually needs this
 * guarantee re-checks admin status itself (e.g. xomtracks-backend's
 * `require_admin`); this const only gates which UI affordances render and
 * backs the client-side `AdminGuard` for the `/admin` route.
 *
 * Originally lived at `pages/xomtracks/config/xomtracks-admin.ts` (WS6,
 * Xomtracks Admin Portal). Lifted here so xomify-level surfaces (the
 * toolbar's user-avatar dropdown, the `/admin` route) can depend on it
 * without reaching into a specific feature module. That file now re-exports
 * this constant so its existing import stays valid.
 */
export const ADMIN_EMAIL = 'dominickj.giordano@gmail.com';

/** Case-insensitive check for whether `email` belongs to the admin. */
export function isAdminEmail(email: string | null | undefined): boolean {
  return !!email && email.trim().toLowerCase() === ADMIN_EMAIL;
}
