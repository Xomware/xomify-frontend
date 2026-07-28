import { Component } from '@angular/core';

/**
 * The xomify-level Admin Portal (`/admin`, gated by `AdminGuard`). Reachable
 * from the user-avatar dropdown (Dom-only). Currently one section —
 * Broadcasts — plus a link out to the existing, separately-gated Shares
 * Admin Portal (`/shares/admin`, xomtracks-backend). WS-B of
 * `docs/features/xomify-favorites-home-admin/PLAN.md`.
 */
@Component({
  selector: 'app-admin',
  templateUrl: './admin.component.html',
  styleUrls: ['./admin.component.scss'],
})
export class AdminComponent {}
