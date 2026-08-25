import { ChangeDetectionStrategy, Component, ElementRef, NgZone } from '@angular/core';
import { gsap } from 'gsap';

import { PreviewBase, artStyle } from './preview-base';
import { BUILDER_ANALYSIS, BUILDER_QUEUE } from '../landing-fixtures';

/** Tracks dropping into a queue, then the analysis bars growing. */
@Component({
  selector: 'app-builder-preview',
  templateUrl: './builder-preview.component.html',
  styleUrls: ['./preview.shared.scss', './builder-preview.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BuilderPreviewComponent extends PreviewBase {
  readonly queue = BUILDER_QUEUE;
  readonly analysis = BUILDER_ANALYSIS;
  readonly art = artStyle;

  constructor(host: ElementRef<HTMLElement>, zone: NgZone) {
    super(host, zone);
  }

  protected buildTimeline(tl: gsap.core.Timeline): void {
    tl.from(this.q('.queue-row'), {
      opacity: 0,
      x: 28,
      duration: 0.4,
      stagger: 0.11,
      ease: 'power3.out',
    });

    // Bars grow from zero rather than fading in — the width IS the datum, so
    // animating it is the one place a count-up-style reveal earns its keep.
    this.q('.bar-fill').forEach((el, i) => {
      const pct = this.analysis[i]?.value ?? 0;
      tl.fromTo(
        el,
        { width: '0%' },
        { width: `${pct}%`, duration: 0.55, ease: 'power2.out' },
        i === 0 ? '-=0.1' : '-=0.4'
      );
    });
  }
}
