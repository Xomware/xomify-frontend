import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

/**
 * Stand-in album art for the landing previews.
 *
 * WHY NOT REAL COVERS: the landing page is public marketing, and shipping real
 * album art there is a licensing problem the app itself doesn't have (inside
 * the product, covers come from Spotify for the user's own library).
 *
 * The first version was a bare gradient square, which read as a broken image
 * rather than a placeholder. This adds the two cues that make a small square
 * legible as a record sleeve: a soft off-centre sheen, and a ring. The initial
 * gives each one an identity so a list of six doesn't look like swatches.
 */
@Component({
  selector: 'app-preview-art',
  template: `
    <span
      class="art"
      [class.art--lg]="size === 'lg'"
      [style.background]="gradient"
      aria-hidden="true"
    >
      <span class="art-sheen"></span>
      <span class="art-ring"></span>
      <span class="art-initial">{{ initial }}</span>
    </span>
  `,
  styleUrls: ['./preview-art.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PreviewArtComponent {
  @Input({ required: true }) art!: readonly [string, string];
  @Input() label = '';
  @Input() size: 'sm' | 'lg' = 'sm';

  get gradient(): string {
    return `linear-gradient(135deg, ${this.art[0]} 0%, ${this.art[1]} 100%)`;
  }

  get initial(): string {
    return (this.label || '').trim().charAt(0).toUpperCase();
  }
}
