import { ChangeDetectionStrategy, ChangeDetectorRef, Component, ElementRef, NgZone } from '@angular/core';
import { gsap } from 'gsap';

import { PreviewBase } from './preview-base';
import { BUILDER_ANALYSIS, BUILDER_QUEUE } from '../landing-fixtures';

/**
 * A queue being built, then analysed, then pushed to Spotify — on a loop.
 *
 * The first version dropped four rows in and grew four bars once, then sat
 * there. It showed the widgets without showing the workflow, which is why it
 * looked fake. This builds the queue a track at a time, shows the running
 * count and duration changing, runs the analysis, then saves.
 */
@Component({
  selector: 'app-builder-preview',
  templateUrl: './builder-preview.component.html',
  styleUrls: ['./preview.shared.scss', './builder-preview.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BuilderPreviewComponent extends PreviewBase {
  readonly queue = BUILDER_QUEUE;
  readonly analysis = BUILDER_ANALYSIS;

  /** How many tracks are currently "in" the queue. */
  count = 0;
  saved = false;

  constructor(host: ElementRef<HTMLElement>, zone: NgZone, private cdr: ChangeDetectorRef) {
    super(host, zone);
  }

  get visible() {
    return this.queue.slice(0, this.count);
  }

  /** Runs at ~3:30 a track — close enough to read as a real duration. */
  get duration(): string {
    const total = this.count * 210;
    const mins = Math.floor(total / 60);
    const secs = String(total % 60).padStart(2, '0');
    return `${mins}:${secs}`;
  }

  protected buildTimeline(tl: gsap.core.Timeline): void {
    tl.repeat(-1);

    // Build the queue a track at a time.
    this.queue.forEach(() => {
      tl.call(() => this.addOne());
      tl.from(this.q('.queue-row:last-child'), {
        opacity: 0,
        x: 26,
        duration: 0.32,
        ease: 'power3.out',
      });
      tl.to({}, { duration: 0.18 });
    });

    // Then analyse it.
    tl.to({}, { duration: 0.4 });
    this.analysis.forEach((row, index) => {
      tl.fromTo(
        this.q('.bar-fill')[index],
        { width: '0%' },
        { width: `${row.value}%`, duration: 0.5, ease: 'power2.out' },
        index === 0 ? '>' : '-=0.35',
      );
    });

    // Then save, hold, and reset for the next pass.
    tl.call(() => this.setSaved(true));
    tl.from(this.q('.save-pill'), { opacity: 0, scale: 0.8, duration: 0.3, ease: 'back.out(2)' });
    tl.to({}, { duration: 1.6 });
    tl.to(this.q('.builder-body'), { opacity: 0, duration: 0.3 });
    tl.call(() => this.reset());
    tl.to(this.q('.builder-body'), { opacity: 1, duration: 0.3 });
  }

  private addOne(): void {
    this.count = Math.min(this.count + 1, this.queue.length);
    this.flush();
  }

  private setSaved(value: boolean): void {
    this.saved = value;
    this.flush();
  }

  private reset(): void {
    this.count = 0;
    this.saved = false;
    this.flush();
    gsap.set(this.q('.bar-fill'), { width: '0%' });
  }

  private flush(): void {
    this.zone.run(() => this.cdr.detectChanges());
  }
}
