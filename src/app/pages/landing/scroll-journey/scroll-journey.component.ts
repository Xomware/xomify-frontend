import {
  AfterContentInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ContentChildren,
  ElementRef,
  EventEmitter,
  NgZone,
  OnDestroy,
  Output,
  QueryList,
  ViewChild,
} from '@angular/core';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

import { JourneyActDirective } from './journey-act.directive';

gsap.registerPlugin(ScrollTrigger);

/** Matches `$breakpoint-lg` in src/styles/_tokens.scss. */
const RAIL_BREAKPOINT = 992;

/**
 * Scroll-driven act sequence.
 *
 * ACTS STAY IN NORMAL FLOW. Each is a full-height section, revealed as it
 * scrolls into view, with a rail tracking position.
 *
 * WHY NOT PINNED (the first version was, and it broke in production): pinning
 * the stage meant absolutely positioning every act inside it and cross-fading
 * between them. Absolute children give their parent no height, so the stage
 * collapsed to a single viewport, all ten acts stacked at the same coordinates,
 * and the page footer rendered straight through the middle of them. The
 * cross-fade was the only thing hiding nine of those ten acts — so the moment
 * anything prevented it applying, every act was visible at once, on top of each
 * other.
 *
 * That is a layout whose correctness depends on an animation succeeding. This
 * one cannot fail that way: if every tween here no-opped, the page would still
 * be ten readable sections stacked vertically, in order, with the footer
 * underneath.
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

  /** Emits the index of the act now in view, so previews can play on arrival. */
  @Output() actChange = new EventEmitter<number>();

  acts: JourneyActDirective[] = [];
  activeIndex = 0;

  private triggers: ScrollTrigger[] = [];
  private reducedMotion = false;

  constructor(private zone: NgZone, private cdr: ChangeDetectorRef) {}

  ngAfterContentInit(): void {
    this.acts = this.actQuery.toArray();
    this.cdr.markForCheck();

    this.reducedMotion =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Reduced motion still gets the rail and the active-act tracking — it just
    // never animates anything. The content is identical either way, which is
    // the point.
    this.zone.runOutsideAngular(() => this.build());
  }

  ngOnDestroy(): void {
    window.removeEventListener('load', this.onLoadRefresh);
    this.triggers.forEach((t) => t.kill());
    this.triggers = [];
    // A route change out of the landing page must not leave triggers attached
    // to a dead DOM.
    ScrollTrigger.getAll().forEach((t) => t.kill());
  }

  // ── Rail ──────────────────────────────────────────────────────────────

  goToAct(index: number): void {
    const act = this.acts[index];
    if (!act) return;
    act.host.nativeElement.scrollIntoView({
      // An explicit 'smooth' overrides the CSS `scroll-behavior: auto` that
      // styles.scss sets under reduced motion, so the check happens here.
      behavior: this.reducedMotion ? 'auto' : 'smooth',
      block: 'start',
    });
  }

  // ── Setup ─────────────────────────────────────────────────────────────

  private build(): void {
    const els = this.acts.map((a) => a.host.nativeElement);
    if (!els.length) return;

    els.forEach((el, index) => {
      // Position tracking, always — this drives the rail and tells previews
      // when to play. Independent of whether anything animates.
      this.triggers.push(
        ScrollTrigger.create({
          trigger: el,
          start: 'top 60%',
          end: 'bottom 40%',
          onEnter: () => this.setActive(index),
          onEnterBack: () => this.setActive(index),
        })
      );

      if (this.reducedMotion) return;

      // The reveal. Targets the act's own children, which always exist —
      // nothing to remember to tag in the template.
      //
      // It animates FROM a transform rather than from `opacity: 0` in CSS: if
      // scripting fails or ScrollTrigger never fires, the act is already
      // visible in its resting state rather than permanently blank. That is
      // the same principle the pinned version violated.
      this.triggers.push(
        ScrollTrigger.create({
          trigger: el,
          start: 'top 85%',
          once: true,
          onEnter: () => {
            gsap.from(el.querySelectorAll('.act-inner > *'), {
              opacity: 0,
              y: 28,
              duration: 0.6,
              stagger: 0.08,
              ease: 'power2.out',
              clearProps: 'transform',
            });
          },
        })
      );
    });

    // First act is above the fold and must be active on load without waiting
    // for a scroll event.
    this.setActive(0);

    // Refresh after layout settles. Fonts and the hero logo land after first
    // paint and shift every subsequent act's offsets; without this the
    // triggers are measured against a layout that no longer exists.
    ScrollTrigger.refresh();
    if (document.readyState !== 'complete') {
      window.addEventListener('load', this.onLoadRefresh, { once: true });
    }
  }

  private readonly onLoadRefresh = () => ScrollTrigger.refresh();

  private setActive(index: number): void {
    const clamped = Math.max(0, Math.min(index, this.acts.length - 1));
    if (clamped === this.activeIndex && this.actChange.observers.length) return;
    this.activeIndex = clamped;
    this.zone.run(() => {
      this.actChange.emit(clamped);
      this.cdr.markForCheck();
    });
  }

  /** Rail is desktop-only — it has nowhere to live on a phone. */
  get railVisible(): boolean {
    return typeof window !== 'undefined' && window.innerWidth >= RAIL_BREAKPOINT;
  }
}
