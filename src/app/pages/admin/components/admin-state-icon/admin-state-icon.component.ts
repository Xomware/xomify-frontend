import { Component, Input } from '@angular/core';

/** Icon names available to `<app-admin-state-icon>`. */
export type AdminStateIconName = 'spinner' | 'warning' | 'check' | 'empty' | 'search' | 'megaphone';

/**
 * Small inline-SVG icon used by every Admin Portal panel's loading/empty/
 * error/success state blocks. Exists so no panel ever reaches for an emoji
 * (standing rule — Dom hates emojis, no exceptions in `/admin`). Purely
 * decorative (`aria-hidden`); the surrounding state block always carries the
 * real copy (`role="alert"`, `aria-live`, etc.) so screen readers aren't
 * affected either way.
 *
 * The `spinner` variant respects `prefers-reduced-motion` — it renders as a
 * static ring instead of a rotating one.
 */
@Component({
  selector: 'app-admin-state-icon',
  templateUrl: './admin-state-icon.component.html',
  styleUrls: ['./admin-state-icon.component.scss'],
})
export class AdminStateIconComponent {
  @Input() name: AdminStateIconName = 'empty';
}
