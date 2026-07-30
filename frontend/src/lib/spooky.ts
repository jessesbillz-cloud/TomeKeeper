/**
 * Hand-drawn Halloween cast for the home-screen overlay.
 *
 * Style brief, taken from the cartoon reference sheets Jesse sent: heavy black
 * outlines, flat fills, and glowing eyes doing most of the expression work.
 * Everything here is drawn with canvas primitives — no emoji, no images, no
 * assets to ship or cache — so the figures stay crisp at any size and match
 * each other instead of inheriting whatever glyphs the OS happens to have.
 *
 * Every draw function takes (ctx, x, groundOrCenterY, h, dir, t, seed):
 *  - `dir`  +1 faces right, -1 faces left
 *  - `t`    seconds elapsed, for animation
 *  - `seed` per-figure random offset so a crowd doesn't move in lockstep
 *
 * Ground-walkers are anchored at the FEET (y = ground line). Flyers are
 * anchored at their center.
 */

export const INK = "#120d06";

/** Fill the current path, then stroke it with the cartoon outline. */
function inked(
  ctx: CanvasRenderingContext2D,
  fill: string,
  lw: number,
  outline: string = INK,
) {
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = lw;
  ctx.strokeStyle = outline;
  ctx.stroke();
}

/** Rounded-rect PATH only — callers decide how to paint it. */
function rrPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const rad = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}

