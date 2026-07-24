import { Component } from '@angular/core';
import { XT_ADMIN_TABS, XtAdminTab } from '../models/xomtracks-admin.model';

/**
 * The Dom-only Admin Portal (`/xomtracks/admin`, gated by `XomtracksAdminGuard`
 * off the server-authoritative `isAdmin` flag on `GET /me/get`). Four
 * read-mostly panels over the `xomtracks-backend` `/admin/*` surface:
 * user directory, read-only "view as" impersonation, a calls/errors
 * dashboard, and ingest-token management (with a revoke override).
 *
 * Stacked as tabs — one panel mounted at a time (`*ngSwitch`) — so each
 * panel owns its own load/error/empty state independently and nothing
 * fetches until its tab is first opened. The "View as" tab additionally
 * accepts a preset email, which the Users panel sets via its `viewAs`
 * output so its "View as" row action jumps straight into that user's feed.
 */
@Component({
  selector: 'app-xomtracks-admin',
  templateUrl: './xomtracks-admin.component.html',
  styleUrls: ['./xomtracks-admin.component.scss'],
})
export class XomtracksAdminComponent {
  readonly tabs = XT_ADMIN_TABS;

  activeTab: XtAdminTab = 'users';

  /** Set when the Users panel's "View as" action fires; consumed once by the
   * View As panel's `presetEmail` input on mount. */
  viewAsPresetEmail: string | null = null;

  setTab(tab: XtAdminTab): void {
    this.activeTab = tab;
  }

  /** "View as" from the Users panel: jump to the View As tab pre-loaded for that user. */
  viewAs(email: string): void {
    this.viewAsPresetEmail = email;
    this.activeTab = 'viewas';
  }
}
