/**
 * The admin's shares are always-on for everyone, so the "Set up your own"
 * ingest-token affordance is hidden for this account — see
 * `XomtracksSetupCardComponent.isAdmin`.
 *
 * Re-exported from the shared xomify-level const (lifted for the nav
 * restructure + `/admin` route) — see `src/app/config/admin.config.ts`.
 * Kept here too so this import path stays valid for existing callers.
 */
export { ADMIN_EMAIL } from '../../../config/admin.config';
