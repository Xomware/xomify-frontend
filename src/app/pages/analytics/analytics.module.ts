import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Routes } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { SharedModule } from '../../shared/shared.module';

import { PlaylistAnalysisComponent } from '../playlist-analysis/playlist-analysis.component';
import { MoodRecommendationsComponent } from '../mood-recommendations/mood-recommendations.component';
import { MoodTimelineComponent } from '../mood-timeline/mood-timeline.component';
import { WeeklyWrappedComponent } from '../weekly-wrapped/weekly-wrapped.component';
import { ShareComponent } from '../share/share.component';

const routes: Routes = [
  { path: 'playlist-analysis', component: PlaylistAnalysisComponent },
  { path: 'mood-recommendations', component: MoodRecommendationsComponent },
  { path: 'mood-timeline', component: MoodTimelineComponent },
  { path: 'weekly-wrapped', component: WeeklyWrappedComponent },
  { path: 'share', component: ShareComponent },
];

@NgModule({
  declarations: [
    PlaylistAnalysisComponent,
    MoodRecommendationsComponent,
    MoodTimelineComponent,
    WeeklyWrappedComponent,
    ShareComponent,
  ],
  imports: [
    CommonModule,
    FormsModule,
    SharedModule,
    RouterModule.forChild(routes),
  ],
})
export class AnalyticsModule {}
