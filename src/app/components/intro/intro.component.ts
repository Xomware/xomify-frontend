import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  NgZone,
  afterNextRender,
  inject,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { DOCUMENT } from '@angular/common';

import { HANDOFF, createScene } from './intro-scene';

// Matches the scene's fade at the end of intro.component.scss.
export const INTRO_LENGTH = 5500;
// Just before the logo starts its flight onto the landing's, late enough that the lazy
// landing route has rendered.
export const AIM_AT = HANDOFF - 150;

interface Aim {
  x: number;
  y: number;
  scale: number;
}

/**
 * The ~5.5 s landing intro: a record spins up on a turntable in a hazy listening room, the
 * needle drops, the track builds, holds its breath for a beat, and drops into the Xomify
 * wordmark, which flies onto the landing's own logo. Drawn by intro-scene.ts as a pure
 * function of time, outside Angular's zone. `index.html` paints the opening frame (the empty
 * room) before any JS; keep the two in step.
 */
@Component({
  selector: 'app-intro',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './intro.component.html',
  styleUrl: './intro.component.scss',
  host: { role: 'region', 'aria-label': 'Xomify intro', '(document:keydown.escape)': 'done.emit()' },
})
export class IntroComponent {
  readonly done = output<void>();
  // Where the logo flies to sit exactly on the landing's hero logo; null fades it out in
  // place instead.
  readonly aim = signal<Aim | null>(null);

  private readonly doc = inject(DOCUMENT);
  private readonly host: HTMLElement = inject(ElementRef).nativeElement;
  private readonly haze = viewChild.required<ElementRef<HTMLCanvasElement>>('haze');
  private readonly gear = viewChild.required<ElementRef<HTMLCanvasElement>>('gear');
  private readonly card = viewChild.required<ElementRef<HTMLCanvasElement>>('card');
  private readonly deck = viewChild.required<ElementRef<HTMLElement>>('deck');
  private readonly mark = viewChild.required<ElementRef<HTMLElement>>('mark');
  private readonly tagline = viewChild.required<ElementRef<HTMLElement>>('tagline');

  constructor() {
    const destroyRef = inject(DestroyRef);
    const zone = inject(NgZone);
    afterNextRender(() => {
      // The scene has painted over the poster, which can go.
      this.doc.documentElement.dataset['intro'] = 'playing';
      const timers = [
        setTimeout(() => this.aimAtLanding(), AIM_AT),
        setTimeout(() => this.done.emit(), INTRO_LENGTH),
      ];
      let frame = 0;
      zone.runOutsideAngular(() => {
        const draw = createScene({
          haze: this.haze().nativeElement,
          gear: this.gear().nativeElement,
          card: this.card().nativeElement,
          deck: this.deck().nativeElement,
          logo: this.mark().nativeElement,
          tagline: this.tagline().nativeElement,
        });
        const start = performance.now();
        const tick = (): void => {
          const t = performance.now() - start;
          draw(t);
          if (t < INTRO_LENGTH) frame = requestAnimationFrame(tick);
        };
        tick();
      });
      destroyRef.onDestroy(() => {
        timers.forEach(clearTimeout);
        cancelAnimationFrame(frame);
      });
    });
  }

  private aimAtLanding(): void {
    const target = this.doc.querySelector('.hero-logo')?.getBoundingClientRect();
    const logo = this.host.querySelector('.logo')?.getBoundingClientRect();
    if (!target?.width || !logo?.width) return;
    this.aim.set({
      x: target.left + target.width / 2 - (logo.left + logo.width / 2),
      y: target.top + target.height / 2 - (logo.top + logo.height / 2),
      scale: target.width / logo.width,
    });
  }
}
