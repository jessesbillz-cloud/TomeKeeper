/**
 * New Year's, Dec 26 → Jan 1 — four stages (see NEW_YEAR_STAGES in
 * ../holidays.ts):
 *
 *   0 sparkle        faint gold and silver glitter drifting down
 *   1 warm-up        + now and then a small firework high on the screen
 *   2 new-years-eve  Dec 31. + champagne bubbles rising off the bottom edge,
 *                      gold and silver streamers curling from the top
 *                      corners, fireworks more often
 *   3 new-year       Jan 1. The finale — more frequent bursts in several
 *                      shapes (peony, ring, willow) and confetti
 *
 * Background-level (kit.ts rules): bursts are small, short-lived and faint
 * enough to read the calendar through; bubbles stay in the bottom strip.
 */

import {
  type Drifter,
  type Scene,
  pick,
  rand,
  softLayer,
  spawnDrifter,
  stepDrifter,
  trimFor,
  vignette,
} from "./kit";
import { sparkle } from "./patriotic";

const SOFT = {
  glitter: 0.65,
  sparks: 0.65,
  bubbles: 0.45,
  streamers: 0.55,
  confetti: 0.55,
};

const GLITTER = ["255, 214, 102", "255, 236, 170", "226, 232, 240"];
const BURST_COLORS = [
  "255, 205, 86", // gold
  "244, 114, 182", // pink
  "226, 232, 240", // silver
  "125, 211, 252", // ice blue
  "251, 146, 60", // amber
  "192, 132, 252", // violet
];
const CONFETTI = ["#fbbf24", "#e2e8f0", "#f472b6", "#fde68a", "#c084fc"];

type BurstKind = "peony" | "ring" | "willow";

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
  grav: number;
}

interface Rocket {
  x: number;
  y: number;
  targetY: number;
  kind: BurstKind;
  color: string;
}

interface Bubble {
  x: number;
  y: number;
  r: number;
  speed: number;
  phase: number;
}

/** Seconds between bursts, per stage. Stage 0 has none. */
const BURST_GAP: Array<[number, number] | null> = [null, [4, 7], [2, 3.5], [0.9, 1.8]];

