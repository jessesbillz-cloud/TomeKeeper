/**
 * Veterans week, Nov 4–11 — five stages (see VETERANS_STAGES in
 * ../holidays.ts):
 *
 *   0 colors          the flag is raised on its pole; stars drift down
 *   1 flag-line       + a row of little flags along the bottom edge
 *   2 fly-over        + a three-ship formation trailing red, white and blue
 *   3 Marine Corps    Nov 10. Scarlet-and-gold bunting, the birthday cake
 *     birthday        with the sword, a Marine in dress blues saluting,
 *                     scarlet and gold confetti, fly-overs
 *   4 Veterans Day    Nov 11. Everything from 0–2, plus a bald eagle and
 *                     the Marine saluting the flag line
 *
 * Every time the screen opens, the main flag runs up the pole over a couple
 * of seconds — a small "colors" moment rather than it just being there.
 */

import { makeFlag, type WavingFlag } from "./flag";
import {
  type Drifter,
  type Scene,
  ease,
  groundY,
  rand,
  spawnDrifter,
  stepDrifter,
  trimFor,
  vignette,
} from "./kit";
import {
  GOLD,
  SCARLET,
  drawBirthdayCake,
  drawBunting,
  drawDriftStar,
  drawEagle,
  drawJet,
  drawMarine,
  drawPole,
} from "./patriotic";

const STAR_COLORS = ["#f8fafc", "#e2e8f0", "#fde68a"];
const MARINE_CONFETTI = [SCARLET, GOLD, GOLD, "#b91c1c", "#fbbf24"];
const TRAILS = ["239, 68, 68", "248, 250, 252", "59, 130, 246"];

interface Pass {
  x: number;
  y: number;
  len: number;
}

interface Eagle {
  x: number;
  y: number;
  vx: number;
  size: number;
  seed: number;
}

