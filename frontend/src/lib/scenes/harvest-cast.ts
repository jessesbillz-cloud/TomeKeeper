/**
 * Hand-drawn Thanksgiving cast: falling leaves, pumpkins, gourds, a hay bale,
 * a corn shock, a strutting turkey, a pie cooling with steam, and the
 * cornucopia.
 *
 * Same conventions as ../spooky.ts and ./patriotic.ts — INK outlines, flat
 * fills, ground figures anchored at the feet / bottom centre.
 */

import { INK, inked, limb, rrPath } from "./kit";

// ---------------------------------------------------------------------------
// Leaves
// ---------------------------------------------------------------------------

// Half a maple leaf (right side), pointing up, unit size. Mirrored for the
// left side so the leaf is symmetric.
const MAPLE_HALF: Array<[number, number]> = [
  [0, -1],
  [0.13, -0.6],
  [0.36, -0.74],
  [0.31, -0.33],
  [0.82, -0.47],
  [0.63, -0.15],
  [0.78, 0.0],
  [0.38, 0.1],
  [0.44, 0.38],
  [0.1, 0.24],
  [0.03, 0.34],
];

export const LEAF_COLORS = ["#d97706", "#b45309", "#c2410c", "#eab308", "#9a3412"];

/**
 * A falling leaf at (x, y). `flip` (-1..1) squashes it horizontally so it
 * looks like it's tumbling over as it falls. kind 0 = maple, 1 = oak.
 */
