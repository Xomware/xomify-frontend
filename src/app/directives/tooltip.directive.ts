import {
  Directive,
  ElementRef,
  HostListener,
  Input,
  OnDestroy,
  Renderer2,
} from '@angular/core';

export type TooltipPosition = 'top' | 'bottom' | 'left' | 'right';

let nextTooltipId = 0;

/**
 * `[appTooltip]` — a small, reusable tooltip for explaining a control.
 *
 * Usage: `<button appTooltip="Filters the feed by genre">Genre</button>`
 *
 * Built for the Xomtracks feature (which needed to explain several controls
 * with no existing pattern to reuse — see
 * `docs/features/xomtracks-xomify-merge/PLAN.md`), but deliberately generic
 * so it can be dropped onto any element across xomify.
 *
 * Accessible:
 *  - Shows on hover AND keyboard focus (not hover-only).
 *  - The tooltip is a `role="tooltip"` element; the host's `aria-describedby`
 *    points at it only while shown (per the WAI-ARIA APG tooltip pattern).
 *  - Escape dismisses it while the host has focus.
 *  - Respects `prefers-reduced-motion` — no fade transition when set.
 *
 * Positioning is computed against the host's bounding rect and appended to
 * `document.body` (not inline) so it never clips inside `overflow: hidden`
 * containers (cards, modals, etc.).
 */
@Directive({
  selector: '[appTooltip]',
})
export class TooltipDirective implements OnDestroy {
  /** The tooltip's text. A falsy/empty value disables the directive entirely. */
  @Input('appTooltip') text = '';

  /** Preferred side. Falls back automatically if it would overflow the viewport. */
  @Input('appTooltipPosition') position: TooltipPosition = 'top';

  private tooltipEl: HTMLElement | null = null;
  private readonly id = `app-tooltip-${nextTooltipId++}`;

  constructor(
    private host: ElementRef<HTMLElement>,
    private renderer: Renderer2,
  ) {}

  @HostListener('mouseenter')
  @HostListener('focus')
  show(): void {
    if (!this.text || this.tooltipEl) return;

    const tip = this.renderer.createElement('span') as HTMLElement;
    this.renderer.addClass(tip, 'app-tooltip');
    this.renderer.setAttribute(tip, 'role', 'tooltip');
    this.renderer.setAttribute(tip, 'id', this.id);
    if (this.prefersReducedMotion()) {
      this.renderer.addClass(tip, 'app-tooltip--no-motion');
    }
    const text = this.renderer.createText(this.text);
    this.renderer.appendChild(tip, text);
    this.renderer.appendChild(document.body, tip);
    this.tooltipEl = tip;

    this.positionTooltip();
    this.host.nativeElement.setAttribute('aria-describedby', this.id);

    // Painted next frame so the fade-in transition actually runs.
    requestAnimationFrame(() => this.tooltipEl?.classList.add('app-tooltip--visible'));
  }

  @HostListener('mouseleave')
  @HostListener('blur')
  hide(): void {
    if (!this.tooltipEl) return;
    this.renderer.removeChild(document.body, this.tooltipEl);
    this.tooltipEl = null;
    this.host.nativeElement.removeAttribute('aria-describedby');
  }

  @HostListener('keydown.escape')
  onEscape(): void {
    this.hide();
  }

  ngOnDestroy(): void {
    this.hide();
  }

  private positionTooltip(): void {
    const tip = this.tooltipEl;
    if (!tip) return;
    const hostRect = this.host.nativeElement.getBoundingClientRect();
    const tipRect = tip.getBoundingClientRect();
    const gap = 8;

    let top = 0;
    let left = 0;
    let placed: TooltipPosition = this.position;

    // Flip top<->bottom when there isn't room, so the tooltip never renders
    // off-screen above a control near the top of the viewport (e.g. the
    // toolbar) or below one near the bottom.
    if (placed === 'top' && hostRect.top - tipRect.height - gap < 0) {
      placed = 'bottom';
    } else if (
      placed === 'bottom' &&
      hostRect.bottom + tipRect.height + gap > window.innerHeight
    ) {
      placed = 'top';
    }

    switch (placed) {
      case 'top':
        top = hostRect.top - tipRect.height - gap;
        left = hostRect.left + hostRect.width / 2 - tipRect.width / 2;
        break;
      case 'bottom':
        top = hostRect.bottom + gap;
        left = hostRect.left + hostRect.width / 2 - tipRect.width / 2;
        break;
      case 'left':
        top = hostRect.top + hostRect.height / 2 - tipRect.height / 2;
        left = hostRect.left - tipRect.width - gap;
        break;
      case 'right':
        top = hostRect.top + hostRect.height / 2 - tipRect.height / 2;
        left = hostRect.right + gap;
        break;
    }

    // Clamp horizontally so it never runs off the left/right viewport edge.
    left = Math.max(4, Math.min(left, window.innerWidth - tipRect.width - 4));

    this.renderer.setStyle(tip, 'top', `${top + window.scrollY}px`);
    this.renderer.setStyle(tip, 'left', `${left + window.scrollX}px`);
    this.renderer.setAttribute(tip, 'data-position', placed);
  }

  private prefersReducedMotion(): boolean {
    return (
      typeof window !== 'undefined' &&
      !!window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    );
  }
}
