import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

/**
 * The cover Xomify puts on a generated Wrapped playlist.
 *
 * NOT the month's top track's album art — that was the previous version and it
 * was wrong. A generated playlist gets a generated cover: Xomify's own mark and
 * the month it covers, which is what makes a row of them read as a series
 * rather than as four unrelated albums.
 */
@Component({
  selector: 'app-wrapped-cover',
  template: `
    <span class="cover" [class.cover--lg]="size === 'lg'" aria-hidden="true">
      <span class="cover-grad"></span>
      <img class="cover-mark" src="assets/img/logo-x-rework.png" alt="" />
      <span class="cover-text">
        <span class="cover-month">{{ month }}</span>
        <span class="cover-year">{{ year }}</span>
      </span>
    </span>
  `,
  styleUrls: ['./wrapped-cover.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WrappedCoverComponent {
  @Input({ required: true }) month!: string;
  @Input() year = '2026';
  @Input() size: 'sm' | 'lg' = 'lg';
}
