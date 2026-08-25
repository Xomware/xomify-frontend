import { ChangeDetectionStrategy, Component, ElementRef, NgZone } from '@angular/core';
import { gsap } from 'gsap';

import { PreviewBase } from './preview-base';
import { DISCOVERY_TILES } from '../landing-fixtures';

/** Mood picks, concerts, news and likes — a quiet tile grid on a loop. */
@Component({
  selector: 'app-discovery-preview',
  templateUrl: './discovery-preview.component.html',
  styleUrls: ['./preview.shared.scss', './discovery-preview.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DiscoveryPreviewComponent extends PreviewBase {
  readonly tiles = DISCOVERY_TILES;

  constructor(host: ElementRef<HTMLElement>, zone: NgZone) {
    super(host, zone);
  }

  protected buildTimeline(tl: gsap.core.Timeline): void {
    tl.repeat(-1).repeatDelay(2.2);
    tl.from(this.q('.tile'), {
      opacity: 0,
      y: 16,
      duration: 0.42,
      stagger: 0.09,
      ease: 'power2.out',
    });
  }
}
