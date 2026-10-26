/**
 * The 4th of July, Jun 28 → Jul 4 — three stages (see FOURTH_STAGES in
 * ../holidays.ts):
 *
 *   0 bunting    red, white and blue bunting from the top corners, a small
 *                flag on a short pole at the bottom-left, a few faint stars
 *   1 sparklers  + two sparklers fizzing along the bottom
 *   2 the 4th    + a fireworks show high on the screen — rockets, peonies,
 *                rings and gold willows — kept faint enough to read through
 */

import { makeFlag, type WavingFlag } from "./flag";
import {
  type Drifter,
  type Scene,
  groundY,
  pick,
  rand,
  softLayer,
  spawnDrifter,
  stepDrifter,
  trimFor,
  vignette,
} from "./kit";
import { drawBunting, drawDriftStar, drawPole } from "./patriotic";
import { drawSparkler } from "./spring-cast";

const SOFT = {
  bunting: 0.7,
  flag: 0.62,
  stars: 0.5,
  sparklers: 0.85,
  // Bursts only flash for a moment, so these can be brighter than the rest.
  fireworks: 0.8,
};

const RED = "#b22234";
const WHITE = "#f4f1ea";
const BLUE = "#3c3b6e";
const STAR_COLORS = ["#f8fafc", "#fde68a", "#fca5a5", "#93c5fd"];
const FIREWORK = [
  "239, 68, 68",
  "248, 250, 252",
  "96, 165, 250",
  "250, 204, 21",
];

type BurstKind = "peony" | "ring" | "willow";

interface Rocket {
  x: number;
  y: number;
  vy: number;
  targetY: number;
  kind: BurstKind;
  color: string;
}

interface Spark {
  x: number;
  y: number;
  px: number;
  py: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  color: string;
  drag: number;
  gravity: number;
}

const MAX_SPARKS = 420;

