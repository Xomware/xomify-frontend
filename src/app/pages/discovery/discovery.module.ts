import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Routes } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { SharedModule } from '../../shared/shared.module';

import { ConcertDiscoveryComponent } from '../concert-discovery/concert-discovery.component';
import { NewsComponent } from '../news/news.component';
import { NewsCardComponent } from '../../components/news-card/news-card.component';
import { RelativeTimePipe } from '../../pipes/relative-time.pipe';

const routes: Routes = [
  { path: 'concerts', component: ConcertDiscoveryComponent },
  { path: 'news', component: NewsComponent },
];

@NgModule({
  declarations: [
    ConcertDiscoveryComponent,
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
