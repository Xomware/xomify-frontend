import { ChangeDetectionStrategy, ChangeDetectorRef, Component, ElementRef, NgZone } from '@angular/core';
import { gsap } from 'gsap';
import { Flip } from 'gsap/Flip';

import { PreviewBase, artStyle } from './preview-base';
import { RANK_ENTRIES, RANK_WINDOWS, PreviewRankEntry } from '../landing-fixtures';

gsap.registerPlugin(Flip);

/** Top-tracks leaderboard, reshuffling as the time window advances. */
@Component({
  selector: 'app-rank-list-preview',
  templateUrl: './rank-list-preview.component.html',
  styleUrls: ['./preview.shared.scss', './rank-list-preview.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RankListPreviewComponent extends PreviewBase {
  readonly windows = RANK_WINDOWS;
  windowIndex = 0;
  entries: PreviewRankEntry[] = this.sortedFor(0);

  readonly art = artStyle;

  constructor(host: ElementRef<HTMLElement>, zone: NgZone, private cdr: ChangeDetectorRef) {
    super(host, zone);
  }

  protected buildTimeline(tl: gsap.core.Timeline): void {
    tl.from(this.q('.rank-row'), {
      opacity: 0,
      x: -16,
      duration: 0.4,
      stagger: 0.07,
      ease: 'power2.out',
    });

    // Advance the window twice, reshuffling the list each time. Flip measures
    // before/after positions and tweens the delta — hand-tweening row offsets
    // means recomputing them on every layout change.
    for (let step = 1; step <= 2; step++) {
      tl.call(() => this.advanceWindow(), undefined, `+=1.1`);
      tl.to({}, { duration: 0.6 });
    }
  }

  private advanceWindow(): void {
    const rows = this.q('.rank-row');
    const state = Flip.getState(rows);

    this.windowIndex = (this.windowIndex + 1) % this.windows.length;
    this.entries = this.sortedFor(this.windowIndex);
    // OnPush + a mutation from outside the zone: without this the DOM never
    // reorders and Flip has nothing to animate to.
    this.zone.run(() => this.cdr.detectChanges());

    Flip.from(state, {
      duration: 0.55,
      ease: 'power2.inOut',
      absolute: true,
    });
  }

  private sortedFor(windowIndex: number): PreviewRankEntry[] {
    return [...RANK_ENTRIES].sort((a, b) => a.ranks[windowIndex] - b.ranks[windowIndex]);
  }
}
