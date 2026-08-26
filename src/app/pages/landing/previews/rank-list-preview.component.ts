import { ChangeDetectionStrategy, ChangeDetectorRef, Component, ElementRef, NgZone } from '@angular/core';
import { gsap } from 'gsap';

import { PreviewBase } from './preview-base';
import {
  RankedArtist,
  RankedTrack,
  TASTE_TABS,
  TIME_RANGES,
  TOP_ALBUMS,
  TOP_ARTISTS,
  TOP_SONGS,
} from '../landing-fixtures';

type Row = RankedTrack | RankedArtist;

/**
 * Top Songs / Artists / Albums, cycling through both the tab and the time
 * range, on a loop.
 *
 * NO GSAP FLIP HERE, deliberately. The first version used `Flip.from(...,
 * { absolute: true })` for the reorder, which lifts every row out of flow for
 * the duration — the card collapsed and only the moving row kept its
 * background. Rows are absolutely positioned by index against a fixed-height
 * track instead, so the container's height never depends on the animation.
 */
@Component({
  selector: 'app-rank-list-preview',
  templateUrl: './rank-list-preview.component.html',
  styleUrls: ['./preview.shared.scss', './rank-list-preview.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RankListPreviewComponent extends PreviewBase {
  readonly tabs = TASTE_TABS;
  readonly ranges = TIME_RANGES;

  tabIndex = 0;
  rangeIndex = 0;

  /** Row height in px — must match `$row-h` in the SCSS. */
  static readonly ROW_H = 40;

  constructor(host: ElementRef<HTMLElement>, zone: NgZone, private cdr: ChangeDetectorRef) {
    super(host, zone);
  }

  get source(): readonly Row[] {
    if (this.tabIndex === 1) return TOP_ARTISTS;
    if (this.tabIndex === 2) return TOP_ALBUMS;
    return TOP_SONGS;
  }

  /** Rows in their current ranked order for the active time range. */
  get rows(): Row[] {
    return [...this.source].sort(
      (a, b) => a.ranks[this.rangeIndex] - b.ranks[this.rangeIndex],
    );
  }

  get trackHeight(): number {
    return this.source.length * RankListPreviewComponent.ROW_H;
  }

  /** Stable identity so Angular reuses DOM nodes across reorders. */
  trackByTitle(_index: number, row: Row): string {
    return row.title;
  }

  offsetFor(row: Row): number {
    return (row.ranks[this.rangeIndex] - 1) * RankListPreviewComponent.ROW_H;
  }

  protected buildTimeline(tl: gsap.core.Timeline): void {
    tl.repeat(-1);

    tl.from(this.q('.rank-row'), {
      opacity: 0,
      x: -14,
      duration: 0.45,
      stagger: 0.07,
      ease: 'power2.out',
    });

    // Walk every combination: three time ranges within each of three tabs.
    for (let step = 0; step < 9; step += 1) {
      tl.to({}, { duration: 1.9 });
      tl.call(() => this.advance());
      // Re-settle the rows AFTER the reorder, with a stagger.
      //
      // The reorder itself used to be a bare CSS transition on every row at
      // once, which is what made it read as herky-jerky: nine rows starting
      // and stopping in perfect lockstep looks mechanical, and a dataset swap
      // on a tab change snapped rather than moved. Animating from a small
      // offset with a stagger gives the movement a direction and a settle.
      tl.fromTo(
        () => this.q('.rank-row'),
        { y: '+=10', opacity: 0.35 },
        { y: '+=0', opacity: 1, duration: 0.55, stagger: 0.05, ease: 'power2.out', clearProps: 'opacity' },
      );
    }
  }

  private advance(): void {
    this.rangeIndex += 1;
    if (this.rangeIndex >= this.ranges.length) {
      this.rangeIndex = 0;
      this.tabIndex = (this.tabIndex + 1) % this.tabs.length;
    }
    // Outside the Angular zone (the timeline runs there), so the reorder needs
    // an explicit pass or the DOM never moves.
    this.zone.run(() => this.cdr.detectChanges());
  }
}
