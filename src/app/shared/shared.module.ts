import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LoaderComponent } from '../components/loader/loader.component';
import { PlayButtonComponent } from '../components/play-button/play-button.component';
import { AddToQueueButtonComponent } from '../components/add-to-queue-button/add-to-queue-button.component';
import { StarRatingComponent } from '../components/star-rating/star-rating.component';
import { SongDetailModalComponent } from '../components/song-detail-modal/song-detail-modal.component';
import { ActivityTimelineComponent } from '../components/activity-timeline/activity-timeline.component';

@NgModule({
  declarations: [
    LoaderComponent,
    PlayButtonComponent,
    AddToQueueButtonComponent,
    StarRatingComponent,
    SongDetailModalComponent,
    ActivityTimelineComponent,
  ],
  imports: [CommonModule, FormsModule],
  exports: [
    LoaderComponent,
    PlayButtonComponent,
    AddToQueueButtonComponent,
    StarRatingComponent,
    SongDetailModalComponent,
    ActivityTimelineComponent,
  ],
})
export class SharedModule {}
