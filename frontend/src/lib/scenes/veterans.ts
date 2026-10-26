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
  softLayer,
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

/**
 * How strongly each layer shows. Jesse's call after the first preview: keep
 * it in the background — Janelle still has to read the calendar and hit her
 * buttons through it — so everything is small and partly see-through, with
 * the big flag softened the most.
 */
const SOFT = {
  flag: 0.62,
  flagLine: 0.62,
  stars: 0.6,
  confetti: 0.6,
  jets: 0.75,
  trails: 0.28,
  eagle: 0.7,
  bunting: 0.7,
  figures: 0.9,
};

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
    mainFlag = makeFlag(Math.max(60, Math.min(96, w * 0.18)));
    lineFlag = makeFlag(w < 480 ? 18 : 22);
    const n = Math.max(4, Math.min(10, Math.round(w / 70)));
    lineSeeds = Array.from({ length: n }, () => Math.random() * 6);
    drift = marineDay
      ? Array.from({ length: trim(14) }, () =>
          spawnDrifter(w, h, true, MARINE_CONFETTI, [5, 9], [22, 48], 2),
        )
      : Array.from({ length: trim([6, 8, 8, 0, 10][stage] ?? 8) }, () =>
          spawnDrifter(w, h, true, STAR_COLORS, [2, 4.5], [8, 20]),
        );
  }

  /** The first eagle starts already in the sky so it's seen right away. */
  function spawnEagle(initial = false): Eagle {
    const dir = initial ? 1 : Math.random() < 0.5 ? 1 : -1;
    const size = Math.max(48, Math.min(76, W * 0.14));
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
    const stick = lineFlag.height + 12;
    // Stop short of the "+ Sale" button in the bottom-right corner.
    const span = Math.max(120, W - 96);
    const lf = lineFlag;
    softLayer(ctx, SOFT.flagLine, 0, g - stick - 8, W, stick + 10, (c) => {
      for (let i = 0; i < n; i++) {
        const x = ((i + 0.5) / n) * span - lf.width * 0.3;
        c.fillStyle = "#cbd5e1";
        c.fillRect(x - 0.8, g - stick, 1.6, stick);
        c.fillStyle = "#fde68a";
        c.beginPath();
        c.arc(x, g - stick - 1.5, 1.8, 0, Math.PI * 2);
        c.fill();
        lf.draw(c, x + 0.8, g - stick, t * 1.1, lineSeeds[i], 1.3);
      }
    });
  }

  function drawPass(dt: number, t: number) {
    nextPass -= dt;
    if (!pass && nextPass <= 0) {
      const len = Math.max(18, Math.min(26, W * 0.055));
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
    const trailLen = Math.max(140, W * 0.4);
    for (let i = 0; i < ships.length; i++) {
      const sx = pass.x + ships[i][0];
      const sy = pass.y + ships[i][1];
      const tail = sx - L * 0.5;
      const from = tail - trailLen;
      const grad = ctx.createLinearGradient(from, 0, tail, 0);
      grad.addColorStop(0, `rgba(${TRAILS[i]}, 0)`);
      grad.addColorStop(1, `rgba(${TRAILS[i]}, ${SOFT.trails})`);
      ctx.strokeStyle = grad;
      ctx.lineCap = "round";
      ctx.lineWidth = Math.max(2.5, L * 0.12);
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
    const px = pass.x;
    const py = pass.y;
    softLayer(ctx, SOFT.jets, px - 2 * L, py - L, 3 * L, 2 * L, (c) => {
      for (let i = 0; i < ships.length; i++) {
        drawJet(c, px + ships[i][0], py + ships[i][1], L, 1, t + i);
      }
    });
    if (pass.x - 1.7 * L - trailLen > W) {
      pass = null;
      nextPass = rand(25, 35);
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
          ctx.globalAlpha = SOFT.confetti;
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
          drawDriftStar(ctx, x, d.y, d.size, d.angle, d.color, tw * SOFT.stars);
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
          const bob = Math.sin(t * 0.7 + eagle.seed) * 6;
          const e = eagle;
          const S = e.size;
          softLayer(ctx, SOFT.eagle, e.x - S * 0.6, e.y + bob - S * 0.75, S * 1.2, S, (c) =>
            drawEagle(c, e.x, e.y + bob, S, e.vx < 0 ? -1 : 1, t, e.seed),
          );
          if (eagle.x < -eagle.size * 1.5 || eagle.x > w + eagle.size * 1.5) {
            eagle = null;
            eagleWait = rand(4, 9);
          }
        }
      }

      if (showJets) drawPass(dt, t);

      if (marineDay) {
        softLayer(ctx, SOFT.bunting, 0, 0, w, 40, (c) =>
          drawBunting(
            c,
            w,
            t,
            { body: SCARLET, edge: GOLD, rosette: GOLD, center: SCARLET },
            0.65,
          ),
        );
      }

      if (showMainFlag && mainFlag) {
        // Colors: the flag runs up the pole when the screen opens.
        const poleX = 16;
        const poleTop = 14;
        const raise = ease(t / 2.8);
        const restY = poleTop + 2;
        const startY = restY + 60;
        const fy = startY + (restY - startY) * raise;
        const mf = mainFlag;
        softLayer(ctx, SOFT.flag, 0, 0, poleX + mf.width + 12, poleTop + mf.height + 110, (c) => {
          drawPole(c, poleX, poleTop, mf.height + 40);
          mf.draw(c, poleX + 1.6, fy, t, 0, 0.6 + 0.4 * raise);
        });
      }

      if (showFlagLine) drawFlagLine(t);

      if (showMarine) {
        const mh = Math.max(54, Math.min(76, h * 0.088));
        // Marine day: beside the cake. Veterans Day: in front of the flag
        // line, on the same ground as the flag sticks.
        const mx = marineDay ? w * 0.2 : Math.max(40, w * 0.13);
        const my = marineDay ? ground + 6 : h - 6;
        // Settles into the salute shortly after the screen opens.
        softLayer(ctx, SOFT.figures, mx - mh * 0.4, my - mh * 1.15, mh * 0.8, mh * 1.2, (c) =>
          drawMarine(c, mx, my, mh, t, ease((t - 0.6) / 0.9)),
        );
      }

      if (marineDay) {
        const cw = Math.max(70, Math.min(100, w * 0.21));
        const cx = w * 0.42;
        const cy = ground + 6;
        softLayer(ctx, SOFT.figures, cx - cw * 0.8, cy - cw * 1.25, cw * 1.6, cw * 1.3, (c) =>
          drawBirthdayCake(c, cx, cy, cw, t, age),
        );
      }

      // Edge glow: a slow scarlet pulse on the Marine day, cool blue otherwise.
      if (marineDay) {
        vignette(ctx, w, h, "200, 16, 46", 0.06 + 0.02 * Math.sin(t * 1.6));
      } else {
        vignette(ctx, w, h, "59, 130, 246", 0.04 + 0.015 * Math.sin(t * 1.2));
      }
    },
  };
}
