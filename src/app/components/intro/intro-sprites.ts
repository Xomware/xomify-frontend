// Everything the intro bakes once and then only places: the foreground gear, the sleeves,
// the label print, and the lens ghosts drawn over the frame.

export const FONT =
  "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";

const RIM = 'rgba(120,240,185,0.9)';

export function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('2D canvas unavailable');
  return [c, ctx];
}

export const loaded = (img: HTMLImageElement): boolean => img.complete && img.naturalWidth > 0;

// Depth of field on the cheap: shrink and re-enlarge with smoothing, halving and doubling a
// step at a time. In one jump WebKit's bilinear upscale leaves visible blocks.
export function soften(src: HTMLCanvasElement, px: number): HTMLCanvasElement {
  if (px < 0.75) return src;
  const f = Math.min(8, px);
  const steps = Math.max(1, Math.round(Math.log2(f)));
  let c = src;
  const sizes: [number, number][] = [];
  for (let i = 0; i < steps; i++) {
    sizes.push([c.width, c.height]);
    const [half, h] = canvas(c.width / 2, c.height / 2);
    h.drawImage(c, 0, 0, half.width, half.height);
    c = half;
  }
  for (const [w, hgt] of sizes.reverse()) {
    const [up, u] = canvas(w, hgt);
    u.drawImage(c, 0, 0, w, hgt);
    c = up;
  }
  return c;
}

export interface Speaker {
  r: number;
  frame: HTMLCanvasElement;
  cone: HTMLCanvasElement;
  rim: HTMLCanvasElement;
}

// A woofer from the front: steel basket rim, rubber surround, paper cone, dust cap. The cone
// is its own image so it can move on the kick while the rim stays put.
export function bakeSpeaker(r: number, scale: number, blur: number, toLight: number): Speaker {
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

// One record sleeve, close to the lens and so well out of focus, its top edge catching the
// skylight, and smeared sideways by `smear` px as it whips past. The canvas has a margin of
// 0.12 w all round for the shadow.
export function bakeSleeve(img: HTMLImageElement, w: number, scale: number, blur: number, smear: number): HTMLCanvasElement {
  const k = scale * 1.5;
  const m = w * 0.12;
  const [c, ctx] = canvas((w + m * 2) * k, (w + m * 2) * k);
  ctx.scale(k, k);
  ctx.translate(m, m);
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.6)';
  ctx.shadowBlur = w * 0.06;
  ctx.shadowOffsetY = w * 0.03;
  ctx.fillStyle = '#111';
  ctx.fillRect(0, 0, w, w);
  ctx.restore();
  ctx.drawImage(img, 0, 0, w, w);
  // So near the lens it is between the camera and the light, so mostly in shadow.
  const shade = ctx.createLinearGradient(0, 0, 0, w);
  shade.addColorStop(0, 'rgba(0,0,0,0.45)');
  shade.addColorStop(1, 'rgba(0,0,0,0.8)');
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, w, w);
  ctx.fillStyle = RIM;
  ctx.globalAlpha = 0.5;
  ctx.fillRect(0, 0, w, Math.max(1, w * 0.008));
  ctx.fillRect(0, 0, Math.max(1, w * 0.008), w * 0.6);
  const soft = soften(c, blur * scale * 1.5);
  const [out, o] = canvas(soft.width, soft.height);
  const n = 10;
  o.globalCompositeOperation = 'lighter';
  o.globalAlpha = 1 / n;
  for (let i = 0; i < n; i++) o.drawImage(soft, (i / (n - 1) - 0.5) * smear * k, 0);
  return out;
}

