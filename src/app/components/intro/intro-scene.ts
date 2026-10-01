import { createHaze } from './intro-haze';

// The intro, drawn as a pure function of time so every frame can be rendered on its own.
// Back to front: the WebGL room, the turntable (DOM, driven through custom properties), the
// out-of-focus gear in the foreground, and the now-playing card, which is the focal plane with
// the record. Timed to a 128 BPM track: the needle lands on beat 2, it builds, a beat of
// silence, and it drops on beat 6.

export const BEAT = 60000 / 128;
export const NEEDLE = BEAT * 2;
export const DROP = BEAT * 6;
// The wordmark is in by ~3.9 s and the tagline by ~4.3 s; both hold until the handoff.
export const HANDOFF = 4900;

const FONT = "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";
const MONO = "ui-monospace, 'SF Mono', SFMono-Regular, Menlo, Consolas, monospace";
const GREEN = '#1ed98f';
const TRACK_START = 107;
const TRACK_SECONDS = 232;
const COVERS = 'assets/img/intro';

export interface SceneElements {
  haze: HTMLCanvasElement;
  gear: HTMLCanvasElement;
  card: HTMLCanvasElement;
  deck: HTMLElement;
  logo: HTMLElement;
  tagline: HTMLElement;
}

const clamp = (v: number, lo = 0, hi = 1): number => Math.min(hi, Math.max(lo, v));
const smooth = (a: number, b: number, v: number): number => {
  const x = clamp((v - a) / (b - a));
  return x * x * (3 - 2 * x);
};
const easeOut = (x: number): number => 1 - Math.pow(1 - clamp(x), 4);
// Settles like a damped mass: quick to start, long gentle landing, no overshoot.
const settle = (x: number): number => 1 - Math.pow(1 - clamp(x), 3);

// A kick drum: fast attack, exponential decay. Four on the floor once the needle is down,
// silent for the beat before the drop.
export function kick(t: number): number {
  if (t < NEEDLE || (t > DROP - BEAT && t < DROP)) return 0;
  return Math.exp(-((t - NEEDLE) % BEAT) / 110);
}

// The skylight: comes up as the room fades in, swells through the build, holds its breath
// for the silent beat.
function light(t: number): number {
  if (t >= DROP) return 0.5 + 0.06 * kick(t);
  const base = 0.38 + 0.5 * smooth(NEEDLE, DROP - BEAT, t) + 0.1 * kick(t);
  return base * smooth(0, 900, t) * (1 - 0.5 * smooth(DROP - BEAT, DROP - 60, t));
}

// 33⅓ rpm is 200 deg/s, reached 0.8 s after start at constant acceleration.
function spin(t: number): number {
  return 0.2 * (t < 800 ? (t * t) / 1600 : t - 400);
}

function meter(t: number, band: number, bands: number): number {
  if (t < NEEDLE) return 0;
  const low = 1 - band / bands;
  const hat = t > DROP - BEAT && t < DROP ? 0 : Math.exp(-(((t - NEEDLE + BEAT / 2) % BEAT) / 70));
  const jitter = 0.5 + 0.5 * Math.sin(t * 0.021 * (band + 1.3) + band * 2.1);
  const silence = smooth(DROP - BEAT, DROP - BEAT + 70, t) * (1 - smooth(DROP - 10, DROP, t));
  const build = 0.7 + 0.3 * smooth(NEEDLE, DROP, t);
  const level = (0.22 + 0.55 * kick(t) * low + 0.35 * hat * (1 - low) + 0.16 * jitter) * build;
  return clamp(level * (1 - silence * 0.9), 0.04, 1);
}

interface Layout {
  w: number;
  h: number;
  s: number;
  cx: number;
  cy: number;
  scale: number;
  phone: boolean;
  cw: number;
  ch: number;
  speakerAt: [number, number];
  sleevesAt: [number, number];
  speaker: ReturnType<typeof bakeSpeaker>;
  sleeves: HTMLCanvasElement | null;
  sleeveW: number;
}

