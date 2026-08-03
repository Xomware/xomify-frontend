import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Routes } from '@angular/router';

import { SharedModule } from '../../shared/shared.module';
import { XomtracksSetupCardComponent } from '../xomtracks/components/xomtracks-setup-card/xomtracks-setup-card.component';
import { AdminComponent } from './admin.component';
import { BroadcastsPanelComponent } from './broadcasts-panel/broadcasts-panel.component';
import { AdminOverviewPanelComponent } from './overview-panel/admin-overview-panel.component';
import { AdminHealthPanelComponent } from './health-panel/admin-health-panel.component';
import { AdminUsersPanelComponent } from './users-panel/admin-users-panel.component';
import { AdminViewasPanelComponent } from './viewas-panel/admin-viewas-panel.component';
import { AdminCronsPanelComponent } from './crons-panel/admin-crons-panel.component';
import { AdminNotificationsPanelComponent } from './notifications-panel/admin-notifications-panel.component';
import { AxTimestampPipe } from './pipes/ax-timestamp.pipe';

// Lazy-loaded, same pattern as the other feature modules (pages/social,
// pages/analytics, pages/discovery, pages/xomtracks) — see
// app-routing.module.ts. `AuthGuard` + `AdminGuard` are applied at the
// lazy-route boundary in app-routing.module.ts, so both must pass before
// this module's chunk is even fetched.
const routes: Routes = [{ path: '', component: AdminComponent }];

@NgModule({
  declarations: [
    AdminComponent,
    BroadcastsPanelComponent,
    AdminOverviewPanelComponent,
    AdminHealthPanelComponent,
    AdminUsersPanelComponent,
    AdminViewasPanelComponent,
    AdminCronsPanelComponent,
    AdminNotificationsPanelComponent,
    AxTimestampPipe,
  ],
  imports: [
    CommonModule,
    FormsModule,
    RouterModule.forChild(routes),
    SharedModule,
    // Standalone — reused as-is (in `forcePreview` mode) by the View As
    // panel's "Preview: Shares signup" section. Standalone components can be
    // dropped straight into an unrelated NgModule's `imports` without also
    // pulling in `XomtracksModule`'s routing/declarations.
    XomtracksSetupCardComponent,
  ],
})
export class AdminModule {}