/** Two glowing eyes — the signature of the whole reference set. */
function glowEyes(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  spread: number,
  r: number,
  color: string,
  squash = 1,
) {
  ctx.fillStyle = color;
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(cx + s * spread, cy, r, r * squash, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** Rare, slow blink. Returns a vertical squash factor for the eyes. */
function blink(t: number, seed: number): number {
  return Math.sin(t * 0.8 + seed * 2) > 0.985 ? 0.2 : 1;
}

/**
 * Mummy — cream wraps, dark eye-band with two glowing eyes, arms out front,
 * loose bandage ends trailing. Lurches as it walks.
 */
export function drawMummy(
  ctx: CanvasRenderingContext2D,
  x: number,
  ground: number,
  h: number,
  dir: number,
  t: number,
  seed: number,
) {
  const w = h * 0.44;
  const gait = Math.sin(t * 2.1 + seed);
  const lw = Math.max(1.1, h * 0.032);
  const WRAP = "#f0e6cd";
  const WRAP_DK = "#d8c8a4";
  const STRIPE = "rgba(120, 104, 74, 0.45)";

  ctx.save();
  ctx.translate(x, ground - Math.abs(gait) * 2.2);
  ctx.rotate(gait * 0.045);
  ctx.scale(dir, 1);
  ctx.lineJoin = "round";

  /** Diagonal wrap lines, clipped to the part just drawn. */
  const stripes = (sx: number, sy: number, sw: number, sh: number) => {
    ctx.save();
    ctx.beginPath();
    ctx.rect(sx, sy, sw, sh);
    ctx.clip();
    ctx.strokeStyle = STRIPE;
    ctx.lineWidth = Math.max(0.9, h * 0.017);
    for (let yy = sy - sw; yy < sy + sh + sw; yy += h * 0.072) {
      ctx.beginPath();
      ctx.moveTo(sx, yy);
      ctx.lineTo(sx + sw, yy + sw * 0.5);
      ctx.stroke();
    }
    ctx.restore();
  };

  // Trailing bandage off the shoulder.
  const flut = Math.sin(t * 3.4 + seed) * h * 0.09;
  ctx.strokeStyle = WRAP_DK;
  ctx.lineWidth = Math.max(1.6, h * 0.05);
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-w * 0.38, -h * 0.6);
  ctx.quadraticCurveTo(-w * 1.4, -h * 0.5 + flut, -w * 2.2, -h * 0.26 - flut);
  ctx.stroke();
  ctx.lineCap = "butt";

  // Legs.
  const legH = h * 0.34;
  rrPath(ctx, -w * 0.38, -legH, w * 0.32, legH + gait * h * 0.05, w * 0.14);
  inked(ctx, WRAP_DK, lw);
  stripes(-w * 0.38, -legH, w * 0.32, legH);
  rrPath(ctx, w * 0.06, -legH, w * 0.32, legH - gait * h * 0.05, w * 0.14);
  inked(ctx, WRAP_DK, lw);
  stripes(w * 0.06, -legH, w * 0.32, legH);

  // Torso.
  rrPath(ctx, -w / 2, -h * 0.82, w, h * 0.54, w * 0.24);
  inked(ctx, WRAP, lw);
  stripes(-w / 2, -h * 0.82, w, h * 0.54);

  // Arms out front.
  rrPath(ctx, w * 0.2, -h * 0.74, w * 0.85, h * 0.16, h * 0.06);
  inked(ctx, WRAP, lw);
  stripes(w * 0.2, -h * 0.74, w * 0.85, h * 0.16);

  // Loose end off the wrist.
  ctx.strokeStyle = WRAP_DK;
  ctx.lineWidth = Math.max(1.3, h * 0.035);
  ctx.beginPath();
  ctx.moveTo(w * 0.95, -h * 0.6);
  ctx.quadraticCurveTo(w * 1.02, -h * 0.45 + flut * 0.4, w * 0.88, -h * 0.32);
  ctx.stroke();

  // Head.
  ctx.beginPath();
  ctx.ellipse(0, -h * 0.94, h * 0.17, h * 0.16, 0, 0, Math.PI * 2);
  inked(ctx, WRAP, lw);
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(0, -h * 0.94, h * 0.17, h * 0.16, 0, 0, Math.PI * 2);
  ctx.clip();
  ctx.strokeStyle = STRIPE;
  ctx.lineWidth = Math.max(0.9, h * 0.017);
  for (let yy = -h * 1.12; yy < -h * 0.76; yy += h * 0.052) {
    ctx.beginPath();
    ctx.moveTo(-h * 0.2, yy);
    ctx.lineTo(h * 0.2, yy + h * 0.05);
    ctx.stroke();
  }
  ctx.restore();

  // The eye band does all the face work — no nose, no mouth.
  rrPath(ctx, -h * 0.15, -h * 0.995, h * 0.3, h * 0.085, h * 0.035);
  ctx.fillStyle = "#100c06";
  ctx.fill();
  glowEyes(ctx, 0, -h * 0.952, h * 0.055, h * 0.023, "#facc15", blink(t, seed));

  ctx.restore();
}

/**
 * Frankenstein's monster — green, flat-topped, bolts in the neck, boxy walk.
 */
export function drawFrankenstein(
  ctx: CanvasRenderingContext2D,
  x: number,
  ground: number,
  h: number,
  dir: number,
  t: number,
  seed: number,
) {
  const w = h * 0.5;
  const gait = Math.sin(t * 1.9 + seed);
  const lw = Math.max(1.1, h * 0.032);
  const SKIN = "#86c34a";
  const SKIN_DK = "#6ba337";

  ctx.save();
  ctx.translate(x, ground - Math.abs(gait) * 1.6);
  ctx.rotate(gait * 0.03);
  ctx.scale(dir, 1);
  ctx.lineJoin = "round";

  // Boots.
  rrPath(ctx, -w * 0.4, -h * 0.1, w * 0.36, h * 0.1, h * 0.02);
  inked(ctx, "#27272a", lw);
  rrPath(ctx, w * 0.04, -h * 0.1, w * 0.36, h * 0.1, h * 0.02);
  inked(ctx, "#27272a", lw);

  // Trousers.
  rrPath(ctx, -w * 0.38, -h * 0.4, w * 0.32, h * 0.32 + gait * h * 0.03, w * 0.08);
  inked(ctx, "#7c4a21", lw);
  rrPath(ctx, w * 0.06, -h * 0.4, w * 0.32, h * 0.32 - gait * h * 0.03, w * 0.08);
  inked(ctx, "#7c4a21", lw);

  // Torso: jacket with a dark shirt panel.
  rrPath(ctx, -w * 0.46, -h * 0.78, w * 0.92, h * 0.4, w * 0.08);
  inked(ctx, "#8b5a2b", lw);
  rrPath(ctx, -w * 0.14, -h * 0.78, w * 0.28, h * 0.4, w * 0.04);
  inked(ctx, "#1f2937", lw * 0.8);

  // Arms out front.
  rrPath(ctx, w * 0.3, -h * 0.72, w * 0.7, h * 0.14, h * 0.05);
  inked(ctx, SKIN, lw);

  // Neck + bolts.
  rrPath(ctx, -w * 0.14, -h * 0.86, w * 0.28, h * 0.1, w * 0.03);
  inked(ctx, SKIN_DK, lw);
  ctx.fillStyle = "#9ca3af";
  ctx.fillRect(-w * 0.24, -h * 0.85, w * 0.1, h * 0.05);
  ctx.fillRect(w * 0.14, -h * 0.85, w * 0.1, h * 0.05);
  ctx.strokeStyle = INK;
  ctx.lineWidth = lw * 0.7;
  ctx.strokeRect(-w * 0.24, -h * 0.85, w * 0.1, h * 0.05);
  ctx.strokeRect(w * 0.14, -h * 0.85, w * 0.1, h * 0.05);

  // Flat-topped head.
  rrPath(ctx, -w * 0.3, -h * 1.16, w * 0.6, h * 0.3, w * 0.06);
  inked(ctx, SKIN, lw);
  // Hair slab across the top.
  rrPath(ctx, -w * 0.32, -h * 1.2, w * 0.64, h * 0.09, w * 0.02);
  inked(ctx, "#14532d", lw * 0.9);
  // Scowling brow + eyes.
  ctx.fillStyle = INK;
  ctx.fillRect(-w * 0.2, -h * 1.06, w * 0.16, h * 0.018);
  ctx.fillRect(w * 0.04, -h * 1.06, w * 0.16, h * 0.018);
  glowEyes(ctx, 0, -h * 1.02, w * 0.12, h * 0.022, "#facc15", blink(t, seed));
  // Stitched mouth.
  ctx.strokeStyle = INK;
  ctx.lineWidth = lw * 0.8;
  ctx.beginPath();
  ctx.moveTo(-w * 0.16, -h * 0.93);
  ctx.lineTo(w * 0.16, -h * 0.93);
  ctx.stroke();

  ctx.restore();
}

/**
 * Dracula — cape flaring on a sine, popped collar, widow's peak, fangs.
 * The breathing cape is what sells him as standing in wind.
 */
export function drawDracula(
  ctx: CanvasRenderingContext2D,
  x: number,
  ground: number,
  h: number,
  dir: number,
  t: number,
  seed: number,
) {
  const w = h * 0.4;
  const gait = Math.sin(t * 1.7 + seed);
  const lw = Math.max(1.1, h * 0.03);
  const flare = 1 + Math.sin(t * 1.3 + seed) * 0.16;

  ctx.save();
  ctx.translate(x, ground - Math.abs(gait) * 1.6);
  ctx.rotate(gait * 0.025);
  ctx.scale(dir, 1);
  ctx.lineJoin = "round";

  // Cape first — body sits in front of it. Scalloped hem, red lining.
  ctx.beginPath();
  ctx.moveTo(-w * 0.5, -h * 0.86);
  ctx.quadraticCurveTo(-w * 2.6 * flare, -h * 0.7, -w * 1.9 * flare, -h * 0.02);
  ctx.quadraticCurveTo(-w * 1.1, -h * 0.22, -w * 0.55, -h * 0.04);
  ctx.quadraticCurveTo(0, -h * 0.24, w * 0.55, -h * 0.04);
  ctx.quadraticCurveTo(w * 1.1, -h * 0.22, w * 1.9 * flare, -h * 0.02);
  ctx.quadraticCurveTo(w * 2.6 * flare, -h * 0.7, w * 0.5, -h * 0.86);
  ctx.closePath();
  inked(ctx, "#c0182f", lw);

  // Shoes + trousers.
  rrPath(ctx, -w * 0.36, -h * 0.36, w * 0.32, h * 0.36, w * 0.1);
  inked(ctx, "#2e1065", lw);
  rrPath(ctx, w * 0.04, -h * 0.36, w * 0.32, h * 0.36, w * 0.1);
  inked(ctx, "#2e1065", lw);

  // Torso + shirt front.
  rrPath(ctx, -w * 0.44, -h * 0.86, w * 0.88, h * 0.52, w * 0.16);
  inked(ctx, "#111014", lw);
  ctx.beginPath();
  ctx.moveTo(0, -h * 0.84);
  ctx.lineTo(w * 0.17, -h * 0.62);
  ctx.lineTo(0, -h * 0.48);
  ctx.lineTo(-w * 0.17, -h * 0.62);
  ctx.closePath();
  inked(ctx, "#f8fafc", lw * 0.8);
  // Bow tie.
  ctx.beginPath();
  ctx.moveTo(-w * 0.13, -h * 0.79);
  ctx.lineTo(0, -h * 0.74);
  ctx.lineTo(-w * 0.13, -h * 0.69);
  ctx.closePath();
  ctx.moveTo(w * 0.13, -h * 0.79);
  ctx.lineTo(0, -h * 0.74);
  ctx.lineTo(w * 0.13, -h * 0.69);
  ctx.closePath();
  inked(ctx, "#c0182f", lw * 0.7);

  // Popped collar behind the head.
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(s * w * 0.42, -h * 0.86);
    ctx.lineTo(s * w * 0.66, -h * 1.18);
    ctx.lineTo(s * w * 0.1, -h * 0.92);
    ctx.closePath();
    inked(ctx, "#c0182f", lw);
  }

  // Head.
  ctx.beginPath();
  ctx.ellipse(0, -h * 1.0, h * 0.15, h * 0.16, 0, 0, Math.PI * 2);
  inked(ctx, "#d8f3f7", lw);
  // Pointed ears.
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(s * h * 0.13, -h * 1.04);
    ctx.lineTo(s * h * 0.2, -h * 1.08);
    ctx.lineTo(s * h * 0.13, -h * 0.97);
    ctx.closePath();
    inked(ctx, "#d8f3f7", lw * 0.8);
  }
  // Hair with a widow's peak.
  ctx.beginPath();
  ctx.moveTo(-h * 0.152, -h * 1.03);
  ctx.quadraticCurveTo(-h * 0.14, -h * 1.21, 0, -h * 1.17);
  ctx.quadraticCurveTo(h * 0.14, -h * 1.21, h * 0.152, -h * 1.03);
  ctx.lineTo(h * 0.09, -h * 1.05);
  ctx.lineTo(0, -h * 0.955);
  ctx.lineTo(-h * 0.09, -h * 1.05);
  ctx.closePath();
  inked(ctx, "#18181b", lw * 0.9);
  // Eyes + fangs.
  glowEyes(ctx, 0, -h * 1.0, h * 0.05, h * 0.02, "#dc2626", blink(t, seed));
  ctx.fillStyle = "#ffffff";
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(s * h * 0.048, -h * 0.945);
    ctx.lineTo(s * h * 0.016, -h * 0.945);
    ctx.lineTo(s * h * 0.032, -h * 0.9);
    ctx.closePath();
    ctx.fill();
  }

  ctx.restore();
}

