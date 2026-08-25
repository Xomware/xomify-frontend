import {
  AfterViewInit,
  Directive,
  ElementRef,
  Input,
  NgZone,
  OnDestroy,
} from '@angular/core';
import { gsap } from 'gsap';

/**
 * Shared machinery for the landing-page previews.
 *
 * THE BUG THIS EXISTS TO PREVENT: the journey cross-fades acts, so every
 * preview stays mounted for the life of the page and `active` flips true every
 * single time the user scrolls back to that act. Building a fresh timeline per
 * activation stacks them — by the third pass the animation is running at 3x and
 * the preview looks broken.
 *
 * So: the timeline is built exactly ONCE, paused, and `restart()`ed on each
 * activation. Idempotent by construction rather than by remembering.
 */
@Directive()
export abstract class PreviewBase implements AfterViewInit, OnDestroy {
  private _active = false;
  private tl: gsap.core.Timeline | null = null;
  private ready = false;
  protected reducedMotion = false;

  constructor(
    protected readonly host: ElementRef<HTMLElement>,
    protected readonly zone: NgZone
  ) {}

  @Input()
  set active(value: boolean) {
    const was = this._active;
    this._active = value;
    if (value && !was) this.play();
  }
  get active(): boolean {
    return this._active;
  }

  ngAfterViewInit(): void {
    this.reducedMotion =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    this.zone.runOutsideAngular(() => {
      this.tl = gsap.timeline({ paused: true });
      this.buildTimeline(this.tl);
      this.ready = true;

      if (this.reducedMotion) {
        // The RESOLVED state, not the first frame. A still frame of an
        // unstarted animation is an empty box, which tells a visitor nothing
        // about what the feature looks like.
        this.tl.progress(1).pause();
        return;
      }

      // An act that is already on screen at load (the hero's neighbour after a
      // refresh mid-page) must not sit at frame zero waiting for a flip.
      if (this._active) this.tl.restart();
    });
  }

  ngOnDestroy(): void {
    this.tl?.kill();
    this.tl = null;
  }

  private play(): void {
    if (!this.ready || !this.tl || this.reducedMotion) return;
    this.zone.runOutsideAngular(() => this.tl?.restart());
  }

  /** Query within this preview's own DOM — never the document. */
  protected q(selector: string): HTMLElement[] {
    return Array.from(this.host.nativeElement.querySelectorAll(selector));
  }

  /** Build the (paused) timeline. Called once. */
  protected abstract buildTimeline(tl: gsap.core.Timeline): void;
}

/** Shared cover-art gradient, so every preview draws "album art" identically. */
export function artStyle(art: readonly [string, string]): string {
  return `linear-gradient(135deg, ${art[0]} 0%, ${art[1]} 100%)`;
}
