/**
 * Hand-drawn cast for Janelle's birthday and Valentine's Day: balloons,
 * pennant bunting, wrapped presents, the book-stack birthday cake, hearts,
 * love letters, a cupid and roses.
 *
 * Same conventions as ../spooky.ts and ./patriotic.ts — heavy ink outlines,
 * flat fills, ground figures anchored at the feet, flyers at their centre.
 */

import { INK, inked, rrPath } from "./kit";

// --- balloons --------------------------------------------------------------

/**
 * A party balloon centred on (x, y), radius `r` (it's a little taller than
 * wide). The string hangs down and wavers; `t`/`seed` drive the wave.
 */
export function drawBalloon(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  color: string,
  t: number,
  seed: number,
) {
  const lw = Math.max(1, r * 0.09);
  const tilt = Math.sin(t * 0.9 + seed) * 0.08;

  // String first, so the knot sits on top of it.
  const knotY = y + r * 1.18;
  ctx.strokeStyle = "rgba(226, 232, 240, 0.7)";
  ctx.lineWidth = Math.max(0.8, r * 0.05);
  ctx.beginPath();
  ctx.moveTo(x, knotY);
  const len = r * 2.8;
  for (let i = 1; i <= 8; i++) {
    const f = i / 8;
    const wob = Math.sin(t * 2.1 + seed + f * 5) * r * 0.22 * f;
    ctx.lineTo(x + wob, knotY + len * f);
  }
  ctx.stroke();

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(tilt);
  // Body: slightly egg-shaped, narrower toward the knot.
  ctx.beginPath();
  ctx.moveTo(0, -r * 1.1);
  ctx.bezierCurveTo(r * 1.15, -r * 1.1, r * 1.05, r * 0.55, 0, r * 1.1);
  ctx.bezierCurveTo(-r * 1.05, r * 0.55, -r * 1.15, -r * 1.1, 0, -r * 1.1);
  ctx.closePath();
  inked(ctx, color, lw);
  // Knot.
  ctx.beginPath();
  ctx.moveTo(-r * 0.14, r * 1.24);
  ctx.lineTo(r * 0.14, r * 1.24);
  ctx.lineTo(0, r * 1.06);
  ctx.closePath();
  inked(ctx, color, lw * 0.8);
  // Shine.
  ctx.fillStyle = "rgba(255, 255, 255, 0.55)";
  ctx.beginPath();
  ctx.ellipse(-r * 0.38, -r * 0.45, r * 0.16, r * 0.32, -0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// --- pennant bunting -------------------------------------------------------

/**
 * A string of triangular pennants from (x0, y0) to (x1, y1), sagging by
 * `sag`. Pennants hang from the string and swing a little.
 */
export function drawPennants(
  ctx: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  sag: number,
  n: number,
  size: number,
  colors: readonly string[],
  t: number,
) {
  const mx = (x0 + x1) / 2;
  const my = (y0 + y1) / 2 + sag * 2; // quadratic control → actual sag ≈ sag
  const at = (f: number): [number, number] => {
    const a = (1 - f) * (1 - f);
    const b = 2 * (1 - f) * f;
    const c = f * f;
    return [a * x0 + b * mx + c * x1, a * y0 + b * my + c * y1];
  };

  ctx.strokeStyle = "rgba(226, 232, 240, 0.8)";
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.quadraticCurveTo(mx, my, x1, y1);
  ctx.stroke();

  const lw = Math.max(1, size * 0.08);
  for (let i = 0; i < n; i++) {
    const f0 = (i + 0.15) / n;
    const f1 = (i + 0.85) / n;
    const [ax, ay] = at(f0);
    const [bx, by] = at(f1);
    const cx = (ax + bx) / 2;
    const swing = Math.sin(t * 1.6 + i * 1.3) * size * 0.12;
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(bx, by);
    ctx.lineTo(cx + swing, (ay + by) / 2 + size);
    ctx.closePath();
    inked(ctx, colors[i % colors.length], lw);
    // A little dot on each pennant.
    ctx.fillStyle = "rgba(255,255,255,0.75)";
    ctx.beginPath();
    ctx.arc(cx + swing * 0.3, (ay + by) / 2 + size * 0.33, size * 0.09, 0, Math.PI * 2);
    ctx.fill();
  }
}

// --- presents --------------------------------------------------------------

/** One wrapped present, anchored at the bottom centre. */
export function drawPresent(
  ctx: CanvasRenderingContext2D,
  x: number,
  ground: number,
  w: number,
  h: number,
  box: string,
  ribbon: string,
  t: number,
  seed: number,
) {
  const lw = Math.max(1, w * 0.045);
  const lid = h * 0.22;
  // Box.
  ctx.beginPath();
  ctx.rect(x - w / 2, ground - h + lid * 0.6, w, h - lid * 0.6);
  inked(ctx, box, lw);
  // Polka dots on the paper.
  ctx.fillStyle = "rgba(255,255,255,0.35)";
  for (let i = 0; i < 4; i++) {
    const px = x - w * 0.32 + ((i * 37 + seed * 13) % 10) / 10 * w * 0.64;
    const py = ground - h * 0.18 - ((i * 23 + seed * 7) % 10) / 10 * h * 0.45;
    ctx.beginPath();
    ctx.arc(px, py, w * 0.035, 0, Math.PI * 2);
    ctx.fill();
  }
  // Vertical ribbon.
  ctx.beginPath();
  ctx.rect(x - w * 0.08, ground - h + lid * 0.6, w * 0.16, h - lid * 0.6);
  inked(ctx, ribbon, lw * 0.7);
  // Lid, a touch wider than the box.
  ctx.beginPath();
  ctx.rect(x - w * 0.56, ground - h, w * 1.12, lid);
  inked(ctx, box, lw);
  ctx.beginPath();
  ctx.rect(x - w * 0.08, ground - h, w * 0.16, lid);
  inked(ctx, ribbon, lw * 0.7);
  // Bow: two loops and two tails, with a slight bounce.
  const bob = Math.sin(t * 1.8 + seed) * h * 0.015;
  const by = ground - h + bob;
  const lr = w * 0.2;
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(x, by);
    ctx.bezierCurveTo(x + s * lr * 1.6, by - lr * 1.3, x + s * lr * 1.8, by + lr * 0.1, x, by);
    inked(ctx, ribbon, lw * 0.7);
  }
  ctx.beginPath();
  ctx.arc(x, by, lr * 0.28, 0, Math.PI * 2);
  inked(ctx, ribbon, lw * 0.6);
}

// --- the book-stack cake ---------------------------------------------------

const BOOKS: ReadonlyArray<{ cover: string; band: string; w: number; h: number; dx: number }> = [
  { cover: "#7c2d5a", band: "#f5c542", w: 1.0, h: 0.2, dx: 0 },
  { cover: "#1f4e5f", band: "#f5c542", w: 0.9, h: 0.17, dx: 0.03 },
  { cover: "#b4475f", band: "#fde68a", w: 0.82, h: 0.18, dx: -0.03 },
];

/**
 * Janelle's birthday "cake": three books stacked, spines out, the top one
 * iced in pink with drips running down its spine, and candles on top.
 * Anchored at the bottom centre; `w` is the width of the bottom book.
 * `lit` turns the candles on (0 = unlit, 1 = fully lit, in between fades).
 */
export function drawBookCake(
  ctx: CanvasRenderingContext2D,
  x: number,
  ground: number,
  w: number,
  t: number,
  lit: number,
) {
  const lw = Math.max(1, w * 0.022);
  let y = ground;
  let topW = w;
  let topX = x;
  for (let i = 0; i < BOOKS.length; i++) {
    const b = BOOKS[i];
    const bw = w * b.w;
    const bh = w * b.h;
    const bx = x + w * b.dx;
    // Page block peeking out on the right (the fore-edge is behind; we see
    // a sliver of cream page edge above each spine).
    rrPath(ctx, bx - bw / 2, y - bh, bw, bh, bh * 0.18);
    inked(ctx, b.cover, lw);
    // Spine bands and a title stripe.
    ctx.fillStyle = b.band;
    ctx.fillRect(bx - bw * 0.42, y - bh * 0.82, bw * 0.05, bh * 0.64);
    ctx.fillRect(bx + bw * 0.37, y - bh * 0.82, bw * 0.05, bh * 0.64);
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.fillRect(bx - bw * 0.22, y - bh * 0.56, bw * 0.44, bh * 0.12);
    y -= bh;
    topW = bw;
    topX = bx;
  }

  // Icing on the top book: a thick pink layer with drips over the spine.
  const iceH = w * 0.07;
  ctx.beginPath();
  ctx.moveTo(topX - topW / 2 - 2, y + iceH * 0.2);
  ctx.quadraticCurveTo(topX - topW / 2 - 2, y - iceH, topX - topW / 2 + iceH, y - iceH);
  ctx.lineTo(topX + topW / 2 - iceH, y - iceH);
  ctx.quadraticCurveTo(topX + topW / 2 + 2, y - iceH, topX + topW / 2 + 2, y + iceH * 0.2);
  // Drips back along the front edge.
  const drips = 6;
  for (let i = drips; i >= 0; i--) {
    const dx = topX - topW / 2 + (topW * i) / drips;
    const len = (i % 2 === 0 ? 0.5 : 1.1) * iceH * (1 + ((i * 7) % 3) * 0.35);
    ctx.quadraticCurveTo(dx + topW / drips / 2, y + len * 1.6, dx, y + iceH * 0.2);
  }
  ctx.closePath();
  inked(ctx, "#f9a8d4", lw);
  // Sprinkles.
  const sprinkle = ["#fde68a", "#a5f3fc", "#ffffff", "#c4b5fd"];
  for (let i = 0; i < 9; i++) {
    ctx.fillStyle = sprinkle[i % sprinkle.length];
    const sx = topX - topW * 0.4 + (topW * 0.8 * i) / 8;
    const sy = y - iceH * 0.55 + ((i * 5) % 3) * iceH * 0.15;
    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(i * 1.1);
    ctx.fillRect(-w * 0.012, -w * 0.004, w * 0.024, w * 0.008);
    ctx.restore();
  }

  // Candles.
  const candles = 3;
  const ch = w * 0.2;
  const cw = w * 0.045;
  const base = y - iceH * 0.7;
  for (let i = 0; i < candles; i++) {
    const cx = topX + (i - (candles - 1) / 2) * topW * 0.26;
    ctx.beginPath();
    ctx.rect(cx - cw / 2, base - ch, cw, ch);
    inked(ctx, "#fdf2f8", lw * 0.8);
    // Candy stripes.
    ctx.save();
    ctx.beginPath();
    ctx.rect(cx - cw / 2, base - ch, cw, ch);
    ctx.clip();
    ctx.strokeStyle = i === 1 ? "#ec4899" : "#a855f7";
    ctx.lineWidth = cw * 0.35;
    for (let k = -1; k < 6; k++) {
      ctx.beginPath();
      ctx.moveTo(cx - cw, base - ch + k * cw * 1.6);
      ctx.lineTo(cx + cw, base - ch + k * cw * 1.6 - cw * 1.2);
      ctx.stroke();
    }
    ctx.restore();
    // Wick.
    ctx.strokeStyle = INK;
    ctx.lineWidth = Math.max(1, cw * 0.18);
    ctx.beginPath();
    ctx.moveTo(cx, base - ch);
    ctx.lineTo(cx, base - ch - cw * 0.6);
    ctx.stroke();

    if (lit > 0) {
      const fy = base - ch - cw * 0.6;
      const fl = 1 + 0.12 * Math.sin(t * 13 + i * 2) + 0.08 * Math.sin(t * 29 + i);
      const sway = Math.sin(t * 5 + i) * cw * 0.25;
      ctx.save();
      ctx.globalAlpha *= lit;
      const glow = ctx.createRadialGradient(cx, fy - cw, 1, cx, fy - cw, cw * 4.5);
      glow.addColorStop(0, "rgba(253, 224, 71, 0.45)");
      glow.addColorStop(1, "rgba(253, 224, 71, 0)");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(cx, fy - cw, cw * 4.5, 0, Math.PI * 2);
      ctx.fill();
      // Teardrop flame: orange outer, yellow core.
      const fh = cw * 2.2 * fl;
      ctx.beginPath();
      ctx.moveTo(cx, fy + cw * 0.15);
      ctx.bezierCurveTo(cx - cw * 0.8, fy - fh * 0.3, cx + sway, fy - fh * 0.8, cx + sway, fy - fh);
      ctx.bezierCurveTo(cx + sway, fy - fh * 0.8, cx + cw * 0.8, fy - fh * 0.3, cx, fy + cw * 0.15);
      ctx.fillStyle = "#fb923c";
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(cx + sway * 0.4, fy - fh * 0.32, cw * 0.28, fh * 0.28, 0, 0, Math.PI * 2);
      ctx.fillStyle = "#fef08a";
      ctx.fill();
      ctx.restore();
    }
  }
}

// --- hearts, letters, cupid, roses ----------------------------------------

/** Heart PATH centred on (x, y), `s` ≈ width. */
export function heartPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  s: number,
) {
  const h = s * 0.5;
  ctx.beginPath();
  ctx.moveTo(x, y + h * 0.95);
  ctx.bezierCurveTo(x - s * 0.95, y + h * 0.05, x - s * 0.55, y - h * 1.15, x, y - h * 0.4);
  ctx.bezierCurveTo(x + s * 0.55, y - h * 1.15, x + s * 0.95, y + h * 0.05, x, y + h * 0.95);
  ctx.closePath();
}

