import { Component, Input } from '@angular/core';

/**
 * Small inline-SVG icon set — the app's replacement for emoji glyphs in the
 * UI (no emoji glyphs anywhere in rendered UI; see toolbar/CLAUDE conventions).
 * Purely decorative by default (`aria-hidden="true"` on the root `<svg>`) —
 * callers keep any accessible label on the surrounding interactive element
 * or an adjacent visible text node, matching how the old
 * `<span aria-hidden="true">...</span>` emoji glyphs were always paired
 * with real text/aria-labels elsewhere in these templates.
 *
 * Deliberately a single component with a name-keyed template (rather than
 * 30+ one-off inline `<svg>` blocks) so the whole icon set stays consistent
 * and easy to extend in one place.
 */
@Component({
  selector: 'app-icon',
  templateUrl: './icon.component.html',
  styleUrls: ['./icon.component.scss'],
})
export class IconComponent {
  @Input() name = '';
  @Input() size = 20;
}
