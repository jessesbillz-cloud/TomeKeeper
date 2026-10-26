/**
 * Janelle's birthday, Feb 27 → Mar 12 — five stages (BIRTHDAY_STAGES in
 * ../holidays.ts), each adding to the last:
 *
 *   0 balloons   a few balloons drift up the side edges, strings wavering
 *   1 bunting    + pennant bunting swagged from the two top corners
 *   2 presents   + a little stack of wrapped presents, bottom-left
 *   3 cake       + her cake: a stack of books, iced, candles on top (unlit)
 *   4 birthday   Mar 12. Candles lit, confetti poppers going off from the
 *                bottom corners now and then, more balloons
 *
 * Background-level throughout (see DESIGN RULES in ./kit.ts): figures are
 * small and faded with softLayer, solid things stay on the edges, the
 * middle of the screen and the "+ Sale" corner stay clear. The words live
 * in the banner, not on the canvas.
 */

import {
  type Scene,
  ease,
  groundY,
  pick,
  rand,
  softLayer,
  trimFor,
  vignette,
} from "./kit";
import {
  drawBalloon,
  drawBookCake,
  drawPennants,
  drawPresent,
} from "./party-cast";
import { sparkle } from "./patriotic";

const BALLOON_COLORS = ["#f472b6", "#ec4899", "#d946ef", "#fbbf24", "#f9a8d4", "#c084fc"];
const PENNANT_COLORS = ["#ec4899", "#fbbf24", "#f9a8d4", "#d946ef", "#fdf2f8"];
const CONFETTI = ["#f472b6", "#fbbf24", "#a78bfa", "#34d399", "#60a5fa", "#fdf2f8"];

/** Same idea as veterans.ts: everything stays in the background. */
const SOFT = {
  balloons: 0.7,
  pennants: 0.7,
  presents: 0.85,
  cake: 0.88,
  confetti: 0.75,
};

interface Balloon {
  x: number;
  y: number;
  r: number;
  speed: number;
  sway: number;
  seed: number;
  color: string;
  /** Right-side balloons start above the "+ Sale" button and fade in. */
  fadeFrom: number;
}

interface Bit {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  angle: number;
  spin: number;
  life: number;
  color: string;
  round: boolean;
}

