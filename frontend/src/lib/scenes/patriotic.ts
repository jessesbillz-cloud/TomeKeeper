/**
 * Hand-drawn cast for Veterans week and the Marine Corps birthday (and the
 * 4th of July, later): a Marine in dress blues, the birthday cake with the
 * sword, fly-over jets, a bald eagle, flagpole and bunting.
 *
 * Same conventions as ../spooky.ts — heavy ink outlines, flat fills,
 * (ctx, x, y, size, …) signatures, ground figures anchored at the feet.
 *
 * Deliberately NOT drawn: the Marine Corps emblem (eagle, globe and anchor).
 * It's a protected mark, so the Marine day leans on scarlet and gold, the
 * dress blues, the cake and the sword instead — which is what the day looks
 * like anyway.
 */

import { INK, inked, limb, rrPath, starPath } from "./kit";

export const SCARLET = "#c8102e";
export const GOLD = "#ffc72c";
const GOLD_DEEP = "#d4a017";
const NAVY = "#14203f";
const SKY_BLUE = "#5b8fd0";
const SKIN = "#e8b98a";
const GLOVE = "#f8fafc";

/**
 * A Marine in dress blues, front view, standing at attention and saluting.
 * Anchored at the feet. `salute` 0 = hands at sides, 1 = full salute.
 */
