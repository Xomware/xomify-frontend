import { createHaze } from './intro-haze';
import { CARD_H, CardFrame, STATS_H, TRACKS, paintCard, paintStats } from './intro-panels';
import {
  Flare,
  Speaker,
  bakeMark,
  bakeRing,
  bakeSleeve,
  bakeSpeaker,
  drawLens,
  drawSpun,
} from './intro-sprites';

// The intro, drawn as a pure function of time so every frame can be rendered on its own, and
// cut to a 128 BPM track, in beats:
//   0   the room comes up; the camera is low and close, pushing in on the tonearm
//   2   the needle lands in close-up and the kick starts; the camera pulls back and orbits
//   3,4 skips: the now-playing card changes track on the beat, a sleeve slides past the lens
//   5   the stats panel builds like Wrapped: minutes rolling, genres, the year by month
//   8   the camera dives at the label
//   9   a beat of silence while the record spins up
//   10  the drop: the X lifts off the label, still turning
//   11  it lands upright as the Xomify wordmark, which holds until the handoff
// Back to front: the WebGL room, the turntable (DOM, framed by a camera transform), the
// out-of-focus foreground, the UI panels, the lifted X, and the lens.

export const BEAT = 60000 / 128;
const at = (beats: number): number => beats * BEAT;
export const NEEDLE = at(2);
const SKIPS = [at(3), at(4)];
const STATS = at(5);
const PUSH = at(8);
const SILENCE = at(9);
export const DROP = at(10);
export const LAND = at(11);
const GLINT = at(12);
export const HANDOFF = 6250;

const COVERS = 'assets/img/intro';
// Where logo-x-rework.png's disc sits inside banner-logo-x-rework.png (582 x 278): measured
// by matching the two discs. The X strokes themselves differ, hence the crossfade.
const MARK_IN_BANNER = { x: 2 / 582, y: 9 / 278, size: 240 / 582 };
// The mark on the label: the label is 36% of the record, the mark 58% of the label.
const LABEL = 0.36;
const MARK_ON_LABEL = 0.58;
// How big the mark is on screen when it leaves the record, against its size in the wordmark.
const LIFT_FROM = 0.82;
// deg/ms: 33⅓ rpm, and the speed the riser takes it to by the drop.
const RPM = 0.2;
const TOP = 1.44;
// Exposure per frame, for motion blur: half of a 60 fps frame.
const SHUTTER = 8.3;

const clamp = (v: number, lo = 0, hi = 1): number => Math.min(hi, Math.max(lo, v));
const smooth = (a: number, b: number, v: number): number => {
  const x = clamp((v - a) / (b - a));
  return x * x * (3 - 2 * x);
};
const easeOut = (x: number): number => 1 - Math.pow(1 - clamp(x), 4);
const inOut = (x: number): number => {
  const v = clamp(x);
  return v < 0.5 ? 4 * v * v * v : 1 - Math.pow(-2 * v + 2, 3) / 2;
};
// Settles like a damped mass: quick to start, long gentle landing, no overshoot.
const settle = (x: number): number => 1 - Math.pow(1 - clamp(x), 3);
const pulse = (t: number, start: number, decay: number): number =>
  t < start - 30 ? 0 : smooth(start - 30, start, t) * Math.exp(-Math.max(0, t - start) / decay);

// A kick drum: fast attack, exponential decay. Four on the floor once the needle is down,
// silent for the beat before the drop.
export function kick(t: number): number {
  if (t < NEEDLE || (t >= SILENCE && t < DROP)) return 0;
  return Math.exp(-((t - NEEDLE) % BEAT) / 110);
}

// The skylight: comes up as the room fades in, swells through the build, holds its breath
// for the silent beat.
function light(t: number): number {
  if (t >= DROP) return 0.5 + 0.06 * kick(t);
  const base = 0.38 + 0.5 * smooth(NEEDLE, SILENCE, t) + 0.1 * kick(t);
  return base * smooth(0, 900, t) * (1 - 0.55 * smooth(SILENCE, SILENCE + 90, t));
}

