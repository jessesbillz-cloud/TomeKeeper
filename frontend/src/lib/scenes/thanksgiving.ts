/**
 * Thanksgiving, Nov 12 → the 4th Thursday — five stages (see
 * THANKSGIVING_STAGES in ../holidays.ts):
 *
 *   0 first-leaves   a few hand-drawn maple and oak leaves tumbling down
 *   1 harvest        + pumpkins, gourds, a hay bale and a corn shock in the
 *                      bottom-left corner
 *   2 turkey-trot    + a turkey strutting along the bottom, head bobbing
 *   3 pies           + a lattice pie cooling with steam; a second turkey
 *   4 thanksgiving   + the cornucopia, a few more leaves, warm amber glow
 *
 * Background-level throughout (see the rules in kit.ts): the leaves are
 * sparse and faint, and everything solid lives on the bottom strip, clear of
 * the "+ Sale" button.
 */

import {
  drawCornucopia,
  drawHarvest,
  drawLeaf,
  drawPie,
  drawTurkey,
  LEAF_COLORS,
} from "./harvest-cast";
import {
  type Drifter,
  type Scene,
  groundY,
  rand,
  softLayer,
  spawnDrifter,
  stepDrifter,
  trimFor,
  vignette,
} from "./kit";

const SOFT = {
  leaves: 0.55,
  harvest: 0.8,
  figures: 0.85,
};

/** Keep solid things out of the bottom-right, where "+ Sale" sits. */
const FAB_CLEAR = 104;

interface Turkey {
  x: number;
  dir: 1 | -1;
  speed: number;
  step: number;
  pause: number;
  nextPause: number;
}

export function createThanksgivingScene(
  ctx: CanvasRenderingContext2D,
  stage: number,
): Scene {
  const showHarvest = stage >= 1;
  const turkeyCount = stage >= 3 ? 2 : stage >= 2 ? 1 : 0;
  const showPie = stage >= 3;
  const showCornucopia = stage >= 4;

  let W = 0;
  let H = 0;
  let leaves: Drifter[] = [];
  let turkeys: Turkey[] = [];

  function layout(w: number, h: number) {
    W = w;
    H = h;
    const trim = trimFor(w);
    leaves = Array.from({ length: trim([7, 8, 9, 9, 12][stage] ?? 8) }, () =>
      spawnDrifter(w, h, true, LEAF_COLORS, [9, 14], [16, 30], 2),
    );
    const right = Math.max(140, w - FAB_CLEAR - 30);
    turkeys = Array.from({ length: turkeyCount }, (_, i) => ({
      x: i === 0 ? right * 0.55 : right * 0.85,
      dir: (i === 0 ? 1 : -1) as 1 | -1,
      speed: rand(13, 19),
      step: Math.random() * 6,
      pause: 0,
      nextPause: rand(4, 9),
    }));
  }

  return {
    frame(dt, t, w, h) {
      if (w !== W || h !== H) layout(w, h);
      const ground = groundY(h) + 6;

      // Leaves: tumble as they fall (the flip squashes them edge-on).
      for (const d of leaves) {
        const x = stepDrifter(d, dt, w, h);
        const flip = Math.cos(t * 1.6 + d.phase * 2);
        ctx.globalAlpha = SOFT.leaves;
        drawLeaf(ctx, x, d.y, d.size, d.angle, flip, d.color, d.kind);
      }
      ctx.globalAlpha = 1;

      if (showHarvest) {
        const s = Math.max(48, Math.min(70, h * 0.08));
        softLayer(ctx, SOFT.harvest, 0, ground - s * 1.25, s * 1.35, s * 1.35, (c) =>
          drawHarvest(c, 6, ground, s, t),
        );
      }

      if (showCornucopia) {
        const cw = Math.max(80, Math.min(120, w * 0.25));
        const cx = Math.max(cw * 0.6 + 70, w * 0.4);
        softLayer(ctx, SOFT.figures, cx - cw * 0.6, ground - cw * 0.5, cw * 1.25, cw * 0.55, (c) =>
          drawCornucopia(c, cx, ground, cw, 1),
        );
      }

      if (showPie) {
        const pw = Math.max(36, Math.min(52, w * 0.11));
        const px = Math.min(w - FAB_CLEAR - pw * 0.6, w * (showCornucopia ? 0.66 : 0.52));
        softLayer(ctx, SOFT.figures, px - pw * 0.6, ground - pw * 1.75, pw * 1.2, pw * 1.8, (c) =>
          drawPie(c, px, ground, pw, t),
        );
      }

      // Turkeys strut back and forth along the bottom, stopping now and
      // then, turning at the edges — never into the "+ Sale" corner.
      const th = Math.max(44, Math.min(62, h * 0.075));
      const left = th * 0.5;
      const right = Math.max(left + 60, w - FAB_CLEAR - th * 0.5);
      for (const tk of turkeys) {
        if (tk.pause > 0) {
          tk.pause -= dt;
          tk.step += dt * 2;
        } else {
          tk.x += tk.dir * tk.speed * dt;
          tk.step += (tk.speed * dt) / (th * 0.09);
          tk.nextPause -= dt;
          if (tk.nextPause <= 0) {
            tk.pause = rand(1.2, 2.6);
            tk.nextPause = rand(5, 10);
          }
        }
        if (tk.x > right) {
          tk.x = right;
          tk.dir = -1;
        } else if (tk.x < left) {
          tk.x = left;
          tk.dir = 1;
        }
        const x = tk.x;
        softLayer(ctx, SOFT.figures, x - th * 0.6, ground - th * 1.0, th * 1.2, th * 1.05, (c) =>
          drawTurkey(c, x, ground, th, tk.dir, tk.step, tk.pause > 0),
        );
      }

      vignette(
        ctx,
        w,
        h,
        "217, 119, 6",
        (showCornucopia ? 0.06 : 0.035) + 0.015 * Math.sin(t * 1.1),
      );
    },
  };
}
