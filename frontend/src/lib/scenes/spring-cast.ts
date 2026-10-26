/**
 * Hand-drawn cast for the spring and summer scenes: St. Patrick's
 * (shamrocks, gold coins, a pot of gold, the rainbow), Easter (tulips,
 * daisies, painted eggs, a bunny, a basket) and the 4th (sparklers).
 *
 * Same conventions as ../spooky.ts and ./patriotic.ts — heavy ink outlines,
 * flat fills, (ctx, x, y, size, …) signatures, ground figures anchored at
 * the bottom. The bunny is a generic cartoon rabbit, not any named or
 * branded character.
 */

import { INK, inked } from "./kit";

export const SHAMROCK_GREENS = ["#22c55e", "#16a34a", "#4ade80"];
const COIN = "#fbbf24";
const COIN_DEEP = "#d97706";

// --- St. Patrick's -------------------------------------------------------------

/** A heart-shaped leaf with its tip at the origin, lobes pointing up (−y). */
function heartLeaf(ctx: CanvasRenderingContext2D, s: number) {
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.bezierCurveTo(-s * 0.62, -s * 0.38, -s * 0.42, -s * 0.98, 0, -s * 0.66);
  ctx.bezierCurveTo(s * 0.42, -s * 0.98, s * 0.62, -s * 0.38, 0, 0);
  ctx.closePath();
}

/** Three-leaf shamrock centred on (x, y), `size` across. */
export function drawShamrock(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  rot: number,
  color: string,
) {
  const s = size * 0.55;
  const lw = Math.max(1, size * 0.07);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  // Stem first so the leaves sit over it.
  ctx.strokeStyle = INK;
  ctx.lineCap = "round";
  ctx.lineWidth = lw * 2.6;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(s * 0.25, s * 0.6, s * 0.1, s * 1.05);
  ctx.stroke();
  ctx.strokeStyle = color;
  ctx.lineWidth = lw * 1.1;
  ctx.stroke();
  for (let i = 0; i < 3; i++) {
    const a = -Math.PI / 2 + (i * Math.PI * 2) / 3;
    ctx.save();
    // Tip at the centre, lobes pointing outward along `a`.
    ctx.rotate(a + Math.PI / 2);
    heartLeaf(ctx, s);
    inked(ctx, color, lw);
    ctx.restore();
  }
  ctx.restore();
}

/**
 * Gold coin seen edge-on as it spins: `spin` in radians; the width follows
 * |cos(spin)| so it flips like a tossed coin.
 */
