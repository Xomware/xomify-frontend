import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

/**
 * Generated album art for the landing previews.
 *
 * WHY GENERATED: the landing page is public marketing, and the app has no
 * Spotify session there to fetch real covers with — signed-out visitors have
 * no token. Inside the product, covers come from Spotify for the user's own
 * library; here there is nothing to fetch.
 *
 * The first version was a flat gradient square, which read as a broken image.
 * These are real compositions in the idiom of record sleeves — duotone fields
 * with a geometric figure — and there are six of them, chosen deterministically
 * per track, so a list of six covers looks like six different albums rather
 * than a row of colour swatches.
 */
@Component({
  selector: 'app-preview-art',
  template: `
    <span class="art" [class.art--lg]="size === 'lg'" aria-hidden="true">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" class="art-svg">
        <defs>
          <linearGradient [attr.id]="gradientId" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" [attr.stop-color]="art[0]" />
            <stop offset="100%" [attr.stop-color]="art[1]" />
          </linearGradient>
        </defs>

        <rect width="100" height="100" [attr.fill]="'url(#' + gradientId + ')'" />

        <!-- Sleeve figure. One of six, keyed off the title so the same track
             always gets the same cover. -->
        <ng-container [ngSwitch]="variant">
          <g *ngSwitchCase="0" opacity="0.85">
            <circle cx="50" cy="50" r="26" fill="none" stroke="#fff" stroke-width="3" opacity="0.5" />
            <circle cx="50" cy="50" r="9" fill="#fff" opacity="0.75" />
          </g>
          <g *ngSwitchCase="1" opacity="0.8">
            <rect x="16" y="58" width="14" height="30" fill="#fff" opacity="0.55" />
            <rect x="36" y="40" width="14" height="48" fill="#fff" opacity="0.75" />
            <rect x="56" y="22" width="14" height="66" fill="#fff" opacity="0.55" />
          </g>
          <g *ngSwitchCase="2" opacity="0.8">
            <path d="M12 76 L38 34 L58 62 L76 40 L88 76 Z" fill="#fff" opacity="0.6" />
          </g>
          <g *ngSwitchCase="3" opacity="0.75">
            <circle cx="36" cy="42" r="22" fill="#fff" opacity="0.45" />
            <circle cx="62" cy="60" r="22" fill="#fff" opacity="0.35" />
          </g>
          <g *ngSwitchCase="4" opacity="0.7">
            <rect x="0" y="34" width="100" height="4" fill="#fff" opacity="0.6" />
            <rect x="0" y="50" width="100" height="4" fill="#fff" opacity="0.45" />
            <rect x="0" y="66" width="100" height="4" fill="#fff" opacity="0.3" />
          </g>
          <g *ngSwitchDefault opacity="0.8">
            <path d="M50 18 L74 50 L50 82 L26 50 Z" fill="none" stroke="#fff" stroke-width="4" opacity="0.6" />
          </g>
        </ng-container>

        <!-- Off-centre sheen: the single cue that most makes a flat square
             read as a printed sleeve rather than a swatch. -->
        <rect width="100" height="100" [attr.fill]="'url(#' + sheenId + ')'" />
        <defs>
          <radialGradient [attr.id]="sheenId" cx="0.3" cy="0.22" r="0.75">
            <stop offset="0%" stop-color="#fff" stop-opacity="0.26" />
            <stop offset="60%" stop-color="#fff" stop-opacity="0" />
          </radialGradient>
        </defs>
      </svg>
    </span>
  `,
  styleUrls: ['./preview-art.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PreviewArtComponent {
  @Input({ required: true }) art!: readonly [string, string];
  @Input() label = '';
  @Input() size: 'sm' | 'lg' = 'sm';

  /** Stable per label, so a track keeps the same sleeve across re-renders. */
  get variant(): number {
    let hash = 0;
    for (const char of this.label) {
      hash = (hash * 31 + char.charCodeAt(0)) % 997;
    }
    return hash % 6;
  }

  // SVG gradient ids must be unique per instance or every cover on the page
  // inherits whichever one the browser resolved first.
  private readonly uid = Math.random().toString(36).slice(2, 8);
  get gradientId(): string {
    return `pa-g-${this.uid}`;
  }
  get sheenId(): string {
    return `pa-s-${this.uid}`;
  }
}
