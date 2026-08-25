import {
  AfterContentInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ContentChildren,
  ElementRef,
  NgZone,
  OnDestroy,
  QueryList,
  ViewChild,
} from '@angular/core';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

import { JourneyActDirective } from './journey-act.directive';

gsap.registerPlugin(ScrollTrigger);

/** Matches `$breakpoint-lg` in src/styles/_tokens.scss. */
const PIN_BREAKPOINT = 992;

/**
 * Scroll-driven act sequence.
 *
 * ABOVE `$breakpoint-lg`: the stage pins and acts cross-fade as you scroll,
 * one viewport-height of scroll per act.
 *
 * BELOW IT: pinning is torn down entirely and acts render as ordinary stacked
 * sections with in-view reveals. Pinned scrub on a phone fights the browser's
 * own scroll physics and reads as jank rather than motion.
 *
 * Modelled on reeses-playoff-challenge's `scroll-journey.tsx`. The important
 * lesson carried over from that codebase: the WHOLE page is the journey. An
 * earlier version there was a vertical stack with one scrubbing section wedged
 * into the middle, and its own source comments record that it "read as two
 * different pages glued together."
 */
@Component({
  selector: 'app-scroll-journey',
  templateUrl: './scroll-journey.component.html',
  styleUrls: ['./scroll-journey.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ScrollJourneyComponent implements AfterContentInit, OnDestroy {
  @ContentChildren(JourneyActDirective) actQuery!: QueryList<JourneyActDirective>;

  @ViewChild('journey', { static: true }) journeyRef!: ElementRef<HTMLElement>;
  @ViewChild('stage', { static: true }) stageRef!: ElementRef<HTMLElement>;

  acts: JourneyActDirective[] = [];
  activeIndex = 0;

  private mm: gsap.MatchMedia | null = null;
  private pinned = false;

  constructor(private zone: NgZone, private cdr: ChangeDetectorRef) {}

  ngAfterContentInit(): void {
    this.acts = this.actQuery.toArray();
    this.cdr.markForCheck();

    const reduced =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (reduced) {
      // Every act visible, in document order, no pin. The still version has to
      // be the informative one — a first frame of an unstarted animation is a
      // blank page.
      this.revealAll();
      return;
    }

    // ScrollTrigger's own RAF plus our tweens have no business inside the
    // Angular zone — they would fire change detection on every frame.
    this.zone.runOutsideAngular(() => this.build());
  }

  ngOnDestroy(): void {
    this.mm?.revert();
    this.mm = null;
    // Belt and braces: matchMedia.revert() kills the triggers it created, but a
    // route change out of the landing page must not leave ANY pin attached to a
    // dead DOM.
    ScrollTrigger.getAll().forEach((t) => t.kill());
  }

  // ── Rail ──────────────────────────────────────────────────────────────

  goToAct(index: number): void {
    const act = this.acts[index];
    if (!act) return;

    if (!this.pinned) {
      act.host.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }

    // While pinned the acts are stacked at the same physical position, so
    // scrolling to the element is meaningless — translate the act index into a
    // scroll offset within the pinned range instead.
    const journey = this.journeyRef.nativeElement;
    const top = journey.offsetTop;
    window.scrollTo({
      top: top + index * window.innerHeight,
      behavior: 'smooth',
    });
  }

  // ── Setup ─────────────────────────────────────────────────────────────

  private build(): void {
    this.mm = gsap.matchMedia();

    this.mm.add(`(min-width: ${PIN_BREAKPOINT}px)`, () => {
      this.pinned = true;
      const els = this.actEls();
      const stage = this.stageRef.nativeElement;

      gsap.set(els, { position: 'absolute', inset: 0, autoAlpha: 0 });
      gsap.set(els[0], { autoAlpha: 1 });

      const trigger = ScrollTrigger.create({
        trigger: this.journeyRef.nativeElement,
        start: 'top top',
        end: () => `+=${els.length * window.innerHeight}`,
        pin: stage,
        pinSpacing: true,
        scrub: true,
        invalidateOnRefresh: true,
        onUpdate: (self) => {
          // `length - 1` intervals across the range, so the last act lands
          // exactly at progress 1 rather than a fraction short.
          const raw = self.progress * (els.length - 1);
          const index = Math.round(raw);
          this.crossfade(els, raw);
          this.setActive(index);
        },
      });

      return () => {
        trigger.kill();
        gsap.set(els, { clearProps: 'position,inset,opacity,visibility' });
        this.pinned = false;
      };
    });

    this.mm.add(`(max-width: ${PIN_BREAKPOINT - 1}px)`, () => {
      this.pinned = false;
      const els = this.actEls();
      const triggers = els.map((el, i) =>
        ScrollTrigger.create({
          trigger: el,
          start: 'top 75%',
          end: 'bottom 25%',
          onEnter: () => this.setActive(i),
          onEnterBack: () => this.setActive(i),
          onToggle: (self) => {
            if (self.isActive) gsap.to(el, { autoAlpha: 1, y: 0, duration: 0.5 });
          },
        })
      );
      gsap.set(els, { autoAlpha: 0, y: 24 });
      // The first act is above the fold — it must never wait for a scroll to
      // become visible.
      gsap.set(els[0], { autoAlpha: 1, y: 0 });

      return () => {
        triggers.forEach((t) => t.kill());
        gsap.set(els, { clearProps: 'opacity,visibility,transform' });
      };
    });
  }

  /**
   * Cross-fades between the two acts either side of the scrub position. Only
   * those two ever carry opacity, so no amount of scrubbing can leave a third
   * act faintly visible underneath.
   */
  private crossfade(els: HTMLElement[], raw: number): void {
    const lower = Math.floor(raw);
    const frac = raw - lower;

    els.forEach((el, i) => {
      let alpha = 0;
      if (i === lower) alpha = 1 - frac;
      else if (i === lower + 1) alpha = frac;
      gsap.set(el, { autoAlpha: alpha });
    });
  }

  private revealAll(): void {
    const els = this.actEls();
    gsap.set(els, { autoAlpha: 1, clearProps: 'transform' });
  }

  private actEls(): HTMLElement[] {
    return this.acts.map((a) => a.host.nativeElement);
  }

  private setActive(index: number): void {
    const clamped = Math.max(0, Math.min(index, this.acts.length - 1));
    if (clamped === this.activeIndex) return;
    this.activeIndex = clamped;
    // Back inside the zone just for this — the rail is the only Angular-bound
    // thing the scroll loop touches.
    this.zone.run(() => this.cdr.markForCheck());
  }
}