/** A sealed love letter, centred on (x, y), width `w`, tilted by `angle`. */
export function drawEnvelope(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  angle: number,
) {
  const h = w * 0.64;
  const lw = Math.max(1, w * 0.04);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.beginPath();
  ctx.rect(-w / 2, -h / 2, w, h);
  inked(ctx, "#fdf2f8", lw);
  // Bottom folds.
  ctx.strokeStyle = "rgba(18, 13, 6, 0.45)";
  ctx.lineWidth = lw * 0.7;
  ctx.beginPath();
  ctx.moveTo(-w / 2, h / 2);
  ctx.lineTo(0, h * 0.02);
  ctx.lineTo(w / 2, h / 2);
  ctx.stroke();
  // Top flap.
  ctx.beginPath();
  ctx.moveTo(-w / 2, -h / 2);
  ctx.lineTo(0, h * 0.12);
  ctx.lineTo(w / 2, -h / 2);
  ctx.closePath();
  inked(ctx, "#fce7f3", lw);
  // Heart wax seal on the flap's point.
  heartPath(ctx, 0, h * 0.06, w * 0.26);
  inked(ctx, "#e11d48", lw * 0.8);
  ctx.restore();
}

/**
 * A little generic cupid, flying, bow drawn. Centred on (x, y); `size` is
 * roughly body height. Wings flap on `t`.
 */
