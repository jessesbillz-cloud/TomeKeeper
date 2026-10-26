/**
 * Christmas, the day after Thanksgiving → Dec 25 — eight stages (see
 * CHRISTMAS_STAGES in ../holidays.ts), each adding to the last:
 *
 *   0 first-snow     sparse, faint snowfall
 *   1 lights         + a string of bulbs swagging from the top corners;
 *                      a thin drift of snow starts collecting at the bottom
 *   2 tree           + a bare tree, bottom-left, standing in the snow bank
 *   3 snowman        + a snowman with scarf and beanie, waving
 *   4 trimming       tree gets garland, ornaments and a glowing gold star;
 *                      two presents appear under it
 *   5 reindeer       + a winter moon; now and then a few reindeer leap past
 *   6 christmas-eve  Santa's sleigh and team cross in front of the moon
 *   7 christmas      everything: more snow, more presents, the tree lit up
 *
 * Background-level throughout (see DESIGN RULES in ./kit.ts): ground figures
 * share one soft layer along the bottom-left, the sky pass shares another,
 * and the middle of the screen only ever gets faint snow.
 */

import {
  XMAS_GOLD,
  XMAS_RED,
  drawLightString,
  drawPresent,
  drawReindeer,
  drawSleigh,
  drawSnowman,
  drawTree,
  drawWinterMoon,
  makeFlakeSprite,
} from "./christmas-cast";
import {
  type Drifter,
  type Scene,
  rand,
  softLayer,
  spawnDrifter,
  stepDrifter,
  trimFor,
  vignette,
} from "./kit";

/** Layer strengths — same spirit as SOFT in ./veterans.ts. */
const SOFT = {
  snow: 0.8,
  bank: 0.3,
  lights: 0.8,
  ground: 0.85,
  moon: 0.55,
  sky: 0.7,
};

const SNOW_COUNTS = [20, 22, 24, 26, 28, 28, 30, 38];

interface Pass {
  x: number;
  speed: number;
}

