// The room: haze hanging in a dark listening room, lit by shafts from a skylight above and,
// on the drop, by a flare off the record. A fragment shader, because smoke needs per-pixel
// noise and lighting; it has no detail finer than a few pixels, so it runs at about half size.

export interface HazeFrame {
  time: number;
  // The skylight's level, which breathes with the kick.
  light: number;
  // 0 at the first frame (the plain room the poster in index.html paints), 1 once in.
  enter: number;
  flare: number;
  // 0..1, the drop's shock wave clearing the haze outward from the record.
  blast: number;
  // The camera's orbit, which swings the skylight across the frame.
  yaw: number;
  // The record's centre, as a fraction of the viewport.
  cx: number;
  cy: number;
}

// Same two stops as ROOM in intro.component.scss and .xi-poster in index.html.
export const ROOM_TOP = [0.024, 0.031, 0.035];
export const ROOM_BOTTOM = [0.043, 0.05, 0.051];

const VERTEX = `
attribute vec2 aPos;
varying vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

const FRAGMENT = `
precision highp float;
varying vec2 vUv;
uniform vec2 uRes;
uniform float uTime;
uniform float uLight;
uniform float uEnter;
uniform float uFlare;
uniform float uBlast;
uniform float uYaw;
uniform vec2 uCenter;
uniform vec3 uTop;
uniform vec3 uBottom;

float hash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}

const mat2 ROT = mat2(1.6, 1.2, -1.2, 1.6);

float fbm(vec2 p) {
  float s = 0.0;
  float a = 0.5;
  for (int i = 0; i < 5; i++) {
    s += a * noise(p);
    p = ROT * p;
    a *= 0.5;
  }
  return s;
}

void main() {
  float aspect = uRes.x / uRes.y;
  vec2 uv = vec2(vUv.x, 1.0 - vUv.y);
  vec3 room = mix(uTop, uBottom, uv.y);
  // y grows downward, as on the page.
  vec2 p = (uv - 0.5) * vec2(aspect, 1.0);
  vec2 c = (uCenter - 0.5) * vec2(aspect, 1.0);

  // A skylight up and to the left of frame. Its beams are rays broken up by noise in angle,
  // so they fan out from the source the way light through a dusty window does.
  vec2 src = vec2((-0.32 + 0.3 * uYaw) * aspect, -0.95);
  vec2 v = p - src;
  float dist = length(v);
  float ang = atan(v.x, v.y);
  float beams = smoothstep(0.42, 0.78, fbm(vec2(ang * 7.0 + uTime * 0.025, uTime * 0.04)));
  float cone = smoothstep(0.75, 0.15, abs(ang - 0.42));
  float shaft = beams * cone * exp(-dist * 0.9);

  // Haze, two drifting sheets, pushed out from the record by the drop.
  float r = length(p - c);
  float reach = uBlast * 1.4;
  vec2 q = c + (p - c) / (1.0 + uBlast * 1.2);
  vec2 w = vec2(noise(q * 1.3 + 4.1), noise(q * 1.3 + 9.2)) - 0.5;
  float d = fbm(q * 2.4 + w * 0.8 + vec2(uTime * 0.05, -uTime * 0.02));
  d = d * 0.6 + 0.4 * fbm(q * 5.0 - vec2(uTime * 0.08, 0.0));
  d = smoothstep(0.3, 0.85, d) * smoothstep(reach - 0.35, reach, r);

  vec3 green = vec3(0.29, 0.92, 0.6);
  vec3 warm = vec3(1.0, 0.93, 0.84);
  vec3 col = room;
  float lit = uLight * (shaft * 1.3 + 0.18 * exp(-dist * 1.4));
  col += mix(green, warm, 0.55) * lit * (0.1 + d * 1.0) * 0.4;
  col += mix(green, warm, 0.6) * shaft * uLight * 0.06;
  // The pool the lamp over the deck throws on the table.
  col += warm * 0.045 * uLight * exp(-length((p - c) * vec2(0.8, 1.2)) * 2.2);

  float flare = uFlare * (1.3 * exp(-r * 16.0) + 0.55 * exp(-r * 5.0) + 0.12 * exp(-r * 1.6));
  col += mix(green, warm, 0.55 + 0.4 * exp(-r * 8.0)) * flare;
  col += mix(green, warm, 0.4) * uFlare * d * 0.25 * exp(-r * 2.0);

  col = 1.0 - exp(-col * 1.25);
  gl_FragColor = vec4(mix(room, col, uEnter), 1.0);
}`;

export function createHaze(canvas: HTMLCanvasElement): ((f: HazeFrame) => void) | null {
  const gl = canvas.getContext('webgl', { antialias: false, alpha: false });
  if (!gl) return null;
  const program = gl.createProgram();
  if (!program) return null;
  for (const [type, src] of [
    [gl.VERTEX_SHADER, VERTEX],
    [gl.FRAGMENT_SHADER, FRAGMENT],
  ] as const) {
    const shader = gl.createShader(type);
    if (!shader) return null;
    gl.shaderSource(shader, src);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) return null;
    gl.attachShader(program, shader);
  }
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return null;
  gl.useProgram(program);

  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const pos = gl.getAttribLocation(program, 'aPos');
  gl.enableVertexAttribArray(pos);
  gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0);

  const u = (name: string): WebGLUniformLocation | null => gl.getUniformLocation(program, name);
  gl.uniform3fv(u('uTop'), ROOM_TOP);
  gl.uniform3fv(u('uBottom'), ROOM_BOTTOM);
  const res = u('uRes');
  const time = u('uTime');
  const light = u('uLight');
  const enter = u('uEnter');
  const flare = u('uFlare');
  const blast = u('uBlast');
  const yaw = u('uYaw');
  const center = u('uCenter');

  return (f) => {
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform2f(res, canvas.width, canvas.height);
    gl.uniform1f(time, f.time);
    gl.uniform1f(light, f.light);
    gl.uniform1f(enter, f.enter);
    gl.uniform1f(flare, f.flare);
    gl.uniform1f(blast, f.blast);
    gl.uniform1f(yaw, f.yaw);
    gl.uniform2f(center, f.cx, f.cy);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };
}