export function drawCupid(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  dir: 1 | -1,
  t: number,
) {
  const S = size;
  const lw = Math.max(1, S * 0.035);
  const flap = Math.sin(t * 9);
  const bob = Math.sin(t * 2.2) * S * 0.05;
  ctx.save();
  ctx.translate(x, y + bob);
  ctx.scale(dir, 1);

  // Far wing.
  const wing = (rot: number, shade: string) => {
    ctx.save();
    ctx.translate(-S * 0.08, -S * 0.12);
    ctx.rotate(rot);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(-S * 0.15, -S * 0.45, -S * 0.5, -S * 0.5, -S * 0.55, -S * 0.3);
    ctx.bezierCurveTo(-S * 0.42, -S * 0.25, -S * 0.45, -S * 0.12, -S * 0.32, -S * 0.08);
    ctx.bezierCurveTo(-S * 0.3, 0, -S * 0.15, S * 0.05, 0, 0);
    ctx.closePath();
    inked(ctx, shade, lw);
    ctx.restore();
  };
  wing(-0.35 - flap * 0.35, "#e2e8f0");

  // Legs, tucked.
  const skin = "#f5c9a8";
  ctx.beginPath();
  ctx.ellipse(-S * 0.14, S * 0.3, S * 0.13, S * 0.09, 0.6, 0, Math.PI * 2);
  inked(ctx, skin, lw);
  // Body + sash.
  ctx.beginPath();
  ctx.ellipse(0, S * 0.12, S * 0.2, S * 0.24, 0, 0, Math.PI * 2);
  inked(ctx, skin, lw);
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(0, S * 0.12, S * 0.2, S * 0.24, 0, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = "#fbcfe8";
  ctx.beginPath();
  ctx.moveTo(-S * 0.25, S * 0.05);
  ctx.lineTo(S * 0.25, S * 0.25);
  ctx.lineTo(S * 0.25, S * 0.4);
  ctx.lineTo(-S * 0.25, S * 0.22);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // Head, curls, cheek, eye.
  const hy = -S * 0.25;
  ctx.beginPath();
  ctx.arc(S * 0.04, hy, S * 0.2, 0, Math.PI * 2);
  inked(ctx, skin, lw);
  ctx.fillStyle = "#facc15";
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.arc(S * (-0.1 + i * 0.07), hy - S * 0.17 + (i % 2) * S * 0.03, S * 0.065, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = "rgba(244, 114, 182, 0.7)";
  ctx.beginPath();
  ctx.arc(S * 0.12, hy + S * 0.06, S * 0.045, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.arc(S * 0.11, hy - S * 0.02, S * 0.025, 0, Math.PI * 2);
  ctx.fill();

  // Bow, drawn forward, with a heart-tipped arrow.
  ctx.strokeStyle = "#a16207";
  ctx.lineWidth = lw * 1.3;
  ctx.beginPath();
  ctx.arc(S * 0.28, S * 0.06, S * 0.24, -1.15, 1.15);
  ctx.stroke();
  ctx.strokeStyle = "rgba(255,255,255,0.8)";
  ctx.lineWidth = Math.max(0.6, lw * 0.4);
  ctx.beginPath();
  ctx.moveTo(S * 0.28 + Math.cos(-1.15) * S * 0.24, S * 0.06 + Math.sin(-1.15) * S * 0.24);
  ctx.lineTo(S * 0.18, S * 0.06);
  ctx.lineTo(S * 0.28 + Math.cos(1.15) * S * 0.24, S * 0.06 + Math.sin(1.15) * S * 0.24);
  ctx.stroke();
  ctx.strokeStyle = INK;
  ctx.lineWidth = lw * 0.9;
  ctx.beginPath();
  ctx.moveTo(S * 0.12, S * 0.06);
  ctx.lineTo(S * 0.66, S * 0.06);
  ctx.stroke();
  heartPath(ctx, S * 0.7, S * 0.06, S * 0.13);
  inked(ctx, "#e11d48", lw * 0.6);
  // Arm holding the bow.
  ctx.beginPath();
  ctx.ellipse(S * 0.32, S * 0.06, S * 0.09, S * 0.05, 0, 0, Math.PI * 2);
  inked(ctx, skin, lw * 0.8);

  wing(-0.1 + flap * 0.35, "#f8fafc");
  ctx.restore();
}

/** A long-stemmed rose, anchored at the bottom of its stem, `h` tall. */
export function drawRose(
  ctx: CanvasRenderingContext2D,
  x: number,
  ground: number,
  h: number,
  t: number,
  seed: number,
) {
  const lw = Math.max(1, h * 0.022);
  const sway = Math.sin(t * 1.1 + seed) * h * 0.04;
  const top: [number, number] = [x + sway, ground - h];
  // Stem.
  ctx.strokeStyle = INK;
  ctx.lineWidth = h * 0.05 + lw * 2;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(x, ground);
  ctx.quadraticCurveTo(x - h * 0.06, ground - h * 0.5, top[0], top[1]);
  ctx.stroke();
  ctx.strokeStyle = "#15803d";
  ctx.lineWidth = h * 0.05;
  ctx.stroke();
  // Two leaves.
  for (const [f, s] of [
    [0.35, -1],
    [0.6, 1],
  ] as const) {
    const lx = x - h * 0.03 + sway * f;
    const ly = ground - h * f;
    ctx.beginPath();
    ctx.moveTo(lx, ly);
    ctx.quadraticCurveTo(lx + s * h * 0.12, ly - h * 0.12, lx + s * h * 0.22, ly - h * 0.04);
    ctx.quadraticCurveTo(lx + s * h * 0.1, ly + h * 0.04, lx, ly);
    inked(ctx, "#22c55e", lw);
  }
  // Bloom: cup of petals with a spiral centre.
  const r = h * 0.16;
  const [bx, by] = top;
  ctx.beginPath();
  ctx.moveTo(bx - r, by - r * 0.3);
  ctx.quadraticCurveTo(bx - r * 1.05, by + r * 0.9, bx, by + r * 0.95);
  ctx.quadraticCurveTo(bx + r * 1.05, by + r * 0.9, bx + r, by - r * 0.3);
  ctx.quadraticCurveTo(bx + r * 0.5, by - r * 1.1, bx, by - r * 0.7);
  ctx.quadraticCurveTo(bx - r * 0.5, by - r * 1.1, bx - r, by - r * 0.3);
  ctx.closePath();
  inked(ctx, "#e11d48", lw);
  ctx.strokeStyle = "rgba(18, 13, 6, 0.6)";
  ctx.lineWidth = lw * 0.8;
  ctx.beginPath();
  ctx.arc(bx, by - r * 0.15, r * 0.45, Math.PI * 0.9, Math.PI * 2.3);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(bx + r * 0.05, by - r * 0.2, r * 0.2, Math.PI * 1.1, Math.PI * 2.6);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(bx - r * 0.85, by + r * 0.1);
  ctx.quadraticCurveTo(bx, by + r * 0.55, bx + r * 0.85, by + r * 0.1);
  ctx.stroke();
}