export function createBirthdayScene(
  ctx: CanvasRenderingContext2D,
  stage: number,
): Scene {
  const showPennants = stage >= 1;
  const showPresents = stage >= 2;
  const showCake = stage >= 3;
  const party = stage >= 4;

  let W = 0;
  let H = 0;
  let balloons: Balloon[] = [];
  const bits: Bit[] = [];
  let nextPop = 1.2;
  let popSide = 0;

  function spawnBalloon(initial: boolean): Balloon {
    const left = Math.random() < 0.5;
    const r = Math.max(9, Math.min(15, W * 0.03)) * rand(0.85, 1.15);
    const x = left ? rand(r + 4, W * 0.16) : rand(W * 0.84, W - r - 4);
    // Right-hand balloons appear above the "+ Sale" button rather than
    // floating up through it.
    const startY = left ? H + r * 4 : H - 130;
    return {
      x,
      y: initial ? rand(H * 0.1, startY) : startY,
      r,
      speed: rand(10, 20),
      sway: rand(4, 10),
      seed: Math.random() * 10,
      color: pick(BALLOON_COLORS),
      fadeFrom: left ? H + r * 4 : startY,
    };
  }

  function layout(w: number, h: number) {
    W = w;
    H = h;
    const trim = trimFor(w);
    const n = trim(party ? 9 : stage >= 2 ? 6 : 5);
    balloons = Array.from({ length: n }, () => spawnBalloon(true));
  }

  /** A confetti popper firing up and inward from a bottom corner. */
  function pop(side: number) {
    const fromLeft = side === 0;
    // Left fires from just above the presents; right from above "+ Sale".
    const ox = fromLeft ? 8 : W - 8;
    const oy = fromLeft ? H * 0.72 : H - 130;
    const n = Math.round(trimFor(W)(26));
    for (let i = 0; i < n; i++) {
      const a = (fromLeft ? -1.0 : -Math.PI + 1.0) + rand(-0.4, 0.4);
      const v = rand(140, 260);
      bits.push({
        x: ox,
        y: oy,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v,
        size: rand(4, 7),
        angle: Math.random() * Math.PI,
        spin: rand(-8, 8),
        life: rand(2.6, 3.6),
        color: pick(CONFETTI),
        round: Math.random() < 0.3,
      });
    }
  }

  return {
    frame(dt, t, w, h) {
      if (w !== W || h !== H) layout(w, h);
      const ground = groundY(h) + 6;

      // Balloons along the side edges.
      for (let i = 0; i < balloons.length; i++) {
        const b = balloons[i];
        b.y -= b.speed * dt;
        if (b.y < -b.r * 6) {
          balloons[i] = spawnBalloon(false);
          continue;
        }
        const x = b.x + Math.sin(t * 0.8 + b.seed) * b.sway;
        const fadeIn = ease((b.fadeFrom - b.y) / 50);
        softLayer(ctx, SOFT.balloons * fadeIn, x - b.r * 1.6, b.y - b.r * 1.4, b.r * 3.2, b.r * 5.6, (c) =>
          drawBalloon(c, x, b.y, b.r, b.color, t, b.seed),
        );
      }

      if (showPennants) {
        const size = Math.max(10, Math.min(16, w * 0.035));
        softLayer(ctx, SOFT.pennants, 0, 0, w, size + 30, (c) => {
          drawPennants(c, -4, 4, w * 0.34, 2, 9, Math.max(4, Math.round(w / 80)), size, PENNANT_COLORS, t);
          drawPennants(c, w * 0.66, 2, w + 4, 4, 9, Math.max(4, Math.round(w / 80)), size, PENNANT_COLORS, t + 1.7);
        });
      }

      // Presents, bottom-left.
      if (showPresents) {
        const pw = Math.max(26, Math.min(40, w * 0.08));
        const px = 12 + pw * 0.75;
        softLayer(ctx, SOFT.presents, 0, ground - pw * 2.4, px + pw * 1.3, pw * 2.5, (c) => {
          drawPresent(c, px, ground, pw * 1.3, pw * 1.0, "#be185d", "#fde68a", t, 1);
          drawPresent(c, px + pw * 0.15, ground - pw * 0.9, pw * 0.95, pw * 0.75, "#7c3aed", "#f9a8d4", t, 2);
          drawPresent(c, px + pw * 1.25, ground, pw * 0.8, pw * 0.7, "#0e7490", "#fbcfe8", t, 3);
        });
      }

      // The book cake, just right of the presents.
      if (showCake) {
        const cw = Math.max(58, Math.min(84, w * 0.17));
        const cx = Math.max(12 + cw * 2.4, w * 0.36);
        const lit = party ? ease((t - 0.4) / 0.8) : 0;
        softLayer(ctx, SOFT.cake, cx - cw * 0.75, ground - cw * 1.25, cw * 1.5, cw * 1.3, (c) =>
          drawBookCake(c, cx, ground, cw, t, lit),
        );
        if (party) {
          for (let i = 0; i < 4; i++) {
            const tw = Math.max(0, Math.sin(t * 2.4 + i * 1.9));
            if (tw < 0.1) continue;
            const a = i * 1.6 + t * 0.4;
            sparkle(
              ctx,
              cx + Math.cos(a) * cw * 0.7,
              ground - cw * 0.75 + Math.sin(a * 1.3) * cw * 0.35,
              (2 + 3 * tw) * (cw / 70),
              tw * 0.7,
            );
          }
        }
      }

      // Confetti poppers on the day itself.
      if (party) {
        nextPop -= dt;
        if (nextPop <= 0) {
          pop(popSide);
          popSide = 1 - popSide;
          nextPop = rand(4, 6.5);
        }
      }
      for (let i = bits.length - 1; i >= 0; i--) {
        const p = bits[i];
        p.life -= dt;
        if (p.life <= 0 || p.y > h + 20) {
          bits.splice(i, 1);
          continue;
        }
        // Air drag, gravity, and a flutter once they're falling.
        const drag = Math.pow(0.35, dt);
        p.vx *= drag;
        p.vy = p.vy * drag + 140 * dt;
        if (p.vy > 45) p.vy = 45;
        p.x += (p.vx + (p.vy > 0 ? Math.sin(t * 4 + p.angle) * 18 : 0)) * dt;
        p.y += p.vy * dt;
        p.angle += p.spin * dt;
        ctx.save();
        ctx.globalAlpha = SOFT.confetti * Math.min(1, p.life / 0.8);
        ctx.translate(p.x, p.y);
        ctx.rotate(p.angle);
        ctx.fillStyle = p.color;
        if (p.round) {
          ctx.beginPath();
          ctx.arc(0, 0, p.size * 0.35, 0, Math.PI * 2);
          ctx.fill();
        } else {
          // Squash on one axis as it tumbles — reads as a paper flake.
          ctx.fillRect(-p.size / 2, (-p.size / 4) * Math.abs(Math.cos(p.angle * 1.7)), p.size, (p.size / 2) * Math.abs(Math.cos(p.angle * 1.7)) + 0.6);
        }
        ctx.restore();
      }

      vignette(ctx, w, h, "236, 72, 153", (party ? 0.06 : 0.04) + 0.015 * Math.sin(t * 1.3));
    },
  };
}
