import { ChangeDetectionStrategy, ChangeDetectorRef, Component, ElementRef, NgZone } from '@angular/core';
import { gsap } from 'gsap';

import { PreviewBase } from './preview-base';
import { PreviewRelease, RADAR_DAYS, RADAR_WEEKS, RadarWeek } from '../landing-fixtures';

/** The Release Radar calendar, walking back through weeks on a loop. */
@Component({
  selector: 'app-radar-preview',
  templateUrl: './radar-preview.component.html',
  styleUrls: ['./preview.shared.scss', './radar-preview.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RadarPreviewComponent extends PreviewBase {
  readonly days = RADAR_DAYS;
  readonly weeks = RADAR_WEEKS;
  index = 0;

  constructor(host: ElementRef<HTMLElement>, zone: NgZone, private cdr: ChangeDetectorRef) {
    super(host, zone);
  }

  get week(): RadarWeek {
    return this.weeks[this.index];
  }

  releasesFor(day: number): PreviewRelease[] {
    return this.week.releases.filter((r) => r.day === day);
  }

  protected buildTimeline(tl: gsap.core.Timeline): void {
    tl.repeat(-1);

    tl.from(this.q('.day-column'), {
      opacity: 0,
      scaleY: 0.85,
      transformOrigin: 'top center',
      duration: 0.28,
      stagger: 0.04,
      ease: 'power2.out',
    }).from(this.q('.release'), {
      opacity: 0,
      y: -10,
      duration: 0.35,
      stagger: 0.09,
      ease: 'back.out(1.6)',
    }, '-=0.1');

    this.weeks.forEach(() => {
      tl.to({}, { duration: 1.7 });
      // Slide the grid sideways as the week changes — a calendar moving
      // through time should look like it is moving through time.
      tl.to(this.q('.calendar'), { opacity: 0, x: -24, duration: 0.28 });
      tl.call(() => this.advance());
      tl.fromTo(this.q('.calendar'), { x: 24 }, { opacity: 1, x: 0, duration: 0.32 });
    });
  }

  private advance(): void {
    this.index = (this.index + 1) % this.weeks.length;
    this.zone.run(() => this.cdr.detectChanges());
  }
}