// Degrees turned: up to 33⅓ rpm in 0.8 s, then through the silent beat a riser whose speed
// grows with the square of time, to TOP at the drop, held after it.
function spin(t: number): number {
  let a = RPM * (t < 800 ? (t * t) / 1600 : t - 400);
  if (t > SILENCE) {
    const x = Math.min(t, DROP) - SILENCE;
    a += ((TOP - RPM) * x * x * x) / (3 * BEAT * BEAT);
    if (t > DROP) a += (TOP - RPM) * (t - DROP);
  }
  return a;
}

function spinRate(t: number): number {
  if (t < 800) return (RPM * t) / 800;
  if (t < SILENCE) return RPM;
  const x = Math.min(t, DROP) - SILENCE;
  return RPM + ((TOP - RPM) * x * x) / (BEAT * BEAT);
}

// The lifted mark's turn, from the record's speed at the drop down to upright at the landing:
// a Hermite curve with the start speed and a stop, ending on a whole turn far enough on that
// it never runs backwards.
const D = LAND - DROP;
const LIFT_FROM_ANGLE = spin(DROP) % 360;
const LIFT_SPEED = TOP * D;
const LIFT_TURN = 360 * Math.ceil((LIFT_FROM_ANGLE + LIFT_SPEED / 3) / 360) - LIFT_FROM_ANGLE;
function liftAngle(u: number): number {
  const x = clamp(u);
  return LIFT_FROM_ANGLE + LIFT_SPEED * (x * x * x - 2 * x * x + x) + LIFT_TURN * (3 * x * x - 2 * x * x * x);
}
function liftRate(u: number): number {
  const x = clamp(u);
  return (LIFT_SPEED * (3 * x * x - 4 * x + 1) + LIFT_TURN * (6 * x - 6 * x * x)) / D;
}

function meter(t: number, band: number, bands: number): number {
  if (t < NEEDLE) return 0;
  const low = 1 - band / bands;
  const hat = Math.exp(-(((t - NEEDLE + BEAT / 2) % BEAT) / 70));
  const jitter = 0.5 + 0.5 * Math.sin(t * 0.021 * (band + 1.3) + band * 2.1);
  const build = 0.7 + 0.3 * smooth(NEEDLE, STATS, t);
  return clamp((0.22 + 0.55 * kick(t) * low + 0.35 * hat * (1 - low) + 0.16 * jitter) * build, 0.04, 1);
}

interface Camera {
  z: number;
  // The point on the deck in frame, from the record's centre, and where on screen it sits,
  // from the record's resting place.
  fx: number;
  fy: number;
  sx: number;
  sy: number;
  tilt: number;
  yaw: number;
}

interface Layout {
  w: number;
  h: number;
  dpr: number;
  cx: number;
  cy: number;
  rec: number;
  scale: number;
  phone: boolean;
  cw: number;
  sw: number;
  stylus: [number, number];
  // The wordmark's disc on screen, centre and size.
  mx: number;
  my: number;
  ms: number;
  zEnd: number;
  speakerAt: [number, number];
  speaker: Speaker;
  sleeveW: number;
  sleeves: (HTMLCanvasElement | null)[];
  ring: HTMLCanvasElement | null;
  mark: HTMLCanvasElement | null;
  lift: HTMLCanvasElement | null;
}

function find<T extends Element>(root: ParentNode, selector: string): T {
  const el = root.querySelector<T>(selector);
  if (!el) throw new Error(`Intro is missing ${selector}`);
  return el;
}

function ctx2d(c: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('2D canvas unavailable');
  return ctx;
}