/**
 * Ghost — flat cream body with a scalloped hem, angry glowing eyes and a
 * lolling tongue, straight off the reference sheet. Anchored at its center;
 * caller controls alpha as it rises and fades.
 */
export function drawGhost(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  h: number,
  t: number,
  seed: number,
) {
  const w = h * 0.86;
  const lw = Math.max(1, h * 0.035);
  const wob = Math.sin(t * 2 + seed) * h * 0.04;

  ctx.save();
  ctx.translate(x, y);
  ctx.lineJoin = "round";

  ctx.beginPath();
  ctx.moveTo(-w / 2, h * 0.18);
  ctx.quadraticCurveTo(-w / 2, -h / 2, 0, -h / 2);
  ctx.quadraticCurveTo(w / 2, -h / 2, w / 2, h * 0.18);
  // Scalloped hem, breathing.
  ctx.quadraticCurveTo(w * 0.36, h * 0.5 + wob, w * 0.22, h * 0.2);
  ctx.quadraticCurveTo(w * 0.08, h * 0.5 - wob, 0, h * 0.22);
  ctx.quadraticCurveTo(-w * 0.08, h * 0.5 + wob, -w * 0.22, h * 0.2);
  ctx.quadraticCurveTo(-w * 0.36, h * 0.5 - wob, -w / 2, h * 0.18);
  ctx.closePath();
  inked(ctx, "#f4f4f5", lw);

  // Angled angry brows made by drawing the eyes as slanted triangles.
  ctx.fillStyle = "#facc15";
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(s * w * 0.08, -h * 0.2);
    ctx.lineTo(s * w * 0.3, -h * 0.12);
    ctx.lineTo(s * w * 0.16, h * 0.02);
    ctx.closePath();
    ctx.fill();
  }
  // Open mouth + tongue.
  ctx.beginPath();
  ctx.ellipse(0, h * 0.11, w * 0.24, h * 0.09, 0, 0, Math.PI * 2);
  inked(ctx, "#b91c1c", lw * 0.7);
  ctx.beginPath();
  ctx.ellipse(0, h * 0.17, w * 0.12, h * 0.08, 0, 0, Math.PI * 2);
  inked(ctx, "#ea7a3c", lw * 0.6);

  ctx.restore();
}