export function createFourthScene(
  ctx: CanvasRenderingContext2D,
  stage: number,
): Scene {
  const showSparklers = stage >= 1;
  const showFireworks = stage >= 2;

  let W = 0;
  let H = 0;
  let flag: WavingFlag | null = null;
  let stars: Drifter[] = [];
  const rockets: Rocket[] = [];
  const sparks: Spark[] = [];
  let nextRocket = 0.4;

  function layout(w: number, h: number) {
    W = w;
    H = h;
    const trim = trimFor(w);
    flag = makeFlag(Math.max(48, Math.min(72, w * 0.14)));
    stars = Array.from({ length: trim(showFireworks ? 4 : 8) }, () =>
      spawnDrifter(w, h, true, STAR_COLORS, [2, 4], [8, 18]),
    );
  }

  function launch() {
    const kind: BurstKind = pick(["peony", "peony", "ring", "willow"] as const);
    rockets.push({
      x: W * rand(0.15, 0.85),
      y: H + 10,
      vy: -rand(H * 0.75, H * 0.95),
      targetY: H * rand(0.08, 0.3),
      kind,
      color: kind === "willow" ? FIREWORK[3] : pick(FIREWORK),
    });
  }

  function burst(r: Rocket) {
    const big = Math.min(W, H);
    const n =
      r.kind === "ring" ? 28 : r.kind === "willow" ? 34 : 40 + Math.floor(Math.random() * 14);
    const second = pick(FIREWORK);
    for (let i = 0; i < n && sparks.length < MAX_SPARKS; i++) {
      const a = (Math.PI * 2 * i) / n + (r.kind === "ring" ? 0 : rand(-0.12, 0.12));
      const v =
        r.kind === "ring"
          ? big * 0.32
          : r.kind === "willow"
            ? big * rand(0.18, 0.3)
            : big * rand(0.12, 0.36);
      const life = r.kind === "willow" ? rand(2.2, 2.9) : rand(1.1, 1.7);
      sparks.push({
        x: r.x,
        y: r.y,
        px: r.x,
        py: r.y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v,
        life,
        max: life,
        // Peonies get a second colour mixed in.
        color: r.kind === "peony" && i % 3 === 0 ? second : r.color,
        drag: r.kind === "willow" ? 1.6 : 1.1,
        gravity: r.kind === "willow" ? 40 : 55,
      });
    }
  }

  function drawFireworks(dt: number) {
    nextRocket -= dt;
    if (nextRocket <= 0) {
      launch();
      nextRocket = rand(0.9, 1.9);
    }
    ctx.save();
    ctx.lineCap = "round";
    for (let i = rockets.length - 1; i >= 0; i--) {
      const r = rockets[i];
      const py = r.y;
      r.y += r.vy * dt;
      r.vy *= 1 - 0.6 * dt;
      ctx.strokeStyle = `rgba(253, 230, 138, ${0.6 * SOFT.fireworks})`;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(r.x, py + 14);
      ctx.lineTo(r.x, r.y);
      ctx.stroke();
      if (r.y <= r.targetY || r.vy > -40) {
        burst(r);
        rockets.splice(i, 1);
      }
    }
    for (let i = sparks.length - 1; i >= 0; i--) {
      const s = sparks[i];
      s.life -= dt;
      if (s.life <= 0) {
        sparks.splice(i, 1);
        continue;
      }
      s.px = s.x;
      s.py = s.y;
      const k = Math.exp(-s.drag * dt);
      s.vx *= k;
      s.vy = s.vy * k + s.gravity * dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      const fade = s.life / s.max;
      // Twinkle as they die.
      const tw = fade < 0.35 ? (Math.random() < 0.5 ? 0.3 : 1) : 1;
      ctx.strokeStyle = `rgba(${s.color}, ${fade * tw * SOFT.fireworks})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      // A streak from where it was a moment ago — reads as motion.
      ctx.moveTo(s.px - s.vx * 0.04, s.py - s.vy * 0.04);
      ctx.lineTo(s.x, s.y);
      ctx.stroke();
    }
    ctx.restore();
  }

  return {
    frame(dt, t, w, h) {
      if (w !== W || h !== H || !flag) layout(w, h);
      const ground = groundY(h) + 30;

      for (const d of stars) {
        const x = stepDrifter(d, dt, w, h);
        const tw = 0.45 + 0.4 * Math.sin(t * 2.2 + d.phase * 3);
        drawDriftStar(ctx, x, d.y, d.size, d.angle, d.color, tw * SOFT.stars);
      }

      if (showFireworks) drawFireworks(dt);

      softLayer(ctx, SOFT.bunting, 0, 0, w, 40, (c) =>
        drawBunting(c, w, t, { body: WHITE, edge: RED, rosette: BLUE, center: WHITE }, 0.65),
      );

      // Small flag on a short pole, planted bottom-left like a garden flag.
      if (flag) {
        const f = flag;
        const poleX = Math.max(22, w * 0.06);
        const poleTop = ground - f.height - 46;
        softLayer(ctx, SOFT.flag, 0, poleTop - 10, poleX + f.width + 14, ground - poleTop + 12, (c) => {
          c.fillStyle = "#cbd5e1";
          c.fillRect(poleX - 1.2, poleTop, 2.4, ground - poleTop);
          drawPole(c, poleX, poleTop, 0);
          f.draw(c, poleX + 1.2, poleTop + 2, t, 0, 0.9);
        });
      }

      if (showSparklers) {
        const sh = Math.max(34, Math.min(48, h * 0.055));
        const xs = [w * 0.34, Math.min(w * 0.52, w - 120)];
        ctx.save();
        ctx.globalAlpha = SOFT.sparklers;
        xs.forEach((x, i) =>
          drawSparkler(
            ctx,
            x,
            ground,
            sh,
            i === 0 ? -0.18 : 0.16,
            // Each burns down slowly, then "relights".
            ((t * 0.035 + i * 0.4) % 1),
            t,
            i + 1,
          ),
        );
        ctx.restore();
      }

      vignette(ctx, w, h, "59, 130, 246", 0.035 + 0.012 * Math.sin(t * 1.2));
    },
  };
}
