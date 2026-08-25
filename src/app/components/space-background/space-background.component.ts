import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Input,
  NgZone,
  OnDestroy,
  ViewChild,
} from '@angular/core';

/**
 * How loud the background is allowed to be.
 *
 * `full`    — the landing page. Three parallax star layers, drifting nebula,
 *             occasional shooting stars, coupled to scroll position.
 * `ambient` — behind the authed app. One static layer at low opacity that
 *             never competes with dense pages (Wrapped, Analysis, admin
 *             tables). No shooting stars, no scroll coupling.
 */
export type SpaceIntensity = 'full' | 'ambient';

interface LayerSpec {
  /** Stars in this layer, at a 1920x1080 reference viewport. */
  readonly count: number;
  readonly minRadius: number;
  readonly maxRadius: number;
  readonly minAlpha: number;
  readonly maxAlpha: number;
  /** Parallax rate. 0 = pinned to the viewport, 1 = scrolls with the page. */
  readonly parallax: number;
}

interface IntensitySpec {
  readonly layers: readonly LayerSpec[];
  readonly alphaScale: number;
  readonly nebulaAlpha: number;
  readonly nebulaSpeed: number;
  readonly twinkle: boolean;
  readonly shootingStars: boolean;
  readonly scrollReactive: boolean;
}

const SPECS: Record<SpaceIntensity, IntensitySpec> = {
  full: {
    layers: [
      { count: 260, minRadius: 0.4, maxRadius: 0.9, minAlpha: 0.25, maxAlpha: 0.55, parallax: 0.02 },
      { count: 140, minRadius: 0.7, maxRadius: 1.4, minAlpha: 0.35, maxAlpha: 0.75, parallax: 0.06 },
      { count: 60, minRadius: 1.1, maxRadius: 2.2, minAlpha: 0.55, maxAlpha: 1.0, parallax: 0.14 },
    ],
    alphaScale: 1,
    nebulaAlpha: 0.16,
    nebulaSpeed: 1,
    twinkle: true,
    shootingStars: true,
    scrollReactive: true,
  },
  ambient: {
    layers: [
      { count: 180, minRadius: 0.4, maxRadius: 1.1, minAlpha: 0.3, maxAlpha: 0.7, parallax: 0 },
    ],
    alphaScale: 0.3,
    nebulaAlpha: 0.07,
    nebulaSpeed: 0.35,
    twinkle: false,
    shootingStars: false,
    scrollReactive: false,
  },
};

/** Brand palette, carried over from the ambient-blob background this replaces. */
const NEBULA = [
  { color: '156, 10, 191', cx: 0.22, cy: 0.28, r: 0.55, phase: 0 },
  { color: '27, 220, 111', cx: 0.78, cy: 0.68, r: 0.5, phase: 2.1 },
  { color: '123, 34, 212', cx: 0.6, cy: 0.12, r: 0.42, phase: 4.2 },
];

const REFERENCE_AREA = 1920 * 1080;
/** Uncapped DPR on a 3x phone is 9x the fill rate for no visible gain. */
const MAX_DPR = 2;

interface ShootingStar {
  x: number;
  y: number;
  vx: number;
  vy: number;
  len: number;
  /** 0 -> 1 across the star's life. */
  t: number;
  speed: number;
}

/**
 * Canvas starfield behind the whole app.
 *
 * Replaces the previous GSAP blob background. That one animated six SVG `<g>`
 * nodes and appended/removed DOM for every lightning bolt — fine for six
 * things, wrong for several hundred stars. One canvas, one RAF loop, no
 * per-star DOM.
 *
 * WHY SPACE: xomware.com's own landing renders each app as a planet
 * (`xomware-frontend/src/app/data/planets.ts`). This continues the parent
 * site's visual language into the product rather than inventing a second one.
 *
 * The RAF loop runs OUTSIDE Angular (`NgZone.runOutsideAngular`) — a 60fps
 * loop inside the zone would trigger change detection on every frame across
 * the entire app.
 */