// The lettering round the label's edge, set like an SVG textPath: starting at nine o'clock,
// running clockwise over the top, baseline on the circle.
export function bakeRing(size: number): HTMLCanvasElement {
  const [c, ctx] = canvas(size, size);
  const text = 'XOMIFY · SIDE A · 33⅓ RPM · STEREO ·';
  const r = size * 0.39;
  const spacing = size * 0.011;
  ctx.font = `600 ${size * 0.064}px ${FONT}`;
  ctx.fillStyle = 'rgba(255,246,252,0.82)';
  ctx.textBaseline = 'alphabetic';
  let a = Math.PI;
  for (const ch of text) {
    const w = ctx.measureText(ch).width;
    const mid = a + w / 2 / r;
    ctx.save();
    ctx.translate(size / 2 + Math.cos(mid) * r, size / 2 + Math.sin(mid) * r);
    ctx.rotate(mid + Math.PI / 2);
    ctx.fillText(ch, -w / 2, 0);
    ctx.restore();
    a += (w + spacing) / r;
  }
  return c;
}

// An image centred on a square canvas, `fill` of its width.
export function bakeMark(size: number, img: HTMLImageElement, fill: number): HTMLCanvasElement {
  const [c, ctx] = canvas(size, size);
  ctx.imageSmoothingQuality = 'high';
  const s = size * fill;
  ctx.drawImage(img, (size - s) / 2, (size - s) / 2, s, s);
  return c;
}

// Square sprites turning about their centre, smeared over `sweep` degrees the way a camera
// shutter would. Averaging copies with 'lighter' at 1/n alpha keeps the overall brightness.
export function drawSpun(ctx: CanvasRenderingContext2D, sprites: CanvasImageSource[], sweep: number): void {
  const size = ctx.canvas.width;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  ctx.clearRect(0, 0, size, size);
  const n = sweep < 1.2 ? 1 : Math.min(14, Math.ceil(sweep / 1.2));
  if (n > 1) ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = 1 / n;
  for (let i = 0; i < n; i++) {
    const a = n === 1 ? 0 : ((i / (n - 1) - 0.5) * sweep * Math.PI) / 180;
    ctx.setTransform(Math.cos(a), Math.sin(a), -Math.sin(a), Math.cos(a), size / 2, size / 2);
    for (const s of sprites) ctx.drawImage(s, -size / 2, -size / 2, size, size);
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
}

export interface Flare {
  x: number;
  y: number;
  s: number;
}

// Where along the line from the light through the frame's centre each ghost sits, its radius
// as a fraction of the short side, and its tint: the reflections between lens elements.
const GHOSTS: [number, number, string][] = [
  [-0.42, 0.05, '255,226,190'],
  [0.16, 0.03, '160,240,200'],
  [0.34, 0.09, '255,236,214'],
  [0.58, 0.13, '150,230,190'],
];

// Lens ghosts and a faint horizontal streak off a bright source.
export function drawLens(ctx: CanvasRenderingContext2D, w: number, h: number, flares: Flare[]): void {
  const m = Math.min(w, h);
  ctx.globalCompositeOperation = 'lighter';
  for (const f of flares) {
    ctx.save();
    ctx.translate(f.x, f.y);
    ctx.scale(1, 0.02);
    const streak = ctx.createRadialGradient(0, 0, 0, 0, 0, w * 0.32);
    streak.addColorStop(0, `rgba(255,240,222,${0.2 * f.s})`);
    streak.addColorStop(0.4, `rgba(255,240,222,${0.05 * f.s})`);
    streak.addColorStop(1, 'rgba(255,240,222,0)');
    ctx.fillStyle = streak;
    ctx.fillRect(-w * 0.32, -w * 0.32, w * 0.64, w * 0.64);
    ctx.restore();

    for (const [k, size, tint] of GHOSTS) {
      const x = w / 2 + (w / 2 - f.x) * k;
      const y = h / 2 + (h / 2 - f.y) * k;
      const r = size * m;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(${tint},${0.012 * f.s})`);
      g.addColorStop(0.8, `rgba(${tint},${0.025 * f.s})`);
      g.addColorStop(0.94, `rgba(${tint},${0.045 * f.s})`);
      g.addColorStop(1, `rgba(${tint},0)`);
      ctx.fillStyle = g;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
  }
  ctx.globalCompositeOperation = 'source-over';
}