export function createVeteransScene(
  ctx: CanvasRenderingContext2D,
  stage: number,
): Scene {
  const marineDay = stage === 3;
  const vetsDay = stage === 4;
  const showMainFlag = !marineDay;
  const showFlagLine = (stage >= 1 && !marineDay) || vetsDay;
  const showJets = stage >= 2;
  const showEagle = vetsDay;
  const showMarine = marineDay || vetsDay;

  // Sized lazily on the first frame (and again if the screen size changes).
  let W = 0;
  let H = 0;
  let mainFlag: WavingFlag | null = null;
  let lineFlag: WavingFlag | null = null;
  let lineSeeds: number[] = [];
  let drift: Drifter[] = [];
  let eagle: Eagle | null = null;
  let eagleWait = 0;
  let firstEagle = true;

  let pass: Pass | null = null;
  let nextPass = 1.5;

  const age = marineDay
    ? `${new Date().getFullYear() - 1775}`
    : "";

  function layout(w: number, h: number) {
    W = w;
    H = h;
    const trim = trimFor(w);
    mainFlag = makeFlag(Math.max(84, Math.min(140, w * 0.24)));
    lineFlag = makeFlag(w < 480 ? 24 : 30);
    const n = Math.max(5, Math.min(16, Math.round(w / 44)));
    lineSeeds = Array.from({ length: n }, () => Math.random() * 6);
    drift = marineDay
      ? Array.from({ length: trim(28) }, () =>
          spawnDrifter(w, h, true, MARINE_CONFETTI, [7, 12], [26, 60], 2),
        )
      : Array.from({ length: trim([10, 14, 16, 0, 22][stage] ?? 12) }, () =>
          spawnDrifter(w, h, true, STAR_COLORS, [2.5, 6], [8, 22]),
        );
  }

  /** The first eagle starts already in the sky so it's seen right away. */
  function spawnEagle(initial = false): Eagle {
    const dir = initial ? 1 : Math.random() < 0.5 ? 1 : -1;
    const size = Math.max(70, Math.min(120, W * 0.2));
    return {
      x: initial ? W * 0.18 : dir === 1 ? -size : W + size,
      y: H * rand(0.26, 0.4),
      vx: dir * rand(34, 46),
      size,
      seed: Math.random() * 10,
    };
  }

  function drawFlagLine(t: number) {
    if (!lineFlag) return;
    const g = H - 6;
    const n = lineSeeds.length;
    const stick = lineFlag.height + 20;
    for (let i = 0; i < n; i++) {
      const x = ((i + 0.5) / n) * W - lineFlag.width * 0.3;
      ctx.fillStyle = "#cbd5e1";
      ctx.fillRect(x - 0.8, g - stick, 1.6, stick);
      ctx.fillStyle = "#fde68a";
      ctx.beginPath();
      ctx.arc(x, g - stick - 1.5, 1.8, 0, Math.PI * 2);
      ctx.fill();
      lineFlag.draw(ctx, x + 0.8, g - stick, t * 1.1, lineSeeds[i], 1.3);
    }
  }

  function drawPass(dt: number, t: number) {
    nextPass -= dt;
    if (!pass && nextPass <= 0) {
      const len = Math.max(26, Math.min(40, W * 0.075));
      pass = { x: -len * 2, y: H * rand(0.18, 0.26), len };
    }
    if (!pass) return;
    pass.x += Math.max(150, W * 0.38) * dt;
    const L = pass.len;
    // Leader in front, wingmen stacked behind — a V seen side-on.
    const ships: Array<[number, number]> = [
      [0, 0],
      [-1.15 * L, -0.55 * L],
      [-1.15 * L, 0.55 * L],
    ];
    const trailLen = Math.max(220, W * 0.6);
    for (let i = 0; i < ships.length; i++) {
      const sx = pass.x + ships[i][0];
      const sy = pass.y + ships[i][1];
      const tail = sx - L * 0.5;
      const from = tail - trailLen;
      const grad = ctx.createLinearGradient(from, 0, tail, 0);
      grad.addColorStop(0, `rgba(${TRAILS[i]}, 0)`);
      grad.addColorStop(1, `rgba(${TRAILS[i]}, 0.55)`);
      ctx.strokeStyle = grad;
      ctx.lineCap = "round";
      ctx.lineWidth = Math.max(4, L * 0.16);
      ctx.beginPath();
      for (let k = 0; k <= 16; k++) {
        const px = from + (trailLen * k) / 16;
        // Smoke billows a little more the older it is.
        const wob = Math.sin(px * 0.035 + t * 2 + i) * (1 - k / 16) * 3;
        if (k === 0) ctx.moveTo(px, sy + wob);
        else ctx.lineTo(px, sy + wob);
      }
      ctx.stroke();
    }
    for (let i = 0; i < ships.length; i++) {
      drawJet(ctx, pass.x + ships[i][0], pass.y + ships[i][1], L, 1, t + i);
    }
    if (pass.x - 1.7 * L - trailLen > W) {
      pass = null;
      nextPass = rand(14, 20);
    }
  }

  return {
    frame(dt, t, w, h) {
      if (w !== W || h !== H || !mainFlag) layout(w, h);
      const ground = groundY(h);

      // Sky first: drifting stars, or Marine-day confetti.
      for (const d of drift) {
        const x = stepDrifter(d, dt, w, h);
        if (marineDay) {
          ctx.save();
          ctx.translate(x, d.y);
          ctx.rotate(d.angle);
          ctx.globalAlpha = 0.9;
          ctx.fillStyle = d.color;
          if (d.kind === 0) {
            ctx.fillRect(-d.size / 2, -d.size / 5, d.size, d.size / 2.5);
          } else {
            ctx.beginPath();
            ctx.arc(0, 0, d.size / 3.2, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.restore();
        } else {
          const tw = 0.45 + 0.4 * Math.sin(t * 2.2 + d.phase * 3);
          drawDriftStar(ctx, x, d.y, d.size, d.angle, d.color, tw);
        }
      }

      if (showEagle) {
        eagleWait -= dt;
        if (!eagle && eagleWait <= 0) {
          eagle = spawnEagle(firstEagle);
          firstEagle = false;
        }
        if (eagle) {
          eagle.x += eagle.vx * dt;
          const bob = Math.sin(t * 0.7 + eagle.seed) * 10;
          drawEagle(
            ctx,
            eagle.x,
            eagle.y + bob,
            eagle.size,
            eagle.vx < 0 ? -1 : 1,
            t,
            eagle.seed,
          );
          if (eagle.x < -eagle.size * 1.5 || eagle.x > w + eagle.size * 1.5) {
            eagle = null;
            eagleWait = rand(4, 9);
          }
        }
      }

      if (showJets) drawPass(dt, t);

      if (marineDay) {
        drawBunting(ctx, w, t, {
          body: SCARLET,
          edge: GOLD,
          rosette: GOLD,
          center: SCARLET,
        });
      }

      if (showMainFlag && mainFlag) {
        // Colors: the flag runs up the pole when the screen opens.
        const poleX = 16;
        const poleTop = 14;
        const raise = ease(t / 2.8);
        const restY = poleTop + 2;
        const startY = restY + 130;
        const fy = startY + (restY - startY) * raise;
        drawPole(ctx, poleX, poleTop, mainFlag.height + 90);
        ctx.globalAlpha = 0.94;
        mainFlag.draw(ctx, poleX + 1.6, fy, t, 0, 0.6 + 0.4 * raise);
        ctx.globalAlpha = 1;
      }

      if (showFlagLine) drawFlagLine(t);

      if (showMarine) {
        const mh = Math.max(68, Math.min(100, h * 0.115));
        // Marine day: beside the cake. Veterans Day: in front of the flag
        // line, on the same ground as the flag sticks.
        const mx = marineDay ? w * 0.2 : Math.max(40, w * 0.13);
        const my = marineDay ? ground + 6 : h - 6;
        // Settles into the salute shortly after the screen opens.
        drawMarine(ctx, mx, my, mh, t, ease((t - 0.6) / 0.9));
      }

      if (marineDay) {
        const cw = Math.max(92, Math.min(140, w * 0.27));
        drawBirthdayCake(ctx, w * 0.47, ground + 6, cw, t, age);
      }

      // Edge glow: a slow scarlet pulse on the Marine day, cool blue otherwise.
      if (marineDay) {
        vignette(ctx, w, h, "200, 16, 46", 0.1 + 0.04 * Math.sin(t * 1.6));
      } else {
        vignette(ctx, w, h, "59, 130, 246", 0.06 + 0.02 * Math.sin(t * 1.2));
      }
    },
  };
}