export function createScene(el: SceneElements): (t: number) => void {
  const haze = createHaze(el.haze);
  const gearCtx = el.gear.getContext('2d');
  const cardCtx = el.card.getContext('2d');
  const art = new Image();
  art.src = `${COVERS}/night-drive.jpg`;
  const sleeveArt = ['low-tide', 'static-bloom'].map((name) => {
    const img = new Image();
    img.src = `${COVERS}/${name}.jpg`;
    return img;
  });
  let lay: Layout | undefined;

  function layout(): Layout {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const phone = w < 640;
    const record = el.deck.querySelector('.record')?.getBoundingClientRect();
    const cx = record ? record.left + record.width / 2 : w / 2;
    const cy = record ? record.top + record.height / 2 : h * 0.4;
    const hazeScale = Math.min(0.5, 960 / w);
    el.haze.width = Math.round(w * hazeScale);
    el.haze.height = Math.round(h * hazeScale);
    // The gear is out of focus, so its canvas runs below device resolution too.
    const scale = Math.min(1, 0.7 * dpr);
    el.gear.width = Math.round(w * scale);
    el.gear.height = Math.round(h * scale);

    const cw = Math.min(w - 32, 460);
    const ch = 124;
    el.card.width = Math.round(cw * dpr);
    el.card.height = Math.round(ch * dpr);
    el.card.style.width = `${cw}px`;
    el.card.style.height = `${ch}px`;
    el.card.style.marginLeft = `${-cw / 2}px`;
    cardCtx?.setTransform(dpr, 0, 0, dpr, 0, 0);

    const s = Math.max(w, h * 0.75);
    const sr = (phone ? 0.15 : 0.12) * s;
    const sleeveW = (phone ? 0.3 : 0.17) * s;
    const speakerAt: [number, number] = phone ? [-w * 0.34, -h * 0.36] : [w * 0.37, h * 0.3];
    const sleevesAt: [number, number] = phone ? [w * 0.36, h * 0.42] : [-w * 0.37, -h * 0.2];
    // Rims face the skylight, up and to the left.
    const toLight = (at: [number, number]): number => Math.atan2(-h * 0.9 - at[1], -w * 0.3 - at[0]);
    return {
      w,
      h,
      s,
      cx,
      cy,
      scale,
      phone,
      cw,
      ch,
      speakerAt,
      sleevesAt,
      speaker: bakeSpeaker(sr, scale, phone ? 3 : 4, toLight(speakerAt)),
      sleeves: null,
      sleeveW,
    };
  }

  function drawDeck(L: Layout, t: number, shake: number): void {
    const s = el.deck.style;
    const swing = 20.5 * settle((t - 100) / 600);
    const creep = 0.9 * smooth(NEEDLE, DROP, t);
    const lift = smooth(0, 150, t) * (1 - settle((t - 650) / (NEEDLE - 650)));
    s.setProperty('--spin', `${spin(t).toFixed(2)}deg`);
    s.setProperty('--arm', `${(swing + creep).toFixed(3)}deg`);
    s.setProperty('--lift', lift.toFixed(3));
    s.setProperty('--rim', clamp(light(t) * 0.7).toFixed(3));

    const enter = smooth(0, 650, t);
    const push = 0.03 * (1 - easeOut(t / 1600));
    const inhale = 0.012 * smooth(DROP - BEAT, DROP, t);
    const out = t > DROP ? easeOut((t - DROP) / 170) : 0;
    const shove = t > DROP ? 1 - Math.exp(-(t - DROP) / 200) : 0;
    s.opacity = `${enter * (1 - out)}`;
    s.transform = `translateY(${(-shake * L.h).toFixed(2)}px) scale(${(1 + push + inhale + shove * 0.3).toFixed(4)})`;
  }

  function drawGear(L: Layout, t: number, shake: number): void {
    const ctx = gearCtx;
    if (!ctx) return;
    ctx.setTransform(L.scale, 0, 0, L.scale, 0, 0);
    ctx.clearRect(0, 0, L.w, L.h);
    const blast = t > DROP ? 1 - Math.exp(-(t - DROP) / 380) : 0;
    const alpha = smooth(150, 1100, t) * (1 - smooth(0.3, 0.8, blast));
    if (alpha <= 0) return;
    const enter = easeOut(t / 1600);
    // Nearer than the deck, so it comes in from further out and leaves faster.
    const fly = 1 + 0.3 * (1 - enter) + blast * 1.7;
    const grow = 1 + blast * 0.5;
    const rim = clamp(light(t) * 0.55);
    const cx = L.w / 2;
    const cy = L.cy - shake * L.h;

    const sp = L.speaker;
    const k = kick(t);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(cx + L.speakerAt[0] * fly - t * 0.006, cy + L.speakerAt[1] * fly + t * 0.003);
    ctx.scale(grow, grow);
    ctx.drawImage(sp.frame, -sp.r, -sp.r, sp.r * 2, sp.r * 2);
    // The cone throws forward on each kick.
    const ex = 1 + 0.03 * k;
    ctx.drawImage(sp.cone, -sp.r * ex, -sp.r * ex, sp.r * 2 * ex, sp.r * 2 * ex);
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = alpha * rim;
    ctx.drawImage(sp.rim, -sp.r, -sp.r, sp.r * 2, sp.r * 2);
    ctx.restore();

    if (!L.sleeves && sleeveArt.every((img) => img.complete && img.naturalWidth)) {
      L.sleeves = bakeSleeves(sleeveArt, L.sleeveW, L.scale, L.phone ? 4 : 6);
    }
    if (!L.sleeves) return;
    const sw = L.sleeveW * 1.5;
    const sh = L.sleeveW * 1.25;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(cx + L.sleevesAt[0] * fly + t * 0.005, cy + L.sleevesAt[1] * fly - t * 0.002);
    ctx.rotate(-0.1 - blast * 0.3 + t * 0.00002);
    ctx.scale(grow, grow);
    ctx.drawImage(L.sleeves, -sw / 2, -sh / 2, sw, sh);
    ctx.restore();
  }

  function drawCard(L: Layout, t: number, shake: number): void {
    const ctx = cardCtx;
    const enter = easeOut((t - 250) / 750);
    const out = t > DROP ? easeOut((t - DROP) / 160) : 0;
    const shove = t > DROP ? 1 - Math.exp(-(t - DROP) / 200) : 0;
    el.card.style.opacity = `${enter * (1 - out)}`;
    el.card.style.transform = `translateY(${((1 - enter) * 20 + shove * 90 - shake * L.h).toFixed(2)}px) scale(${(1 + shove * 0.06).toFixed(4)})`;
    if (!ctx || enter * (1 - out) <= 0) return;

    const { cw, ch, phone } = L;
    const pad = 14;
    ctx.clearRect(0, 0, cw, ch);
    paintCardBackground(ctx, cw, ch);

    const size = 56;
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(pad, pad, size, size, 4);
    ctx.clip();
    ctx.fillStyle = '#15171a';
    ctx.fillRect(pad, pad, size, size);
    if (art.complete && art.naturalWidth) ctx.drawImage(art, pad, pad, size, size);
    ctx.restore();

    const playing = t >= NEEDLE;
    const tx = pad + size + 14;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = playing ? GREEN : '#7d8287';
    ctx.font = `600 10px ${FONT}`;
    ctx.fillText(playing ? 'NOW PLAYING' : 'CUED', tx, pad + 12);
    ctx.fillStyle = '#eef0ec';
    ctx.font = `600 ${phone ? 15 : 16}px ${FONT}`;
    ctx.fillText('Night Drive', tx, pad + 33);
    ctx.fillStyle = '#9a9fa4';
    ctx.font = `400 13px ${FONT}`;
    ctx.fillText('Low Season', tx, pad + 51);

    // A spectrum meter, the kind of segmented glass on a mixer.
    const bands = phone ? 7 : 10;
    const segs = 9;
    const mw = 4;
    const right = cw - pad;
    const mx = right - bands * (mw + 2) + 2;
    for (let b = 0; b < bands; b++) {
      const level = meter(t, b, bands);
      for (let g = 0; g < segs; g++) {
        const lit = g < Math.round(level * segs);
        ctx.fillStyle = lit ? (g >= segs - 2 ? '#e9efe9' : GREEN) : 'rgba(255,255,255,0.06)';
        ctx.fillRect(mx + b * (mw + 2), pad + size - (g + 1) * 6 + 3, mw, 4);
      }
    }

    const elapsed = TRACK_START + Math.max(0, t - NEEDLE) / 1000;
    const by = ch - pad - 8;
    ctx.font = `500 11px ${MONO}`;
    ctx.fillStyle = '#9a9fa4';
    ctx.fillText(fmt(Math.floor(elapsed)), pad, by + 4);
    ctx.textAlign = 'right';
    ctx.fillText(fmt(TRACK_SECONDS), right, by + 4);
    ctx.textAlign = 'left';
    const bx = pad + 40;
    const bw = right - 40 - bx;
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.beginPath();
    ctx.roundRect(bx, by - 2, bw, 4, 2);
    ctx.fill();
    const head = bx + bw * (elapsed / TRACK_SECONDS);
    ctx.fillStyle = playing ? GREEN : '#cfd3d0';
    ctx.beginPath();
    ctx.roundRect(bx, by - 2, head - bx, 4, 2);
    ctx.fill();
    ctx.fillStyle = '#f2f4f1';
    ctx.beginPath();
    ctx.arc(head, by, 5, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawMark(t: number): void {
    const reveal = easeOut((t - DROP - 180) / 900);
    el.logo.style.opacity = `${reveal}`;
    el.logo.style.transform = `scale(${(0.955 + 0.045 * reveal + 0.006 * (t > DROP ? kick(t) : 0)).toFixed(4)})`;
    const tag = easeOut((t - DROP - 760) / 700);
    el.tagline.style.opacity = `${tag}`;
    el.tagline.style.transform = `translateY(${((1 - tag) * 8).toFixed(2)}px)`;
  }

  return (t: number) => {
    if (!lay || lay.w !== window.innerWidth || lay.h !== window.innerHeight) lay = layout();
    const L = lay;
    const shake = t > DROP ? Math.exp(-(t - DROP) / 140) * Math.sin((t - DROP) * 0.11) * 0.006 : 0;
    haze?.({
      time: t / 1000,
      light: light(t),
      enter: smooth(0, 900, t),
      flare: t > DROP ? 1.5 * Math.exp(-(t - DROP) / 320) + 0.07 : 0,
      blast: t > DROP ? 1 - Math.exp(-(t - DROP) / 420) : 0,
      shake,
      cx: L.cx / L.w,
      cy: L.cy / L.h,
    });
    drawDeck(L, t, shake);
    drawGear(L, t, shake);
    drawCard(L, t, shake);
    drawMark(t);
  };
}

function fmt(sec: number): string {
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
}

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('2D canvas unavailable');
  return [c, ctx];
}

function paintCardBackground(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, 'rgba(26,28,31,0.9)');
  g.addColorStop(1, 'rgba(15,17,19,0.92)');
  ctx.beginPath();
  ctx.roundRect(0.5, 0.5, w - 1, h - 1, 10);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.07)';
  ctx.lineWidth = 1;
  ctx.stroke();
  const edge = ctx.createLinearGradient(0, 0, w, 0);
  edge.addColorStop(0, 'rgba(255,255,255,0)');
  edge.addColorStop(0.5, 'rgba(255,255,255,0.12)');
  edge.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = edge;
  ctx.fillRect(12, 0.5, w - 24, 1);
}

