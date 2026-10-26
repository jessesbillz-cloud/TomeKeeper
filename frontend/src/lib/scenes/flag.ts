/**
 * A waving US flag.
 *
 * The flat flag is painted once onto an offscreen canvas at 2x, then each
 * frame it's drawn back in thin vertical slices, each nudged up or down on a
 * travelling sine wave and shaded by the wave's slope. The hoist (pole side)
 * is pinned, and the ripple grows toward the fly end — which is what makes it
 * read as cloth in wind rather than a jelly rectangle.
 *
 * Proportions follow the real flag (1.9 : 1, canton 7 stripes tall and 0.4
 * of the width, 50 stars in 9 staggered rows). Small flags skip the stars and
 * just show a few dots, since stars that size are sub-pixel anyway.
 */

const RED = "#b22234";
const WHITE = "#f4f1ea";
const BLUE = "#3c3b6e";
const SCALE = 2;

export interface WavingFlag {
  width: number;
  height: number;
  /**
   * Draw with the hoist's top corner at (x, y). `t` drives the wave; `seed`
   * keeps a row of flags from rippling in lockstep; `wind` scales the ripple.
   */
  draw(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    t: number,
    seed: number,
    wind?: number,
  ): void;
}

function paintFlat(fw: number, fh: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = Math.ceil(fw * SCALE);
  c.height = Math.ceil(fh * SCALE);
  const g = c.getContext("2d");
  if (!g) return c;
  g.scale(SCALE, SCALE);

  const stripe = fh / 13;
  for (let i = 0; i < 13; i++) {
    g.fillStyle = i % 2 === 0 ? RED : WHITE;
    // +0.5 overlap so no hairline gaps show between stripes.
    g.fillRect(0, i * stripe, fw, stripe + 0.5);
  }

  const cw = fw * 0.4;
  const ch = stripe * 7;
  g.fillStyle = BLUE;
  g.fillRect(0, 0, cw, ch);

  g.fillStyle = WHITE;
  if (fw >= 70) {
    const r = fh * 0.0308;
    for (let row = 0; row < 9; row++) {
      const n = row % 2 === 0 ? 6 : 5;
      for (let k = 0; k < n; k++) {
        const sx = row % 2 === 0 ? ((2 * k + 1) * cw) / 12 : ((2 * k + 2) * cw) / 12;
        const sy = ((row + 1) * ch) / 10;
        g.beginPath();
        for (let i = 0; i < 10; i++) {
          const rr = i % 2 === 0 ? r : r * 0.38;
          const a = -Math.PI / 2 + (i * Math.PI) / 5;
          const px = sx + Math.cos(a) * rr;
          const py = sy + Math.sin(a) * rr;
          if (i === 0) g.moveTo(px, py);
          else g.lineTo(px, py);
        }
        g.closePath();
        g.fill();
      }
    }
  } else {
    // A suggestion of stars: a small staggered dot grid.
    const dot = Math.max(0.45, fh * 0.035);
    for (let row = 0; row < 4; row++) {
      const n = row % 2 === 0 ? 3 : 2;
      for (let k = 0; k < n; k++) {
        const sx = row % 2 === 0 ? ((2 * k + 1) * cw) / 6 : ((2 * k + 2) * cw) / 6;
        const sy = ((row + 1) * ch) / 5;
        g.beginPath();
        g.arc(sx, sy, dot, 0, Math.PI * 2);
        g.fill();
      }
    }
  }
  return c;
}

export function makeFlag(width: number): WavingFlag {
  const fw = Math.max(12, width);
  const fh = fw / 1.9;
  const flat = paintFlat(fw, fh);
  // ~60 slices on a big flag, fewer on the little ones.
  const slice = Math.max(1.5, fw / 60);
  const k = (Math.PI * 2) / (fw * 0.85); // ~1.2 waves across the flag

  return {
    width: fw,
    height: fh,
    draw(ctx, x, y, t, seed, wind = 1) {
      const amp = fh * 0.09 * wind;
      for (let sx = 0; sx < fw; sx += slice) {
        const frac = sx / fw;
        const ph = sx * k - t * 4.2 + seed;
        // Pinned at the hoist, freer toward the fly end.
        const reach = Math.pow(frac, 0.8);
        const dy = Math.sin(ph) * amp * reach;
        // A slight droop and shrink in the troughs sells the depth.
        const squash = 1 - 0.04 * reach * (1 + Math.cos(ph)) * 0.5;
        const sw = Math.min(slice, fw - sx);
        const dh = fh * squash;
        ctx.drawImage(
          flat,
          sx * SCALE,
          0,
          sw * SCALE,
          fh * SCALE,
          x + sx,
          y + dy + (fh - dh) * 0.5,
          sw + 0.6,
          dh,
        );
        const shade = Math.cos(ph) * reach;
        ctx.fillStyle =
          shade > 0
            ? `rgba(0, 0, 0, ${0.28 * shade})`
            : `rgba(255, 255, 255, ${0.14 * -shade})`;
        ctx.fillRect(x + sx, y + dy + (fh - dh) * 0.5, sw + 0.6, dh);
      }
    },
  };
}