export function createScene(root: HTMLElement): (t: number) => void {
  const el = {
    haze: find<HTMLCanvasElement>(root, '.haze'),
    deck: find<HTMLElement>(root, '.deck'),
    record: find<HTMLElement>(root, '.record'),
    print: find<HTMLCanvasElement>(root, '.print'),
    sweep: find<HTMLElement>(root, '.sweep i'),
    shadow: find<HTMLElement>(root, '.lift-shadow'),
    gear: find<HTMLCanvasElement>(root, '.gear'),
    scrim: find<HTMLElement>(root, '.scrim'),
    card: find<HTMLCanvasElement>(root, '.now-playing'),
    stats: find<HTMLCanvasElement>(root, '.stats'),
    lift: find<HTMLCanvasElement>(root, '.lift'),
    lens: find<HTMLCanvasElement>(root, '.lens'),
    mark: find<HTMLElement>(root, '.mark-logo'),
    logo: find<HTMLImageElement>(root, '.logo'),
    glint: find<HTMLElement>(root, '.glint i'),
    tagline: find<HTMLElement>(root, '.tagline'),
  };
  const haze = createHaze(el.haze);
  const ctx = {
    gear: ctx2d(el.gear),
    card: ctx2d(el.card),
    stats: ctx2d(el.stats),
    print: ctx2d(el.print),
    lift: ctx2d(el.lift),
    lens: ctx2d(el.lens),
  };
  // Baking from an image that isn't decoded yet decodes it there and then, mid-frame; wait
  // for decode() instead. One that fails to load is left out of the scene.
  const decoded = new WeakSet<HTMLImageElement>();
  const image = (src: string): HTMLImageElement => {
    const img = new Image();
    img.src = src;
    img.decode().then(
      () => decoded.add(img),
      () => undefined,
    );
    return img;
  };
  const art = TRACKS.map((track) => image(`${COVERS}/${track.art}.jpg`));
  const markArt = image('assets/img/logo-x-rework.png');
  let lay: Layout | undefined;
  let printed = '';
  let lensClear = true;

  function layout(): Layout {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const phone = w < 640;
    const rec = el.record.offsetWidth;
    const cx = el.record.offsetLeft + rec / 2;
    const cy = el.record.offsetTop + rec / 2;
    const hazeScale = Math.min(0.5, 960 / w);
    el.haze.width = Math.round(w * hazeScale);
    el.haze.height = Math.round(h * hazeScale);
    // Out of focus, so below device resolution.
    const scale = Math.min(1, 0.7 * dpr);
    el.gear.width = Math.round(w * scale);
    el.gear.height = Math.round(h * scale);
    el.lens.width = Math.round(w * 0.5);
    el.lens.height = Math.round(h * 0.5);

    // The panels are drawn at phone size and scaled up on big screens.
    const ui = phone ? 1 : clamp(Math.min(w / 1200, h / 760), 1, 1.3);
    const cw = Math.min(w - 32, 460);
    sizeCanvas(el.card, cw, CARD_H, dpr, ui, false);
    const sw = Math.min(w - 32, 440);
    sizeCanvas(el.stats, sw, STATS_H, dpr, ui, true);

    const logo = el.logo.getBoundingClientRect();
    const ms = logo.width * MARK_IN_BANNER.size;
    const mx = logo.left + logo.width * MARK_IN_BANNER.x + ms / 2;
    const my = logo.top + logo.height * MARK_IN_BANNER.y + ms / 2;
    const zEnd = (LIFT_FROM * ms) / (rec * LABEL * MARK_ON_LABEL);
    // The label print is magnified by the push-in, so it is drawn for that.
    const printPx = Math.round(rec * LABEL * dpr * zEnd);
    el.print.width = printPx;
    el.print.height = printPx;
    const liftPx = Math.round(ms * 1.15 * dpr);
    el.lift.width = liftPx;
    el.lift.height = liftPx;
    Object.assign(el.lift.style, { left: `${mx - ms / 2}px`, top: `${my - ms / 2}px`, width: `${ms}px`, height: `${ms}px` });
    printed = '';

    const s = Math.max(w, h * 0.75);
    const sr = (phone ? 0.15 : 0.12) * s;
    const speakerAt: [number, number] = phone ? [-w * 0.36, -h * 0.36] : [w * 0.37, h * 0.3];
    // Rims face the skylight, up and to the left.
    const toLight = Math.atan2(-h * 0.9 - speakerAt[1], -w * 0.3 - speakerAt[0]);
    return {
      w,
      h,
      dpr,
      cx,
      cy,
      rec,
      scale,
      phone,
      cw,
      sw,
      // Where the stylus comes down: the arm's pivot plus its length, swung ~21deg.
      stylus: [rec * 0.333, rec * 0.245],
      mx,
      my,
      ms,
      zEnd,
      speakerAt,
      speaker: bakeSpeaker(sr, scale, phone ? 3 : 4, toLight),
      sleeveW: (phone ? 0.62 : 0.34) * s,
      sleeves: TRACKS.map(() => null),
      ring: null,
      mark: null,
      lift: null,
    };
  }

  function bake(L: Layout): void {
    if (!L.ring) L.ring = bakeRing(el.print.width);
    if (!L.mark && decoded.has(markArt)) {
      L.mark = bakeMark(el.print.width, markArt, MARK_ON_LABEL);
      L.lift = bakeMark(el.lift.width, markArt, 1 / 1.15);
    }
    L.sleeves.forEach((s, i) => {
      if (!s && i > 0 && decoded.has(art[i])) {
        L.sleeves[i] = bakeSleeve(art[i], L.sleeveW, L.scale, L.phone ? 12 : 18, L.w * 0.04);
      }
    });
  }

  function camera(L: Layout, t: number): Camera {
    const open = settle(t / NEEDLE);
    const pull = inOut((t - NEEDLE - 80) / (at(5.5) - NEEDLE - 80));
    const drift = clamp((t - at(5.5)) / (PUSH - at(5.5)));
    const push = inOut((t - PUSH) / (DROP - PUSH));
    // After the drop the record falls away from the lifting mark.
    const fall = t > DROP ? easeOut((t - DROP) / 500) : 0;
    const path = (a: number, b: number, c: number, d: number, e: number): number =>
      a + (b - a) * open + (c - b) * pull + (d - c) * drift + (e - d) * push;
    // On a phone the record is wider than the screen in close-up, so frame between the
    // stylus and the label rather than on the stylus.
    const near = L.phone ? 0.5 : 1;
    const px = L.stylus[0] * near;
    const py = L.stylus[1] * near;
    const jolt = t > NEEDLE ? Math.exp(-(t - NEEDLE) / 90) * Math.sin((t - NEEDLE) * 0.09) * 0.004 * L.h : 0;
    const shake = t > DROP ? Math.exp(-(t - DROP) / 140) * Math.sin((t - DROP) * 0.11) * 0.006 * L.h : 0;
    return {
      z: path(1.3, 2.1, 0.95, 0.9, L.zEnd) * (1 - 0.14 * fall),
      fx: path(px * 0.55, px, 0, 0, 0),
      fy: path(py * 0.55, py, L.rec * 0.04, L.rec * 0.04, 0),
      sx: path(0, 0, 0, 0, L.mx - L.cx),
      sy: path(0, 0, 0, 0, L.my - L.cy) - jolt - shake,
      tilt: path(42, 32, 18, 15, 0),
      yaw: path(-34, -24, 12, 18, 0),
    };
  }

  function drawDeck(L: Layout, t: number, cam: Camera): void {
    const s = el.deck.style;
    const swing = 20.5 * settle((t - 100) / 600);
    const creep = 0.9 * smooth(NEEDLE, SILENCE, t);
    const lift = smooth(0, 150, t) * (1 - settle((t - 650) / (NEEDLE - 650)));
    s.setProperty('--arm', `${(swing + creep).toFixed(3)}deg`);
    s.setProperty('--lift', lift.toFixed(3));
    s.setProperty('--rim', clamp(light(t) * 0.7).toFixed(3));
    s.setProperty('--spin', `${(spin(t) % 360).toFixed(2)}deg`);
    const out = t > DROP ? easeOut((t - DROP) / 420) : 0;
    s.opacity = `${smooth(0, 650, t) * (1 - out)}`;
    s.transform =
      `translate(${cam.sx.toFixed(2)}px, ${cam.sy.toFixed(2)}px) perspective(${(L.rec * 3).toFixed(0)}px) ` +
      `rotateX(${cam.tilt.toFixed(3)}deg) rotateZ(${cam.yaw.toFixed(3)}deg) scale(${cam.z.toFixed(4)}) ` +
      `translate(${(-cam.fx).toFixed(2)}px, ${(-cam.fy).toFixed(2)}px)`;

    // The label print turns with the record; past 33⅓ it blurs with the shutter.
    const sweep = spinRate(t) * SHUTTER;
    const withMark = t < DROP && !!L.mark;
    const key = `${Math.min(14, Math.ceil(sweep / 1.2))}:${sweep.toFixed(1)}:${withMark}:${!!L.ring}`;
    if (key !== printed && L.ring) {
      drawSpun(ctx.print, withMark && L.mark ? [L.ring, L.mark] : [L.ring], sweep < 1.2 ? 0 : sweep);
      printed = key;
    }
    el.print.style.transform = `rotate(${(spin(t) % 360).toFixed(2)}deg)`;

    // A band of light crossing the vinyl on the skips.
    const band = [NEEDLE, ...SKIPS].map((b) => (t - b) / 520).find((u) => u >= 0 && u < 1);
    el.sweep.style.opacity = band === undefined ? '0' : `${Math.sin(band * Math.PI).toFixed(3)}`;
    el.sweep.style.transform = `translateX(${band === undefined ? -100 : (-70 + 140 * band).toFixed(1)}%)`;

    // The mark's shadow on the label, opening out as it lifts.
    const u = t > DROP ? easeOut((t - DROP) / 260) : 0;
    el.shadow.style.opacity = t > DROP ? `${(0.75 * (1 - 0.5 * u)).toFixed(3)}` : '0';
    el.shadow.style.transform = `translate(${(u * 0.05 * L.rec).toFixed(2)}px, ${(u * 0.08 * L.rec).toFixed(2)}px) scale(${(1 + 0.25 * u).toFixed(3)})`;
  }

  function drawGear(L: Layout, t: number, cam: Camera): void {
    const g = ctx.gear;
    g.setTransform(L.scale, 0, 0, L.scale, 0, 0);
    g.clearRect(0, 0, L.w, L.h);
    const leave = smooth(PUSH, PUSH + 500, t);
    const alpha = smooth(150, 1100, t) * (1 - leave);
    const sp = L.speaker;
    if (alpha > 0) {
      // Nearer than the deck, so it swings further with the orbit and flies out on the push.
      const yaw = (cam.yaw * Math.PI) / 180;
      const [ax, ay] = L.speakerAt;
      const k = 0.85 + 0.2 * cam.z + leave * 0.8;
      const x = L.w / 2 + (ax * Math.cos(yaw * 0.5) - ay * Math.sin(yaw * 0.5)) * k;
      const y = L.cy + (ax * Math.sin(yaw * 0.5) + ay * Math.cos(yaw * 0.5)) * k + cam.sy * 0.3;
      g.save();
      g.globalAlpha = alpha;
      g.translate(x, y);
      g.scale(k, k);
      g.drawImage(sp.frame, -sp.r, -sp.r, sp.r * 2, sp.r * 2);
      // The cone throws forward on each kick.
      const ex = 1 + 0.03 * kick(t);
      g.drawImage(sp.cone, -sp.r * ex, -sp.r * ex, sp.r * 2 * ex, sp.r * 2 * ex);
      g.globalCompositeOperation = 'lighter';
      g.globalAlpha = alpha * clamp(light(t) * 0.55);
      g.drawImage(sp.rim, -sp.r, -sp.r, sp.r * 2, sp.r * 2);
      g.restore();
    }

    // On each skip the new track's sleeve slides past the lens, crossing the middle on the beat.
    SKIPS.forEach((beat, i) => {
      const sleeve = L.sleeves[i + 1];
      const u = (t - beat + 300) / 620;
      if (!sleeve || u <= 0 || u >= 1) return;
      const size = L.sleeveW * 1.24;
      const dir = i === 0 ? 1 : -1;
      const span = L.w + size * 1.2;
      const x = L.w / 2 + dir * span * (u - 0.5) * (0.85 + 0.3 * Math.abs(u - 0.5));
      const y = L.h * (i === 0 ? 0.74 : 0.2);
      g.save();
      g.translate(x, y);
      g.rotate(dir * 0.2);
      g.drawImage(sleeve, -size / 2, -size / 2, size, size);
      g.restore();
    });
  }

  function drawCard(L: Layout, t: number): void {
    const enter = easeOut((t - 500) / 700);
    const out = easeOut((t - STATS + 60) / 260);
    const shown = enter * (1 - out);
    el.card.style.opacity = `${shown}`;
    el.card.style.transform = `translateY(${((1 - enter) * 20 + out * 40).toFixed(2)}px)`;
    if (shown <= 0) return;
    const track = t < SKIPS[0] ? 0 : t < SKIPS[1] ? 1 : 2;
    const since = (b: number, end: number): number => Math.max(0, Math.min(t, end) - b) / 1000;
    const frame: CardFrame = {
      track,
      swap: track === 0 ? 1 : (t - SKIPS[track - 1]) / 240,
      elapsed: [
        TRACKS[0].from + since(NEEDLE, SKIPS[0]),
        TRACKS[1].from + since(SKIPS[0], SKIPS[1]),
        TRACKS[2].from + since(SKIPS[1], Infinity),
      ],
      playing: t >= NEEDLE,
      press: Math.max(...SKIPS.map((b) => pulse(t, b, 150))),
      meter: (band, bands) => meter(t, band, bands),
    };
    paintCard(ctx.card, L.cw, L.phone, frame, art);
  }

  function drawStats(L: Layout, t: number): void {
    const enter = easeOut((t - STATS) / 380);
    const out = smooth(at(8.5), at(8.5) + 200, t);
    const shown = enter * (1 - out);
    el.scrim.style.opacity = `${(0.6 * smooth(STATS - 60, STATS + 260, t) * (1 - smooth(at(8.5), SILENCE, t))).toFixed(3)}`;
    el.stats.style.opacity = `${shown}`;
    el.stats.style.transform = `translateY(${((1 - enter) * 28).toFixed(2)}px) scale(${(0.97 + 0.03 * enter + 0.08 * out).toFixed(4)})`;
    if (shown <= 0) return;
    const count = (x: number): number => 48213 * easeOut((x - STATS - 100) / (at(7) - STATS - 100));
    const g = (t - at(8)) / 520;
    paintStats(ctx.stats, L.sw, {
      minutes: count(t),
      rate: (count(t + 8) - count(t - 8)) / 16,
      chips: [0, 1, 2].map((i) => (t - at(6 + i * 0.5)) / 260),
      bars: Array.from({ length: 12 }, (_, i) => (t - at(6.5) - i * 40) / 320),
      glint: g > 0 && g < 1 ? -0.3 + 1.6 * g : null,
    });
  }

  function drawLift(L: Layout, t: number): void {
    const u = (t - DROP) / D;
    if (u < 0 || !L.lift) {
      el.lift.style.opacity = '0';
      return;
    }
    el.lift.style.opacity = `${1 - smooth(LAND + 10, LAND + 210, t)}`;
    const k = u >= 1 ? 1 : (LIFT_FROM + (1 - LIFT_FROM) * settle(u)) * (1 + 0.1 * Math.sin(Math.PI * u));
    el.lift.style.transform = `rotate(${(liftAngle(u) % 360).toFixed(2)}deg) scale(${k.toFixed(4)})`;
    drawSpun(ctx.lift, [L.lift], u >= 1 ? 0 : liftRate(u) * SHUTTER);
  }

  function drawFlares(L: Layout, t: number, cam: Camera): void {
    const sky: [number, number] = [L.w * (0.18 + cam.yaw * 0.004), -L.h * 0.45];
    const flares: Flare[] = [
      ...([
        [NEEDLE, 0.55],
        [SKIPS[0], 0.4],
        [SKIPS[1], 0.4],
        [STATS, 0.6],
      ] as const).map(([b, s]) => ({ x: sky[0], y: sky[1], s: s * pulse(t, b, 280) })),
      { x: L.mx, y: L.my, s: pulse(t, DROP, 380) },
    ].filter((f) => f.s > 0.01);
    if (!flares.length && lensClear) return;
    const c = ctx.lens;
    c.setTransform(0.5, 0, 0, 0.5, 0, 0);
    c.clearRect(0, 0, L.w, L.h);
    drawLens(c, L.w, L.h, flares);
    lensClear = !flares.length;
  }

  function drawMark(t: number): void {
    el.mark.style.opacity = `${smooth(LAND - 70, LAND + 150, t)}`;
    // The lettering is brushed in left to right from behind the mark.
    const wipe = 36 + 80 * easeOut((t - LAND + 40) / 420);
    const mask = wipe >= 115 ? 'none' : `linear-gradient(90deg, #000 ${(wipe - 14).toFixed(1)}%, transparent ${wipe.toFixed(1)}%)`;
    el.logo.style.setProperty('mask-image', mask);
    el.logo.style.setProperty('-webkit-mask-image', mask);
    const g = (t - GLINT) / 650;
    el.glint.style.opacity = g > 0 && g < 1 ? `${Math.sin(g * Math.PI).toFixed(3)}` : '0';
    el.glint.style.transform = `translateX(${(-120 + 340 * clamp(g)).toFixed(1)}%)`;
    const tag = easeOut((t - LAND - 380) / 600);
    el.tagline.style.opacity = `${tag}`;
    el.tagline.style.transform = `translateY(${((1 - tag) * 8).toFixed(2)}px)`;
  }

  return (t: number) => {
    if (!lay || lay.w !== window.innerWidth || lay.h !== window.innerHeight) lay = layout();
    const L = lay;
    bake(L);
    const cam = camera(L, t);
    const yaw = (cam.yaw * Math.PI) / 180;
    // The record's centre on screen, near enough, for the light pooled under it.
    const rx = L.cx + cam.sx - cam.z * (cam.fx * Math.cos(yaw) - cam.fy * Math.sin(yaw));
    const ry = L.cy + cam.sy - cam.z * (cam.fx * Math.sin(yaw) + cam.fy * Math.cos(yaw));
    haze?.({
      time: t / 1000,
      light: light(t),
      enter: smooth(0, 900, t),
      flare: t > DROP ? 1.1 * Math.exp(-(t - DROP) / 300) + 0.07 : 0,
      blast: t > DROP ? 1 - Math.exp(-(t - DROP) / 420) : 0,
      yaw: cam.yaw / 90,
      cx: rx / L.w,
      cy: ry / L.h,
    });
    drawDeck(L, t, cam);
    drawGear(L, t, cam);
    drawCard(L, t);
    drawStats(L, t);
    drawLift(L, t);
    drawFlares(L, t, cam);
    drawMark(t);
  };
}

// Sizes a panel canvas centred on left: 50%, and on its top too if `middle`.
function sizeCanvas(c: HTMLCanvasElement, w: number, h: number, dpr: number, ui: number, middle: boolean): void {
  const k = dpr * ui;
  c.width = Math.round(w * k);
  c.height = Math.round(h * k);
  Object.assign(c.style, {
    width: `${w * ui}px`,
    height: `${h * ui}px`,
    marginLeft: `${(-w * ui) / 2}px`,
    marginTop: middle ? `${(-h * ui) / 2}px` : '0',
  });
  c.getContext('2d')?.setTransform(k, 0, 0, k, 0, 0);
}