const RIM = 'rgba(120,240,185,0.9)';

// A woofer from the front: steel basket rim, rubber surround, paper cone, dust cap. The cone
// is its own image so it can move on the kick while the rim stays put.
function bakeSpeaker(
  r: number,
  scale: number,
  blur: number,
  toLight: number,
): { r: number; frame: HTMLCanvasElement; cone: HTMLCanvasElement; rim: HTMLCanvasElement } {
  const px = Math.max(48, r * 2 * scale * 1.5);
  const R = px / 2;
  const [frame, f] = canvas(px, px);
  f.translate(R, R);
  const basket = f.createLinearGradient(-R, -R, R, R);
  basket.addColorStop(0, '#2a2c2e');
  basket.addColorStop(0.5, '#141617');
  basket.addColorStop(1, '#090a0a');
  f.fillStyle = basket;
  f.beginPath();
  f.arc(0, 0, R * 0.99, 0, Math.PI * 2);
  f.fill();
  f.fillStyle = '#060707';
  f.beginPath();
  f.arc(0, 0, R * 0.9, 0, Math.PI * 2);
  f.fill();
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 4 + (i * Math.PI) / 2;
    f.fillStyle = 'rgba(255,255,255,0.16)';
    f.beginPath();
    f.arc(Math.cos(a) * R * 0.945, Math.sin(a) * R * 0.945, R * 0.016, 0, Math.PI * 2);
    f.fill();
  }

  const [cone, c] = canvas(px, px);
  c.translate(R, R);
  const roll = c.createRadialGradient(-R * 0.12, -R * 0.12, R * 0.6, 0, 0, R * 0.88);
  roll.addColorStop(0, '#09090a');
  roll.addColorStop(0.55, '#2d3032');
  roll.addColorStop(0.8, '#191b1c');
  roll.addColorStop(1, '#070708');
  c.fillStyle = roll;
  c.beginPath();
  c.arc(0, 0, R * 0.88, 0, Math.PI * 2);
  c.fill();
  const paper = c.createRadialGradient(-R * 0.08, -R * 0.1, R * 0.1, 0, 0, R * 0.7);
  paper.addColorStop(0, '#080909');
  paper.addColorStop(0.7, '#171919');
  paper.addColorStop(1, '#202323');
  c.fillStyle = paper;
  c.beginPath();
  c.arc(0, 0, R * 0.7, 0, Math.PI * 2);
  c.fill();
  const cap = c.createRadialGradient(-R * 0.09, -R * 0.1, R * 0.01, 0, 0, R * 0.26);
  cap.addColorStop(0, '#565a5b');
  cap.addColorStop(0.35, '#2a2d2e');
  cap.addColorStop(1, '#111314');
  c.fillStyle = cap;
  c.beginPath();
  c.arc(0, 0, R * 0.26, 0, Math.PI * 2);
  c.fill();

  const [rim, rg] = canvas(px, px);
  rg.translate(R, R);
  const ux = Math.cos(toLight) * R;
  const uy = Math.sin(toLight) * R;
  const dir = rg.createLinearGradient(ux, uy, -ux * 0.2, -uy * 0.2);
  dir.addColorStop(0, RIM);
  dir.addColorStop(1, 'rgba(120,240,185,0)');
  rg.strokeStyle = dir;
  rg.lineWidth = R * 0.035;
  rg.beginPath();
  rg.arc(0, 0, R * 0.975, 0, Math.PI * 2);
  rg.stroke();
  const soft = (src: HTMLCanvasElement): HTMLCanvasElement => soften(src, blur * scale * 1.5);
  return { r, frame: soft(frame), cone: soft(cone), rim: soft(rim) };
}