export function drawLeaf(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  angle: number,
  flip: number,
  color: string,
  kind: number,
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.scale(Math.max(0.15, Math.abs(flip)), 1);
  const s = size;
  const lw = Math.max(0.8, s * 0.08);
  ctx.beginPath();
  if (kind === 0) {
    MAPLE_HALF.forEach(([px, py], i) =>
      i === 0 ? ctx.moveTo(px * s, py * s) : ctx.lineTo(px * s, py * s),
    );
    for (let i = MAPLE_HALF.length - 1; i >= 1; i--) {
      const [px, py] = MAPLE_HALF[i];
      ctx.lineTo(-px * s, py * s);
    }
  } else {
    // Oak: rounded lobes down each side.
    const lobes = 4;
    ctx.moveTo(0, -s);
    for (let i = 0; i < lobes; i++) {
      const y0 = -s + (i * 1.6 * s) / lobes;
      const y1 = -s + ((i + 1) * 1.6 * s) / lobes;
      const wdt = s * (0.32 + 0.12 * Math.sin((i / lobes) * Math.PI));
      ctx.quadraticCurveTo(wdt * 1.4, (y0 + y1) / 2, wdt * 0.35, y1);
    }
    ctx.lineTo(0, s * 0.7);
    for (let i = lobes - 1; i >= 0; i--) {
      const y0 = -s + ((i + 1) * 1.6 * s) / lobes;
      const y1 = -s + (i * 1.6 * s) / lobes;
      const wdt = s * (0.32 + 0.12 * Math.sin((i / lobes) * Math.PI));
      ctx.quadraticCurveTo(-wdt * 1.4, (y0 + y1) / 2, -wdt * 0.35, y1);
    }
  }
  ctx.closePath();
  inked(ctx, color, lw);
  // Midrib and stem.
  ctx.strokeStyle = INK;
  ctx.lineWidth = lw * 0.8;
  ctx.beginPath();
  ctx.moveTo(0, -s * 0.7);
  ctx.lineTo(0, s * 0.85);
  ctx.stroke();
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Harvest pieces
// ---------------------------------------------------------------------------

/** Pumpkin sitting on the ground at (x, ground); `w` is its width. */
export function drawPumpkin(
  ctx: CanvasRenderingContext2D,
  x: number,
  ground: number,
  w: number,
  color = "#ea7a1a",
) {
  const h = w * 0.72;
  const cy = ground - h / 2;
  const lw = Math.max(1, w * 0.045);
  // Outer ribs first, centre rib on top.
  for (const [dx, rx] of [
    [-0.24, 0.3],
    [0.24, 0.3],
    [0, 0.26],
  ] as const) {
    ctx.beginPath();
    ctx.ellipse(x + dx * w, cy, rx * w, h / 2, 0, 0, Math.PI * 2);
    inked(ctx, dx === 0 ? color : shade(color, -0.12), lw);
  }
  // Stem.
  ctx.beginPath();
  ctx.moveTo(x - w * 0.05, cy - h / 2 + lw);
  ctx.quadraticCurveTo(x - w * 0.04, cy - h / 2 - w * 0.2, x + w * 0.08, cy - h / 2 - w * 0.22);
  ctx.lineTo(x + w * 0.07, cy - h / 2 - w * 0.13);
  ctx.quadraticCurveTo(x + w * 0.04, cy - h / 2 - w * 0.08, x + w * 0.05, cy - h / 2 + lw);
  ctx.closePath();
  inked(ctx, "#5b6b2a", lw * 0.8);
}

/** Pear-shaped gourd, two-tone, on the ground. */
export function drawGourd(
  ctx: CanvasRenderingContext2D,
  x: number,
  ground: number,
  h: number,
  tilt: number,
) {
  const lw = Math.max(1, h * 0.05);
  ctx.save();
  ctx.translate(x, ground);
  ctx.rotate(tilt);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.bezierCurveTo(h * 0.42, 0, h * 0.38, -h * 0.5, h * 0.12, -h * 0.62);
  ctx.quadraticCurveTo(h * 0.08, -h * 0.95, 0, -h * 0.95);
  ctx.quadraticCurveTo(-h * 0.08, -h * 0.95, -h * 0.12, -h * 0.62);
  ctx.bezierCurveTo(-h * 0.38, -h * 0.5, -h * 0.42, 0, 0, 0);
  ctx.closePath();
  inked(ctx, "#e9c46a", lw);
  // Green bottom half.
  ctx.save();
  ctx.clip();
  ctx.fillStyle = "#4d7c3a";
  ctx.fillRect(-h, -h * 0.32, h * 2, h);
  ctx.restore();
  ctx.stroke();
  ctx.strokeStyle = INK;
  ctx.lineWidth = lw * 0.9;
  ctx.beginPath();
  ctx.moveTo(0, -h * 0.95);
  ctx.lineTo(h * 0.04, -h * 1.08);
  ctx.stroke();
  ctx.restore();
}

/** Hay bale, sitting on the ground. */
export function drawHayBale(
  ctx: CanvasRenderingContext2D,
  x: number,
  ground: number,
  w: number,
) {
  const h = w * 0.55;
  const lw = Math.max(1, w * 0.035);
  rrPath(ctx, x - w / 2, ground - h, w, h, w * 0.1);
  inked(ctx, "#d6a93b", lw);
  ctx.strokeStyle = "rgba(120, 80, 20, 0.55)";
  ctx.lineWidth = Math.max(0.6, w * 0.015);
  for (let i = 1; i < 6; i++) {
    const yy = ground - h + (i * h) / 6;
    ctx.beginPath();
    ctx.moveTo(x - w * 0.44, yy);
    ctx.lineTo(x + w * 0.44, yy + (i % 2 ? 1.5 : -1.5));
    ctx.stroke();
  }
  // Twine.
  ctx.strokeStyle = "#7c4a1e";
  ctx.lineWidth = Math.max(1, w * 0.03);
  for (const f of [-0.25, 0.25]) {
    ctx.beginPath();
    ctx.moveTo(x + f * w, ground - h);
    ctx.lineTo(x + f * w, ground);
    ctx.stroke();
  }
}

/** Corn shock — stalks bundled and tied, flaring at the top. */
export function drawCornShock(
  ctx: CanvasRenderingContext2D,
  x: number,
  ground: number,
  h: number,
  t: number,
) {
  const lw = Math.max(1, h * 0.025);
  const sway = Math.sin(t * 0.9) * h * 0.02;
  ctx.beginPath();
  ctx.moveTo(x - h * 0.26, ground);
  ctx.lineTo(x - h * 0.07, ground - h * 0.58);
  ctx.lineTo(x - h * 0.2 + sway, ground - h);
  ctx.lineTo(x + sway * 0.6, ground - h * 0.86);
  ctx.lineTo(x + h * 0.2 + sway, ground - h * 0.98);
  ctx.lineTo(x + h * 0.07, ground - h * 0.58);
  ctx.lineTo(x + h * 0.26, ground);
  ctx.closePath();
  inked(ctx, "#c9a24a", lw);
  ctx.strokeStyle = "rgba(110, 75, 20, 0.6)";
  ctx.lineWidth = Math.max(0.6, h * 0.012);
  for (let i = -3; i <= 3; i++) {
    ctx.beginPath();
    ctx.moveTo(x + i * h * 0.06, ground);
    ctx.lineTo(x + i * h * 0.015, ground - h * 0.58);
    ctx.lineTo(x + i * h * 0.045 + sway, ground - h * 0.9);
    ctx.stroke();
  }
  // Tie.
  ctx.beginPath();
  ctx.rect(x - h * 0.09, ground - h * 0.63, h * 0.18, h * 0.07);
  inked(ctx, "#7c4a1e", lw * 0.8);
}

/** The harvest cluster for the bottom-left corner. `s` is its overall height. */
export function drawHarvest(
  ctx: CanvasRenderingContext2D,
  x: number,
  ground: number,
  s: number,
  t: number,
) {
  drawCornShock(ctx, x + s * 0.28, ground, s * 1.05, t);
  drawHayBale(ctx, x + s * 0.72, ground, s * 0.78);
  drawPumpkin(ctx, x + s * 0.52, ground - s * 0.42, s * 0.42, "#f08a24");
  drawPumpkin(ctx, x + s * 0.3, ground, s * 0.62);
  drawGourd(ctx, x + s * 0.72, ground, s * 0.34, 0.25);
  drawPumpkin(ctx, x + s * 0.98, ground, s * 0.4, "#e8d9b0");
}

// ---------------------------------------------------------------------------
// Turkey
// ---------------------------------------------------------------------------

const FEATHERS = ["#7c3f1d", "#b4532a", "#d97706", "#eab308", "#b4532a", "#7c3f1d", "#9a3412"];

/**
 * A cartoon tom turkey, side view, strutting. Anchored at the feet. `step`
 * is the walk phase in radians (advance it with distance); `still` stops the
 * legs for a pause.
 */
export function drawTurkey(
  ctx: CanvasRenderingContext2D,
  x: number,
  ground: number,
  h: number,
  dir: 1 | -1,
  step: number,
  still: boolean,
) {
  const u = h / 100;
  const lw = Math.max(1, u * 2.2);
  const bob = still ? 0 : Math.abs(Math.sin(step)) * u * 2;
  ctx.save();
  ctx.translate(x, ground);
  ctx.scale(dir, 1);

  // Tail fan, behind everything: feathers fanned from the rump, cream tips.
  const fx = -12 * u;
  const fy = -50 * u - bob;
  for (let i = 0; i < FEATHERS.length; i++) {
    const a = Math.PI * (1.02 + (i / (FEATHERS.length - 1)) * 0.86);
    const r = 40 * u;
    ctx.save();
    ctx.translate(fx, fy);
    ctx.rotate(a);
    ctx.beginPath();
    ctx.ellipse(r * 0.58, 0, r * 0.5, 8.5 * u, 0, 0, Math.PI * 2);
    inked(ctx, FEATHERS[i], lw);
    ctx.beginPath();
    ctx.ellipse(r * 0.98, 0, 5 * u, 6.5 * u, 0, 0, Math.PI * 2);
    inked(ctx, "#f3e2c0", lw * 0.8);
    ctx.restore();
  }

  // Legs (drawn before the body so the body sits over the hips).
  const legC = "#e08a1e";
  for (const k of [0, Math.PI]) {
    const sw = still ? 0 : Math.sin(step + k);
    const lift = still ? 0 : Math.max(0, Math.cos(step + k)) * 4 * u;
    const hip: [number, number] = [2 * u, -30 * u - bob];
    const foot: [number, number] = [2 * u + sw * 9 * u, -lift];
    limb(ctx, [hip, foot], 3 * u, legC, lw * 0.6);
    ctx.strokeStyle = legC;
    ctx.lineWidth = 2 * u;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(foot[0], foot[1]);
    ctx.lineTo(foot[0] + 6 * u, foot[1]);
    ctx.moveTo(foot[0], foot[1]);
    ctx.lineTo(foot[0] - 3 * u, foot[1]);
    ctx.stroke();
  }

  // Body.
  ctx.beginPath();
  ctx.ellipse(0, -44 * u - bob, 24 * u, 18 * u, -0.12, 0, Math.PI * 2);
  inked(ctx, "#6b3a1c", lw);
  // Wing.
  ctx.beginPath();
  ctx.ellipse(-3 * u, -44 * u - bob, 14 * u, 9 * u, 0.25, 0, Math.PI * 2);
  inked(ctx, "#4a2812", lw * 0.9);
  ctx.strokeStyle = "rgba(243, 226, 192, 0.6)";
  ctx.lineWidth = u * 1.2;
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.moveTo(-12 * u + i * 5 * u, -40 * u - bob);
    ctx.lineTo(-6 * u + i * 5 * u, -38 * u - bob);
    ctx.stroke();
  }

  // Neck and head bob forward with each step, like a real turkey.
  const nod = still ? Math.sin(step * 0.5) * u : Math.sin(step * 2) * 3.5 * u;
  const neckBase: [number, number] = [17 * u, -52 * u - bob];
  const head: [number, number] = [25 * u + nod, -74 * u - bob];
  limb(ctx, [neckBase, [22 * u + nod * 0.5, -62 * u - bob], head], 7 * u, "#b9c4cf", lw * 0.6);
  ctx.beginPath();
  ctx.arc(head[0], head[1], 6.5 * u, 0, Math.PI * 2);
  inked(ctx, "#c3ccd6", lw);
  // Beak.
  ctx.beginPath();
  ctx.moveTo(head[0] + 5.5 * u, head[1] - 1.5 * u);
  ctx.lineTo(head[0] + 11 * u, head[1] + 0.5 * u);
  ctx.lineTo(head[0] + 5.5 * u, head[1] + 2.5 * u);
  ctx.closePath();
  inked(ctx, "#f2b33d", lw * 0.7);
  // Snood over the beak and wattle hanging under it.
  ctx.beginPath();
  ctx.ellipse(head[0] + 7 * u, head[1] + 4 * u, 2 * u, 5 * u, -0.3, 0, Math.PI * 2);
  inked(ctx, "#d92b2b", lw * 0.7);
  ctx.beginPath();
  ctx.ellipse(head[0] + 2 * u, head[1] + 8 * u, 3.4 * u, 6 * u, 0.1, 0, Math.PI * 2);
  inked(ctx, "#d92b2b", lw * 0.7);
  // Eye.
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.arc(head[0] + 2 * u, head[1] - 1.5 * u, 1.4 * u, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

// ---------------------------------------------------------------------------
// Pie and cornucopia
// ---------------------------------------------------------------------------

/** A lattice-top pie on the ground, with steam curling up. */
export function drawPie(
  ctx: CanvasRenderingContext2D,
  x: number,
  ground: number,
  w: number,
  t: number,
) {
  const lw = Math.max(1, w * 0.035);
  const top = ground - w * 0.22;
  // Tin.
  ctx.beginPath();
  ctx.moveTo(x - w * 0.5, top + w * 0.04);
  ctx.lineTo(x + w * 0.5, top + w * 0.04);
  ctx.lineTo(x + w * 0.4, ground);
  ctx.lineTo(x - w * 0.4, ground);
  ctx.closePath();
  inked(ctx, "#9ca3af", lw);
  // Filling + crust top.
  ctx.beginPath();
  ctx.ellipse(x, top, w * 0.5, w * 0.13, 0, 0, Math.PI * 2);
  inked(ctx, "#c2410c", lw);
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(x, top, w * 0.46, w * 0.11, 0, 0, Math.PI * 2);
  ctx.clip();
  ctx.strokeStyle = "#e9b96e";
  ctx.lineWidth = w * 0.06;
  for (let i = -3; i <= 3; i++) {
    ctx.beginPath();
    ctx.moveTo(x + i * w * 0.13 - w * 0.1, top - w * 0.15);
    ctx.lineTo(x + i * w * 0.13 + w * 0.1, top + w * 0.15);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x + i * w * 0.13 + w * 0.1, top - w * 0.15);
    ctx.lineTo(x + i * w * 0.13 - w * 0.1, top + w * 0.15);
    ctx.stroke();
  }
  ctx.restore();
  // Crimped crust rim.
  ctx.beginPath();
  ctx.ellipse(x, top, w * 0.5, w * 0.13, 0, 0, Math.PI * 2);
  ctx.strokeStyle = "#d9a35a";
  ctx.lineWidth = w * 0.06;
  ctx.stroke();
  ctx.strokeStyle = INK;
  ctx.lineWidth = lw * 0.7;
  ctx.beginPath();
  ctx.ellipse(x, top, w * 0.53, w * 0.155, 0, 0, Math.PI * 2);
  ctx.stroke();

  // Steam: three wisps rising and fading on a loop.
  ctx.lineCap = "round";
  for (let i = 0; i < 3; i++) {
    const p = (t * 0.35 + i / 3) % 1;
    const sx = x + (i - 1) * w * 0.22;
    const rise = p * w * 0.9;
    ctx.strokeStyle = `rgba(241, 245, 249, ${0.32 * Math.sin(p * Math.PI)})`;
    ctx.lineWidth = Math.max(2, w * 0.07);
    ctx.lineJoin = "round";
    ctx.beginPath();
    for (let k = 0; k <= 16; k++) {
      const yy = top - w * 0.12 - rise - k * w * 0.025;
      // Wider sway the higher it gets, like real steam spreading out.
      const xx = sx + Math.sin(k * 0.38 + t * 1.5 + i * 2) * w * (0.03 + k * 0.004);
      if (k === 0) ctx.moveTo(xx, yy);
      else ctx.lineTo(xx, yy);
    }
    ctx.stroke();
  }
}

/**
 * The cornucopia — a woven horn lying on its side, curling up at the tip,
 * with fruit spilling out of the mouth toward `dir`. `w` is its length.
 */
export function drawCornucopia(
  ctx: CanvasRenderingContext2D,
  x: number,
  ground: number,
  w: number,
  dir: 1 | -1,
) {
  const lw = Math.max(1, w * 0.025);
  ctx.save();
  ctx.translate(x, ground);
  ctx.scale(dir, 1);

  // Horn: from the curled tip at the left to the open mouth at the right.
  ctx.beginPath();
  ctx.moveTo(-0.5 * w, -0.42 * w);
  ctx.quadraticCurveTo(-0.58 * w, -0.24 * w, -0.4 * w, -0.2 * w);
  ctx.quadraticCurveTo(-0.1 * w, -0.08 * w, 0.18 * w, -0.04 * w);
  ctx.lineTo(0.2 * w, -0.4 * w);
  ctx.quadraticCurveTo(-0.15 * w, -0.32 * w, -0.38 * w, -0.3 * w);
  ctx.quadraticCurveTo(-0.46 * w, -0.32 * w, -0.5 * w, -0.42 * w);
  ctx.closePath();
  inked(ctx, "#c99a4a", lw);
  // Weave bands.
  ctx.save();
  ctx.clip();
  ctx.strokeStyle = "rgba(110, 70, 20, 0.6)";
  ctx.lineWidth = w * 0.018;
  for (let i = 0; i < 8; i++) {
    const bx = -0.4 * w + i * 0.075 * w;
    ctx.beginPath();
    ctx.moveTo(bx - 0.03 * w, -0.45 * w);
    ctx.lineTo(bx + 0.03 * w, 0);
    ctx.stroke();
  }
  ctx.restore();
  // Mouth rim.
  ctx.beginPath();
  ctx.ellipse(0.19 * w, -0.22 * w, 0.06 * w, 0.18 * w, 0, 0, Math.PI * 2);
  inked(ctx, "#8a5a22", lw);

  // Fruit spilling out onto the ground.
  const fruit = (fx: number, fy: number, r: number, c: string) => {
    ctx.beginPath();
    ctx.arc(fx * w, fy * w, r * w, 0, Math.PI * 2);
    inked(ctx, c, lw);
  };
  // Grapes.
  for (const [gx, gy] of [
    [0.24, -0.3],
    [0.29, -0.27],
    [0.26, -0.24],
    [0.31, -0.21],
    [0.27, -0.18],
  ]) {
    fruit(gx, gy, 0.035, "#6d3a8a");
  }
  // Pear.
  ctx.beginPath();
  ctx.ellipse(0.4 * w, -0.08 * w, 0.06 * w, 0.08 * w, 0.4, 0, Math.PI * 2);
  inked(ctx, "#a3b93a", lw);
  fruit(0.28, -0.07, 0.07, "#c62828"); // apple
  fruit(0.5, -0.045, 0.045, "#e97b1f"); // orange
  drawPumpkin(ctx, 0.12 * w, 0, 0.16 * w);
  // Ear of corn leaning out.
  ctx.save();
  ctx.translate(0.3 * w, -0.34 * w);
  ctx.rotate(0.9);
  ctx.beginPath();
  ctx.ellipse(0, 0, 0.04 * w, 0.11 * w, 0, 0, Math.PI * 2);
  inked(ctx, "#f2c94c", lw);
  ctx.beginPath();
  ctx.moveTo(0, 0.1 * w);
  ctx.quadraticCurveTo(0.08 * w, 0.02 * w, 0.03 * w, -0.08 * w);
  ctx.quadraticCurveTo(0.02 * w, 0.06 * w, 0, 0.1 * w);
  inked(ctx, "#8aa04a", lw * 0.8);
  ctx.restore();

  ctx.restore();
}

/** Lighten (amt > 0) or darken (amt < 0) a #rrggbb colour. */
function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  const f = (c: number) =>
    Math.round(Math.min(255, Math.max(0, amt < 0 ? c * (1 + amt) : c + (255 - c) * amt)));
  const r = f((n >> 16) & 255);
  const g = f((n >> 8) & 255);
  const b = f(n & 255);
  return `rgb(${r}, ${g}, ${b})`;
}
