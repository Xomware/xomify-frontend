import { FONT, loaded } from './intro-sprites';

// The two pieces of UI in the intro, painted to canvas at device resolution: the now-playing
// card, which skips through three tracks, and a Wrapped-style stats panel. Every number on
// them is made up, and the panel says so.

const MONO = "ui-monospace, 'SF Mono', SFMono-Regular, Menlo, Consolas, monospace";
export const GREEN = '#1ed98f';
const INK = '#eef0ec';
const MUTED = '#9a9fa4';
const FAINT = '#7d8287';

export interface Track {
  title: string;
  artist: string;
  art: string;
  // Where the track is when it comes on, and its length, in seconds.
  from: number;
  length: number;
}

// Original covers generated for the intro; no real album art.
export const TRACKS: Track[] = [
  { title: 'Night Drive', artist: 'Low Season', art: 'night-drive', from: 107, length: 232 },
  { title: 'Low Tide', artist: 'Marlow Coast', art: 'low-tide', from: 0, length: 201 },
  { title: 'Static Bloom', artist: 'Hollis Vale', art: 'static-bloom', from: 0, length: 248 },
];

export const CARD_H = 150;
export const STATS_H = 276;

export interface CardFrame {
  track: number;
  // 0 to 1 through the slide from the previous track; 1 once settled.
  swap: number;
  // Seconds into each track.
  elapsed: number[];
  playing: boolean;
  // The next button, 0 at rest, 1 pressed.
  press: number;
  meter: (band: number, bands: number) => number;
}

export interface StatsFrame {
  minutes: number;
  // How fast the count is going, in minutes per ms.
  rate: number;
  chips: number[];
  bars: number[];
  // The light sweeping across the glass, as a fraction of the width; null when it isn't.
  glint: number | null;
}

const clamp = (v: number, lo = 0, hi = 1): number => Math.min(hi, Math.max(lo, v));
const easeOut = (x: number): number => 1 - Math.pow(1 - clamp(x), 3);

function glass(ctx: CanvasRenderingContext2D, w: number, h: number, r: number): void {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, 'rgba(26,28,31,0.92)');
  g.addColorStop(1, 'rgba(14,16,18,0.94)');
  ctx.beginPath();
  ctx.roundRect(0.5, 0.5, w - 1, h - 1, r);
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
  ctx.fillRect(r, 0.5, w - r * 2, 1);
}

function fmt(sec: number): string {
  const s = Math.floor(sec);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function paintCard(
  ctx: CanvasRenderingContext2D,
  w: number,
  phone: boolean,
  f: CardFrame,
  art: HTMLImageElement[],
): void {
  const h = CARD_H;
  const pad = 14;
  const size = 56;
  ctx.clearRect(0, 0, w, h);
  glass(ctx, w, h, 10);

  const bands = phone ? 7 : 10;
  const mw = 4;
  const right = w - pad;
  const mx = right - bands * (mw + 2) + 2;

  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = f.playing ? GREEN : FAINT;
  ctx.font = `600 10px ${FONT}`;
  ctx.fillText(f.playing ? 'NOW PLAYING' : 'CUED', pad + size + 14, pad + 12);

  // The outgoing track slides off left as the next comes in from the right.
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, mx - 10, pad + size + 4);
  ctx.clip();
  const slide = 30;
  const s = easeOut(f.swap);
  if (s < 1 && f.track > 0) {
    trackRow(ctx, TRACKS[f.track - 1], art[f.track - 1], -slide * s, clamp(1 - s / 0.45), pad, size, phone);
  }
  trackRow(ctx, TRACKS[f.track], art[f.track], slide * (1 - s), clamp((s - 0.25) / 0.75), pad, size, phone);
  ctx.restore();

  // A spectrum meter, the kind of segmented glass on a mixer.
  const segs = 9;
  for (let b = 0; b < bands; b++) {
    const level = f.meter(b, bands);
    for (let g = 0; g < segs; g++) {
      const lit = g < Math.round(level * segs);
      ctx.fillStyle = lit ? (g >= segs - 2 ? '#e9efe9' : GREEN) : 'rgba(255,255,255,0.06)';
      ctx.fillRect(mx + b * (mw + 2), pad + size - (g + 1) * 6 + 3, mw, 4);
    }
  }

  // The playhead runs back to the start on a skip rather than jumping there.
  const track = TRACKS[f.track];
  const at = (i: number): number => f.elapsed[i] / TRACKS[i].length;
  const frac = f.track > 0 && s < 1 ? at(f.track - 1) + (at(f.track) - at(f.track - 1)) * s : at(f.track);
  const by = pad + size + 22;
  ctx.font = `500 11px ${MONO}`;
  ctx.fillStyle = MUTED;
  ctx.fillText(fmt(frac * track.length), pad, by + 4);
  ctx.textAlign = 'right';
  ctx.fillText(fmt(track.length), right, by + 4);
  ctx.textAlign = 'left';
  const bx = pad + 40;
  const bw = right - 40 - bx;
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.beginPath();
  ctx.roundRect(bx, by - 2, bw, 4, 2);
  ctx.fill();
  const head = bx + bw * frac;
  ctx.fillStyle = f.playing ? GREEN : '#cfd3d0';
  ctx.beginPath();
  ctx.roundRect(bx, by - 2, Math.max(4, head - bx), 4, 2);
  ctx.fill();
  ctx.fillStyle = '#f2f4f1';
  ctx.beginPath();
  ctx.arc(head, by, 5, 0, Math.PI * 2);
  ctx.fill();

  transport(ctx, w / 2, h - pad - 13, f);
}

