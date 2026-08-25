import { ChangeDetectionStrategy, Component, ElementRef, NgZone } from '@angular/core';
import { gsap } from 'gsap';

import { PreviewBase, artStyle } from './preview-base';
import { WRAPPED_MONTHS, WRAPPED_TRACKS } from '../landing-fixtures';

/** A Wrapped playlist assembling itself, track by track, month by month. */
@Component({
  selector: 'app-wrapped-preview',
  templateUrl: './wrapped-preview.component.html',
  styleUrls: ['./preview.shared.scss', './wrapped-preview.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WrappedPreviewComponent extends PreviewBase {
  readonly months = WRAPPED_MONTHS;
  readonly tracks = WRAPPED_TRACKS;
  readonly art = artStyle;

  constructor(host: ElementRef<HTMLElement>, zone: NgZone) {
    super(host, zone);
  }

  protected buildTimeline(tl: gsap.core.Timeline): void {
    const chips = this.q('.month-chip');
    const rows = this.q('.wrapped-row');

    tl.from(chips, { opacity: 0, y: -8, duration: 0.3, stagger: 0.1 })
      .from(rows, { opacity: 0, y: 14, duration: 0.35, stagger: 0.12, ease: 'power2.out' }, '-=0.1')
      .to(this.q('.wrapped-count'), { textContent: this.tracks.length, snap: { textContent: 1 }, duration: 0.6 }, '-=0.5');

    // Advance the highlighted month, so the "and again next month" point lands
    // without any copy having to make it.
    chips.forEach((_, i) => {
      tl.call(() => {
        chips.forEach((c, j) => c.classList.toggle('month-chip--active', i === j));
      }, undefined, i === 0 ? '+=0.6' : '+=0.9');
    });
  }
}