// Two record sleeves leaning one behind the other, out of focus, their top edges catching
// the skylight.
function bakeSleeves(art: HTMLImageElement[], w: number, scale: number, blur: number): HTMLCanvasElement {
  const k = scale * 1.5;
  const [c, ctx] = canvas(w * 1.5 * k, w * 1.25 * k);
  ctx.scale(k, k);
  art.forEach((img, i) => {
    const x = i === 0 ? w * 0.42 : w * 0.06;
    const y = i === 0 ? 0 : w * 0.2;
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = w * 0.06;
    ctx.shadowOffsetY = w * 0.03;
    ctx.fillStyle = '#111';
    ctx.fillRect(x, y, w, w);
    ctx.restore();
    ctx.drawImage(img, x, y, w, w);
    // Printed sleeve: a little sheen, darker towards the bottom where the light doesn't reach.
    const shade = ctx.createLinearGradient(x, y, x, y + w);
    shade.addColorStop(0, 'rgba(255,255,255,0.06)');
    shade.addColorStop(1, 'rgba(0,0,0,0.6)');
    ctx.fillStyle = shade;
    ctx.fillRect(x, y, w, w);
    ctx.fillStyle = RIM;
    ctx.globalAlpha = 0.55;
    ctx.fillRect(x, y, w, Math.max(1, w * 0.008));
    ctx.fillRect(x, y, Math.max(1, w * 0.008), w * 0.6);
    ctx.globalAlpha = 1;
  });
  return soften(c, blur * scale * 1.5);
}

// Depth of field on the cheap: shrink and re-enlarge with smoothing.
function soften(src: HTMLCanvasElement, px: number): HTMLCanvasElement {
  if (px < 0.75) return src;
  const f = Math.min(8, px);
  const [small, sctx] = canvas(src.width / f, src.height / f);
  sctx.imageSmoothingQuality = 'high';
  sctx.drawImage(src, 0, 0, small.width, small.height);
  const [out, octx] = canvas(src.width, src.height);
  octx.imageSmoothingQuality = 'high';
  octx.drawImage(small, 0, 0, out.width, out.height);
  return out;
}
