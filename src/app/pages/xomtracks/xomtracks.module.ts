import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Routes } from '@angular/router';
import { SharedModule } from '../../shared/shared.module';

import { XomtracksComponent } from './xomtracks.component';
import { XomtracksShareCardComponent } from './components/xomtracks-share-card/xomtracks-share-card.component';
import { XomtracksTrackDetailModalComponent } from './components/xomtracks-track-detail-modal/xomtracks-track-detail-modal.component';
import { XomtracksRatingStarsComponent } from './components/xomtracks-rating-stars/xomtracks-rating-stars.component';
import { XomtracksPlaylistsPanelComponent } from './components/xomtracks-playlists-panel/xomtracks-playlists-panel.component';
import { XomtracksSetupCardComponent } from './components/xomtracks-setup-card/xomtracks-setup-card.component';
import { XomtracksAdminComponent } from './admin/xomtracks-admin.component';
import { XomtracksAdminUsersPanelComponent } from './admin/components/xomtracks-admin-users-panel/xomtracks-admin-users-panel.component';
import { XomtracksAdminViewasPanelComponent } from './admin/components/xomtracks-admin-viewas-panel/xomtracks-admin-viewas-panel.component';
import { XomtracksAdminCallsPanelComponent } from './admin/components/xomtracks-admin-calls-panel/xomtracks-admin-calls-panel.component';
import { XomtracksAdminTokensPanelComponent } from './admin/components/xomtracks-admin-tokens-panel/xomtracks-admin-tokens-panel.component';
import { XomtracksAdminGuard } from './admin/guards/xomtracks-admin.guard';

// Lazy-loaded, same pattern as the other feature modules
// (pages/social, pages/analytics, pages/discovery) — see app-routing.module.ts.
// `admin` is a further-gated child: AuthGuard (parent /xomtracks route) proves
// the caller is logged in, XomtracksAdminGuard additionally proves they're
// the admin (server-authoritative `isAdmin` from GET /me/get) before the
// Admin Portal ever mounts.
const routes: Routes = [
  { path: '', component: XomtracksComponent },
  { path: 'admin', component: XomtracksAdminComponent, canActivate: [XomtracksAdminGuard] },
];

@NgModule({
  declarations: [
    XomtracksComponent,
    XomtracksShareCardComponent,
    XomtracksTrackDetailModalComponent,
    XomtracksRatingStarsComponent,
    XomtracksPlaylistsPanelComponent,
    XomtracksSetupCardComponent,
    XomtracksAdminComponent,
    XomtracksAdminUsersPanelComponent,
    XomtracksAdminViewasPanelComponent,
    XomtracksAdminCallsPanelComponent,
    XomtracksAdminTokensPanelComponent,
  ],
  imports: [
    CommonModule,
    FormsModule,
    SharedModule, // brings in the `[appTooltip]` directive
    RouterModule.forChild(routes),
  ],
})
export class XomtracksModule {}
