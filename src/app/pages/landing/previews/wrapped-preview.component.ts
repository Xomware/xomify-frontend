import { ChangeDetectionStrategy, ChangeDetectorRef, Component, ElementRef, NgZone } from '@angular/core';
import { gsap } from 'gsap';

import { PreviewBase } from './preview-base';
import { WRAPPED_MONTHS, WrappedMonth } from '../landing-fixtures';

/**
 * A generated Wrapped playlist, cycling month by month on a loop.
 *
 * Shows the thing the feature actually produces: a playlist with a cover, a
 * name, a minutes-listened figure and its tracks — and all four changing as
 * the month advances. The first version showed a static track list and a chip
 * row that highlighted a different month without anything else moving, which
 * is why it read as fake.
 */
@Component({
  selector: 'app-wrapped-preview',
  templateUrl: './wrapped-preview.component.html',
  styleUrls: ['./preview.shared.scss', './wrapped-preview.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WrappedPreviewComponent extends PreviewBase {
  readonly months = WRAPPED_MONTHS;
  index = 0;

  constructor(host: ElementRef<HTMLElement>, zone: NgZone, private cdr: ChangeDetectorRef) {
    super(host, zone);
  }

  get current(): WrappedMonth {
    return this.months[this.index];
  }

  protected buildTimeline(tl: gsap.core.Timeline): void {
    tl.repeat(-1);

    tl.from(this.q('.wrapped-cover'), { opacity: 0, scale: 0.9, duration: 0.45, ease: 'back.out(1.5)' })
      .from(this.q('.wrapped-meta > *'), { opacity: 0, y: 10, duration: 0.3, stagger: 0.07 }, '-=0.2')
      .from(this.q('.wrapped-row'), { opacity: 0, x: 16, duration: 0.3, stagger: 0.08 }, '-=0.15');

    this.months.forEach(() => {
      tl.to({}, { duration: 1.6 });
      // Cross-fade the whole card, then swap the month behind it — swapping
      // in place makes the covers pop between images.
      tl.to(this.q('.wrapped-body'), { opacity: 0, y: -8, duration: 0.28 });
      tl.call(() => this.advance());
      tl.to(this.q('.wrapped-body'), { opacity: 1, y: 0, duration: 0.32 });
    });
  }

  private advance(): void {
    this.index = (this.index + 1) % this.months.length;
    this.zone.run(() => this.cdr.detectChanges());
  }
}
