/**
 * Valentine's, Feb 8 → 14 — three stages (VALENTINES_STAGES in
 * ../holidays.ts):
 *
 *   0 hearts        faint inked hearts float upward, swaying
 *   1 love-letters  + now and then a sealed envelope drifts down
 *   2 valentines    Feb 14. + a little cupid flies across every so often,
 *                   and a few roses stand in the bottom-left corner
 *
 * Background-level (DESIGN RULES in ./kit.ts): hearts are small and faint,
 * one or two letters at a time, the cupid is a quick pass.
 */

import {
  type Scene,
  groundY,
  inked,
  pick,
  rand,
  softLayer,
  trimFor,
  vignette,
} from "./kit";
import { drawCupid, drawEnvelope, drawRose, heartPath } from "./party-cast";

const HEART_COLORS = ["#f472b6", "#fb7185", "#e11d48", "#f9a8d4", "#ec4899"];

const SOFT = {
  hearts: 0.55,
  letters: 0.75,
  cupid: 0.8,
  roses: 0.85,
};

interface Heart {
  x: number;
  y: number;
  size: number;
  speed: number;
  sway: number;
  phase: number;
  color: string;
  alpha: number;
}

interface Letter {
  x: number;
  y: number;
  w: number;
  speed: number;
  phase: number;
}

interface Cupid {
  x: number;
  y: number;
  vx: number;
  size: number;
}

export function createValentinesScene(
  ctx: CanvasRenderingContext2D,
  stage: number,
): Scene {
  const showLetters = stage >= 1;
  const theDay = stage >= 2;

  let W = 0;
  let H = 0;
  let hearts: Heart[] = [];
  const letters: Letter[] = [];
  let nextLetter = 1;
  let cupid: Cupid | null = null;
  let nextCupid = 1.2;
  let roseSeeds: number[] = [];

  function spawnHeart(initial: boolean): Heart {
    return {
      x: Math.random() * W,
      y: initial ? Math.random() * H : H + 20,
      size: rand(7, 15),
      speed: rand(12, 26),
      sway: rand(6, 18),
      phase: Math.random() * Math.PI * 2,
      color: pick(HEART_COLORS),
      alpha: rand(0.55, 1),
    };
  }

  function layout(w: number, h: number) {
    W = w;
    H = h;
    const trim = trimFor(w);
    hearts = Array.from({ length: trim([14, 14, 16][stage] ?? 14) }, () =>
      spawnHeart(true),
    );
    roseSeeds = [0.3, 1.7, 3.1];
  }

  return {
    frame(dt, t, w, h) {
      if (w !== W || h !== H) layout(w, h);

      // Hearts drift up — faint, so they never fight the calendar.
      for (let i = 0; i < hearts.length; i++) {
        const p = hearts[i];
        p.y -= p.speed * dt;
        p.phase += dt;
        if (p.y < -20) {
          hearts[i] = spawnHeart(false);
          continue;
        }
        const x = p.x + Math.sin(p.phase) * p.sway;
        ctx.save();
        ctx.globalAlpha = SOFT.hearts * p.alpha;
        ctx.translate(x, p.y);
        ctx.rotate(Math.sin(p.phase * 0.8) * 0.25);
        heartPath(ctx, 0, 0, p.size);
        inked(ctx, p.color, Math.max(0.8, p.size * 0.08));
        ctx.restore();
      }

      // Love letters, one or two at a time, see-sawing down.
      if (showLetters) {
        nextLetter -= dt;
        if (nextLetter <= 0 && letters.length < 2) {
          letters.push({
            x: rand(w * 0.1, w * 0.75),
            y: -30,
            w: Math.max(22, Math.min(32, w * 0.07)),
            speed: rand(22, 32),
            phase: Math.random() * Math.PI * 2,
          });
          nextLetter = rand(6, 10);
        }
        for (let i = letters.length - 1; i >= 0; i--) {
          const l = letters[i];
          l.y += l.speed * dt;
          l.phase += dt * 1.4;
          if (l.y > h + 30) {
            letters.splice(i, 1);
            continue;
          }
          // Falling-leaf motion: swing side to side, tilting into the swing.
          const lx = l.x + Math.sin(l.phase) * 26;
          const ang = Math.cos(l.phase) * 0.35;
          softLayer(ctx, SOFT.letters, lx - l.w, l.y - l.w, l.w * 2, l.w * 2, (c) =>
            drawEnvelope(c, lx, l.y, l.w, ang),
          );
        }
      }

      if (theDay) {
        // Cupid: a quick pass high across the sky now and then.
        nextCupid -= dt;
        if (!cupid && nextCupid <= 0) {
          const dir = Math.random() < 0.5 ? 1 : -1;
          const size = Math.max(34, Math.min(50, w * 0.1));
          cupid = {
            x: dir === 1 ? -size : w + size,
            y: h * rand(0.2, 0.32),
            vx: dir * rand(60, 80),
            size,
          };
        }
        if (cupid) {
          const c0 = cupid;
          c0.x += c0.vx * dt;
          const S = c0.size;
          softLayer(ctx, SOFT.cupid, c0.x - S * 0.9, c0.y - S * 0.8, S * 1.8, S * 1.4, (c) =>
            drawCupid(c, c0.x, c0.y, S, c0.vx < 0 ? -1 : 1, t),
          );
          if (c0.x < -S * 1.5 || c0.x > w + S * 1.5) {
            cupid = null;
            nextCupid = rand(12, 18);
          }
        }

        // Roses, bottom-left.
        const ground = groundY(h) + 6;
        const rh = Math.max(46, Math.min(66, h * 0.075));
        softLayer(ctx, SOFT.roses, 0, ground - rh * 1.3, rh * 1.6, rh * 1.4, (c) => {
          for (let i = 0; i < 3; i++) {
            drawRose(c, 14 + i * rh * 0.32, ground, rh * (1 - i * 0.12), t, roseSeeds[i]);
          }
        });
      }

      vignette(ctx, w, h, "225, 29, 72", (theDay ? 0.06 : 0.04) + 0.015 * Math.sin(t * 1.4));
    },
  };
}