export function createNewYearScene(
  ctx: CanvasRenderingContext2D,
  stage: number,
): Scene {
  const gap = BURST_GAP[Math.min(stage, 3)] ?? null;
  const showBubbles = stage >= 2;
  const showStreamers = stage >= 2;
  const showConfetti = stage >= 3;
  const kinds: BurstKind[] = stage >= 3 ? ["peony", "ring", "willow"] : ["peony", "ring"];
  // Fireworks only flash for a moment, so New Year's Eve and the day itself
  // can be bolder than the rest without getting in the way: bigger, fuller,
  // brighter bursts.
  const boom = [1, 1, 1.15, 1.35][Math.min(stage, 3)] ?? 1;
  const sparkAlpha = Math.min(0.9, SOFT.sparks * [1, 1, 1.15, 1.3][Math.min(stage, 3)]);

  let W = 0;
  let H = 0;
  let glitter: Drifter[] = [];
  let confetti: Drifter[] = [];
  let bubbles: Bubble[] = [];
  const sparks: Spark[] = [];
  const rockets: Rocket[] = [];
  let nextBurst = 0.8;

  function spawnBubble(initial: boolean): Bubble {
    return {
      x: rand(10, Math.max(20, W - 110)),
      y: initial ? H - rand(0, H * 0.3) : H + 6,
      r: rand(1.6, 3.6),
      speed: rand(18, 34),
      phase: Math.random() * 6,
    };
  }

  function layout(w: number, h: number) {
    W = w;
    H = h;
    const trim = trimFor(w);
    glitter = Array.from({ length: trim([12, 12, 14, 16][stage] ?? 12) }, () =>
      spawnDrifter(w, h, true, GLITTER, [3, 5.5], [8, 18]),
    );
    confetti = showConfetti
      ? Array.from({ length: trim(14) }, () =>
          spawnDrifter(w, h, true, CONFETTI, [5, 8], [22, 44], 2),
        )
      : [];
    bubbles = showBubbles
      ? Array.from({ length: trim(16) }, () => spawnBubble(true))
      : [];
  }

  function launch() {
    rockets.push({
      x: rand(W * 0.1, W * 0.9),
      y: 0,
      targetY: H * rand(0.06, 0.3),
      kind: pick(kinds),
      color: pick(BURST_COLORS),
    });
    const r = rockets[rockets.length - 1];
    // Short rise: starts ~60px below where it bursts, not from the ground,
    // so nothing streaks across the calendar.
    r.y = r.targetY + 60;
  }

  function explode(r: Rocket) {
    const small = W < 480;
    const scale = (small ? 0.8 : 1) * boom;
    if (r.kind === "ring") {
      const n = Math.round(22 * boom);
      const v = 68 * scale;
      const tilt = rand(0.35, 0.8); // a ring seen at an angle
      for (let i = 0; i < n; i++) {
        const a = (Math.PI * 2 * i) / n;
        addSpark(r.x, r.targetY, Math.cos(a) * v, Math.sin(a) * v * tilt, 1.1, r.color, 1.6, 20);
      }
    } else if (r.kind === "willow") {
      // Long-lived gold that droops like willow branches.
      const n = Math.round(26 * boom);
      for (let i = 0; i < n; i++) {
        const a = (Math.PI * 2 * i) / n + rand(-0.1, 0.1);
        const v = rand(50, 70) * scale;
        addSpark(r.x, r.targetY, Math.cos(a) * v, Math.sin(a) * v, rand(1.8, 2.4), "255, 205, 86", 1.4, 34);
      }
    } else {
      const n = Math.round(30 * boom);
      for (let i = 0; i < n; i++) {
        const a = (Math.PI * 2 * i) / n + rand(-0.15, 0.15);
        const v = rand(45, 78) * scale;
        addSpark(r.x, r.targetY, Math.cos(a) * v, Math.sin(a) * v, rand(0.9, 1.3), r.color, 1.8, 26);
      }
    }
  }

  function addSpark(
    x: number,
    y: number,
    vx: number,
    vy: number,
    life: number,
    color: string,
    drag: number,
    grav: number,
  ) {
    sparks.push({ x, y, px: x, py: y, vx, vy, life, max: life, color, drag, grav });
  }

  function drawStreamers(t: number) {
    const len = Math.min(46, H * 0.06);
    const colors = ["#fbbf24", "#e2e8f0", "#f59e0b", "#cbd5e1"];
    const box = Math.min(84, W * 0.22);
    for (const side of [0, 1]) {
      const x0 = side === 0 ? 0 : W - box;
      softLayer(ctx, SOFT.streamers, x0, 0, box, len + 16, (c) => {
        c.lineCap = "round";
        c.lineWidth = 2.2;
        for (let i = 0; i < 4; i++) {
          const ax = side === 0 ? 8 + i * box * 0.22 : W - 8 - i * box * 0.22;
          const l = len * (0.55 + 0.45 * ((i * 7) % 4) / 3);
          c.strokeStyle = colors[i % colors.length];
          c.beginPath();
          c.moveTo(ax, 0);
          for (let k = 1; k <= 20; k++) {
            const f = k / 20;
            // A curling ribbon: a sine that tightens toward the end.
            const curl = Math.sin(f * 6 + t * 1.4 + i) * (1.5 + f * 4);
            c.lineTo(ax + curl, f * l);
          }
          c.stroke();
        }
      });
    }
  }

  return {
    frame(dt, t, w, h) {
      if (w !== W || h !== H) layout(w, h);

      // Glitter.
      for (const d of glitter) {
        const x = stepDrifter(d, dt, w, h);
        const tw = Math.max(0, Math.sin(t * 2.4 + d.phase * 3));
        if (tw > 0.05) sparkle(ctx, x, d.y, d.size * (0.6 + tw * 0.6), tw * SOFT.glitter, d.color);
      }

      // Fireworks.
      if (gap) {
        nextBurst -= dt;
        if (nextBurst <= 0 && rockets.length + (sparks.length > 0 ? 1 : 0) < 4) {
          launch();
          nextBurst = rand(gap[0], gap[1]);
        }
      }
      for (let i = rockets.length - 1; i >= 0; i--) {
        const r = rockets[i];
        const py = r.y;
        r.y -= 75 * dt;
        ctx.strokeStyle = `rgba(${r.color}, 0.35)`;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(r.x, py + 10);
        ctx.lineTo(r.x, r.y);
        ctx.stroke();
        if (r.y <= r.targetY) {
          explode(r);
          rockets.splice(i, 1);
        }
      }
      ctx.lineCap = "round";
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
        s.vy = s.vy * k + s.grav * dt;
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        const a = Math.min(1, s.life / s.max) * sparkAlpha;
        ctx.strokeStyle = `rgba(${s.color}, ${a})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        // A short streak from where it was, so it reads as a spark trail.
        ctx.moveTo(s.px - (s.x - s.px) * 2, s.py - (s.y - s.py) * 2);
        ctx.lineTo(s.x, s.y);
        ctx.stroke();
      }

      // Confetti (finale only).
      for (const d of confetti) {
        const x = stepDrifter(d, dt, w, h);
        ctx.save();
        ctx.translate(x, d.y);
        ctx.rotate(d.angle);
        ctx.globalAlpha = SOFT.confetti;
        ctx.fillStyle = d.color;
        if (d.kind === 0) ctx.fillRect(-d.size / 2, -d.size / 5, d.size, d.size / 2.5);
        else {
          ctx.beginPath();
          ctx.arc(0, 0, d.size / 3.2, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }

      // Champagne bubbles rising off the bottom edge, fading as they go.
      if (showBubbles) {
        const top = h * 0.3;
        ctx.lineWidth = 1;
        for (let i = 0; i < bubbles.length; i++) {
          const b = bubbles[i];
          b.y -= b.speed * dt;
          b.phase += dt * 3;
          if (b.y < h - top) {
            bubbles[i] = spawnBubble(false);
            continue;
          }
          const f = (h - b.y) / top; // 0 at the bottom → 1 at the top of the band
          const a = SOFT.bubbles * Math.sin(Math.min(1, f) * Math.PI) * 1.2;
          const x = b.x + Math.sin(b.phase) * 2.5;
          ctx.strokeStyle = `rgba(253, 230, 138, ${a})`;
          ctx.fillStyle = `rgba(253, 230, 138, ${a * 0.25})`;
          ctx.beginPath();
          ctx.arc(x, b.y, b.r, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = `rgba(255, 255, 255, ${a})`;
          ctx.beginPath();
          ctx.arc(x - b.r * 0.35, b.y - b.r * 0.35, b.r * 0.25, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      if (showStreamers) drawStreamers(t);

      vignette(ctx, w, h, "245, 158, 11", (stage >= 3 ? 0.055 : 0.035) + 0.015 * Math.sin(t * 1.3));
    },
  };
}
