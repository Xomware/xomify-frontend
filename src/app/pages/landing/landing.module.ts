import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

import { LandingComponent } from './landing.component';
import { ScrollJourneyComponent } from './scroll-journey/scroll-journey.component';
import { JourneyActDirective } from './scroll-journey/journey-act.directive';
import { PreviewArtComponent } from './previews/preview-art.component';
import { RankListPreviewComponent } from './previews/rank-list-preview.component';
import { WrappedPreviewComponent } from './previews/wrapped-preview.component';
import { RadarPreviewComponent } from './previews/radar-preview.component';
import { BuilderPreviewComponent } from './previews/builder-preview.component';
import { ShareCardPreviewComponent } from './previews/share-card-preview.component';
import { DiscoveryPreviewComponent } from './previews/discovery-preview.component';
import { HowItWorksPreviewComponent } from './previews/how-it-works-preview.component';

/**
 * Lazy-loaded, and deliberately so.
 *
 * This module pulls in GSAP ScrollTrigger and Flip. Eagerly importing it put
 * ~58 kB of transfer into the initial bundle for EVERY user — including signed-in
 * ones, who never see the landing page. The route split in AppRoutingModule
 * (`canMatch`) means the chunk is only fetched for a visitor who is actually
 * logged out.
 */
@NgModule({
  declarations: [
    LandingComponent,
    ScrollJourneyComponent,
    JourneyActDirective,
    PreviewArtComponent,
    RankListPreviewComponent,
    WrappedPreviewComponent,
    RadarPreviewComponent,
    BuilderPreviewComponent,
    ShareCardPreviewComponent,
    DiscoveryPreviewComponent,
    HowItWorksPreviewComponent,
  ],
  imports: [
    CommonModule,
    RouterModule.forChild([{ path: '', component: LandingComponent }]),
  ],
})
export class LandingModule {}
