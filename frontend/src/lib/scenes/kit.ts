/**
 * Shared kit for the hand-built holiday scenes.
 *
 * A scene is a small object that draws one frame at a time onto the overlay
 * canvas. HolidayCanvas owns the canvas, the DPR scaling, the clear, the
 * RAF loop and the battery guards; a scene only draws.
 *
 * Style follows the Halloween cast in ../spooky.ts: heavy INK outlines, flat
 * fills, no emoji, no images — everything canvas primitives so it is crisp
 * at any size and looks the same on every phone.
 *
 * DESIGN RULES (Jesse, after the first Veterans preview: "soften it up —
 * she still has to push her buttons"). Every scene sits in the BACKGROUND:
 *  - Small figures, partly see-through. Fade figures as one piece with
 *    `softLayer` at roughly 0.5–0.9 (big/central things lowest), never by
 *    setting globalAlpha on a figure made of overlapping shapes.
 *  - Keep the middle of the screen (the calendar) mostly clear: ambient bits
 *    (snow, leaves, hearts) are sparse and faint; anything solid lives on the
 *    edges — top corners, the bottom strip, or a quick pass across the sky.
 *  - Leave the app title (top centre) readable and keep solid things out of
 *    the bottom-right ~100×100 where the "+ Sale" button sits.
 *  - Phones: populations trimmed with `trimFor`; sizes scale off w/h with
 *    clamps, never fixed big numbers.
 *  - Stages ADD to each other so the screen visibly builds toward the day,
 *    and the day itself is the fullest — but still background-level.
 *  - No trademarked characters or marks (no Rudolph's glowing nose, no
 *    Frosty, no branded mascots or emblems). Generic Santa, reindeer,
 *    snowman, cupid, bunny, leprechaun are fine.
 */

export { INK, inked, rrPath } from "../spooky";
import { INK } from "../spooky";

export interface Scene {
  /**
   * Draw one frame. The canvas is already cleared and DPR-scaled; `w`/`h`
   * are CSS pixels. `t` is seconds since the scene started.
   */
  frame(dt: number, t: number, w: number, h: number): void;
}

export type SceneFactory = (
  ctx: CanvasRenderingContext2D,
  stage: number,
) => Scene;

/** Phones get ~40% fewer figures so the screen never goes wall-to-wall. */
export function trimFor(w: number) {
  const small = w < 480;
  return (n: number) =>
    small ? Math.max(n > 0 ? 1 : 0, Math.round(n * 0.6)) : n;
}

/** The line the ground figures stand on — same as the Halloween walkers. */
export function groundY(h: number): number {
  return h - Math.min(46, h * 0.07);
}

export const rand = (a: number, b: number) => a + Math.random() * (b - a);
export const pick = <T>(xs: readonly T[]): T =>
  xs[Math.floor(Math.random() * xs.length)];

/** Smoothstep 0→1 easing, clamped. */
export function ease(x: number): number {
  const c = Math.min(1, Math.max(0, x));
  return c * c * (3 - 2 * c);
}

/** Five-point star PATH centred on (x, y). */
export function starPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  rot = 0,
  inner = 0.45,
) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const rr = i % 2 === 0 ? r : r * inner;
    const a = rot - Math.PI / 2 + (i * Math.PI) / 5;
    const px = x + Math.cos(a) * rr;
    const py = y + Math.sin(a) * rr;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

/**
 * A cartoon limb: a thick round-capped stroke with an ink outline, drawn as
 * a wide INK stroke with the colour stroked on top.
 */
export function limb(
  ctx: CanvasRenderingContext2D,
  pts: ReadonlyArray<readonly [number, number]>,
  width: number,
  color: string,
  outline: number,
) {
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
  ctx.strokeStyle = INK;
  ctx.lineWidth = width + outline * 2;
  ctx.stroke();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.stroke();
  ctx.restore();
}