/**
 * Witch on a broom, flying. Anchored at center; `dir` sets travel direction.
 * Hat brim and hair stream backwards, and she tilts slightly as she rides.
 */
export function drawWitch(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  h: number,
  dir: number,
  t: number,
  seed: number,
) {
  const lw = Math.max(1, h * 0.03);
  const bob = Math.sin(t * 2.2 + seed) * h * 0.05;

  ctx.save();
  ctx.translate(x, y + bob);
  ctx.scale(dir, 1);
  ctx.rotate(-0.12);
  ctx.lineJoin = "round";

  // Broom: handle then bristles at the tail.
  ctx.strokeStyle = "#6b4423";
  ctx.lineWidth = Math.max(1.6, h * 0.055);
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-h * 0.75, h * 0.2);
  ctx.lineTo(h * 0.8, -h * 0.05);
  ctx.stroke();
  ctx.lineCap = "butt";
  ctx.beginPath();
  ctx.moveTo(-h * 0.72, h * 0.06);
  ctx.lineTo(-h * 1.12, h * 0.3);
  ctx.lineTo(-h * 1.05, h * 0.5);
  ctx.lineTo(-h * 0.66, h * 0.32);
  ctx.closePath();
  inked(ctx, "#e0a53a", lw);

  // Cloak.
  ctx.beginPath();
  ctx.moveTo(-h * 0.05, -h * 0.1);
  ctx.quadraticCurveTo(-h * 0.55, h * 0.05, -h * 0.62, h * 0.36);
  ctx.quadraticCurveTo(-h * 0.2, h * 0.28, h * 0.16, h * 0.16);
  ctx.closePath();
  inked(ctx, "#6b21a8", lw);

  // Body.
  rrPath(ctx, -h * 0.16, -h * 0.34, h * 0.34, h * 0.44, h * 0.1);
  inked(ctx, "#7e22ce", lw);

  // Arm forward to the handle.
  rrPath(ctx, h * 0.1, -h * 0.24, h * 0.42, h * 0.11, h * 0.05);
  inked(ctx, "#7e22ce", lw);

  // Streaming hair.
  ctx.beginPath();
  ctx.moveTo(-h * 0.02, -h * 0.42);
  ctx.quadraticCurveTo(-h * 0.4, -h * 0.4, -h * 0.5, -h * 0.12);
  ctx.quadraticCurveTo(-h * 0.24, -h * 0.24, -h * 0.02, -h * 0.26);
  ctx.closePath();
  inked(ctx, "#f5c542", lw * 0.9);

  // Green face.
  ctx.beginPath();
  ctx.ellipse(h * 0.04, -h * 0.44, h * 0.14, h * 0.13, 0, 0, Math.PI * 2);
  inked(ctx, "#86c34a", lw);
  // Hooked nose.
  ctx.beginPath();
  ctx.moveTo(h * 0.14, -h * 0.45);
  ctx.lineTo(h * 0.26, -h * 0.4);
  ctx.lineTo(h * 0.14, -h * 0.36);
  ctx.closePath();
  inked(ctx, "#6ba337", lw * 0.7);
  glowEyes(ctx, h * 0.04, -h * 0.47, h * 0.05, h * 0.019, "#facc15", blink(t, seed));

  // Pointed hat, brim then cone.
  ctx.beginPath();
  ctx.ellipse(h * 0.03, -h * 0.57, h * 0.26, h * 0.06, 0, 0, Math.PI * 2);
  inked(ctx, "#4c1d95", lw);
  ctx.beginPath();
  ctx.moveTo(-h * 0.14, -h * 0.58);
  ctx.quadraticCurveTo(-h * 0.02, -h * 0.95, -h * 0.3, -h * 1.02);
  ctx.quadraticCurveTo(h * 0.06, -h * 0.86, h * 0.2, -h * 0.58);
  ctx.closePath();
  inked(ctx, "#6b21a8", lw);

  ctx.restore();
}

