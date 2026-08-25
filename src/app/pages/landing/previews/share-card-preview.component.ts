import { ChangeDetectionStrategy, Component, ElementRef, NgZone } from '@angular/core';
import { gsap } from 'gsap';

import { PreviewBase, artStyle } from './preview-base';
import { SHARE_PREVIEW } from '../landing-fixtures';

/**
 * The social half of the product: a share arriving, then the response coming
 * back. This is the busiest preview on the page on purpose — it carries the
 * one thing a chat-app share cannot do.
 */
@Component({
  selector: 'app-share-card-preview',
  templateUrl: './share-card-preview.component.html',
  styleUrls: ['./preview.shared.scss', './share-card-preview.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShareCardPreviewComponent extends PreviewBase {
  readonly share = SHARE_PREVIEW;
  readonly stars = [1, 2, 3, 4, 5];
  readonly art = artStyle;

  constructor(host: ElementRef<HTMLElement>, zone: NgZone) {
    super(host, zone);
  }

  protected buildTimeline(tl: gsap.core.Timeline): void {
    tl.from(this.q('.share-header, .share-track'), {
      opacity: 0,
      y: 16,
      duration: 0.4,
      stagger: 0.1,
      ease: 'power2.out',
    })
      .from(this.q('.reaction'), {
        opacity: 0,
        scale: 0.4,
        duration: 0.35,
        stagger: 0.09,
        ease: 'back.out(2.2)',
      }, '-=0.1')
      .from(this.q('.comment'), { opacity: 0, y: 10, duration: 0.35 }, '-=0.05')
      .from(this.q('.star--on'), {
        opacity: 0,
        scale: 0.3,
        duration: 0.25,
        stagger: 0.09,
        ease: 'back.out(2.5)',
      }, '-=0.15')
      .from(this.q('.listened'), { opacity: 0, x: -8, duration: 0.3 }, '-=0.2');
  }
}