/**
 * Soft coloured glow around the screen edge. Atmosphere, not a filter —
 * keep alpha low. `rgb` is "r, g, b".
 */
export function vignette(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  rgb: string,
  alpha: number,
) {
  const g = ctx.createRadialGradient(
    w / 2,
    h / 2,
    Math.min(w, h) * 0.25,
    w / 2,
    h / 2,
    Math.max(w, h) * 0.75,
  );
  g.addColorStop(0, `rgba(${rgb}, 0)`);
  g.addColorStop(1, `rgba(${rgb}, ${Math.max(0, alpha)})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

/** A falling, swaying, spinning bit of something — confetti, stars, leaves. */
export interface Drifter {
  x: number;
  y: number;
  size: number;
  speed: number;
  sway: number;
  phase: number;
  spin: number;
  angle: number;
  color: string;
  kind: number;
}

export function spawnDrifter(
  w: number,
  h: number,
  initial: boolean,
  colors: readonly string[],
  size: [number, number],
  speed: [number, number],
  kinds = 1,
): Drifter {
  return {
    x: Math.random() * w,
    y: initial ? Math.random() * h : -20,
    size: rand(size[0], size[1]),
    speed: rand(speed[0], speed[1]),
    sway: rand(6, 24),
    phase: Math.random() * Math.PI * 2,
    spin: (Math.random() - 0.5) * 1.8,
    angle: Math.random() * Math.PI * 2,
    color: pick(colors),
    kind: Math.floor(Math.random() * kinds),
  };
}

/**
 * Advance a drifter and recycle it off the bottom. Returns the swayed x so
 * the caller can draw it.
 */
export function stepDrifter(
  d: Drifter,
  dt: number,
  w: number,
  h: number,
): number {
  d.y += d.speed * dt;
  d.phase += dt;
  d.angle += d.spin * dt;
  if (d.y > h + 24) {
    d.y = -20;
    d.x = Math.random() * w;
  }
  return d.x + Math.sin(d.phase) * d.sway;
}

// One scratch canvas, reused (and only ever grown) for every soft layer.
let scratch: HTMLCanvasElement | null = null;
let scratchCtx: CanvasRenderingContext2D | null = null;

/**
 * Draw something at `alpha` as a single flat layer.
 *
 * Setting globalAlpha directly on a figure built from overlapping shapes
 * (an arm over a coat, a flag drawn in slices) lets every overlap show
 * through as a darker seam. Instead this draws the figure at full strength
 * into a scratch canvas covering just the box (x, y, w, h), then fades the
 * finished picture onto the scene in one go.
 */
export function softLayer(
  ctx: CanvasRenderingContext2D,
  alpha: number,
  x: number,
  y: number,
  w: number,
  h: number,
  draw: (g: CanvasRenderingContext2D) => void,
) {
  if (alpha >= 1 || w <= 0 || h <= 0) {
    draw(ctx);
    return;
  }
  const dpr = ctx.getTransform().a || 1;
  const pw = Math.ceil(w * dpr);
  const ph = Math.ceil(h * dpr);
  if (!scratch) {
    scratch = document.createElement("canvas");
    scratchCtx = scratch.getContext("2d");
  }
  if (!scratchCtx) {
    draw(ctx);
    return;
  }
  if (scratch.width < pw || scratch.height < ph) {
    scratch.width = Math.max(scratch.width, pw);
    scratch.height = Math.max(scratch.height, ph);
  }
  const g = scratchCtx;
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalAlpha = 1;
  // Clear a pixel past the box: drawImage smooths across the box edge, and
  // anything left over from an earlier, bigger layer would show as a faint
  // outline around the figure.
  g.clearRect(0, 0, Math.min(scratch.width, pw + 2), Math.min(scratch.height, ph + 2));
  g.setTransform(dpr, 0, 0, dpr, -x * dpr, -y * dpr);
  draw(g);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.drawImage(scratch, 0, 0, pw, ph, x, y, w, h);
  ctx.restore();
}
