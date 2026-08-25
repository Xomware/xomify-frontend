import { ChangeDetectionStrategy, Component, ElementRef, NgZone } from '@angular/core';
import { gsap } from 'gsap';

import { PreviewBase, artStyle } from './preview-base';
import { RADAR_DAYS, RADAR_RELEASES, PreviewRelease } from '../landing-fixtures';

/** A week of the Release Radar calendar, filling in as releases land. */
@Component({
  selector: 'app-radar-preview',
  templateUrl: './radar-preview.component.html',
  styleUrls: ['./preview.shared.scss', './radar-preview.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RadarPreviewComponent extends PreviewBase {
  readonly days = RADAR_DAYS;
  readonly art = artStyle;

  constructor(host: ElementRef<HTMLElement>, zone: NgZone) {
    super(host, zone);
  }

  releasesFor(day: number): PreviewRelease[] {
    return RADAR_RELEASES.filter((r) => r.day === day);
  }

  protected buildTimeline(tl: gsap.core.Timeline): void {
    tl.from(this.q('.day-column'), {
      opacity: 0,
      scaleY: 0.8,
      transformOrigin: 'top center',
      duration: 0.3,
      stagger: 0.05,
      ease: 'power2.out',
    }).from(
      this.q('.release'),
      { opacity: 0, y: -12, duration: 0.4, stagger: 0.11, ease: 'back.out(1.6)' },
      '-=0.1'
    );
  }
}