export function drawCoin(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  spin: number,
) {
  const sx = Math.max(0.12, Math.abs(Math.cos(spin)));
  const lw = Math.max(0.9, r * 0.16);
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(sx, 1);
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  inked(ctx, Math.cos(spin) > 0 ? COIN : COIN_DEEP, lw / sx);
  ctx.strokeStyle = "rgba(146, 64, 14, 0.7)";
  ctx.lineWidth = Math.max(0.6, r * 0.1) / sx;
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.66, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

/**
 * Pot of gold: black cauldron with a heap of coins. Anchored at the bottom
 * centre; `w` is the pot's width.
 */
export function drawPotOfGold(
  ctx: CanvasRenderingContext2D,
  x: number,
  ground: number,
  w: number,
) {
  const u = w / 100;
  const lw = Math.max(1.2, u * 2.2);
  // Little feet.
  ctx.fillStyle = "#1f1f22";
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(x + s * 28 * u, ground - 3 * u, 9 * u, 4 * u, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // Heap of coins behind the rim.
  const coins: Array<[number, number]> = [
    [-30, -66], [-14, -72], [2, -75], [18, -71], [32, -65],
    [-22, -80], [-4, -86], [12, -84], [26, -78], [4, -96],
  ];
  for (const [cx, cy] of coins) {
    ctx.beginPath();
    ctx.ellipse(x + cx * u, ground + cy * u, 11 * u, 8 * u, 0, 0, Math.PI * 2);
    inked(ctx, COIN, lw * 0.7);
  }
  // Cauldron body.
  ctx.beginPath();
  ctx.moveTo(x - 44 * u, ground - 64 * u);
  ctx.bezierCurveTo(
    x - 60 * u, ground - 20 * u,
    x - 30 * u, ground - 4 * u,
    x, ground - 4 * u,
  );
  ctx.bezierCurveTo(
    x + 30 * u, ground - 4 * u,
    x + 60 * u, ground - 20 * u,
    x + 44 * u, ground - 64 * u,
  );
  ctx.closePath();
  inked(ctx, "#27272a", lw);
  // Sheen.
  ctx.strokeStyle = "rgba(255,255,255,0.18)";
  ctx.lineWidth = 3 * u;
  ctx.beginPath();
  ctx.arc(x - 8 * u, ground - 40 * u, 26 * u, Math.PI * 0.95, Math.PI * 1.25);
  ctx.stroke();
  // Rim.
  ctx.beginPath();
  ctx.ellipse(x, ground - 64 * u, 48 * u, 8 * u, 0, 0, Math.PI * 2);
  inked(ctx, "#3f3f46", lw);
  // Coins spilling over the rim, in front.
  for (const [cx, cy] of [[-20, -66], [10, -67]] as Array<[number, number]>) {
    ctx.beginPath();
    ctx.ellipse(x + cx * u, ground + cy * u, 11 * u, 7 * u, 0.1, 0, Math.PI * 2);
    inked(ctx, COIN, lw * 0.7);
  }
}

const RAINBOW = ["#ef4444", "#f97316", "#facc15", "#22c55e", "#3b82f6", "#8b5cf6"];

/**
 * Rainbow arc around (cx, cy), outer radius `r`, from angle a0 to a1.
 * Drawn as soft bands — the caller keeps it very faint.
 */
export function drawRainbow(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  band: number,
  a0: number,
  a1: number,
) {
  ctx.save();
  ctx.lineCap = "butt";
  ctx.lineWidth = band + 0.6;
  RAINBOW.forEach((c, i) => {
    ctx.strokeStyle = c;
    ctx.beginPath();
    ctx.arc(cx, cy, r - i * band - band / 2, a0, a1);
    ctx.stroke();
  });
  ctx.restore();
}

// --- Easter ---------------------------------------------------------------------

const STEM = "#4d7c0f";
const LEAF = "#65a30d";

function stemAndLeaves(
  ctx: CanvasRenderingContext2D,
  x: number,
  ground: number,
  h: number,
  sway: number,
  lw: number,
): [number, number] {
  const tx = x + sway;
  const ty = ground - h;
  ctx.save();
  ctx.lineCap = "round";
  ctx.strokeStyle = INK;
  ctx.lineWidth = lw * 2.8;
  ctx.beginPath();
  ctx.moveTo(x, ground);
  ctx.quadraticCurveTo(x, ground - h * 0.5, tx, ty);
  ctx.stroke();
  ctx.strokeStyle = STEM;
  ctx.lineWidth = lw * 1.2;
  ctx.stroke();
  ctx.restore();
  // Two blade leaves at the base, curving outward.
  for (const s of [-1, 1]) {
    const tipX = x + s * h * 0.34 + sway * 0.3;
    const tipY = ground - h * 0.52;
    ctx.beginPath();
    ctx.moveTo(x - s * h * 0.03, ground);
    ctx.quadraticCurveTo(x + s * h * 0.02, ground - h * 0.42, tipX, tipY);
    ctx.quadraticCurveTo(x + s * h * 0.2, ground - h * 0.16, x + s * h * 0.06, ground);
    ctx.closePath();
    inked(ctx, LEAF, lw);
  }
  return [tx, ty];
}

/** Tulip anchored at the ground; `h` is stem height. */
export function drawTulip(
  ctx: CanvasRenderingContext2D,
  x: number,
  ground: number,
  h: number,
  color: string,
  sway: number,
) {
  const lw = Math.max(1, h * 0.035);
  const [tx, ty] = stemAndLeaves(ctx, x, ground, h, sway, lw);
  const b = h * 0.3;
  ctx.save();
  ctx.translate(tx, ty);
  ctx.rotate(sway * 0.02);
  // Cup: two side petals and a front petal with pointed tips.
  ctx.beginPath();
  ctx.moveTo(-b * 0.5, -b * 0.15);
  ctx.quadraticCurveTo(-b * 0.55, b * 0.55, 0, b * 0.5);
  ctx.quadraticCurveTo(b * 0.55, b * 0.55, b * 0.5, -b * 0.15);
  ctx.lineTo(b * 0.42, -b * 0.62);
  ctx.lineTo(b * 0.18, -b * 0.3);
  ctx.lineTo(0, -b * 0.68);
  ctx.lineTo(-b * 0.18, -b * 0.3);
  ctx.lineTo(-b * 0.42, -b * 0.62);
  ctx.closePath();
  inked(ctx, color, lw);
  ctx.strokeStyle = "rgba(0,0,0,0.25)";
  ctx.lineWidth = lw * 0.7;
  ctx.beginPath();
  ctx.moveTo(0, -b * 0.6);
  ctx.quadraticCurveTo(-b * 0.06, b * 0.1, 0, b * 0.45);
  ctx.stroke();
  ctx.restore();
}

/** Daisy anchored at the ground. */
export function drawDaisy(
  ctx: CanvasRenderingContext2D,
  x: number,
  ground: number,
  h: number,
  sway: number,
) {
  const lw = Math.max(1, h * 0.032);
  const [tx, ty] = stemAndLeaves(ctx, x, ground, h, sway, lw);
  const r = h * 0.2;
  ctx.save();
  ctx.translate(tx, ty);
  for (let i = 0; i < 8; i++) {
    ctx.save();
    ctx.rotate((i * Math.PI) / 4 + sway * 0.03);
    ctx.beginPath();
    ctx.ellipse(0, -r * 0.62, r * 0.26, r * 0.55, 0, 0, Math.PI * 2);
    inked(ctx, "#fafaf9", lw * 0.8);
    ctx.restore();
  }
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.36, 0, Math.PI * 2);
  inked(ctx, "#facc15", lw * 0.8);
  ctx.restore();
}

export type EggPattern = "stripes" | "dots" | "zigzag";

/** An egg's outline PATH: rounder at the bottom, narrower at the top. */
function eggPath(ctx: CanvasRenderingContext2D, s: number) {
  ctx.beginPath();
  ctx.moveTo(0, -s);
  ctx.bezierCurveTo(s * 0.62, -s, s * 0.78, s * 0.2, s * 0.72, s * 0.42);
  ctx.bezierCurveTo(s * 0.62, s * 0.86, -s * 0.62, s * 0.86, -s * 0.72, s * 0.42);
  ctx.bezierCurveTo(-s * 0.78, s * 0.2, -s * 0.62, -s, 0, -s);
  ctx.closePath();
}

/**
 * Painted egg sitting on the ground at (x, ground); `size` is half-height.
 */
export function drawEgg(
  ctx: CanvasRenderingContext2D,
  x: number,
  ground: number,
  size: number,
  base: string,
  accent: string,
  pattern: EggPattern,
  tilt: number,
) {
  const s = size;
  const lw = Math.max(1, s * 0.12);
  ctx.save();
  ctx.translate(x, ground - s * 0.78);
  ctx.rotate(tilt);
  eggPath(ctx, s);
  ctx.fillStyle = base;
  ctx.fill();
  ctx.save();
  ctx.clip();
  ctx.fillStyle = accent;
  ctx.strokeStyle = accent;
  if (pattern === "stripes") {
    ctx.fillRect(-s, -s * 0.28, s * 2, s * 0.22);
    ctx.fillRect(-s, s * 0.22, s * 2, s * 0.18);
  } else if (pattern === "dots") {
    const dots: Array<[number, number]> = [
      [-0.3, -0.45], [0.25, -0.2], [-0.35, 0.2], [0.3, 0.42], [0, 0.05], [0.05, -0.7],
    ];
    for (const [dx, dy] of dots) {
      ctx.beginPath();
      ctx.arc(dx * s, dy * s, s * 0.13, 0, Math.PI * 2);
      ctx.fill();
    }
  } else {
    ctx.lineWidth = s * 0.14;
    ctx.lineJoin = "round";
    ctx.beginPath();
    for (let i = 0; i <= 8; i++) {
      const px = -s + (i * s * 2) / 8;
      const py = (i % 2 === 0 ? -0.08 : 0.14) * s;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
  }
  ctx.restore();
  eggPath(ctx, s);
  ctx.lineWidth = lw;
  ctx.strokeStyle = INK;
  ctx.stroke();
  // Highlight.
  ctx.fillStyle = "rgba(255,255,255,0.35)";
  ctx.beginPath();
  ctx.ellipse(-s * 0.28, -s * 0.38, s * 0.1, s * 0.22, 0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/**
 * Generic cartoon bunny, side view, facing `dir`. Anchored at the feet.
 * `hop` 0 = sitting, 1 = top of a hop (stretched, feet off the ground);
 * `twitch` wiggles the nose and ears while sitting.
 */
export function drawBunny(
  ctx: CanvasRenderingContext2D,
  x: number,
  ground: number,
  h: number,
  dir: 1 | -1,
  hop: number,
  twitch: number,
) {
  const u = h / 100;
  const lw = Math.max(1, u * 2.6);
  const FUR = "#f5f5f4";
  const SHADE = "#d6d3d1";
  const PINK = "#f9a8d4";
  const lift = hop * 34 * u;
  const stretch = 1 + hop * 0.12;

  ctx.save();
  ctx.translate(x, ground - lift);
  ctx.scale(dir, 1);
  ctx.scale(1 / Math.sqrt(stretch), stretch);
  const lean = -hop * 0.22;
  ctx.rotate(lean);

  // Back foot (long), stretched out behind on a hop.
  ctx.beginPath();
  ctx.ellipse(-18 * u - hop * 10 * u, -5 * u + hop * 2 * u, 20 * u, 6 * u, hop * 0.5, 0, Math.PI * 2);
  inked(ctx, SHADE, lw);

  // Tail puff.
  ctx.beginPath();
  ctx.arc(-40 * u, -30 * u, 9 * u, 0, Math.PI * 2);
  inked(ctx, "#ffffff", lw);

  // Body.
  ctx.beginPath();
  ctx.ellipse(-12 * u, -28 * u, 32 * u, 25 * u, -0.15, 0, Math.PI * 2);
  inked(ctx, FUR, lw);

  // Front paw.
  ctx.beginPath();
  ctx.ellipse(12 * u + hop * 8 * u, -6 * u, 9 * u, 5 * u, 0, 0, Math.PI * 2);
  inked(ctx, FUR, lw);

  // Ears — back one darker, both flick a little.
  const flick = Math.sin(twitch * 3) * 0.08;
  const ear = (ox: number, rot: number, fill: string) => {
    ctx.save();
    ctx.translate(ox, -62 * u);
    ctx.rotate(rot);
    ctx.beginPath();
    ctx.ellipse(0, -22 * u, 7.5 * u, 23 * u, 0, 0, Math.PI * 2);
    inked(ctx, fill, lw);
    ctx.fillStyle = PINK;
    ctx.beginPath();
    ctx.ellipse(0, -21 * u, 3.6 * u, 17 * u, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };
  ear(10 * u, -0.5 + flick - hop * 0.35, SHADE);

  // Head.
  ctx.beginPath();
  ctx.ellipse(18 * u, -54 * u, 19 * u, 16 * u, 0.1, 0, Math.PI * 2);
  inked(ctx, FUR, lw);

  ear(16 * u, -0.25 - flick - hop * 0.3, FUR);

  // Eye, cheek, nose, whiskers.
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.arc(24 * u, -58 * u, 2.8 * u, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(25 * u, -59 * u, 0.9 * u, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(249, 168, 212, 0.55)";
  ctx.beginPath();
  ctx.arc(24 * u, -50 * u, 4 * u, 0, Math.PI * 2);
  ctx.fill();
  const nose = Math.sin(twitch * 9) * 0.6 * u;
  ctx.beginPath();
  ctx.ellipse(36 * u, -53 * u + nose, 2.6 * u, 2 * u, 0, 0, Math.PI * 2);
  inked(ctx, PINK, lw * 0.6);
  ctx.strokeStyle = "rgba(18, 13, 6, 0.6)";
  ctx.lineWidth = Math.max(0.6, u * 0.8);
  for (const dy of [-2, 1.5]) {
    ctx.beginPath();
    ctx.moveTo(33 * u, -51 * u + dy * u);
    ctx.lineTo(46 * u, -53 * u + dy * 2.2 * u + nose);
    ctx.stroke();
  }

  ctx.restore();
}

/** Woven Easter basket with grass and eggs peeking out. `w` is its width. */
export function drawBasket(
  ctx: CanvasRenderingContext2D,
  x: number,
  ground: number,
  w: number,
) {
  const u = w / 100;
  const lw = Math.max(1, u * 2.2);
  const WICKER = "#c08a4a";
  // Handle.
  ctx.save();
  ctx.lineCap = "round";
  ctx.strokeStyle = INK;
  ctx.lineWidth = 9 * u;
  ctx.beginPath();
  ctx.ellipse(x, ground - 42 * u, 38 * u, 44 * u, 0, Math.PI, 0);
  ctx.stroke();
  ctx.strokeStyle = WICKER;
  ctx.lineWidth = 5 * u;
  ctx.stroke();
  ctx.restore();
  // Eggs peeking out.
  drawEgg(ctx, x - 20 * u, ground - 34 * u, 13 * u, "#f9a8d4", "#fdf2f8", "stripes", -0.3);
  drawEgg(ctx, x + 2 * u, ground - 38 * u, 14 * u, "#93c5fd", "#eff6ff", "dots", 0.05);
  drawEgg(ctx, x + 22 * u, ground - 34 * u, 12 * u, "#fde68a", "#f97316", "zigzag", 0.35);
  // Grass fringe.
  ctx.fillStyle = "#84cc16";
  ctx.beginPath();
  ctx.moveTo(x - 44 * u, ground - 40 * u);
  for (let i = 0; i <= 12; i++) {
    const px = x - 44 * u + (i * 88 * u) / 12;
    ctx.lineTo(px, ground - (i % 2 === 0 ? 40 : 50) * u);
  }
  ctx.lineTo(x + 44 * u, ground - 36 * u);
  ctx.lineTo(x - 44 * u, ground - 36 * u);
  ctx.closePath();
  ctx.fill();
  // Basket body.
  ctx.beginPath();
  ctx.moveTo(x - 46 * u, ground - 42 * u);
  ctx.lineTo(x + 46 * u, ground - 42 * u);
  ctx.lineTo(x + 36 * u, ground);
  ctx.lineTo(x - 36 * u, ground);
  ctx.closePath();
  inked(ctx, WICKER, lw);
  // Weave.
  ctx.strokeStyle = "rgba(120, 72, 28, 0.75)";
  ctx.lineWidth = Math.max(0.7, u * 1.4);
  for (let r = 1; r < 4; r++) {
    const y = ground - 42 * u + r * 10.5 * u;
    const inset = (r * 10.5 * 10) / 42;
    ctx.beginPath();
    ctx.moveTo(x - (46 - inset) * u, y);
    ctx.lineTo(x + (46 - inset) * u, y);
    ctx.stroke();
  }
  for (let i = -3; i <= 3; i++) {
    ctx.beginPath();
    ctx.moveTo(x + i * 12 * u, ground - 42 * u);
    ctx.lineTo(x + i * 9.4 * u, ground);
    ctx.stroke();
  }
}

// --- the 4th ----------------------------------------------------------------------

/**
 * A sparkler planted in the ground, leaning a little, its tip fizzing.
 * `burn` 0..1 is how far down the wire has burned.
 */
export function drawSparkler(
  ctx: CanvasRenderingContext2D,
  x: number,
  ground: number,
  h: number,
  lean: number,
  burn: number,
  t: number,
  seed: number,
) {
  const dx = Math.sin(lean);
  const dy = -Math.cos(lean);
  const tipLen = h * (1 - 0.55 * burn);
  const tx = x + dx * tipLen;
  const ty = ground + dy * tipLen;
  ctx.save();
  ctx.lineCap = "round";
  // Burnt part of the wire (dark), then the unburnt coated part (grey).
  ctx.strokeStyle = "#3f3f46";
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(x, ground);
  ctx.lineTo(x + dx * h * 0.35, ground + dy * h * 0.35);
  ctx.stroke();
  ctx.strokeStyle = "#a1a1aa";
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  ctx.moveTo(x + dx * h * 0.35, ground + dy * h * 0.35);
  ctx.lineTo(tx, ty);
  ctx.stroke();

  // Glow.
  const glowR = h * 0.32;
  const g = ctx.createRadialGradient(tx, ty, 0, tx, ty, glowR);
  g.addColorStop(0, "rgba(255, 244, 214, 0.9)");
  g.addColorStop(0.25, "rgba(253, 224, 71, 0.35)");
  g.addColorStop(1, "rgba(253, 224, 71, 0)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(tx, ty, glowR, 0, Math.PI * 2);
  ctx.fill();

  // Sparks: short bright lines flickering out in every direction, re-rolled
  // every frame from a hash of time so it fizzes rather than rotates.
  const n = 18;
  const frameSeed = Math.floor(t * 30) + seed * 97;
  for (let i = 0; i < n; i++) {
    const hsh = Math.sin((frameSeed + i * 13.37) * 12.9898) * 43758.5453;
    const r1 = hsh - Math.floor(hsh);
    const hsh2 = Math.sin((frameSeed + i * 7.11) * 78.233) * 12345.678;
    const r2 = hsh2 - Math.floor(hsh2);
    const a = r1 * Math.PI * 2;
    const len = h * (0.08 + r2 * 0.28);
    const sx = tx + Math.cos(a) * len * 0.25;
    const sy = ty + Math.sin(a) * len * 0.25;
    const ex = tx + Math.cos(a) * len;
    const ey = ty + Math.sin(a) * len + len * 0.12;
    ctx.strokeStyle = r2 > 0.5 ? "rgba(255, 251, 235, 0.95)" : "rgba(253, 224, 71, 0.9)";
    ctx.lineWidth = r2 > 0.8 ? 1.4 : 1;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(ex, ey);
    ctx.stroke();
    // A few branch into little forks — what makes it read as a sparkler.
    if (r2 > 0.7) {
      ctx.beginPath();
      ctx.moveTo(ex, ey);
      ctx.lineTo(ex + Math.cos(a + 0.7) * len * 0.25, ey + Math.sin(a + 0.7) * len * 0.25);
      ctx.moveTo(ex, ey);
      ctx.lineTo(ex + Math.cos(a - 0.7) * len * 0.25, ey + Math.sin(a - 0.7) * len * 0.25);
      ctx.stroke();
    }
  }
  ctx.restore();
}
