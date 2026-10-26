/**
 * Hand-drawn Christmas cast: the tree (bare → trimmed → lit), a snowman,
 * wrapped presents, a string of bulbs, reindeer, Santa's sleigh, a winter
 * moon and snowflakes.
 *
 * Same conventions as ../spooky.ts and ./patriotic.ts — heavy ink outlines,
 * flat fills, (ctx, x, y, size, …) signatures, ground figures anchored at
 * the feet / base, flyers at their centre.
 *
 * Kept generic on purpose: the reindeer have plain dark noses (no glowing
 * red one), and the snowman wears a knit beanie and scarf — no top hat, no
 * pipe, nothing from any particular song or film.
 */

import { INK, inked, limb, rrPath, starPath } from "./kit";

export const XMAS_RED = "#c81e2b";
export const XMAS_GREEN = "#1f7a3a";
export const XMAS_GOLD = "#fbbf24";
const TREE_DARK = "#17602d";
const TRUNK = "#6b3f1d";
const SNOW = "#f8fafc";
const SNOW_SHADE = "#dbe4ef";
const FUR = "#8b5a2b";
const FUR_LIGHT = "#c49a6c";
const ANTLER = "#d8b98a";
const SKIN = "#f1c7a1";

/** Ornament / bulb palette — a little pink in it, for Janelle's app. */
export const BULB_COLORS = ["#ef4444", "#22c55e", "#fbbf24", "#3b82f6", "#f472b6"];

// --- tree ------------------------------------------------------------------

export interface TreeLook {
  /** Ornaments + garland + star. */
  trimmed: boolean;
  /** Twinkling lights on the garland (Christmas Day). */
  lit: boolean;
}

/**
 * Christmas tree, anchored at the base of the trunk. `h` is the full height
 * including the star. Three scalloped tiers, bottom drawn first so each tier
 * above overlaps the one below.
 */