@Component({
  selector: 'app-space-background',
  templateUrl: './space-background.component.html',
  styleUrls: ['./space-background.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SpaceBackgroundComponent implements AfterViewInit, OnDestroy {
  /**
   * Defaults to `ambient` deliberately: a missed binding should degrade to the
   * quiet version, not put shooting stars behind the admin tables.
   */
  @Input() intensity: SpaceIntensity = 'ambient';

  @ViewChild('sky', { static: true }) skyRef!: ElementRef<HTMLCanvasElement>;

  private ctx: CanvasRenderingContext2D | null = null;
  private width = 0;
  private height = 0;

  // Parallel typed arrays rather than an array of objects — this is read every
  // frame for every star, and the flat layout keeps it cache-friendly.
  private starX = new Float32Array(0);
  private starY = new Float32Array(0);
  private starR = new Float32Array(0);
  private starA = new Float32Array(0);
  private starPhase = new Float32Array(0);
  private starParallax = new Float32Array(0);

  private shooting: ShootingStar[] = [];

  private rafId: number | null = null;
  private shootingTimer: ReturnType<typeof setTimeout> | null = null;
  private reducedMotion = false;
  private startTime = 0;

  private readonly onResize = () => this.resize();
  private readonly onVisibility = () => {
    if (document.hidden) {
      this.stopLoop();
    } else if (!this.reducedMotion) {
      this.startLoop();
    }
  };

  constructor(private zone: NgZone) {}

  ngAfterViewInit(): void {
    const canvas = this.skyRef.nativeElement;
    this.ctx = canvas.getContext('2d');
    if (!this.ctx) return;

    this.reducedMotion =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    this.resize();

    window.addEventListener('resize', this.onResize, { passive: true });
    document.addEventListener('visibilitychange', this.onVisibility);

    if (this.reducedMotion) {
      // One composed frame at t=0. Deliberately the RESOLVED look rather than
      // an empty canvas — a still frame of an unstarted animation is a blank
      // box, which is worse than no background at all.
      this.draw(0);
      return;
    }

    this.startTime = performance.now();
    this.startLoop();
    if (this.spec.shootingStars) this.scheduleShootingStar();
  }

  ngOnDestroy(): void {
    this.stopLoop();
    if (this.shootingTimer) {
      clearTimeout(this.shootingTimer);
      this.shootingTimer = null;
    }
    window.removeEventListener('resize', this.onResize);
    document.removeEventListener('visibilitychange', this.onVisibility);
  }

  private get spec(): IntensitySpec {
    return SPECS[this.intensity] ?? SPECS.ambient;
  }

  // ── Sizing ────────────────────────────────────────────────────────────

  private resize(): void {
    const canvas = this.skyRef.nativeElement;
    const ctx = this.ctx;
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    this.width = window.innerWidth;
    this.height = window.innerHeight;

    canvas.width = Math.floor(this.width * dpr);
    canvas.height = Math.floor(this.height * dpr);
    canvas.style.width = `${this.width}px`;
    canvas.style.height = `${this.height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Star positions are viewport-relative, so a resize invalidates them.
    // Regenerated HERE and nowhere else — never per frame.
    this.generateStars();

    if (this.reducedMotion) this.draw(0);
  }

  private generateStars(): void {
    const spec = this.spec;
    // Scale counts by actual viewport area so a phone isn't as dense as a
    // 4K monitor, clamped so a small window still reads as a star field.
    const areaScale = Math.min(
      Math.max((this.width * this.height) / REFERENCE_AREA, 0.35),
      1.6
    );

    const total = spec.layers.reduce(
      (sum, l) => sum + Math.round(l.count * areaScale),
      0
    );

    this.starX = new Float32Array(total);
    this.starY = new Float32Array(total);
    this.starR = new Float32Array(total);
    this.starA = new Float32Array(total);
    this.starPhase = new Float32Array(total);
    this.starParallax = new Float32Array(total);

    let i = 0;
    for (const layer of spec.layers) {
      const n = Math.round(layer.count * areaScale);
      for (let k = 0; k < n; k++, i++) {
        this.starX[i] = Math.random() * this.width;
        // Overscan vertically so parallax-shifted layers never expose an edge.
        this.starY[i] = Math.random() * this.height * 1.4 - this.height * 0.2;
        this.starR[i] =
          layer.minRadius + Math.random() * (layer.maxRadius - layer.minRadius);
        this.starA[i] =
          (layer.minAlpha + Math.random() * (layer.maxAlpha - layer.minAlpha)) *
          spec.alphaScale;
        this.starPhase[i] = Math.random() * Math.PI * 2;
        this.starParallax[i] = layer.parallax;
      }
    }
  }

  // ── Loop ──────────────────────────────────────────────────────────────

  private startLoop(): void {
    if (this.rafId !== null) return;
    this.zone.runOutsideAngular(() => {
      const tick = (now: number) => {
        this.draw(now - this.startTime);
        this.rafId = requestAnimationFrame(tick);
      };
      this.rafId = requestAnimationFrame(tick);
    });
  }

  private stopLoop(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  // ── Painting ──────────────────────────────────────────────────────────

  private draw(elapsed: number): void {
    const ctx = this.ctx;
    if (!ctx) return;

    const t = elapsed / 1000;
    ctx.clearRect(0, 0, this.width, this.height);

    this.drawNebula(ctx, t);
    this.drawStars(ctx, t);
    if (this.spec.shootingStars) this.drawShootingStars(ctx);
  }

  private drawNebula(ctx: CanvasRenderingContext2D, t: number): void {
    const spec = this.spec;
    const maxDim = Math.max(this.width, this.height);

    for (const cloud of NEBULA) {
      // Long, slow, non-repeating drift — two sines at different periods so
      // the loop never visibly repeats.
      const drift = t * 0.02 * spec.nebulaSpeed;
      const cx =
        (cloud.cx + Math.sin(drift + cloud.phase) * 0.05) * this.width;
      const cy =
        (cloud.cy + Math.cos(drift * 0.7 + cloud.phase) * 0.04) * this.height;
      const r = cloud.r * maxDim;

      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      grad.addColorStop(0, `rgba(${cloud.color}, ${spec.nebulaAlpha})`);
      grad.addColorStop(0.55, `rgba(${cloud.color}, ${spec.nebulaAlpha * 0.35})`);
      grad.addColorStop(1, `rgba(${cloud.color}, 0)`);

      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, this.width, this.height);
    }
  }

  private drawStars(ctx: CanvasRenderingContext2D, t: number): void {
    const spec = this.spec;
    // Read scroll ONCE per frame, never per star.
    const scroll = spec.scrollReactive ? window.scrollY || 0 : 0;

    ctx.globalCompositeOperation = 'lighter';

    for (let i = 0; i < this.starX.length; i++) {
      const alpha = spec.twinkle
        ? this.starA[i] * (0.62 + 0.38 * Math.sin(t * 1.7 + this.starPhase[i]))
        : this.starA[i];

      let y = this.starY[i] - scroll * this.starParallax[i];
      // Wrap through the overscanned band so parallax never runs out of sky.
      const band = this.height * 1.4;
      y = ((y + this.height * 0.2) % band + band) % band - this.height * 0.2;

      ctx.globalAlpha = alpha;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(this.starX[i], y, this.starR[i], 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  // ── Shooting stars ────────────────────────────────────────────────────

  /**
   * Cadence borrowed from the outgoing background's `scheduleLightning()` —
   * self-rescheduling randomized timer. That structure was sound; only the
   * thing being drawn changed.
   */
  private scheduleShootingStar(): void {
    const delay = 2600 + Math.random() * 7000;
    this.shootingTimer = setTimeout(() => {
      this.spawnShootingStar();
      this.scheduleShootingStar();
    }, delay);
  }

  private spawnShootingStar(): void {
    if (document.hidden) return;
    // Enter from the top edge, travelling down-right at a shallow angle.
    const angle = Math.PI * (0.12 + Math.random() * 0.12);
    this.shooting.push({
      x: Math.random() * this.width * 0.8,
      y: Math.random() * this.height * 0.35,
      vx: Math.cos(angle),
      vy: Math.sin(angle),
      len: 90 + Math.random() * 140,
      t: 0,
      speed: 7 + Math.random() * 6,
    });
  }

  private drawShootingStars(ctx: CanvasRenderingContext2D): void {
    if (!this.shooting.length) return;

    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';

    for (let i = this.shooting.length - 1; i >= 0; i--) {
      const s = this.shooting[i];
      s.t += 0.016;
      s.x += s.vx * s.speed;
      s.y += s.vy * s.speed;

      // Fade in fast, out slow.
      const life = Math.min(s.t / 0.9, 1);
      const alpha = life < 0.2 ? life / 0.2 : 1 - (life - 0.2) / 0.8;

      const tailX = s.x - s.vx * s.len;
      const tailY = s.y - s.vy * s.len;
      const grad = ctx.createLinearGradient(s.x, s.y, tailX, tailY);
      grad.addColorStop(0, `rgba(255, 255, 255, ${alpha})`);
      grad.addColorStop(0.4, `rgba(211, 164, 232, ${alpha * 0.5})`);
      grad.addColorStop(1, 'rgba(255, 255, 255, 0)');

      ctx.strokeStyle = grad;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(tailX, tailY);
      ctx.stroke();

      if (life >= 1 || s.x > this.width + s.len || s.y > this.height + s.len) {
        this.shooting.splice(i, 1);
      }
    }

    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }
}