export function drawMarine(
  ctx: CanvasRenderingContext2D,
  x: number,
  ground: number,
  h: number,
  t: number,
  salute: number,
) {
  const u = h / 100;
  const lw = Math.max(1.2, u * 1.6);
  const breathe = Math.sin(t * 1.4) * u * 0.4;
  const Y = (v: number) => ground - v * u; // v = height above ground, in u

  ctx.save();

  // Shoes.
  ctx.fillStyle = "#0b0b0b";
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(x + s * 6.5 * u, Y(2), 6 * u, 2.6 * u, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Trousers — sky blue, scarlet "blood stripe" down each outer seam.
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.rect(x + (s < 0 ? -11 : 1) * u, Y(46), 10 * u, 43 * u);
    inked(ctx, SKY_BLUE, lw);
    ctx.fillStyle = SCARLET;
    ctx.fillRect(x + (s < 0 ? -11 : 8.6) * u, Y(46), 2.4 * u, 43 * u);
  }

  // Coat: square shoulders, nipped at the belt, slight flare to the hem.
  const top = Y(81) + breathe;
  ctx.beginPath();
  ctx.moveTo(x - 15 * u, top + 2 * u);
  ctx.quadraticCurveTo(x - 15 * u, top, x - 12 * u, top);
  ctx.lineTo(x + 12 * u, top);
  ctx.quadraticCurveTo(x + 15 * u, top, x + 15 * u, top + 2 * u);
  ctx.lineTo(x + 12 * u, Y(53));
  ctx.lineTo(x + 13.5 * u, Y(42));
  ctx.lineTo(x - 13.5 * u, Y(42));
  ctx.lineTo(x - 12 * u, Y(53));
  ctx.closePath();
  inked(ctx, NAVY, lw);

  // Gold buttons down the front.
  ctx.fillStyle = GOLD;
  for (let i = 0; i < 6; i++) {
    ctx.beginPath();
    ctx.arc(x, top + (4 + i * 4.4) * u, 1.15 * u, 0, Math.PI * 2);
    ctx.fill();
  }

  // White belt and gold buckle.
  ctx.beginPath();
  ctx.rect(x - 12.4 * u, Y(56), 24.8 * u, 4 * u);
  inked(ctx, "#fafafa", lw * 0.8);
  ctx.beginPath();
  ctx.rect(x - 3 * u, Y(56.6), 6 * u, 5.2 * u);
  inked(ctx, GOLD, lw * 0.7);

  // Standing collar.
  ctx.beginPath();
  ctx.rect(x - 5 * u, top - 3.5 * u, 10 * u, 4 * u);
  inked(ctx, NAVY, lw * 0.8);
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = Math.max(0.6, u * 0.6);
  ctx.beginPath();
  ctx.moveTo(x - 5 * u, top - 3.3 * u);
  ctx.lineTo(x + 5 * u, top - 3.3 * u);
  ctx.stroke();

  // Head.
  const hy = Y(90) + breathe;
  ctx.beginPath();
  ctx.arc(x, hy, 7.6 * u, 0, Math.PI * 2);
  inked(ctx, SKIN, lw);
  ctx.fillStyle = INK;
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(x + s * 2.8 * u, hy + 0.6 * u, 0.95 * u, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = INK;
  ctx.lineWidth = Math.max(0.8, u * 0.7);
  ctx.beginPath();
  ctx.moveTo(x - 2 * u, hy + 4 * u);
  ctx.lineTo(x + 2 * u, hy + 4 * u);
  ctx.stroke();

  // Frame cap: white crown, black band, black visor.
  ctx.beginPath();
  ctx.ellipse(x, hy - 8.4 * u, 11.5 * u, 3.6 * u, 0, 0, Math.PI * 2);
  inked(ctx, "#fbfbfb", lw);
  ctx.beginPath();
  ctx.rect(x - 8.2 * u, hy - 7.6 * u, 16.4 * u, 2.8 * u);
  inked(ctx, "#111", lw * 0.6);
  ctx.beginPath();
  ctx.ellipse(x, hy - 4.6 * u, 8.6 * u, 2.2 * u, 0, 0, Math.PI);
  inked(ctx, "#111", lw * 0.6);
  ctx.fillStyle = GOLD;
  ctx.beginPath();
  ctx.arc(x, hy - 6.2 * u, 0.9 * u, 0, Math.PI * 2);
  ctx.fill();

  // Left arm (viewer's right) at the side.
  const armW = 5.4 * u;
  limb(
    ctx,
    [
      [x + 14 * u, top + 3 * u],
      [x + 15.5 * u, Y(56)],
    ],
    armW,
    NAVY,
    lw * 0.6,
  );
  ctx.beginPath();
  ctx.arc(x + 15.6 * u, Y(54), 2.9 * u, 0, Math.PI * 2);
  inked(ctx, GLOVE, lw * 0.7);

  // Right arm (viewer's left): blends from "at the side" to the salute —
  // upper arm out level with the shoulder, forearm up to the brim.
  const s = Math.min(1, Math.max(0, salute));
  const sh: [number, number] = [x - 14 * u, top + 3 * u];
  const elbow: [number, number] = [
    x - (15.5 + 11 * s) * u,
    Y(68) + (top + 3 * u - Y(68)) * s * 0.9,
  ];
  const wrist: [number, number] = [
    x - (15.5 - 6 * s) * u,
    Y(56) + (hy - 4 * u - Y(56)) * s,
  ];
  limb(ctx, [sh, elbow, wrist], armW, NAVY, lw * 0.6);
  // Flat hand, fingers to the brim.
  ctx.save();
  ctx.translate(wrist[0], wrist[1]);
  ctx.rotate(-0.55 * s);
  rrPath(ctx, -1 * u, -2 * u, (6 + 2 * s) * u, 4 * u, 1.6 * u);
  inked(ctx, GLOVE, lw * 0.7);
  ctx.restore();

  ctx.restore();
}

/**
 * The Marine Corps birthday cake: two tiers in scarlet and gold, the age on
 * the front, and the sword standing in the top tier — the cake is cut with a
 * sword at every birthday ball. Anchored at the bottom centre of the stand.
 */
export function drawBirthdayCake(
  ctx: CanvasRenderingContext2D,
  x: number,
  ground: number,
  w: number,
  t: number,
  label: string,
) {
  const u = w / 100;
  const lw = Math.max(1.2, u * 1.8);
  ctx.save();

  // Stand.
  ctx.beginPath();
  ctx.ellipse(x, ground - 3 * u, 56 * u, 6 * u, 0, 0, Math.PI * 2);
  inked(ctx, GOLD_DEEP, lw);

  // Bottom tier.
  const b0 = ground - 6 * u;
  const bh = 34 * u;
  ctx.beginPath();
  ctx.rect(x - 48 * u, b0 - bh, 96 * u, bh);
  inked(ctx, SCARLET, lw);
  // Gold piping along the top and bottom edges.
  ctx.fillStyle = GOLD;
  for (let i = 0; i <= 12; i++) {
    const px = x - 48 * u + (i * 96 * u) / 12;
    ctx.beginPath();
    ctx.arc(px, b0 - bh, 2.6 * u, 0, Math.PI * 2);
    ctx.arc(px, b0, 2.2 * u, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.font = `800 ${Math.round(18 * u)}px Georgia, "Times New Roman", serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineWidth = lw * 0.9;
  ctx.strokeStyle = INK;
  ctx.strokeText(label, x, b0 - bh / 2 + u);
  ctx.fillStyle = GOLD;
  ctx.fillText(label, x, b0 - bh / 2 + u);

  // Top tier — white with a scarlet ribbon.
  const t0 = b0 - bh;
  const th = 24 * u;
  ctx.beginPath();
  ctx.rect(x - 32 * u, t0 - th, 64 * u, th);
  inked(ctx, "#fbf7ef", lw);
  ctx.fillStyle = SCARLET;
  ctx.fillRect(x - 32 * u + lw / 2, t0 - th * 0.55, 64 * u - lw, 6 * u);
  ctx.fillStyle = GOLD;
  for (let i = 0; i <= 8; i++) {
    ctx.beginPath();
    ctx.arc(x - 32 * u + (i * 64 * u) / 8, t0 - th, 2.2 * u, 0, Math.PI * 2);
    ctx.fill();
  }

  // The sword, point down in the top tier, slight lean.
  ctx.save();
  ctx.translate(x + 14 * u, t0 - th + 6 * u);
  ctx.rotate(0.32);
  // Blade (mostly hidden in the cake — we see the upper part).
  ctx.beginPath();
  ctx.moveTo(-2 * u, 0);
  ctx.lineTo(2 * u, 0);
  ctx.lineTo(2 * u, -40 * u);
  ctx.lineTo(-2 * u, -42 * u);
  ctx.closePath();
  inked(ctx, "#e5e7eb", lw * 0.8);
  ctx.strokeStyle = "rgba(255,255,255,0.8)";
  ctx.lineWidth = Math.max(0.6, u * 0.8);
  ctx.beginPath();
  ctx.moveTo(0, -2 * u);
  ctx.lineTo(0, -38 * u);
  ctx.stroke();
  // Cross guard.
  rrPath(ctx, -9 * u, -46 * u, 18 * u, 4 * u, 1.5 * u);
  inked(ctx, GOLD, lw * 0.8);
  // Ivory grip, curved like a mameluke hilt.
  ctx.beginPath();
  ctx.moveTo(-2.6 * u, -46 * u);
  ctx.quadraticCurveTo(-3 * u, -56 * u, -6 * u, -62 * u);
  ctx.lineTo(-1 * u, -63 * u);
  ctx.quadraticCurveTo(2.4 * u, -56 * u, 2.6 * u, -46 * u);
  ctx.closePath();
  inked(ctx, "#f5efdc", lw * 0.8);
  ctx.beginPath();
  ctx.arc(-3.6 * u, -63 * u, 3 * u, 0, Math.PI * 2);
  inked(ctx, GOLD, lw * 0.7);
  ctx.restore();

  // Twinkles around the cake.
  for (let i = 0; i < 5; i++) {
    const a = t * 0.9 + i * 1.7;
    const tw = Math.max(0, Math.sin(t * 2.6 + i * 2.1));
    if (tw < 0.05) continue;
    const px = x + Math.cos(a * 0.7 + i) * 60 * u;
    const py = t0 - th * 0.4 + Math.sin(a * 0.5 + i * 3) * 30 * u;
    sparkle(ctx, px, py, (3 + 3 * tw) * u, tw);
  }

  ctx.restore();
}

/** Four-point twinkle. */
export function sparkle(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  alpha: number,
  color = "255, 230, 140",
) {
  ctx.save();
  ctx.fillStyle = `rgba(${color}, ${alpha})`;
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.quadraticCurveTo(x, y, x, y + r);
  ctx.quadraticCurveTo(x, y, x - r, y);
  ctx.quadraticCurveTo(x, y, x, y - r);
  ctx.fill();
  ctx.restore();
}

/**
 * Fighter jet, side view, nose pointing `dir`. Centred on (x, y), `len` long.
 * Generic swept-wing shape — not any particular aircraft.
 */
export function drawJet(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  len: number,
  dir: 1 | -1,
  t: number,
) {
  const L = len;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(dir, 1);
  const lw = Math.max(1, L * 0.035);

  // Afterburner flicker.
  const fl = 0.6 + 0.4 * Math.sin(t * 40);
  ctx.fillStyle = `rgba(251, 146, 60, ${0.75 * fl})`;
  ctx.beginPath();
  ctx.ellipse(-0.53 * L, 0.01 * L, 0.07 * L * fl, 0.03 * L, 0, 0, Math.PI * 2);
  ctx.fill();

  // Far wing (darker, peeking above the fuselage).
  ctx.beginPath();
  ctx.moveTo(0.05 * L, -0.03 * L);
  ctx.lineTo(-0.24 * L, -0.15 * L);
  ctx.lineTo(-0.32 * L, -0.15 * L);
  ctx.lineTo(-0.2 * L, -0.03 * L);
  ctx.closePath();
  inked(ctx, "#64748b", lw);

  // Tail fin.
  ctx.beginPath();
  ctx.moveTo(-0.28 * L, -0.06 * L);
  ctx.lineTo(-0.42 * L, -0.3 * L);
  ctx.lineTo(-0.5 * L, -0.3 * L);
  ctx.lineTo(-0.48 * L, -0.05 * L);
  ctx.closePath();
  inked(ctx, "#94a3b8", lw);

  // Fuselage.
  ctx.beginPath();
  ctx.moveTo(0.52 * L, 0.01 * L);
  ctx.quadraticCurveTo(0.34 * L, -0.08 * L, 0.18 * L, -0.08 * L);
  ctx.lineTo(-0.36 * L, -0.07 * L);
  ctx.lineTo(-0.52 * L, -0.045 * L);
  ctx.lineTo(-0.52 * L, 0.055 * L);
  ctx.lineTo(0.2 * L, 0.065 * L);
  ctx.quadraticCurveTo(0.4 * L, 0.06 * L, 0.52 * L, 0.01 * L);
  ctx.closePath();
  inked(ctx, "#a3b1c2", lw);

  // Canopy.
  ctx.beginPath();
  ctx.ellipse(0.2 * L, -0.08 * L, 0.11 * L, 0.055 * L, 0, Math.PI, 0);
  inked(ctx, "#93c5fd", lw * 0.8);

  // Near wing.
  ctx.beginPath();
  ctx.moveTo(0.08 * L, 0.03 * L);
  ctx.lineTo(-0.22 * L, 0.2 * L);
  ctx.lineTo(-0.32 * L, 0.2 * L);
  ctx.lineTo(-0.18 * L, 0.03 * L);
  ctx.closePath();
  inked(ctx, "#8a9bb0", lw);

  ctx.restore();
}

/**
 * Bald eagle, side view, gliding with an occasional slow beat. Centred on
 * (x, y); `size` is roughly the wingspan as drawn.
 */
export function drawEagle(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  dir: 1 | -1,
  t: number,
  seed: number,
) {
  const S = size;
  const lw = Math.max(1, S * 0.022);
  // Mostly gliding; every few seconds a couple of slow, deep beats.
  const cycle = (t * 0.35 + seed) % 1;
  const beat = cycle > 0.75 ? Math.sin((cycle - 0.75) * 4 * Math.PI * 2) : 0;
  const lift = 0.08 * Math.sin(t * 0.9 + seed) + 0.45 * beat;

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(dir, 1);

  // One broad wing, drawn pointing "up" and then swept back by `angle`.
  // Five slotted primaries at the tip — the eagle's signature in flight.
  const WING: Array<[number, number]> = [
    [0.04, -0.46],
    [0.01, -0.6], [-0.03, -0.47],
    [-0.07, -0.59], [-0.09, -0.46],
    [-0.13, -0.56], [-0.14, -0.43],
    [-0.19, -0.5], [-0.19, -0.38],
    [-0.24, -0.43],
  ];
  const wing = (shade: string, back: number, angle: number, scale: number) => {
    ctx.save();
    ctx.translate(back * S, -0.03 * S);
    ctx.rotate(-angle);
    ctx.scale(scale, scale);
    ctx.beginPath();
    ctx.moveTo(0.1 * S, 0.02 * S);
    ctx.quadraticCurveTo(0.13 * S, -0.3 * S, WING[0][0] * S, WING[0][1] * S);
    for (const [px, py] of WING.slice(1)) ctx.lineTo(px * S, py * S);
    // Trailing edge, scalloped secondaries back to the body.
    ctx.quadraticCurveTo(-0.22 * S, -0.3 * S, -0.2 * S, -0.22 * S);
    ctx.quadraticCurveTo(-0.22 * S, -0.12 * S, -0.17 * S, -0.1 * S);
    ctx.quadraticCurveTo(-0.19 * S, -0.02 * S, -0.14 * S, 0.02 * S);
    ctx.closePath();
    inked(ctx, shade, lw / scale);
    ctx.restore();
  };

  // Far wing first, then body, then near wing.
  wing("#3b2412", 0.04, 0.75 + lift * 0.8, 0.85);

  // Tail fan — white.
  ctx.beginPath();
  ctx.moveTo(-0.16 * S, -0.02 * S);
  ctx.lineTo(-0.36 * S, -0.07 * S);
  ctx.quadraticCurveTo(-0.4 * S, 0.0, -0.36 * S, 0.06 * S);
  ctx.lineTo(-0.16 * S, 0.04 * S);
  ctx.closePath();
  inked(ctx, "#f8fafc", lw);

  // Body.
  ctx.beginPath();
  ctx.ellipse(0, 0, 0.22 * S, 0.075 * S, -0.05, 0, Math.PI * 2);
  inked(ctx, "#4a2e16", lw);

  // Yellow feet tucked under.
  ctx.beginPath();
  ctx.ellipse(-0.06 * S, 0.07 * S, 0.04 * S, 0.018 * S, 0.2, 0, Math.PI * 2);
  inked(ctx, "#facc15", lw * 0.7);

  // White head and hooked yellow beak.
  ctx.beginPath();
  ctx.ellipse(0.22 * S, -0.04 * S, 0.075 * S, 0.06 * S, 0, 0, Math.PI * 2);
  inked(ctx, "#f8fafc", lw);
  ctx.beginPath();
  ctx.moveTo(0.28 * S, -0.06 * S);
  ctx.quadraticCurveTo(0.36 * S, -0.06 * S, 0.35 * S, -0.01 * S);
  ctx.lineTo(0.32 * S, -0.02 * S);
  ctx.lineTo(0.28 * S, -0.02 * S);
  ctx.closePath();
  inked(ctx, "#facc15", lw * 0.8);
  // Eye with a stern brow.
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.arc(0.245 * S, -0.055 * S, 0.012 * S, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = lw;
  ctx.beginPath();
  ctx.moveTo(0.215 * S, -0.08 * S);
  ctx.lineTo(0.27 * S, -0.07 * S);
  ctx.stroke();

  wing("#5a3a1c", -0.01, 0.5 + lift, 1);

  ctx.restore();
}

/**
 * Flagpole from (x, top) down `len`, with a gold ball finial. The lower end
 * fades out, so the pole reads as continuing off-screen rather than ending
 * in mid-air.
 */
export function drawPole(
  ctx: CanvasRenderingContext2D,
  x: number,
  top: number,
  len: number,
) {
  const w = 3.2;
  const g = ctx.createLinearGradient(0, top, 0, top + len);
  g.addColorStop(0, "rgba(209, 213, 219, 1)");
  g.addColorStop(0.7, "rgba(156, 163, 175, 0.9)");
  g.addColorStop(1, "rgba(156, 163, 175, 0)");
  ctx.fillStyle = g;
  ctx.fillRect(x - w / 2, top, w, len);
  ctx.beginPath();
  ctx.arc(x, top - 3, 4.5, 0, Math.PI * 2);
  inked(ctx, GOLD, 1.2);
}

/**
 * Scarlet-and-gold bunting swagged from the two top corners, with gold
 * rosettes where the swags meet. The middle third is left open so the app
 * title stays readable. Sways gently.
 */
export function drawBunting(
  ctx: CanvasRenderingContext2D,
  w: number,
  t: number,
  colors: { body: string; edge: string; rosette: string; center: string },
  /** Scales how far the swags hang and the rosette size. */
  size = 1,
) {
  const runs: Array<[number, number]> = [
    [0, w * 0.33],
    [w * 0.67, w],
  ];
  let k = 0;
  for (const [r0, r1] of runs) {
    const runW = r1 - r0;
    const n = Math.max(1, Math.round(runW / 75));
    const span = runW / n;
    const depth = Math.min(22, span * 0.3) * size;
    for (let i = 0; i < n; i++, k++) {
      const x0 = r0 + i * span;
      const x1 = x0 + span;
      const mid = (x0 + x1) / 2;
      const sway = Math.sin(t * 1.1 + k * 0.9) * 2.5;
      // Outer swag = the gold edge…
      ctx.beginPath();
      ctx.moveTo(x0, 0);
      ctx.lineTo(x1, 0);
      ctx.quadraticCurveTo(mid + sway, depth * 2.05, x0, 0);
      ctx.closePath();
      inked(ctx, colors.edge, 1.4);
      // …and the scarlet body inside it.
      ctx.beginPath();
      ctx.moveTo(x0 + 2, 0);
      ctx.lineTo(x1 - 2, 0);
      ctx.quadraticCurveTo(mid + sway, depth * 1.55, x0 + 2, 0);
      ctx.closePath();
      ctx.fillStyle = colors.body;
      ctx.fill();
      // Pleat lines.
      ctx.strokeStyle = "rgba(0,0,0,0.25)";
      ctx.lineWidth = 1;
      for (const f of [0.45, 0.8]) {
        ctx.beginPath();
        ctx.moveTo(x0 + span * 0.12, 0);
        ctx.quadraticCurveTo(mid + sway, depth * 1.55 * f, x1 - span * 0.12, 0);
        ctx.stroke();
      }
    }
    // Rosettes at the joins (and both ends of the run).
    for (let i = 0; i <= n; i++) {
      const rx = r0 + i * span;
      const r = Math.min(8, span * 0.1) * Math.max(0.6, size);
      ctx.beginPath();
      ctx.arc(rx, 3, r, 0, Math.PI * 2);
      inked(ctx, colors.rosette, 1.3);
      ctx.beginPath();
      ctx.arc(rx, 3, r * 0.45, 0, Math.PI * 2);
      inked(ctx, colors.center, 1);
    }
  }
}

/** A drifting five-point star (Veterans week sky). */
export function drawDriftStar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  rot: number,
  color: string,
  alpha: number,
) {
  ctx.save();
  ctx.globalAlpha = alpha;
  starPath(ctx, x, y, r, rot);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();
}
