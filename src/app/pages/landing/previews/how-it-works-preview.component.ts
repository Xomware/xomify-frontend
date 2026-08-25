import { ChangeDetectionStrategy, Component, ElementRef, NgZone } from '@angular/core';
import { gsap } from 'gsap';

import { PreviewBase } from './preview-base';

interface Step {
  readonly title: string;
  readonly body: string;
}

const STEPS: readonly Step[] = [
  { title: 'Connect Spotify', body: 'One OAuth handshake. No password ever touches Xomify.' },
  { title: 'It watches', body: 'Your plays, tops and likes get snapshotted over time.' },
  { title: 'Playlists appear', body: 'Wrapped monthly, Release Radar weekly, straight into Spotify.' },
  { title: 'Share and compare', body: 'Push songs at friends and find out what they made of them.' },
];

/**
 * The four-step explainer, with a line drawing through the steps as they land.
 *
 * DEVIATION FROM PLAN: the plan specified DrawSVGPlugin for the connecting
 * line. The line here is dead straight, and `scaleX` on a plain element is
 * identical on screen while surviving the responsive reflow — at narrow widths
 * the steps stack vertically and an SVG path would need re-authoring per
 * breakpoint. No plugin, one fewer thing in the bundle.
 */
@Component({
  selector: 'app-how-it-works-preview',
  templateUrl: './how-it-works-preview.component.html',
  styleUrls: ['./preview.shared.scss', './how-it-works-preview.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HowItWorksPreviewComponent extends PreviewBase {
  readonly steps = STEPS;

  constructor(host: ElementRef<HTMLElement>, zone: NgZone) {
    super(host, zone);
  }

  protected buildTimeline(tl: gsap.core.Timeline): void {
    tl.repeat(-1).repeatDelay(2.6);
    tl.fromTo(
      this.q('.connector'),
      { scaleX: 0 },
      { scaleX: 1, duration: 0.9, ease: 'power2.inOut', transformOrigin: 'left center' }
    ).from(
      this.q('.step'),
      { opacity: 0, y: 20, duration: 0.4, stagger: 0.14, ease: 'power2.out' },
      '-=0.75'
    );
  }
}
