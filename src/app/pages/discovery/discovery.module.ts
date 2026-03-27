import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Routes } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { SharedModule } from '../../shared/shared.module';

import { ArtistDiscoveryComponent } from '../artist-discovery/artist-discovery.component';
import { ConcertDiscoveryComponent } from '../concert-discovery/concert-discovery.component';
import { NewReleasesComponent } from '../new-releases/new-releases.component';
import { NewsComponent } from '../news/news.component';
import { NewsCardComponent } from '../../components/news-card/news-card.component';
import { RelativeTimePipe } from '../../pipes/relative-time.pipe';

const routes: Routes = [
  { path: 'discover-artists', component: ArtistDiscoveryComponent },
  { path: 'concerts', component: ConcertDiscoveryComponent },
  { path: 'new-releases', component: NewReleasesComponent },
  { path: 'news', component: NewsComponent },
];

@NgModule({
  declarations: [
    ArtistDiscoveryComponent,
    ConcertDiscoveryComponent,
    NewReleasesComponent,
    NewsComponent,
    NewsCardComponent,
    RelativeTimePipe,
  ],
  imports: [
    CommonModule,
    FormsModule,
    SharedModule,
    RouterModule.forChild(routes),
  ],
})
export class DiscoveryModule {}
