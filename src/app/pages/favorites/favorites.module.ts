import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Routes } from '@angular/router';
import { SharedModule } from '../../shared/shared.module';

import { FavoritesComponent } from './favorites.component';
import { FavoritesRankedListComponent } from './components/favorites-ranked-list/favorites-ranked-list.component';
import { FavoritesSearchPickerComponent } from './components/favorites-search-picker/favorites-search-picker.component';
import { FavoritesNewListModalComponent } from './components/favorites-new-list-modal/favorites-new-list-modal.component';

// Lazy-loaded, same pattern as the other feature modules
// (pages/social, pages/xomtracks, pages/analytics) — see app-routing.module.ts.
// "My Favorites" = user-CURATED best-of lists (see FavoritesService doc
// comment), distinct from the Spotify-derived Music Taste pages.
const routes: Routes = [{ path: '', component: FavoritesComponent }];

@NgModule({
  declarations: [
    FavoritesComponent,
    FavoritesRankedListComponent,
    FavoritesSearchPickerComponent,
    FavoritesNewListModalComponent,
  ],
  imports: [
    CommonModule,
    FormsModule,
    SharedModule, // brings in [appTooltip]
    RouterModule.forChild(routes),
  ],
})
export class FavoritesModule {}
