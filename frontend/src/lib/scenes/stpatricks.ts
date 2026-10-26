/**
 * St. Patrick's, Mar 15–17 — two stages (see ST_PATRICKS_STAGES in
 * ../holidays.ts):
 *
 *   0 lucky        faint inked shamrocks drifting down, a few gold coins
 *                  tumbling and glinting
 *   1 St. Patrick  + a very soft rainbow arcing down to a pot of gold in the
 *                  bottom-left corner
 */

import {
  type Scene,
  groundY,
  pick,
  rand,
  softLayer,
  trimFor,
  vignette,
} from "./kit";
import { sparkle } from "./patriotic";
import {
  SHAMROCK_GREENS,
  drawCoin,
  drawPotOfGold,
  drawRainbow,
  drawShamrock,
} from "./spring-cast";

/** Background-level strengths — see DESIGN RULES in kit.ts. */
const SOFT = {
  shamrocks: 0.5,
  coins: 0.7,
  rainbow: 0.16,
  pot: 0.88,
};

interface Leaf {
  x: number;
  y: number;
  size: number;
  speed: number;
  sway: number;
  phase: number;
  rot: number;
  spin: number;
  color: string;
}

interface Coin {
  x: number;
  y: number;
  r: number;
  speed: number;
  spin: number;
  spinRate: number;
  phase: number;
}

export function createStPatricksScene(
  ctx: CanvasRenderingContext2D,
  stage: number,
): Scene {
  const showPot = stage >= 1;
  let W = 0;
  let H = 0;
  let leaves: Leaf[] = [];
  let coins: Coin[] = [];

  function spawnLeaf(initial: boolean): Leaf {
    return {
      x: Math.random() * W,
      y: initial ? Math.random() * H : -20,
      size: rand(15, 22),
      speed: rand(12, 26),
      sway: rand(8, 22),
      phase: Math.random() * Math.PI * 2,
      rot: Math.random() * Math.PI * 2,
      spin: (Math.random() - 0.5) * 1.2,
      color: pick(SHAMROCK_GREENS),
    };
  }

  function spawnCoin(initial: boolean): Coin {
    return {
      x: rand(20, W - 20),
      y: initial ? Math.random() * H : -16,
      r: rand(5, 7.5),
      speed: rand(16, 30),
      spin: Math.random() * Math.PI * 2,
      spinRate: rand(2.5, 5),
      phase: Math.random() * Math.PI * 2,
    };
  }

  function layout(w: number, h: number) {
    W = w;
    H = h;
    const trim = trimFor(w);
    leaves = Array.from({ length: trim(showPot ? 12 : 10) }, () => spawnLeaf(true));
    coins = Array.from({ length: trim(4) }, () => spawnCoin(true));
  }

  return {
    frame(dt, t, w, h) {
      if (w !== W || h !== H) layout(w, h);
      const ground = groundY(h);
      const potX = Math.max(46, w * 0.15);
      const potW = Math.max(54, Math.min(76, w * 0.17));

      // Rainbow first, so everything else sits over it. Centred off to the
      // right so the arc rises from the pot and leaves off the right edge.
      if (showPot) {
        const cx = w * 0.98;
        const cy = ground - potW * 0.5;
        const r = cx - potX + potW * 0.15;
        ctx.save();
        ctx.globalAlpha = SOFT.rainbow * (0.85 + 0.15 * Math.sin(t * 0.8));
        drawRainbow(ctx, cx, cy, r, Math.max(4, w * 0.012), Math.PI, Math.PI * 1.62);
        ctx.restore();
      }

      for (const l of leaves) {
        l.y += l.speed * dt;
        l.phase += dt;
        l.rot += l.spin * dt;
        if (l.y > h + 24) Object.assign(l, spawnLeaf(false));
        const x = l.x + Math.sin(l.phase) * l.sway;
        const s = l.size;
        softLayer(ctx, SOFT.shamrocks, x - s, l.y - s, s * 2, s * 2, (c) =>
          drawShamrock(c, x, l.y, s, l.rot, l.color),
        );
      }

      ctx.save();
      ctx.globalAlpha = SOFT.coins;
      for (const c of coins) {
        c.y += c.speed * dt;
        c.spin += c.spinRate * dt;
        c.phase += dt;
        if (c.y > h + 20) Object.assign(c, spawnCoin(false));
        const x = c.x + Math.sin(c.phase * 0.8) * 6;
        drawCoin(ctx, x, c.y, c.r, c.spin);
        // Glint when the coin faces us.
        const face = Math.cos(c.spin);
        if (face > 0.93) sparkle(ctx, x + c.r * 0.3, c.y - c.r * 0.3, c.r * 1.3, (face - 0.93) * 12);
      }
      ctx.restore();

      if (showPot) {
        softLayer(ctx, SOFT.pot, potX - potW * 0.7, ground - potW * 1.1, potW * 1.4, potW * 1.2, (c) =>
          drawPotOfGold(c, potX, ground + 4, potW),
        );
        // Glints on the heap.
        for (let i = 0; i < 3; i++) {
          const tw = Math.max(0, Math.sin(t * 2.2 + i * 2.3));
          if (tw < 0.1) continue;
          sparkle(
            ctx,
            potX + (i - 1) * potW * 0.22,
            ground + 4 - potW * (0.8 + 0.1 * (i % 2)),
            potW * 0.08 * (0.6 + tw),
            tw * 0.85,
          );
        }
      }

      vignette(ctx, w, h, "34, 197, 94", 0.035 + 0.01 * Math.sin(t * 1.1));
    },
  };
}
