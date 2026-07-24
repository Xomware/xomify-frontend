/**
 * The admin's shares are always-on for everyone, so the "Set up your own"
 * ingest-token affordance is hidden for this account — see
 * `XomtracksSetupCardComponent.isAdmin`.
 *
 * A single exported const so the admin identity is easy to change later
 * without hunting through the component.
 */
export const ADMIN_EMAIL = 'dominickj.giordano@gmail.com';
