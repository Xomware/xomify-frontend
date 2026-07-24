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

// Lazy-loaded, same pattern as the other feature modules
// (pages/social, pages/analytics, pages/discovery) — see app-routing.module.ts.
const routes: Routes = [{ path: '', component: XomtracksComponent }];

@NgModule({
  declarations: [
    XomtracksComponent,
    XomtracksShareCardComponent,
    XomtracksTrackDetailModalComponent,
    XomtracksRatingStarsComponent,
    XomtracksPlaylistsPanelComponent,
    XomtracksSetupCardComponent,
  ],
  imports: [
    CommonModule,
    FormsModule,
    SharedModule, // brings in the `[appTooltip]` directive
    RouterModule.forChild(routes),
  ],
})
export class XomtracksModule {}
