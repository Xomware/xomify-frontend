import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { LandingComponent } from './landing.component';
import { ScrollJourneyComponent } from './scroll-journey/scroll-journey.component';
import { JourneyActDirective } from './scroll-journey/journey-act.directive';
import { RankListPreviewComponent } from './previews/rank-list-preview.component';
import { WrappedPreviewComponent } from './previews/wrapped-preview.component';
import { RadarPreviewComponent } from './previews/radar-preview.component';
import { BuilderPreviewComponent } from './previews/builder-preview.component';
import { ShareCardPreviewComponent } from './previews/share-card-preview.component';
import { DiscoveryPreviewComponent } from './previews/discovery-preview.component';
import { HowItWorksPreviewComponent } from './previews/how-it-works-preview.component';

/**
 * Eagerly imported by AppModule rather than lazy-loaded: this IS the first
 * paint for a signed-out visitor, so a lazy chunk would only add a round trip
 * before anything renders.
 */
@NgModule({
  declarations: [
    LandingComponent,
    ScrollJourneyComponent,
    JourneyActDirective,
    RankListPreviewComponent,
    WrappedPreviewComponent,
    RadarPreviewComponent,
    BuilderPreviewComponent,
    ShareCardPreviewComponent,
    DiscoveryPreviewComponent,
    HowItWorksPreviewComponent,
  ],
  imports: [CommonModule],
  exports: [LandingComponent],
})
export class LandingModule {}
