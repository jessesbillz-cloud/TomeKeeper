import { useEffect, useMemo, useRef, useState } from "react";

import {
  drawBat,
  drawDracula,
  drawFrankenstein,
  drawGhost,
  drawMummy,
  drawWitch,
} from "../lib/spooky";
import {
  activeHoliday,
  halloweenPhase,
  halloweenPhaseAt,
  holidayById,
  holidayMessage,
  type ActiveHoliday,
  type HalloweenPhase,
  type HolidayEffect,
} from "../lib/holidays";

const DISMISS_KEY = "tomekeeper:holiday-dismissed";

/**
 * Glyph sets for the "drift" effects — particles that fall and sway. Drawn
 * with canvas fillText so there are no image assets to ship or cache.
 *
 * Halloween is NOT in here. It gets a hand-built scene instead (see
 * `runHalloween`) because it's Janelle's favorite and deserves more than
 * bat emoji falling like snow.
 */
const DRIFT_GLYPHS: Partial<Record<HolidayEffect, string[]>> = {
  snow: ["❄", "❅", "❆"],
  hearts: ["💗", "💕", "💖"],
  shamrocks: ["☘️", "🍀"],
  petals: ["🌸", "🌷", "🌼"],
  leaves: ["🍁", "🍂"],
};

const CONFETTI_COLORS = [
  "#f472b6",
  "#fbbf24",
  "#34d399",
  "#60a5fa",
  "#c084fc",
  "#fb7185",
];

interface DriftParticle {
  x: number;
  y: number;
  size: number;
  speed: number;
  sway: number;
  phase: number;
  spin: number;
  angle: number;
  glyph: string;
  color: string;
}

interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
}

/** A bat crossing the screen on a sine path, wings flapping. */
interface Bat {
  x: number;
  y: number;
  vx: number;
  amp: number;
  freq: number;
  phase: number;
  size: number;
  flapRate: number;
}

/** A ghost rising from the bottom, fading as it climbs. */
interface Ghost {
  x: number;
  y: number;
  speed: number;
  sway: number;
  phase: number;
  size: number;
}

/** A monster on the ground: mummy, Frankenstein, or Dracula. */
type WalkerKind = "mummy" | "frankenstein" | "dracula";

interface Walker {
  kind: WalkerKind;
  x: number;
  vx: number;
  h: number;
  seed: number;
}

/** A witch on a broom, crossing the sky. */
interface Witch {
  x: number;
  y: number;
  vx: number;
  h: number;
  seed: number;
}

/** A spider on a thread: drops, dangles, climbs back, repeats elsewhere. */
interface Spider {
  x: number;
  y: number;
  target: number;
  size: number;
  dir: 1 | -1;
  wait: number;
}

/**
 * Full-screen particle overlay. Fixed, `pointer-events-none`, and sits at
 * z-40 — below Layout's floating "+ Sale" button (z-50) so it can never eat
 * a tap or cover the primary action.
 *
 * Battery/perf guards, all deliberate:
 *  - `prefers-reduced-motion` renders nothing at all (the banner still shows).
 *  - The loop stops entirely while the tab is hidden and restarts on return,
 *    so a backgrounded PWA isn't animating in someone's pocket.
 *  - Particle counts scale with viewport area and are hard-capped.
 *  - Canvas is sized to devicePixelRatio so glyphs aren't blurry on retina.
 */
