import { ChangeDetectionStrategy, ChangeDetectorRef, Component, ElementRef, NgZone } from '@angular/core';
import { gsap } from 'gsap';

import { PreviewBase } from './preview-base';
import { SHARE_FEED, SharePost } from '../landing-fixtures';

/**
 * The shares feed — multiple posts scrolling past, on a loop.
 *
 * The first version showed a single static card. A feed is a stream, and one
 * frozen card of it reads as a mockup; the whole point of the feature is that
 * things keep arriving and people keep responding.
 */
@Component({
  selector: 'app-share-card-preview',
  templateUrl: './share-card-preview.component.html',
  styleUrls: ['./preview.shared.scss', './share-card-preview.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShareCardPreviewComponent extends PreviewBase {
  readonly stars = [1, 2, 3, 4, 5];

  /** Doubled so the scroll can wrap without a visible seam. */
  readonly posts: SharePost[] = [...SHARE_FEED, ...SHARE_FEED];

  /** Height of one card + gap, in px — must match the SCSS. */
  private static readonly CARD_H = 168;

  constructor(host: ElementRef<HTMLElement>, zone: NgZone, private cdr: ChangeDetectorRef) {
    super(host, zone);
  }

  protected buildTimeline(tl: gsap.core.Timeline): void {
    tl.repeat(-1);

    const track = this.q('.feed-track')[0];
    if (!track) return;

    tl.from(this.q('.share-card')[0], { opacity: 0, y: 18, duration: 0.45, ease: 'power2.out' });
    tl.from(this.q('.share-card')[0]?.querySelectorAll('.reaction') ?? [], {
      opacity: 0, scale: 0.4, duration: 0.3, stagger: 0.08, ease: 'back.out(2.2)',
    }, '-=0.15');

    // Scroll one card at a time through the original set, then snap back to
    // the top instantly — the duplicated tail means the snap is invisible.
    SHARE_FEED.forEach((_, index) => {
      tl.to({}, { duration: 1.5 });
      tl.to(track, {
        y: -((index + 1) * ShareCardPreviewComponent.CARD_H),
        duration: 0.55,
        ease: 'power2.inOut',
      });
    });
    tl.set(track, { y: 0 });
  }
}
