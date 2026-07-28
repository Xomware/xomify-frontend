import {
  Component,
  Input,
  OnChanges,
  OnDestroy,
  SimpleChanges,
} from '@angular/core';
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
})
export class SpotlightRotatorComponent implements OnChanges, OnDestroy {
  @Input() slides: SpotlightSlide[] = [];

  activeIndex = 0;
  paused = false;

  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private router: Router,
    private reducedMotion: ReducedMotionService,
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