function trackRow(
  ctx: CanvasRenderingContext2D,
  track: Track,
  art: HTMLImageElement,
  dx: number,
  alpha: number,
  pad: number,
  size: number,
  phone: boolean,
): void {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(dx, 0);
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(pad, pad, size, size, 4);
  ctx.clip();
  ctx.fillStyle = '#15171a';
  ctx.fillRect(pad, pad, size, size);
  if (loaded(art)) ctx.drawImage(art, pad, pad, size, size);
  ctx.restore();
  const tx = pad + size + 14;
  ctx.fillStyle = INK;
  ctx.font = `600 ${phone ? 15 : 16}px ${FONT}`;
  ctx.fillText(track.title, tx, pad + 33);
  ctx.fillStyle = MUTED;
  ctx.font = `400 13px ${FONT}`;
  ctx.fillText(track.artist, tx, pad + 51);
  ctx.restore();
}

// Previous, play/pause, next.
function transport(ctx: CanvasRenderingContext2D, cx: number, cy: number, f: CardFrame): void {
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.arc(cx, cy, 13, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#15171a';
  if (f.playing) {
    ctx.fillRect(cx - 4.5, cy - 5, 3, 10);
    ctx.fillRect(cx + 1.5, cy - 5, 3, 10);
  } else {
    ctx.beginPath();
    ctx.moveTo(cx - 3.5, cy - 6);
    ctx.lineTo(cx + 6, cy);
    ctx.lineTo(cx - 3.5, cy + 6);
    ctx.fill();
  }

  skipGlyph(ctx, cx - 44, cy, -1, 'rgba(238,240,236,0.55)');
  ctx.save();
  ctx.translate(cx + 44, cy);
  if (f.press > 0.01) {
    ctx.fillStyle = `rgba(255,255,255,${0.1 * f.press})`;
    ctx.beginPath();
    ctx.arc(0, 0, 16, 0, Math.PI * 2);
    ctx.fill();
  }
  const k = 1 - 0.14 * f.press;
  ctx.scale(k, k);
  skipGlyph(ctx, 0, 0, 1, `rgba(238,240,236,${0.55 + 0.45 * f.press})`);
  ctx.restore();
}

function skipGlyph(ctx: CanvasRenderingContext2D, x: number, y: number, dir: 1 | -1, fill: string): void {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.moveTo(x - 5 * dir, y - 6);
  ctx.lineTo(x + 3.5 * dir, y);
  ctx.lineTo(x - 5 * dir, y + 6);
  ctx.fill();
  ctx.fillRect(dir > 0 ? x + 3.5 : x - 5.5, y - 6, 2, 12);
}

const MINUTES = 48213;
const GENRES = ['Indie electronic', 'Dream pop', 'Nu-disco'];
const MONTHS = 'JFMAMJJASOND';
const BY_MONTH = [0.42, 0.55, 0.48, 0.63, 0.58, 0.71, 0.66, 0.8, 1, 0.74, 0.61, 0.69];
const PEAK = BY_MONTH.indexOf(1);

export function paintStats(ctx: CanvasRenderingContext2D, w: number, f: StatsFrame): void {
  const h = STATS_H;
  const pad = w < 400 ? 18 : 22;
  ctx.clearRect(0, 0, w, h);
  glass(ctx, w, h, 14);

  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.font = `600 10.5px ${FONT}`;
  ctx.fillStyle = MUTED;
  ctx.fillText('YOUR YEAR SO FAR', pad, pad + 9);
  ctx.font = `600 9.5px ${FONT}`;
  const tag = 'SAMPLE DATA';
  const tw = ctx.measureText(tag).width + 14;
  ctx.strokeStyle = 'rgba(255,255,255,0.2)';
  ctx.beginPath();
  ctx.roundRect(w - pad - tw + 0.5, pad - 3.5, tw - 1, 17, 8.5);
  ctx.stroke();
  ctx.fillStyle = '#b9bdc0';
  ctx.fillText(tag, w - pad - tw + 7, pad + 9);

  odometer(ctx, pad, pad + 26, f.minutes, f.rate);
  ctx.font = `400 13px ${FONT}`;
  ctx.fillStyle = MUTED;
  ctx.fillText('minutes listened', pad, pad + 96);

  let x = pad;
  const cy = pad + 112;
  GENRES.forEach((genre, i) => {
    const p = easeOut(f.chips[i]);
    const label = i === 0 ? `#1  ${genre}` : genre;
    ctx.font = `500 12px ${FONT}`;
    const cw = ctx.measureText(label).width + 22;
    if (p > 0) {
      ctx.save();
      ctx.globalAlpha = p;
      ctx.translate(x + cw / 2, cy + 13 + (1 - p) * 6);
      const k = 0.88 + 0.12 * p;
      ctx.scale(k, k);
      ctx.beginPath();
      ctx.roundRect(-cw / 2 + 0.5, -12.5, cw - 1, 25, 12.5);
      ctx.fillStyle = i === 0 ? 'rgba(30,217,143,0.14)' : 'rgba(255,255,255,0.05)';
      ctx.fill();
      ctx.strokeStyle = i === 0 ? 'rgba(30,217,143,0.5)' : 'rgba(255,255,255,0.14)';
      ctx.stroke();
      ctx.fillStyle = i === 0 ? '#bff5dd' : '#d6d9d6';
      ctx.textAlign = 'center';
      ctx.fillText(label, 0, 4.5);
      ctx.restore();
    }
    x += cw + 8;
  });
  ctx.textAlign = 'left';

  const top = pad + 156;
  const bottom = h - pad - 18;
  const gap = 5;
  const bw = (w - pad * 2 - gap * (MONTHS.length - 1)) / MONTHS.length;
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.fillRect(pad, bottom + 0.5, w - pad * 2, 1);
  ctx.font = `500 10px ${FONT}`;
  ctx.textAlign = 'center';
  BY_MONTH.forEach((v, i) => {
    const bx = pad + i * (bw + gap);
    const p = easeOut(f.bars[i]);
    const bh = (bottom - top) * v * p;
    if (bh > 0.5) {
      ctx.fillStyle = i === PEAK ? GREEN : 'rgba(238,240,236,0.2)';
      ctx.beginPath();
      ctx.roundRect(bx, bottom - bh, bw, bh, [2, 2, 0, 0]);
      ctx.fill();
    }
    ctx.fillStyle = i === PEAK ? GREEN : FAINT;
    ctx.globalAlpha = clamp(f.bars[i] * 3);
    ctx.fillText(MONTHS[i], bx + bw / 2, h - pad + 2);
    ctx.globalAlpha = 1;
  });
  ctx.textAlign = 'left';

  if (f.glint !== null) {
    const gx = f.glint * w;
    const g = ctx.createLinearGradient(gx - w * 0.25, 0, gx + w * 0.25, h * 0.4);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.5, 'rgba(255,255,255,0.06)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(0.5, 0.5, w - 1, h - 1, 14);
    ctx.clip();
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }
}

// Mechanical counter: each wheel turns while the one to its right goes from 9 to 0. A wheel
// turning faster than a few digits a frame just flicks between digits, as it would on film.
// Unreached leading wheels stay dim.
function odometer(ctx: CanvasRenderingContext2D, x: number, top: number, value: number, rate: number): void {
  const H = 52;
  const base = top + 44;
  ctx.font = `700 46px ${FONT}`;
  const cw = Math.max(...'0123456789'.split('').map((d) => ctx.measureText(d).width));
  const comma = ctx.measureText(',').width;
  const places = String(MINUTES).length;
  const shown = Math.floor(value);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x - 4, top - 4, places * cw + comma + 8, H + 6);
  ctx.clip();
  ctx.textAlign = 'center';
  let cx = x;
  for (let k = places - 1; k >= 0; k--) {
    const unit = Math.pow(10, k);
    const below = value % unit;
    const p = k === 0 ? value : Math.floor(value / unit) + Math.max(0, below - (unit - 1));
    const d = Math.floor(p);
    const roll = (rate * 16.7) / unit > 0.35 ? 0 : p - d;
    ctx.fillStyle = INK;
    ctx.globalAlpha = shown < unit && k > 0 ? 0.2 : 1;
    ctx.fillText(String(d % 10), cx + cw / 2, base - roll * H);
    if (roll > 0) ctx.fillText(String((d + 1) % 10), cx + cw / 2, base + H - roll * H);
    cx += cw;
    if (k === 3) {
      ctx.globalAlpha = shown < 1000 ? 0.2 : 1;
      ctx.fillText(',', cx + comma / 2, base);
      cx += comma;
    }
  }
  ctx.restore();
}
