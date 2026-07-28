import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Routes } from '@angular/router';

import { AdminComponent } from './admin.component';
import { BroadcastsPanelComponent } from './broadcasts-panel/broadcasts-panel.component';
import { AdminStateIconComponent } from './components/admin-state-icon/admin-state-icon.component';
import { AdminHealthPanelComponent } from './health-panel/admin-health-panel.component';
import { AdminUsersPanelComponent } from './users-panel/admin-users-panel.component';
import { AdminCronsPanelComponent } from './crons-panel/admin-crons-panel.component';
import { AdminNotificationsPanelComponent } from './notifications-panel/admin-notifications-panel.component';

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
    AdminStateIconComponent,
    AdminHealthPanelComponent,
    AdminUsersPanelComponent,
    AdminCronsPanelComponent,
    AdminNotificationsPanelComponent,
  ],
  imports: [CommonModule, FormsModule, RouterModule.forChild(routes)],
})
export class AdminModule {}
