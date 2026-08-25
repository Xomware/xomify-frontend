import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { LandingComponent } from './landing.component';
import { ScrollJourneyComponent } from './scroll-journey/scroll-journey.component';
import { JourneyActDirective } from './scroll-journey/journey-act.directive';

/**
 * Eagerly imported by AppModule rather than lazy-loaded: this IS the first
 * paint for a signed-out visitor, so a lazy chunk would only add a round trip
 * before anything renders.
 */
@NgModule({
  declarations: [LandingComponent, ScrollJourneyComponent, JourneyActDirective],
  imports: [CommonModule],
  exports: [LandingComponent],
})
export class LandingModule {}