function HolidayCanvas({
  effect,
  phase,
}: {
  effect: HolidayEffect;
  /** Halloween only — which stage of the two-week build-up to render. */
  phase: HalloweenPhase | null;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = 0;
    let height = 0;

    function resize() {
      if (!canvas || !ctx) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();

    const glyphs = DRIFT_GLYPHS[effect];
    const isDrift = Boolean(glyphs);
    const isConfetti = effect === "confetti";
    const isHalloween = effect === "bats";

    const count = Math.min(
      70,
      Math.max(18, Math.round((width * height) / 26_000)),
    );

    function spawnDrift(initial: boolean): DriftParticle {
      const set = glyphs ?? ["•"];
      return {
        x: Math.random() * width,
        y: initial ? Math.random() * height : -20,
        size: 10 + Math.random() * 14,
        speed: 18 + Math.random() * 42,
        sway: 8 + Math.random() * 26,
        phase: Math.random() * Math.PI * 2,
        spin: (Math.random() - 0.5) * 1.6,
        angle: Math.random() * Math.PI * 2,
        glyph: set[Math.floor(Math.random() * set.length)],
        color:
          CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
      };
    }

    const drift: DriftParticle[] =
      isDrift || isConfetti
        ? Array.from({ length: count }, () => spawnDrift(true))
        : [];
    const sparks: Spark[] = [];

    // --- Halloween cast -------------------------------------------------
    // Small, deliberate populations. This is a scene, not a blizzard: a few
    // bats crossing, a couple of ghosts rising, one or two spiders working
    // their threads. Cheap enough to run alongside the fog and the moon.
    // Population comes from the stage, then gets trimmed on small screens so
    // a phone doesn't end up wall-to-wall bats.
    const small = width < 480;
    const trim = (n: number) => (small ? Math.max(n > 0 ? 1 : 0, Math.round(n * 0.6)) : n);
    const batCount = trim(phase?.bats ?? 0);
    const ghostCount = trim(phase?.ghosts ?? 0);
    const spiderCount = trim(phase?.spiders ?? 0);
    const pumpkinCount = trim(phase?.pumpkins ?? 0);
    const mummyCount = trim(phase?.mummies ?? 0);
    const frankCount = trim(phase?.frankensteins ?? 0);
    const draculaCount = trim(phase?.draculas ?? 0);
    const witchCount = trim(phase?.witches ?? 0);
    const showWebs = phase?.webs ?? false;
    const showFog = phase?.fog ?? false;
    const pulseScale = phase?.pulse ?? 1;

    function spawnBat(initial: boolean): Bat {
      const dir = Math.random() < 0.5 ? 1 : -1;
      const size = 16 + Math.random() * 18;
      return {
        x: initial
          ? Math.random() * width
          : dir === 1
            ? -40
            : width + 40,
        y: 40 + Math.random() * Math.max(80, height * 0.55),
        vx: dir * (35 + Math.random() * 60),
        amp: 12 + Math.random() * 34,
        freq: 0.6 + Math.random() * 1.1,
        phase: Math.random() * Math.PI * 2,
        size,
        flapRate: 6 + Math.random() * 5,
      };
    }

    function spawnGhost(initial: boolean): Ghost {
      return {
        x: Math.random() * width,
        y: initial ? Math.random() * height : height + 40,
        speed: 14 + Math.random() * 22,
        sway: 14 + Math.random() * 26,
        phase: Math.random() * Math.PI * 2,
        size: 20 + Math.random() * 16,
      };
    }

    function spawnSpider(): Spider {
      return {
        x: 40 + Math.random() * Math.max(1, width - 80),
        y: -30,
        target: 60 + Math.random() * Math.max(60, height * 0.35),
        size: 16 + Math.random() * 10,
        dir: 1,
        wait: 0,
      };
    }

    const bats: Bat[] = isHalloween
      ? Array.from({ length: batCount }, () => spawnBat(true))
      : [];
    const ghosts: Ghost[] = isHalloween
      ? Array.from({ length: ghostCount }, () => spawnGhost(true))
      : [];
    const spiders: Spider[] = isHalloween
      ? Array.from({ length: spiderCount }, () => spawnSpider())
      : [];

    /**
     * Ground monsters walk in from either edge, slowly — they shamble, they
     * don't march. Dracula is a touch taller and slower still.
     */
    function spawnWalker(kind: WalkerKind, initial: boolean): Walker {
      const dir = Math.random() < 0.5 ? 1 : -1;
      const base = kind === "dracula" ? 52 : 42;
      return {
        kind,
        x: initial ? Math.random() * width : dir === 1 ? -70 : width + 70,
        vx: dir * (kind === "dracula" ? 9 + Math.random() * 8 : 11 + Math.random() * 13),
        h: base + Math.random() * 18,
        seed: Math.random() * Math.PI * 2,
      };
    }

    function spawnWitch(initial: boolean): Witch {
      const dir = Math.random() < 0.5 ? 1 : -1;
      return {
        x: initial ? Math.random() * width : dir === 1 ? -110 : width + 110,
        y: 60 + Math.random() * Math.max(60, height * 0.3),
        vx: dir * (55 + Math.random() * 45),
        h: 30 + Math.random() * 14,
        seed: Math.random() * Math.PI * 2,
      };
    }

    const walkers: Walker[] = isHalloween
      ? [
          ...Array.from({ length: mummyCount }, () => spawnWalker("mummy", true)),
          ...Array.from({ length: frankCount }, () =>
            spawnWalker("frankenstein", true),
          ),
          ...Array.from({ length: draculaCount }, () =>
            spawnWalker("dracula", true),
          ),
        ]
      : [];

    const witches: Witch[] = isHalloween
      ? Array.from({ length: witchCount }, () => spawnWitch(true))
      : [];

    // Jack-o'-lanterns sit along the bottom edge, evenly spaced, bobbing and
    // glowing slightly out of sync with each other.
    const pumpkins = Array.from({ length: pumpkinCount }, (_, i) => ({
      x: ((i + 0.5) / Math.max(1, pumpkinCount)) * width,
      size: 26 + Math.random() * 12,
      phase: Math.random() * Math.PI * 2,
    }));

    let raf = 0;
    let last = performance.now();
    let elapsed = 0;
    let nextBurst = 0;
    let running = true;

    function burst() {
      const cx = width * (0.15 + Math.random() * 0.7);
      const cy = height * (0.1 + Math.random() * 0.4);
      const color =
        CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)];
      const n = 26 + Math.floor(Math.random() * 16);
      for (let i = 0; i < n; i++) {
        const a = (Math.PI * 2 * i) / n + Math.random() * 0.2;
        const v = 60 + Math.random() * 110;
        const life = 0.9 + Math.random() * 0.7;
        sparks.push({
          x: cx,
          y: cy,
          vx: Math.cos(a) * v,
          vy: Math.sin(a) * v,
          life,
          maxLife: life,
          color,
        });
      }
    }

    /**
     * A corner cobweb: spokes fanning out from the corner plus concentric
     * strands that sag slightly between them, so it reads as web rather than
     * as a radar screen.
     */
    function drawWeb(
      ox: number,
      oy: number,
      radius: number,
      a0: number,
      a1: number,
    ) {
      if (!ctx) return;
      const spokes = 7;
      ctx.save();
      ctx.strokeStyle = "rgba(226, 232, 240, 0.16)";
      ctx.lineWidth = 1;
      for (let i = 0; i <= spokes; i++) {
        const a = a0 + ((a1 - a0) * i) / spokes;
        ctx.beginPath();
        ctx.moveTo(ox, oy);
        ctx.lineTo(ox + Math.cos(a) * radius, oy + Math.sin(a) * radius);
        ctx.stroke();
      }
      for (let ring = 1; ring <= 5; ring++) {
        const r = (radius * ring) / 5;
        ctx.beginPath();
        for (let i = 0; i < spokes; i++) {
          const a = a0 + ((a1 - a0) * i) / spokes;
          const b = a0 + ((a1 - a0) * (i + 1)) / spokes;
          const mid = (a + b) / 2;
          const sag = r * 0.86; // pull the midpoint inward
          if (i === 0) ctx.moveTo(ox + Math.cos(a) * r, oy + Math.sin(a) * r);
          ctx.quadraticCurveTo(
            ox + Math.cos(mid) * sag,
            oy + Math.sin(mid) * sag,
            ox + Math.cos(b) * r,
            oy + Math.sin(b) * r,
          );
        }
        ctx.stroke();
      }
      ctx.restore();
    }

    /** Low-hanging graveyard fog: two offset bands sliding at different rates. */
    function drawFog(t: number) {
      if (!ctx) return;
      const band = Math.min(190, height * 0.3);
      const grad = ctx.createLinearGradient(0, height - band, 0, height);
      grad.addColorStop(0, "rgba(88, 28, 135, 0)");
      grad.addColorStop(1, "rgba(88, 28, 135, 0.34)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, height - band, width, band);

      ctx.save();
      ctx.globalAlpha = 0.1;
      ctx.fillStyle = "#e9d5ff";
      for (let i = 0; i < 3; i++) {
        const speed = 12 + i * 7;
        const cx = ((t * speed + i * width * 0.4) % (width + 400)) - 200;
        const cy = height - band * (0.25 + i * 0.16);
        ctx.beginPath();
        ctx.ellipse(cx, cy, 190, 34, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    /** Full moon, top-right, with a soft halo and a few craters. */
    function drawMoon() {
      if (!ctx) return;
      const r = Math.min(42, Math.max(24, width * 0.07));
      const cx = width - r - 26;
      const cy = r + 26;
      const halo = ctx.createRadialGradient(cx, cy, r * 0.6, cx, cy, r * 2.6);
      halo.addColorStop(0, "rgba(253, 230, 138, 0.22)");
      halo.addColorStop(1, "rgba(253, 230, 138, 0)");
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(cx, cy, r * 2.6, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "rgba(254, 243, 199, 0.82)";
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "rgba(180, 160, 110, 0.25)";
      const craters: Array<[number, number, number]> = [
        [-0.3, -0.25, 0.18],
        [0.25, 0.1, 0.13],
        [-0.1, 0.38, 0.1],
      ];
      for (const [dx, dy, cr] of craters) {
        ctx.beginPath();
        ctx.arc(cx + dx * r, cy + dy * r, cr * r, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    function runHalloween(dt: number, t: number) {
      if (!ctx) return;
      drawMoon();
      if (showWebs) {
        drawWeb(0, 0, Math.min(150, width * 0.34), 0, Math.PI / 2);
        drawWeb(width, 0, Math.min(120, width * 0.28), Math.PI / 2, Math.PI);
      }

      // Spiders: drop on a thread, dangle, climb back, respawn elsewhere.
      for (let i = 0; i < spiders.length; i++) {
        const sp = spiders[i];
        if (sp.wait > 0) {
          sp.wait -= dt;
          sp.y = sp.target + Math.sin(t * 2.4 + i) * 5;
        } else {
          sp.y += sp.dir * 42 * dt;
          if (sp.dir === 1 && sp.y >= sp.target) {
            sp.y = sp.target;
            sp.wait = 1.6 + Math.random() * 2.2;
            sp.dir = -1;
          } else if (sp.dir === -1 && sp.y < -30) {
            spiders[i] = spawnSpider();
            continue;
          }
        }
        ctx.strokeStyle = "rgba(226, 232, 240, 0.3)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(sp.x, 0);
        ctx.lineTo(sp.x, sp.y);
        ctx.stroke();
        ctx.font = `${sp.size}px serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("🕷️", sp.x, sp.y);
      }

      // Ghosts: rise, sway, fade out over the top third.
      for (let i = 0; i < ghosts.length; i++) {
        const g = ghosts[i];
        g.y -= g.speed * dt;
        g.phase += dt;
        if (g.y < -50) {
          ghosts[i] = spawnGhost(false);
          continue;
        }
        const fade = Math.min(1, Math.max(0, g.y / (height * 0.85)));
        ctx.globalAlpha = 0.2 + fade * 0.55;
        drawGhost(ctx, g.x + Math.sin(g.phase) * g.sway, g.y, g.size, t, i);
      }
      ctx.globalAlpha = 1;

      // Witches ride across the sky, well above the rooftops.
      for (let i = 0; i < witches.length; i++) {
        const wi = witches[i];
        wi.x += wi.vx * dt;
        if (wi.vx > 0 && wi.x > width + 140) witches[i] = spawnWitch(false);
        else if (wi.vx < 0 && wi.x < -140) witches[i] = spawnWitch(false);
        drawWitch(ctx, wi.x, wi.y, wi.h, wi.vx < 0 ? -1 : 1, t, wi.seed);
      }

      // Bats: cross the screen on a sine path, wings flapping.
      for (let i = 0; i < bats.length; i++) {
        const b = bats[i];
        b.x += b.vx * dt;
        b.phase += dt * b.freq;
        if (b.vx > 0 && b.x > width + 60) bats[i] = spawnBat(false);
        else if (b.vx < 0 && b.x < -60) bats[i] = spawnBat(false);
        const y = b.y + Math.sin(b.phase) * b.amp;
        const flap = 0.5 + 0.5 * Math.sin(t * b.flapRate + i);
        drawBat(ctx, b.x, y, b.size, b.vx < 0 ? -1 : 1, flap);
      }

      // Ground monsters walk the bottom edge. Drawn BEFORE the fog so the fog
      // band washes over their legs and they read as being in it, not on it.
      const groundY = height - Math.min(46, height * 0.07);
      for (let i = 0; i < walkers.length; i++) {
        const m = walkers[i];
        m.x += m.vx * dt;
        if (m.vx > 0 && m.x > width + 110)
          walkers[i] = spawnWalker(m.kind, false);
        else if (m.vx < 0 && m.x < -110)
          walkers[i] = spawnWalker(m.kind, false);
        const dir = m.vx < 0 ? -1 : 1;
        if (m.kind === "mummy") drawMummy(ctx, m.x, groundY, m.h, dir, t, m.seed);
        else if (m.kind === "frankenstein")
          drawFrankenstein(ctx, m.x, groundY, m.h, dir, t, m.seed);
        else drawDracula(ctx, m.x, groundY, m.h, dir, t, m.seed);
      }

      if (showFog) drawFog(t);

      // Jack-o'-lanterns on the bottom edge: a soft ember glow underneath,
      // then the glyph bobbing on top.
      for (let i = 0; i < pumpkins.length; i++) {
        const pk = pumpkins[i];
        const bob = Math.sin(t * 1.6 + pk.phase) * 3;
        const y = height - pk.size * 0.55 + bob;
        const flick = 0.55 + 0.45 * Math.abs(Math.sin(t * 3.1 + pk.phase));
        const glow = ctx.createRadialGradient(pk.x, y, 2, pk.x, y, pk.size * 2);
        glow.addColorStop(0, `rgba(249, 115, 22, ${0.3 * flick})`);
        glow.addColorStop(1, "rgba(249, 115, 22, 0)");
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(pk.x, y, pk.size * 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 0.95;
        ctx.font = `${pk.size}px serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("🎃", pk.x, y);
      }
      ctx.globalAlpha = 1;

      // Slow orange pulse, like a jack-o'-lantern guttering somewhere off
      // screen. Very low alpha — atmosphere, not a filter.
      const pulse =
        (0.05 + 0.035 * Math.sin(t * 1.7) + 0.02 * Math.sin(t * 5.3)) *
        pulseScale;
      const vig = ctx.createRadialGradient(
        width / 2,
        height / 2,
        Math.min(width, height) * 0.25,
        width / 2,
        height / 2,
        Math.max(width, height) * 0.75,
      );
      vig.addColorStop(0, "rgba(249, 115, 22, 0)");
      vig.addColorStop(1, `rgba(249, 115, 22, ${Math.max(0, pulse)})`);
      ctx.fillStyle = vig;
      ctx.fillRect(0, 0, width, height);
    }

    function frame(now: number) {
      if (!ctx) return;
      // Clamp dt so returning from a background tab doesn't teleport
      // everything off-screen in a single huge step.
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      elapsed += dt;
      ctx.clearRect(0, 0, width, height);

      if (isHalloween) {
        runHalloween(dt, elapsed);
      } else if (effect === "fireworks") {
        nextBurst -= dt;
        if (nextBurst <= 0) {
          burst();
          nextBurst = 0.5 + Math.random() * 0.9;
        }
        for (let i = sparks.length - 1; i >= 0; i--) {
          const s = sparks[i];
          s.life -= dt;
          if (s.life <= 0) {
            sparks.splice(i, 1);
            continue;
          }
          s.vy += 60 * dt; // gravity
          s.x += s.vx * dt;
          s.y += s.vy * dt;
          ctx.globalAlpha = Math.max(0, s.life / s.maxLife) * 0.9;
          ctx.fillStyle = s.color;
          ctx.beginPath();
          ctx.arc(s.x, s.y, 2.2, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      } else {
        for (const p of drift) {
          p.y += p.speed * dt;
          p.phase += dt;
          p.angle += p.spin * dt;
          const x = p.x + Math.sin(p.phase) * p.sway;

          if (isConfetti) {
            ctx.save();
            ctx.translate(x, p.y);
            ctx.rotate(p.angle);
            ctx.globalAlpha = 0.85;
            ctx.fillStyle = p.color;
            ctx.fillRect(-p.size / 3, -p.size / 6, p.size / 1.5, p.size / 3);
            ctx.restore();
          } else {
            ctx.globalAlpha = 0.85;
            ctx.font = `${p.size}px serif`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(p.glyph, x, p.y);
          }

          // Recycle off the bottom rather than allocating new objects.
          if (p.y > height + 24) {
            p.y = -20;
            p.x = Math.random() * width;
          }
        }
        ctx.globalAlpha = 1;
      }

      if (running) raf = requestAnimationFrame(frame);
    }

    raf = requestAnimationFrame(frame);

    function onVisibility() {
      if (document.hidden) {
        running = false;
        cancelAnimationFrame(raf);
      } else if (!running) {
        running = true;
        last = performance.now();
        raf = requestAnimationFrame(frame);
      }
    }

    window.addEventListener("resize", resize);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [effect, phase]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="fixed inset-0 z-40 pointer-events-none"
    />
  );
}

/**
 * Home-screen holiday theme: a banner strip plus the animated overlay.
 *
 * Which holiday is showing, and for how long, is decided entirely by
 * `lib/holidays.ts` — this component just renders whatever is active. The ×
 * dismisses the current occurrence only (keyed slug + year in localStorage),
 * so the theme returns for the next holiday and again next year.
 */
export function HolidayTheme() {
  // Resolved once per mount. Holiday windows change at midnight, and the app
  // is a PWA people reopen constantly, so there's no reason to poll.
  //
  // `?holiday=<id>` force-shows one out of season so the theme can be checked
  // in July. An unknown id falls through to the real calendar, so a junk
  // param can't blank the screen.
  const holiday = useMemo<ActiveHoliday | null>(() => {
    const preview = new URLSearchParams(window.location.search).get("holiday");
    return (preview ? holidayById(preview) : null) ?? activeHoliday();
  }, []);

  const [dismissed, setDismissed] = useState<string | null>(() => {
    try {
      return localStorage.getItem(DISMISS_KEY);
    } catch {
      // Private mode / storage disabled — just never persist a dismissal.
      return null;
    }
  });

  const reducedMotion =
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (!holiday || dismissed === holiday.key) return null;

  function dismiss() {
    if (!holiday) return;
    try {
      localStorage.setItem(DISMISS_KEY, holiday.key);
    } catch {
      // Ignore — the dismissal just won't survive a reload.
    }
    setDismissed(holiday.key);
  }

  const isHalloween = holiday.id === "halloween";
  // Halloween escalates over its two-week window; every other holiday has a
  // single look, so `phase` stays null for them.
  // `?stage=N` pins a specific stage for previewing; otherwise the stage
  // falls out of how many days are left.
  const stageParam = new URLSearchParams(window.location.search).get("stage");
  const phase = !isHalloween
    ? null
    : stageParam !== null && stageParam.trim() !== "" && !isNaN(Number(stageParam))
      ? halloweenPhaseAt(Number(stageParam))
      : halloweenPhase(holiday.daysUntil);

  return (
    <>
      {!reducedMotion && (
        <HolidayCanvas effect={holiday.effect} phase={phase} />
      )}
      <div
        role="status"
        className={[
          "relative z-40 mb-3 flex items-center gap-2 border px-3 py-2 text-sm",
          holiday.banner,
          // Halloween gets the guttering-candle treatment on the banner text
          // to match the scene behind it. Suppressed under reduced-motion.
          isHalloween && !reducedMotion ? "halloween-banner" : "",
        ].join(" ")}
      >
        <div
          className={[
            "flex-1 font-medium",
            isHalloween ? "tracking-wide" : "",
          ].join(" ")}
        >
          {isHalloween && phase ? (
            <>
              <span aria-hidden>🎃 </span>
              {phase.tagline}
              {holiday.daysUntil > 0 && (
                <span className="opacity-80">
                  {" "}
                  {holidayMessage(holiday)}
                </span>
              )}
              <span aria-hidden> 🦇</span>
            </>
          ) : (
            holidayMessage(holiday)
          )}
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label={`Dismiss ${holiday.name} theme`}
          className="text-base leading-none opacity-70 hover:opacity-100"
        >
          ×
        </button>
      </div>
    </>
  );
}
