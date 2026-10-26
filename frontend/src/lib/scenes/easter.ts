/**
 * Easter week — three stages (see EASTER_STAGES in ../holidays.ts):
 *
 *   0 blooms     a little bed of tulips and daisies along the bottom-left,
 *                faint petals drifting down
 *   1 egg hunt   + painted eggs tucked in among the flowers
 *   2 Easter     + a basket of eggs, and a bunny that hops in now and then,
 *                sits and twitches its nose, then hops back out
 *
 * Everything on the ground stays in the left ~65% of the screen so the
 * "+ Sale" button's corner stays clear.
 */

import {
  type Drifter,
  type Scene,
  ease,
  groundY,
  pick,
  rand,
  softLayer,
  spawnDrifter,
  stepDrifter,
  trimFor,
  vignette,
} from "./kit";
import {
  type EggPattern,
  drawBasket,
  drawBunny,
  drawDaisy,
  drawEgg,
  drawTulip,
} from "./spring-cast";

const SOFT = {
  petals: 0.5,
  bed: 0.8,
  bunny: 0.88,
};

const TULIPS = ["#f472b6", "#fb7185", "#c084fc", "#fbbf24", "#f87171"];
const PETALS = ["#fbcfe8", "#e9d5ff", "#fde68a", "#fecdd3"];
const EGGS: Array<[string, string]> = [
  ["#f9a8d4", "#fdf2f8"],
  ["#93c5fd", "#eff6ff"],
  ["#fde68a", "#f97316"],
  ["#a7f3d0", "#059669"],
  ["#c4b5fd", "#faf5ff"],
];
const PATTERNS: EggPattern[] = ["stripes", "dots", "zigzag"];

interface Flower {
  x: number;
  h: number;
  kind: "tulip" | "daisy";
  color: string;
  seed: number;
}

interface Egg {
  x: number;
  size: number;
  base: string;
  accent: string;
  pattern: EggPattern;
  tilt: number;
}

/** The bunny's little routine: hop in, sit a while, hop back out. */
interface Bunny {
  x: number;
  target: number;
  dir: 1 | -1;
  mode: "in" | "sit" | "out" | "away";
  timer: number;
  hopT: number;
}

export function createEasterScene(
  ctx: CanvasRenderingContext2D,
  stage: number,
): Scene {
  const showEggs = stage >= 1;
  const showBunny = stage >= 2;

  let W = 0;
  let H = 0;
  let flowers: Flower[] = [];
  let eggs: Egg[] = [];
  let petals: Drifter[] = [];
  const bunny: Bunny = {
    x: -60,
    target: 0,
    dir: 1,
    mode: "in",
    timer: 0,
    hopT: 0,
  };

  function layout(w: number, h: number) {
    W = w;
    H = h;
    const trim = trimFor(w);
    const bedW = Math.min(w * 0.62, w - 110);
    const n = trim(11);
    flowers = Array.from({ length: n }, (_, i) => ({
      x: 10 + ((i + rand(0.15, 0.85)) / n) * bedW,
      h: Math.max(24, Math.min(42, h * 0.045)) * rand(0.85, 1.15),
      kind: i % 3 === 1 ? "daisy" : "tulip",
      color: pick(TULIPS),
      seed: Math.random() * 10,
    }));
    const ne = trim(5);
    eggs = Array.from({ length: ne }, (_, i) => {
      const [base, accent] = EGGS[i % EGGS.length];
      return {
        x: 18 + ((i + 0.5) / ne) * bedW * 0.95 + rand(-6, 6),
        size: Math.max(7, Math.min(10, w * 0.022)),
        base,
        accent,
        pattern: PATTERNS[i % PATTERNS.length],
        tilt: rand(-0.35, 0.35),
      };
    });
    petals = Array.from({ length: trim(10) }, () =>
      spawnDrifter(w, h, true, PETALS, [4.5, 7.5], [12, 26]),
    );
    bunny.x = -60;
    bunny.mode = "in";
    bunny.dir = 1;
    bunny.target = w * rand(0.3, 0.45);
  }

  function stepBunny(dt: number) {
    const b = bunny;
    const speed = Math.max(42, W * 0.11);
    if (b.mode === "away") {
      b.timer -= dt;
      if (b.timer <= 0) {
        b.mode = "in";
        b.dir = 1;
        b.x = -60;
        b.target = W * rand(0.28, 0.48);
      }
      return;
    }
    if (b.mode === "sit") {
      b.timer -= dt;
      b.hopT = 0;
      if (b.timer <= 0) {
        b.mode = "out";
        b.dir = -1;
      }
      return;
    }
    b.x += b.dir * speed * dt;
    b.hopT += dt;
    if (b.mode === "in" && b.x >= b.target) {
      b.mode = "sit";
      b.timer = rand(4, 7);
    } else if (b.mode === "out" && b.x < -70) {
      b.mode = "away";
      b.timer = rand(6, 12);
    }
  }

  return {
    frame(dt, t, w, h) {
      if (w !== W || h !== H) layout(w, h);
      const ground = groundY(h) + 30;

      ctx.save();
      for (const p of petals) {
        const x = stepDrifter(p, dt, w, h);
        ctx.globalAlpha = SOFT.petals;
        ctx.fillStyle = p.color;
        ctx.save();
        ctx.translate(x, p.y);
        ctx.rotate(p.angle);
        ctx.beginPath();
        ctx.ellipse(0, 0, p.size * 0.55, p.size * 0.3, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      ctx.restore();

      // The flower bed (and eggs) as one soft layer.
      const bedRight = Math.min(w * 0.66, w - 100);
      const tallest = Math.max(...flowers.map((f) => f.h), 30);
      softLayer(ctx, SOFT.bed, 0, ground - tallest * 1.6, bedRight + 20, tallest * 1.6 + 8, (c) => {
        for (const f of flowers) {
          const sway = Math.sin(t * 1.1 + f.seed) * f.h * 0.08;
          if (f.kind === "tulip") drawTulip(c, f.x, ground, f.h, f.color, sway);
          else drawDaisy(c, f.x, ground, f.h * 0.85, sway);
        }
        if (showEggs) {
          for (const e of eggs) {
            drawEgg(c, e.x, ground + 1, e.size, e.base, e.accent, e.pattern, e.tilt);
          }
        }
      });

      if (showBunny) {
        const bw = Math.max(46, Math.min(62, w * 0.14));
        const bx = Math.min(w * 0.56, w - 150);
        softLayer(ctx, SOFT.bed, bx - bw * 0.6, ground - bw * 1.25, bw * 1.2, bw * 1.3, (c) =>
          drawBasket(c, bx, ground, bw),
        );

        stepBunny(dt);
        const b = bunny;
        if (b.mode !== "away") {
          const bh = Math.max(36, Math.min(52, h * 0.06));
          // Each hop is a quick arc; between hops the feet touch down.
          const cycle = (b.hopT * 2.4) % 1;
          const hop = b.mode === "sit" ? 0 : Math.sin(cycle * Math.PI);
          const twitch = b.mode === "sit" ? t : 0;
          softLayer(ctx, SOFT.bunny, b.x - bh, ground - bh * 1.9, bh * 2, bh * 1.95, (c) =>
            drawBunny(c, b.x, ground, bh, b.dir, ease(hop), twitch),
          );
        }
      }

      vignette(ctx, w, h, "192, 132, 252", 0.035 + 0.01 * Math.sin(t * 1.1));
    },
  };
}
