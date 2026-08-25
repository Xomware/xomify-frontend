import { ChangeDetectionStrategy, Component, ElementRef, NgZone } from '@angular/core';
import { gsap } from 'gsap';

import { PreviewBase, artStyle } from './preview-base';
import { DISCOVERY_TILES } from '../landing-fixtures';

/**
 * Deliberately the quietest preview on the page — it follows the busiest
 * (shares), and two loud acts back to back read as noise.
 */
@Component({
  selector: 'app-discovery-preview',
  templateUrl: './discovery-preview.component.html',
  styleUrls: ['./preview.shared.scss', './discovery-preview.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DiscoveryPreviewComponent extends PreviewBase {
  readonly tiles = DISCOVERY_TILES;
  readonly art = artStyle;

  constructor(host: ElementRef<HTMLElement>, zone: NgZone) {
    super(host, zone);
  }

  protected buildTimeline(tl: gsap.core.Timeline): void {
    tl.from(this.q('.tile'), {
      opacity: 0,
      y: 18,
      duration: 0.45,
      stagger: 0.09,
      ease: 'power2.out',
    });
  }
}
