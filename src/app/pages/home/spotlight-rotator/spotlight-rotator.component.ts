import {
  Component,
  Input,
  OnChanges,
  OnDestroy,
  SimpleChanges,
} from '@angular/core';
import { animate, style, transition, trigger } from '@angular/animations';
import { NavigationExtras, Router } from '@angular/router';
import { ReducedMotionService } from 'src/app/services/reduced-motion.service';

export interface SpotlightSlide {
  id: string;
  kind: 'recent' | 'top' | 'favorites' | 'broadcast';
  eyebrow: string;
  title: string;
  subtitle?: string;
  image?: string;
  cta?: string;
  link?: string[];
  queryParams?: Record<string, string>;
}

const ROTATE_MS = 8_000;

/**
 * "What's happening" rotating highlight cards. Pure presentational —
 * `@Input slides` is assembled by HomeComponent from whichever of
 * (recently-played / top-items / broadcasts / favorites) has loaded so far.
 * Auto-rotates unless `prefers-reduced-motion` is set, always pauses on
 * hover/focus, and exposes prev/next + dot controls as the required manual
 * override.
 */
@Component({
  selector: 'app-home-spotlight',
  templateUrl: './spotlight-rotator.component.html',
  styleUrls: ['./spotlight-rotator.component.scss'],
  animations: [
    // Crossfade + slight rise whenever the bound value changes (works on a
    // persistent element, not just *ngIf enter/leave — see
    // https://angular.dev/guide/animations, "any state change" transitions).
    trigger('crossfade', [
      transition('* => *', [
        style({ opacity: 0, transform: 'translateY(6px)' }),
        animate('280ms ease-out', style({ opacity: 1, transform: 'translateY(0)' })),
      ]),
    ]),
  ],
  host: {
    // Skip the animation entirely under prefers-reduced-motion — content
    // still swaps instantly (no hard-cut flash), just without the motion.
    '[@.disabled]': 'reducedMotion.prefersReducedMotion()',
  },
})
export class SpotlightRotatorComponent implements OnChanges, OnDestroy {
  @Input() slides: SpotlightSlide[] = [];

  /**
   * True while HomeComponent's fetches are still in flight and nothing has
   * resolved yet. Distinguishes "still loading" from "genuinely nothing to
   * show" (`slides` is `[]` in both cases otherwise) so this module renders
   * a skeleton instead of silently disappearing on first paint.
   */
  @Input() loading = false;

  activeIndex = 0;
  paused = false;

  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private router: Router,
    // Public — read directly from the `[@.disabled]` host binding above.
    public reducedMotion: ReducedMotionService,
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['slides']) {
      if (this.activeIndex >= this.slides.length) {
        this.activeIndex = 0;
      }
      this.restartTimer();
    }
  }

  ngOnDestroy(): void {
    this.clearTimer();
  }

  get activeSlide(): SpotlightSlide | null {
    return this.slides[this.activeIndex] ?? null;
  }

  next(): void {
    if (this.slides.length === 0) return;
    this.activeIndex = (this.activeIndex + 1) % this.slides.length;
    this.restartTimer();
  }

  previous(): void {
    if (this.slides.length === 0) return;
    this.activeIndex = (this.activeIndex - 1 + this.slides.length) % this.slides.length;
    this.restartTimer();
  }

  goTo(index: number): void {
    this.activeIndex = index;
    this.restartTimer();
  }

  onCardActivate(slide: SpotlightSlide): void {
    if (!slide.link) return;
    const extras: NavigationExtras = slide.queryParams ? { queryParams: slide.queryParams } : {};
    this.router.navigate(slide.link, extras);
  }

  private restartTimer(): void {
    this.clearTimer();
    if (this.reducedMotion.prefersReducedMotion()) return;
    if (this.slides.length <= 1) return;
    this.timer = setInterval(() => {
      if (this.paused) return;
      this.activeIndex = (this.activeIndex + 1) % this.slides.length;
    }, ROTATE_MS);
  }

  private clearTimer(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}