export function createChristmasScene(
  ctx: CanvasRenderingContext2D,
  stage: number,
): Scene {
  const st = Math.max(0, Math.min(7, Math.floor(stage)));
  const showLights = st >= 1;
  const showTree = st >= 2;
  const showSnowman = st >= 3;
  const trimmed = st >= 4;
  const showMoon = st >= 5;
  const reindeerOnly = st === 5;
  const showSleigh = st >= 6;
  const lit = st === 7;
  const presentCount = st >= 7 ? 4 : st >= 4 ? 2 : 0;

  let W = 0;
  let H = 0;
  let snow: Drifter[] = [];
  let flake: HTMLCanvasElement | null = null;
  let bumps: number[] = [];

  let pass: Pass | null = null;
  let nextPass = 1.0;

  function layout(w: number, h: number) {
    W = w;
    H = h;
    const trim = trimFor(w);
    snow = Array.from({ length: trim(SNOW_COUNTS[st]) }, () =>
      // kind 0 = soft dot, kind 1 = drawn flake
      spawnDrifter(w, h, true, ["#ffffff"], [1.5, 4.5], [14, 32], 2),
    );
    flake = makeFlakeSprite(12);
    bumps = Array.from({ length: 7 }, () => Math.random() * Math.PI * 2);
  }

  /**
   * Flight path: a nearly level line along the header's nav row, with a
   * gentle lift, ending across the moon. Kept low enough that the team
   * doesn't sit on the app title for long.
   */
  function pathY(x: number, moonY: number): number {
    const f = Math.min(1, Math.max(0, x / W));
    return moonY + 10 - 8 * Math.sin(Math.PI * f);
  }

  function drawSnowBank(h: number) {
    const bankH = st === 0 ? 0 : st === 1 ? 8 : 16;
    if (bankH === 0) return;
    const top = h - bankH;
    ctx.save();
    ctx.globalAlpha = SOFT.bank;
    ctx.fillStyle = "#f1f5f9";
    ctx.beginPath();
    ctx.moveTo(0, h);
    ctx.lineTo(0, top + 3);
    const n = bumps.length;
    for (let i = 0; i < n; i++) {
      const x0 = (W * i) / n;
      const x1 = (W * (i + 1)) / n;
      ctx.quadraticCurveTo(
        (x0 + x1) / 2,
        top - 4 - Math.sin(bumps[i]) * 3,
        x1,
        top + 3,
      );
    }
    ctx.lineTo(W, h);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawGround(t: number, w: number, h: number) {
    if (!showTree && !showSnowman) return;
    const base = h - 9;
    const treeH = Math.max(84, Math.min(120, h * 0.15));
    const treeX = Math.max(44, w * 0.14);
    const manH = Math.max(58, Math.min(80, h * 0.1));
    const manX = w * 0.42;
    const top = base - treeH - 20;
    softLayer(ctx, SOFT.ground, 0, top, Math.min(w, w * 0.62), h - top, (c) => {
      if (showTree) drawTree(c, treeX, base, treeH, t, { trimmed, lit });
      if (showSnowman) drawSnowman(c, manX, base + 2, manH, t, -1);
      const pw = Math.max(16, treeH * 0.2);
      const gifts: Array<[number, number, number, string, string]> = [
        // x, width, height, paper, ribbon
        [treeX + treeH * 0.3, pw, pw * 0.8, XMAS_RED, XMAS_GOLD],
        [treeX + treeH * 0.5, pw * 0.8, pw * 1.05, "#2563eb", "#f8fafc"],
        [treeX - treeH * 0.24, pw * 0.9, pw * 0.7, "#f472b6", "#fef3c7"],
        [manX + manH * 0.42, pw * 0.85, pw * 0.75, "#16a34a", XMAS_RED],
      ];
      for (let i = 0; i < presentCount; i++) {
        const [gx, gw, gh, paper, ribbon] = gifts[i];
        drawPresent(c, gx, base + 2, gw, gh, paper, ribbon);
      }
    });
  }

  function drawSky(dt: number, t: number, w: number, moonY: number) {
    if (!reindeerOnly && !showSleigh) return;
    nextPass -= dt;
    const R = Math.max(30, Math.min(44, w * 0.09));
    const S = Math.max(42, Math.min(60, w * 0.12));
    if (!pass && nextPass <= 0) {
      pass = { x: -R, speed: Math.max(110, w * 0.3) };
    }
    if (!pass) return;
    pass.x += pass.speed * dt;
    const p = pass;
    const gap = reindeerOnly ? R * 1.15 : R * 0.82;
    const team = reindeerOnly ? 3 : 4;
    const sleighX = p.x - (team - 1) * gap - R * 0.5 - S * 0.55;
    const bandTop = Math.max(0, moonY - 70);
    softLayer(ctx, SOFT.sky, 0, bandTop, w, 150, (c) => {
      const deer: Array<[number, number]> = [];
      for (let i = 0; i < team; i++) {
        const dx = p.x - i * gap;
        const lift = reindeerOnly ? (i % 2 === 0 ? -6 : 6) : 0;
        deer.push([dx, pathY(dx, moonY) + lift + Math.sin(t * 5 + i) * 2]);
      }
      if (showSleigh) {
        const sy = pathY(sleighX, moonY) + 4;
        // Reins and the harness line, drawn under the figures.
        const hand = sleighHand(sleighX, sy, S);
        c.strokeStyle = "rgba(120, 53, 15, 0.9)";
        c.lineWidth = 1.1;
        c.beginPath();
        c.moveTo(hand[0], hand[1]);
        for (let i = deer.length - 1; i >= 0; i--) {
          c.lineTo(deer[i][0] + R * 0.15, deer[i][1] - R * 0.02);
        }
        c.stroke();
        drawSleigh(c, sleighX, sy, S, 1, t);
      }
      for (let i = deer.length - 1; i >= 0; i--) {
        drawReindeer(c, deer[i][0], deer[i][1], R, 1, t, i * 1.3, showSleigh);
      }
    });
    const tail = showSleigh ? sleighX - S * 0.6 : p.x - (team - 1) * gap - R * 0.5;
    if (tail > w + 10) {
      pass = null;
      nextPass = rand(16, 24);
    }
  }

  /** Where Santa's rein hand is for a sleigh at (x, y) — mirrors drawSleigh. */
  function sleighHand(x: number, y: number, S: number): [number, number] {
    return [x + 0.12 * S, y - 0.32 * S];
  }

  return {
    frame(dt, t, w, h) {
      if (w !== W || h !== H || !flake) layout(w, h);

      // Up in the header's right corner, behind the string of lights —
      // clear of the banner and the calendar.
      const moonR = Math.max(15, Math.min(24, w * 0.045));
      const moonX = w - moonR - 30;
      const moonY = moonR + 30;

      if (showMoon) {
        const glow = st === 6 ? 1.4 : 1;
        softLayer(
          ctx,
          SOFT.moon,
          moonX - moonR * 3,
          moonY - moonR * 3,
          moonR * 6,
          moonR * 6,
          (c) => drawWinterMoon(c, moonX, moonY, moonR, glow),
        );
      }

      drawSky(dt, t, w, moonY);

      // Snowfall: soft dots and a few drawn flakes, faint.
      for (const d of snow) {
        const x = stepDrifter(d, dt, w, h);
        const a = SOFT.snow * (0.6 + 0.4 * Math.sin(d.phase * 1.3 + 1));
        if (d.kind === 1 && flake && d.size > 2.5) {
          const s = d.size * 2.8;
          ctx.save();
          ctx.globalAlpha = a;
          ctx.translate(x, d.y);
          ctx.rotate(d.angle * 0.4);
          ctx.drawImage(flake, -s / 2, -s / 2, s, s);
          ctx.restore();
        } else {
          ctx.globalAlpha = a * 0.9;
          ctx.fillStyle = "#ffffff";
          ctx.beginPath();
          ctx.arc(x, d.y, d.size * 0.62, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 1;
        }
      }

      drawSnowBank(h);
      drawGround(t, w, h);

      if (showLights) {
        softLayer(ctx, SOFT.lights, 0, 0, w, 48, (c) => drawLightString(c, w, t));
      }

      // Edge glow: cool and wintry; warm gold on Christmas Day.
      if (lit) {
        vignette(ctx, w, h, "251, 191, 36", 0.035 + 0.012 * Math.sin(t * 1.3));
      } else {
        vignette(ctx, w, h, "148, 197, 253", 0.035 + 0.01 * Math.sin(t * 1.1));
      }
    },
  };
}
