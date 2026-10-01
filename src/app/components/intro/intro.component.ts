import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  inject,
  output,
  signal,
} from '@angular/core';
import { DOCUMENT } from '@angular/common';

// Matches the exit fade at the end of intro.component.scss.
export const INTRO_LENGTH = 5800;
// Just before the logo starts its flight onto the landing's (5.2 s), late
// enough that the lazy landing route has rendered.
export const AIM_AT = 5050;

interface Bar {
  angle: number;
  color: string;
  // Tallest the bar gets, 0..1 of its length.
  peak: number;
  duration: number;
  delay: number;
}

interface Aim {
  x: number;
  y: number;
  scale: number;
}

interface Card {
  label: string;
  value: string;
  note: string;
  // Original cover art made for the intro, never a real release's; the hero
  // card shows the Wrapped cover instead.
  cover: { src: string; title: string } | null;
  // Position in the fan, -2..2 left to right.
  slot: number;
}

// Seeded so the equalizer moves the same way on every load.
function random(seed: number): () => number {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
}

// Smooth noise round a ring: neighbouring bars move together, the way a
// spectrum does, rather than each one twitching on its own.
function ringNoise(seed: number, knots: number): (angle: number) => number {
  const r = random(seed);
  const values = Array.from({ length: knots }, r);
  return (angle) => {
    const pos = (angle / 360) * knots;
    const i = Math.floor(pos);
    const t = (1 - Math.cos((pos - i) * Math.PI)) / 2;
    return values[i % knots] * (1 - t) + values[(i + 1) % knots] * t;
  };
}

// Hue around the ring: violet at the top, cyan right, green bottom, magenta
// left — the logo's circle and X colours, muted so the record stays the
// brightest thing on screen.
const STOPS = [
  [275, 46, 66],
  [189, 46, 62],
  [158, 42, 60],
  [312, 44, 66],
  [275, 46, 66],
];

function ringColor(angle: number): string {
  const pos = (angle / 360) * (STOPS.length - 1);
  const i = Math.floor(pos);
  const t = pos - i;
  const [h1, s1, l1] = STOPS[i];
  const [h2, s2, l2] = STOPS[Math.min(i + 1, STOPS.length - 1)];
  let dh = h2 - h1;
  if (dh > 180) dh -= 360;
  if (dh < -180) dh += 360;
  const h = (h1 + dh * t + 360) % 360;
  return `hsl(${h.toFixed(1)} ${s1 + (s2 - s1) * t}% ${l1 + (l2 - l1) * t}%)`;
}

const next = random(7);
const level = ringNoise(11, 9);
const phase = ringNoise(23, 6);
const BAR_COUNT = 72;

export const BARS: readonly Bar[] = Array.from({ length: BAR_COUNT }, (_, i) => {
  const angle = (i * 360) / BAR_COUNT;
  return {
    angle,
    color: ringColor(angle),
    peak: Number((0.3 + level(angle) * 0.7).toFixed(2)),
    duration: Math.round(420 + next() * 160),
    delay: -Math.round(phase(angle) * 900 + next() * 80),
  };
});

const ART = 'assets/img/intro';
const month = new Date().toLocaleString('en-US', { month: 'long' });

// Illustrative: a signed-out visitor has no listening history to show yet.
// Short enough to read on the strip of each card the fan leaves showing.
export const CARDS: readonly Card[] = [
  { label: 'Top song', value: '#1', note: '312 plays', cover: { src: `${ART}/night-drive.jpg`, title: 'Night Drive' }, slot: -2 },
  { label: 'Minutes', value: '18.2k', note: 'listened', cover: { src: `${ART}/untitled-07.jpg`, title: 'Untitled 07' }, slot: -1 },
  { label: 'Genre', value: 'Indie', note: '38%', cover: { src: `${ART}/low-tide.jpg`, title: 'Low Tide' }, slot: 1 },
  { label: 'New finds', value: '47', note: 'artists', cover: { src: `${ART}/static-bloom.jpg`, title: 'Static Bloom' }, slot: 2 },
  { label: 'Monthly', value: 'Wrapped', note: month, cover: null, slot: 0 },
];

/**
 * The ~6 s landing intro: a record spins up on a turntable, the tonearm lowers
 * onto it, a spectrum rings the record, Wrapped-style cards fan out of it, and
 * the record shrinks into the circle of the Xomify logo. Pure CSS on transforms and opacity, so it
 * stays on the compositor. `index.html` paints this scene's first frame as a
 * poster before any JS; keep the two in step.
 */
@Component({
  selector: 'app-intro',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './intro.component.html',
  styleUrl: './intro.component.scss',
  host: { role: 'region', 'aria-label': 'Xomify intro' },
})
export class IntroComponent {
  readonly done = output<void>();
  readonly bars = BARS;
  readonly cards = CARDS;
  // Where the logo flies to sit exactly on the landing's hero logo; null
  // fades it out in place instead.
  readonly aim = signal<Aim | null>(null);

  private readonly doc = inject(DOCUMENT);
  private readonly host: HTMLElement = inject(ElementRef).nativeElement;

  constructor() {
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      // The scene has painted over the poster, which can go.
      this.doc.documentElement.dataset['intro'] = 'playing';
      const timers = [
        setTimeout(() => this.aimAtLanding(), AIM_AT),
        setTimeout(() => this.done.emit(), INTRO_LENGTH),
      ];
      destroyRef.onDestroy(() => timers.forEach(clearTimeout));
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