/**
 * Bat — inked silhouette with scalloped wings that flap. Anchored at center.
 * `flap` is 0..1; the wings rotate up and down around the body.
 */
export function drawBat(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  h: number,
  dir: number,
  flap: number,
) {
  const lw = Math.max(0.8, h * 0.05);
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(dir, 1);
  ctx.lineJoin = "round";

  const lift = (flap - 0.5) * h * 0.55;
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(s * h * 0.12, 0);
    ctx.quadraticCurveTo(s * h * 0.5, -h * 0.28 + lift, s * h * 0.95, -h * 0.1 + lift);
    ctx.quadraticCurveTo(s * h * 0.72, h * 0.06 + lift, s * h * 0.66, h * 0.24 + lift);
    ctx.quadraticCurveTo(s * h * 0.5, h * 0.04 + lift, s * h * 0.34, h * 0.22 + lift);
    ctx.quadraticCurveTo(s * h * 0.26, h * 0.06, s * h * 0.12, h * 0.14);
    ctx.closePath();
    inked(ctx, "#1b1220", lw);
  }
  // Body + ears.
  ctx.beginPath();
  ctx.ellipse(0, 0, h * 0.15, h * 0.22, 0, 0, Math.PI * 2);
  inked(ctx, "#1b1220", lw);
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(s * h * 0.04, -h * 0.18);
    ctx.lineTo(s * h * 0.14, -h * 0.36);
    ctx.lineTo(s * h * 0.15, -h * 0.14);
    ctx.closePath();
    inked(ctx, "#1b1220", lw * 0.8);
  }
  glowEyes(ctx, 0, -h * 0.04, h * 0.06, h * 0.03, "#facc15");

  ctx.restore();
}