export function drawTree(
  ctx: CanvasRenderingContext2D,
  x: number,
  ground: number,
  h: number,
  t: number,
  look: TreeLook,
) {
  const u = h / 100;
  const lw = Math.max(1.2, u * 1.6);

  // Trunk.
  ctx.beginPath();
  ctx.rect(x - 5 * u, ground - 12 * u, 10 * u, 12 * u);
  inked(ctx, TRUNK, lw);

  type Tier = { top: number; bottom: number; hw: number };
  const tiers: Tier[] = [0, 1, 2].map((i) => {
    const bottom = ground - 10 * u - i * 22 * u;
    return { bottom, top: bottom - 38 * u, hw: (34 - i * 8.5) * u };
  });

  for (const tr of tiers) {
    ctx.beginPath();
    ctx.moveTo(x, tr.top);
    ctx.lineTo(x + tr.hw, tr.bottom);
    // Scalloped hem, right to left.
    const n = 4;
    for (let k = 0; k < n; k++) {
      const x0 = x + tr.hw - (2 * tr.hw * k) / n;
      const x1 = x + tr.hw - (2 * tr.hw * (k + 1)) / n;
      ctx.quadraticCurveTo((x0 + x1) / 2, tr.bottom + 5 * u, x1, tr.bottom);
    }
    ctx.closePath();
    inked(ctx, XMAS_GREEN, lw);
    // A darker half for a little volume.
    ctx.save();
    ctx.clip();
    ctx.fillStyle = TREE_DARK;
    ctx.globalAlpha *= 0.55;
    ctx.beginPath();
    ctx.moveTo(x, tr.top);
    ctx.lineTo(x + tr.hw + 2, tr.bottom + 6 * u);
    ctx.lineTo(x + tr.hw * 0.15, tr.bottom + 6 * u);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  const topY = tiers[2].top;

  if (look.trimmed) {
    // Garland: a gold rope sagging across each tier.
    const bulbs: Array<[number, number]> = [];
    tiers.forEach((tr, i) => {
      const yA = tr.bottom - 22 * u;
      const xa = x - tr.hw * 0.52;
      const xb = x + tr.hw * 0.58;
      const ya = yA + 4 * u;
      const yb = yA - 3 * u;
      const cx = (xa + xb) / 2;
      const cy = Math.max(ya, yb) + 9 * u;
      ctx.lineCap = "round";
      ctx.strokeStyle = "#8a6512";
      ctx.lineWidth = 2.6 * u;
      ctx.beginPath();
      ctx.moveTo(xa, ya);
      ctx.quadraticCurveTo(cx, cy, xb, yb);
      ctx.stroke();
      ctx.strokeStyle = XMAS_GOLD;
      ctx.lineWidth = 1.5 * u;
      ctx.stroke();
      // Points along the garland for the lights.
      for (let k = 1; k < 6; k++) {
        const s = k / 6;
        const bx = (1 - s) * (1 - s) * xa + 2 * (1 - s) * s * cx + s * s * xb;
        const by = (1 - s) * (1 - s) * ya + 2 * (1 - s) * s * cy + s * s * yb;
        bulbs.push([bx, by]);
      }
      // Ornaments near each tier's hem.
      const count = i === 0 ? 4 : 3;
      for (let k = 0; k < count; k++) {
        const f = -0.62 + (1.24 * k) / (count - 1);
        const ox = x + f * tr.hw * 0.82;
        const oy = tr.bottom - 4 * u - Math.abs(f) * 3 * u;
        const col = BULB_COLORS[(i * 2 + k) % BULB_COLORS.length];
        ctx.beginPath();
        ctx.arc(ox, oy, 3.4 * u, 0, Math.PI * 2);
        inked(ctx, col, lw * 0.7);
        ctx.fillStyle = "rgba(255,255,255,0.75)";
        ctx.beginPath();
        ctx.arc(ox - 1.1 * u, oy - 1.1 * u, 0.9 * u, 0, Math.PI * 2);
        ctx.fill();
      }
    });

    if (look.lit) {
      bulbs.forEach(([bx, by], i) => {
        const on = 0.5 + 0.5 * Math.sin(t * 2.4 + i * 1.7);
        const col = BULB_COLORS[i % BULB_COLORS.length];
        ctx.globalAlpha = 0.45 + 0.55 * on;
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.arc(bx, by, (1.6 + 0.8 * on) * u, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      });
    }

    // Gold star with a soft, slow glow.
    const sy = topY - 2 * u;
    const pulse = 0.6 + 0.4 * Math.sin(t * 1.5);
    const glow = ctx.createRadialGradient(x, sy, 1, x, sy, 18 * u);
    glow.addColorStop(0, `rgba(253, 224, 71, ${0.55 * pulse})`);
    glow.addColorStop(1, "rgba(253, 224, 71, 0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x, sy, 18 * u, 0, Math.PI * 2);
    ctx.fill();
    starPath(ctx, x, sy, 7.5 * u, Math.sin(t * 0.8) * 0.08, 0.45);
    inked(ctx, XMAS_GOLD, lw * 0.8);
  }
}

// --- snowman ---------------------------------------------------------------

/**
 * A snowman: three balls, coal eyes, smile and buttons, carrot nose, a red
 * striped scarf with a fluttering tail, a green knit beanie with a bobble,
 * and stick arms — one waving. Anchored at the bottom of the base ball.
 */
export function drawSnowman(
  ctx: CanvasRenderingContext2D,
  x: number,
  ground: number,
  h: number,
  t: number,
  dir: 1 | -1,
) {
  const u = h / 100;
  const lw = Math.max(1.2, u * 1.7);

  const ball = (cy: number, r: number) => {
    ctx.beginPath();
    ctx.arc(x, cy, r, 0, Math.PI * 2);
    inked(ctx, SNOW, lw);
    // Shaded crescent on the side away from the light.
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, cy, r - lw / 2, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = SNOW_SHADE;
    ctx.beginPath();
    ctx.arc(x - dir * r * 0.35, cy + r * 0.25, r, 0, Math.PI * 2);
    ctx.arc(x + dir * r * 0.2, cy - r * 0.1, r * 1.02, 0, Math.PI * 2, true);
    ctx.fill("evenodd");
    ctx.restore();
  };

  const b0 = ground - 21 * u;
  const b1 = ground - 52 * u;
  const hy = ground - 76 * u;

  // Stick arms behind the middle ball.
  const wave = Math.sin(t * 2.2) * 0.25;
  const armA: [number, number] = [x + dir * 12 * u, b1 - 2 * u];
  const handA: [number, number] = [
    x + dir * (30 * u),
    b1 - (18 + wave * 14) * u,
  ];
  limb(ctx, [armA, handA], 2 * u, "#5b3a1e", lw * 0.4);
  limb(
    ctx,
    [
      [handA[0] - dir * 4 * u, handA[1] + 3 * u],
      [handA[0] + dir * 2 * u, handA[1] - 6 * u],
    ],
    1.4 * u,
    "#5b3a1e",
    lw * 0.3,
  );
  const armB: [number, number] = [x - dir * 12 * u, b1];
  const handB: [number, number] = [x - dir * 28 * u, b1 + 8 * u];
  limb(ctx, [armB, handB], 2 * u, "#5b3a1e", lw * 0.4);
  limb(
    ctx,
    [
      [handB[0] + dir * 5 * u, handB[1] - 2.5 * u],
      [handB[0] - dir * 1 * u, handB[1] - 8 * u],
    ],
    1.4 * u,
    "#5b3a1e",
    lw * 0.3,
  );

  ball(b0, 22 * u);
  ball(b1, 16 * u);
  ball(hy, 12 * u);

  // Coal buttons.
  ctx.fillStyle = INK;
  for (const k of [-6, 0, 6]) {
    ctx.beginPath();
    ctx.arc(x + dir * 1 * u, b1 + k * u, 1.6 * u, 0, Math.PI * 2);
    ctx.fill();
  }

  // Scarf: band at the neck, tail hanging and fluttering.
  ctx.save();
  rrPath(ctx, x - 13 * u, hy + 8.5 * u, 26 * u, 5.5 * u, 2.5 * u);
  inked(ctx, XMAS_RED, lw * 0.8);
  ctx.translate(x - dir * 7 * u, hy + 12 * u);
  ctx.rotate(dir * (0.15 + Math.sin(t * 3.1) * 0.12));
  rrPath(ctx, -2.6 * u, 0, 5.2 * u, 15 * u, 1.5 * u);
  inked(ctx, XMAS_RED, lw * 0.8);
  ctx.fillStyle = "#fff";
  ctx.fillRect(-2 * u, 5 * u, 4 * u, 1.6 * u);
  ctx.fillRect(-2 * u, 9.5 * u, 4 * u, 1.6 * u);
  ctx.restore();
  ctx.fillStyle = "#fff";
  for (const k of [-6, 0, 6]) ctx.fillRect(x + k * u - 0.8 * u, hy + 9.2 * u, 1.6 * u, 4.2 * u);

  // Face.
  ctx.fillStyle = INK;
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(x + s * 4 * u + dir * 1.5 * u, hy - 2 * u, 1.5 * u, 0, Math.PI * 2);
    ctx.fill();
  }
  for (let k = 0; k < 5; k++) {
    const a = Math.PI * (0.25 + (k * 0.5) / 4);
    ctx.beginPath();
    ctx.arc(
      x + dir * 1.5 * u + Math.cos(a) * 6 * u,
      hy + 1 * u + Math.sin(a) * 4 * u,
      0.9 * u,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }
  // Carrot nose, pointing the way he faces.
  ctx.beginPath();
  ctx.moveTo(x + dir * 1 * u, hy - 1.6 * u);
  ctx.lineTo(x + dir * 13 * u, hy + 0.6 * u);
  ctx.lineTo(x + dir * 1 * u, hy + 2 * u);
  ctx.closePath();
  inked(ctx, "#f97316", lw * 0.6);

  // Knit beanie with a turned-up cuff and a bobble.
  ctx.beginPath();
  ctx.ellipse(x, hy - 7 * u, 11.5 * u, 10 * u, 0, Math.PI, 0);
  ctx.closePath();
  inked(ctx, XMAS_GREEN, lw * 0.8);
  rrPath(ctx, x - 12.5 * u, hy - 9 * u, 25 * u, 4.5 * u, 2 * u);
  inked(ctx, "#f1f5f9", lw * 0.7);
  ctx.beginPath();
  ctx.arc(x, hy - 18 * u, 3.6 * u, 0, Math.PI * 2);
  inked(ctx, "#f1f5f9", lw * 0.7);
}

// --- presents --------------------------------------------------------------

/** A wrapped present with a ribbon cross and a bow. Anchored at the base. */
export function drawPresent(
  ctx: CanvasRenderingContext2D,
  x: number,
  ground: number,
  w: number,
  h: number,
  paper: string,
  ribbon: string,
) {
  const lw = Math.max(1, w * 0.05);
  ctx.beginPath();
  ctx.rect(x - w / 2, ground - h, w, h);
  inked(ctx, paper, lw);
  ctx.fillStyle = ribbon;
  ctx.fillRect(x - w * 0.09, ground - h + lw / 2, w * 0.18, h - lw);
  ctx.fillRect(x - w / 2 + lw / 2, ground - h * 0.58, w - lw, h * 0.16);
  // Lid line.
  ctx.strokeStyle = "rgba(0,0,0,0.3)";
  ctx.lineWidth = Math.max(0.6, lw * 0.5);
  ctx.beginPath();
  ctx.moveTo(x - w / 2, ground - h * 0.8);
  ctx.lineTo(x + w / 2, ground - h * 0.8);
  ctx.stroke();
  // Bow: two loops and a knot.
  for (const s of [-1, 1]) {
    ctx.save();
    ctx.translate(x + s * w * 0.13, ground - h - w * 0.06);
    ctx.rotate(s * 0.5);
    ctx.beginPath();
    ctx.ellipse(0, 0, w * 0.15, w * 0.08, 0, 0, Math.PI * 2);
    inked(ctx, ribbon, lw * 0.8);
    ctx.restore();
  }
  ctx.beginPath();
  ctx.arc(x, ground - h - w * 0.02, w * 0.06, 0, Math.PI * 2);
  inked(ctx, ribbon, lw * 0.8);
}

// --- string of lights ------------------------------------------------------

/**
 * Colored bulbs on a sagging wire along the top edge, in two runs from the
 * corners so the app title in the middle stays clear. A slow chase moves
 * the brightness along the string.
 */
export function drawLightString(
  ctx: CanvasRenderingContext2D,
  w: number,
  t: number,
) {
  const runs: Array<[number, number]> = [
    [0, w * 0.33],
    [w * 0.67, w],
  ];
  let idx = 0;
  for (const [r0, r1] of runs) {
    const runW = r1 - r0;
    const n = Math.max(1, Math.round(runW / 70));
    const span = runW / n;
    const sag = Math.min(16, span * 0.22);
    for (let i = 0; i < n; i++) {
      const x0 = r0 + i * span;
      const x1 = x0 + span;
      const cx = (x0 + x1) / 2;
      const cy = sag * 2;
      ctx.strokeStyle = "#1f2a1f";
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(x0, 2);
      ctx.quadraticCurveTo(cx, cy, x1, 2);
      ctx.stroke();
      const per = 4;
      for (let k = 1; k <= per; k++, idx++) {
        const s = k / (per + 1);
        const bx = (1 - s) * (1 - s) * x0 + 2 * (1 - s) * s * cx + s * s * x1;
        const by = (1 - s) * (1 - s) * 2 + 2 * (1 - s) * s * cy + s * s * 2;
        const col = BULB_COLORS[idx % BULB_COLORS.length];
        const on = 0.5 + 0.5 * Math.sin(t * 1.8 - idx * 0.7);
        // Glow.
        ctx.globalAlpha = 0.35 * on;
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.arc(bx, by + 5, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        // Socket cap, then the bulb hanging below it.
        ctx.fillStyle = "#2d3a2d";
        ctx.fillRect(bx - 1.6, by - 0.5, 3.2, 3);
        ctx.beginPath();
        ctx.ellipse(bx, by + 5.4, 2.6, 3.8, 0, 0, Math.PI * 2);
        ctx.fillStyle = col;
        ctx.globalAlpha = 0.55 + 0.45 * on;
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.lineWidth = 0.9;
        ctx.strokeStyle = INK;
        ctx.stroke();
      }
    }
  }
}

// --- flyers ----------------------------------------------------------------

/**
 * A reindeer in a flying leap, side view, facing `dir`. Centred on the body.
 * `size` is roughly nose-to-tail. A red harness strap with a gold bell when
 * `harness` is set (pulling the sleigh). Plain dark nose.
 */
export function drawReindeer(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  dir: 1 | -1,
  t: number,
  seed: number,
  harness = false,
) {
  const S = size;
  const lw = Math.max(1, S * 0.03);
  const ph = t * 5 + seed;
  const stride = Math.sin(ph);

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(dir, 1);

  // Far legs first (darker), then body, then near legs.
  const leg = (
    hipX: number,
    hipY: number,
    swing: number,
    front: boolean,
    color: string,
  ) => {
    // Flying leap: front legs reach forward and fold at the knee, hind
    // legs stretch out behind. Angles are from +x (forward), y down.
    const a = front ? 0.75 + swing * 0.3 : Math.PI - 0.75 + swing * 0.3;
    const b = front ? a + 1.1 : a + 0.35;
    const knee: [number, number] = [
      hipX + Math.cos(a) * 0.15 * S,
      hipY + Math.sin(a) * 0.15 * S,
    ];
    const foot: [number, number] = [
      knee[0] + Math.cos(b) * 0.13 * S,
      knee[1] + Math.sin(b) * 0.13 * S,
    ];
    limb(ctx, [[hipX, hipY], knee, foot], S * 0.045, color, lw * 0.5);
    ctx.fillStyle = "#2b1a0e";
    ctx.beginPath();
    ctx.arc(foot[0], foot[1], S * 0.026, 0, Math.PI * 2);
    ctx.fill();
  };
  leg(0.2 * S, 0.06 * S, -stride, true, "#6e4520");
  leg(-0.2 * S, 0.06 * S, stride, false, "#6e4520");

  // Tail.
  ctx.beginPath();
  ctx.ellipse(-0.32 * S, -0.07 * S, 0.05 * S, 0.035 * S, -0.5, 0, Math.PI * 2);
  inked(ctx, "#f5f0e6", lw);

  // Body.
  ctx.beginPath();
  ctx.ellipse(0, 0, 0.3 * S, 0.12 * S, -0.04, 0, Math.PI * 2);
  inked(ctx, FUR, lw);
  // Pale belly.
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(0, 0, 0.3 * S - lw / 2, 0.12 * S - lw / 2, -0.04, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = FUR_LIGHT;
  ctx.beginPath();
  ctx.ellipse(0.02 * S, 0.12 * S, 0.24 * S, 0.06 * S, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Neck and head, bobbing with the stride.
  const nod = stride * 0.02 * S;
  limb(
    ctx,
    [
      [0.2 * S, -0.04 * S],
      [0.34 * S, -0.2 * S + nod],
    ],
    0.1 * S,
    FUR,
    lw * 0.8,
  );
  const hx = 0.4 * S;
  const hy = -0.24 * S + nod;

  // Antlers: main beam sweeping back with three tines each.
  const antler = (ox: number, shade: string) => {
    const bx = hx - 0.02 * S + ox;
    const by = hy - 0.06 * S;
    const pts: Array<[number, number]> = [
      [bx, by],
      [bx - 0.05 * S, by - 0.12 * S],
      [bx - 0.15 * S, by - 0.2 * S],
    ];
    limb(ctx, pts, S * 0.025, shade, lw * 0.35);
    for (const [px, py, dx, dy] of [
      [bx - 0.01 * S, by - 0.03 * S, 0.06, -0.03],
      [pts[1][0], pts[1][1], 0.05, -0.08],
      [(pts[1][0] + pts[2][0]) / 2, (pts[1][1] + pts[2][1]) / 2, 0.02, -0.09],
      [pts[2][0], pts[2][1], -0.02, -0.07],
    ] as Array<[number, number, number, number]>) {
      limb(
        ctx,
        [
          [px, py],
          [px + dx * S, py + dy * S],
        ],
        S * 0.018,
        shade,
        lw * 0.3,
      );
    }
  };
  antler(-0.03 * S, "#b8996a");
  ctx.beginPath();
  ctx.ellipse(hx, hy, 0.085 * S, 0.06 * S, 0.25, 0, Math.PI * 2);
  inked(ctx, FUR, lw);
  // Muzzle and plain dark nose.
  ctx.beginPath();
  ctx.ellipse(hx + 0.07 * S, hy + 0.025 * S, 0.05 * S, 0.035 * S, 0.3, 0, Math.PI * 2);
  inked(ctx, FUR_LIGHT, lw * 0.8);
  ctx.fillStyle = "#2b1a0e";
  ctx.beginPath();
  ctx.arc(hx + 0.115 * S, hy + 0.03 * S, 0.018 * S, 0, Math.PI * 2);
  ctx.fill();
  // Ear and eye.
  ctx.beginPath();
  ctx.ellipse(hx - 0.06 * S, hy - 0.04 * S, 0.035 * S, 0.015 * S, -0.6, 0, Math.PI * 2);
  inked(ctx, FUR, lw * 0.7);
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.arc(hx + 0.015 * S, hy - 0.012 * S, 0.012 * S, 0, Math.PI * 2);
  ctx.fill();
  antler(0.01 * S, ANTLER);

  if (harness) {
    ctx.strokeStyle = XMAS_RED;
    ctx.lineWidth = S * 0.035;
    ctx.beginPath();
    ctx.moveTo(0.18 * S, -0.1 * S);
    ctx.lineTo(0.12 * S, 0.11 * S);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0.15 * S, 0.02 * S, 0.025 * S, 0, Math.PI * 2);
    inked(ctx, XMAS_GOLD, lw * 0.6);
  }

  // Near legs.
  leg(0.22 * S, 0.07 * S, stride * 0.8, true, FUR);
  leg(-0.18 * S, 0.07 * S, -stride * 0.8, false, FUR);

  ctx.restore();
}

/**
 * Santa in his sleigh, side view, facing `dir`. Centred on the sleigh body;
 * `size` is the sleigh's length. Returns Santa's rein hand position (in
 * canvas coords) so the caller can run the reins to the team.
 */
export function drawSleigh(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  dir: 1 | -1,
  t: number,
): [number, number] {
  const S = size;
  const lw = Math.max(1, S * 0.025);

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(dir, 1);

  // Sack of toys behind Santa.
  ctx.beginPath();
  ctx.ellipse(-0.3 * S, -0.3 * S, 0.15 * S, 0.17 * S, -0.2, 0, Math.PI * 2);
  inked(ctx, "#8b6b45", lw);
  ctx.beginPath();
  ctx.rect(-0.36 * S, -0.52 * S, 0.1 * S, 0.09 * S);
  inked(ctx, "#3b82f6", lw * 0.8);
  ctx.fillStyle = XMAS_GOLD;
  ctx.fillRect(-0.32 * S, -0.52 * S, 0.02 * S, 0.09 * S);

  // Santa: body, beard, face, hat.
  const sx = -0.06 * S;
  ctx.beginPath();
  ctx.ellipse(sx, -0.28 * S, 0.13 * S, 0.15 * S, 0, 0, Math.PI * 2);
  inked(ctx, XMAS_RED, lw);
  ctx.beginPath();
  ctx.arc(sx + 0.02 * S, -0.47 * S, 0.075 * S, 0, Math.PI * 2);
  inked(ctx, SKIN, lw);
  // Beard.
  ctx.beginPath();
  ctx.moveTo(sx - 0.04 * S, -0.46 * S);
  ctx.quadraticCurveTo(sx - 0.02 * S, -0.3 * S, sx + 0.06 * S, -0.31 * S);
  ctx.quadraticCurveTo(sx + 0.12 * S, -0.36 * S, sx + 0.1 * S, -0.45 * S);
  ctx.quadraticCurveTo(sx + 0.03 * S, -0.41 * S, sx - 0.04 * S, -0.46 * S);
  ctx.closePath();
  inked(ctx, "#ffffff", lw * 0.8);
  // Rosy cheek, eye.
  ctx.fillStyle = "rgba(239, 68, 68, 0.45)";
  ctx.beginPath();
  ctx.arc(sx + 0.06 * S, -0.455 * S, 0.018 * S, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.arc(sx + 0.055 * S, -0.49 * S, 0.01 * S, 0, Math.PI * 2);
  ctx.fill();
  // Hat: drooping cone with a white band and pom-pom.
  const flop = Math.sin(t * 3) * 0.02 * S;
  ctx.beginPath();
  ctx.moveTo(sx + 0.1 * S, -0.53 * S);
  ctx.quadraticCurveTo(sx + 0.07 * S, -0.74 * S, sx - 0.15 * S, -0.68 * S + flop);
  ctx.quadraticCurveTo(sx - 0.05 * S, -0.62 * S, sx - 0.07 * S, -0.53 * S);
  ctx.closePath();
  inked(ctx, XMAS_RED, lw);
  rrPath(ctx, sx - 0.08 * S, -0.57 * S, 0.2 * S, 0.05 * S, 0.02 * S);
  inked(ctx, "#ffffff", lw * 0.7);
  ctx.beginPath();
  ctx.arc(sx - 0.16 * S, -0.68 * S + flop, 0.035 * S, 0, Math.PI * 2);
  inked(ctx, "#ffffff", lw * 0.7);

  // Sleigh body: tall back, low middle, front curling up into a scroll.
  ctx.beginPath();
  ctx.moveTo(-0.5 * S, -0.4 * S);
  ctx.quadraticCurveTo(-0.54 * S, -0.1 * S, -0.44 * S, 0.02 * S);
  ctx.lineTo(0.34 * S, 0.02 * S);
  ctx.quadraticCurveTo(0.52 * S, 0.0, 0.5 * S, -0.2 * S);
  ctx.quadraticCurveTo(0.48 * S, -0.3 * S, 0.4 * S, -0.27 * S);
  ctx.quadraticCurveTo(0.36 * S, -0.2 * S, 0.3 * S, -0.16 * S);
  ctx.lineTo(-0.3 * S, -0.16 * S);
  ctx.quadraticCurveTo(-0.36 * S, -0.3 * S, -0.5 * S, -0.4 * S);
  ctx.closePath();
  inked(ctx, "#b91c1c", lw);
  // Gold trim along the side.
  ctx.strokeStyle = XMAS_GOLD;
  ctx.lineWidth = S * 0.02;
  ctx.beginPath();
  ctx.moveTo(-0.42 * S, -0.04 * S);
  ctx.lineTo(0.34 * S, -0.04 * S);
  ctx.quadraticCurveTo(0.45 * S, -0.06 * S, 0.44 * S, -0.17 * S);
  ctx.stroke();

  // Runners with struts, curling up at the front.
  ctx.strokeStyle = INK;
  ctx.lineWidth = S * 0.03;
  ctx.lineCap = "round";
  ctx.beginPath();
  for (const sx2 of [-0.3, 0.0, 0.25]) {
    ctx.moveTo(sx2 * S, 0.02 * S);
    ctx.lineTo(sx2 * S, 0.12 * S);
  }
  ctx.moveTo(-0.46 * S, 0.12 * S);
  ctx.lineTo(0.4 * S, 0.12 * S);
  ctx.quadraticCurveTo(0.58 * S, 0.12 * S, 0.56 * S, 0.0);
  ctx.stroke();
  ctx.strokeStyle = XMAS_GOLD;
  ctx.lineWidth = S * 0.016;
  ctx.stroke();

  // Arm out front holding the reins, with a little wave.
  const hand: [number, number] = [0.12 * S, -0.32 * S + Math.sin(t * 2) * 0.015 * S];
  limb(ctx, [[sx + 0.06 * S, -0.34 * S], hand], 0.05 * S, XMAS_RED, lw * 0.5);
  ctx.beginPath();
  ctx.arc(hand[0], hand[1], 0.03 * S, 0, Math.PI * 2);
  inked(ctx, "#1f2937", lw * 0.6);

  ctx.restore();
  return [x + dir * hand[0], y + hand[1]];
}

/** Winter moon: cool white disc with a soft halo. */
export function drawWinterMoon(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  glow: number,
) {
  const halo = ctx.createRadialGradient(cx, cy, r * 0.6, cx, cy, r * 2.8);
  halo.addColorStop(0, `rgba(226, 232, 240, ${0.25 * glow})`);
  halo.addColorStop(1, "rgba(226, 232, 240, 0)");
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(cx, cy, r * 2.8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#eef2f7";
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(148, 163, 184, 0.28)";
  for (const [dx, dy, cr] of [
    [-0.3, -0.25, 0.18],
    [0.25, 0.1, 0.13],
    [-0.1, 0.38, 0.1],
  ] as Array<[number, number, number]>) {
    ctx.beginPath();
    ctx.arc(cx + dx * r, cy + dy * r, cr * r, 0, Math.PI * 2);
    ctx.fill();
  }
}

/**
 * A six-armed snowflake, pre-rendered once onto a small canvas so the
 * snowfall costs one drawImage per flake per frame.
 */
export function makeFlakeSprite(px: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  const S = Math.ceil(px * 2);
  c.width = S;
  c.height = S;
  const g = c.getContext("2d");
  if (!g) return c;
  const m = S / 2;
  const r = S * 0.44;
  g.strokeStyle = "#ffffff";
  g.lineCap = "round";
  g.lineWidth = Math.max(1, S * 0.07);
  g.translate(m, m);
  for (let i = 0; i < 6; i++) {
    g.save();
    g.rotate((i * Math.PI) / 3);
    g.beginPath();
    g.moveTo(0, 0);
    g.lineTo(0, -r);
    for (const f of [0.45, 0.72]) {
      g.moveTo(0, -r * f);
      g.lineTo(-r * 0.2, -r * (f + 0.16));
      g.moveTo(0, -r * f);
      g.lineTo(r * 0.2, -r * (f + 0.16));
    }
    g.stroke();
    g.restore();
  }
  return c;
}
