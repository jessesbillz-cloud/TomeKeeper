/**
 * Holiday calendar for the home-screen theme.
 *
 * Every entry resolves to a single local calendar date and carries a
 * significance *tier*. The tier is the only thing that decides how long the
 * theme is up for:
 *
 *   major  → 14 days   medium → 7 days   minor → 1 day
 *
 * The window always ENDS on the holiday itself and counts backwards, so the
 * theme reads as a countdown: snow starts drifting in on Dec 12 and stops
 * after Christmas, rather than lingering into the new year.
 *
 * To change how long something stays up, change its `tier` — nothing else.
 * To add a holiday, add a row to HOLIDAYS.
 */

export type HolidayTier = "major" | "medium" | "minor";

export type HolidayEffect =
  | "snow"
  | "fireworks"
  | "hearts"
  | "shamrocks"
  | "petals"
  | "leaves"
  | "bats"
  | "confetti";

/** Days the theme is visible, including the holiday itself. */
export const TIER_DAYS: Record<HolidayTier, number> = {
  major: 14,
  medium: 7,
  minor: 1,
};

interface HolidayDef {
  /** Stable slug. Combined with the year to key dismissals. */
  id: string;
  /** Shown in the banner countdown ("Christmas in 5 days"). */
  name: string;
  /** Shown in the banner on the day itself. */
  greeting: string;
  tier: HolidayTier;
  effect: HolidayEffect;
  /** Tailwind classes for the banner strip. */
  banner: string;
  /** Resolve this holiday's date within a given year, in LOCAL time. */
  date: (year: number) => Date;
}

// --- date helpers ----------------------------------------------------------

/** Local midnight, stripped of any time component. */
function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

/**
 * Whole calendar days from `a` to `b`. Rounded rather than floored so a DST
 * boundary inside the range (which makes one "day" 23 or 25 hours long) can't
 * knock the count off by one.
 */
function dayDiff(a: Date, b: Date): number {
  return Math.round(
    (startOfDay(b).getTime() - startOfDay(a).getTime()) / 86_400_000,
  );
}

/** A holiday on the same month/day every year. `month` is 1-based. */
function fixed(month: number, day: number) {
  return (year: number) => new Date(year, month - 1, day);
}

/**
 * The Nth given weekday of a month, e.g. Thanksgiving = 4th Thursday of
 * November → nthWeekday(11, 4, 4). `weekday` is 0=Sun..6=Sat, `month` 1-based.
 */
function nthWeekday(month: number, weekday: number, n: number) {
  return (year: number) => {
    const first = new Date(year, month - 1, 1);
    const shift = (weekday - first.getDay() + 7) % 7;
    return new Date(year, month - 1, 1 + shift + (n - 1) * 7);
  };
}

/**
 * Easter Sunday (Gregorian), via the Anonymous/Meeus algorithm. Easter moves
 * by more than a month between years, so it has to be computed rather than
 * tabulated.
 */
function easter(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31); // 3 = March, 4 = April
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

// --- the calendar ----------------------------------------------------------

const HOLIDAYS: readonly HolidayDef[] = [
  {
    id: "new-years",
    name: "New Year's",
    greeting: "Happy New Year!",
    tier: "medium",
    effect: "fireworks",
    banner: "border-amber-400 bg-amber-950/50 text-amber-100",
    date: fixed(1, 1),
  },
  {
    id: "valentines",
    name: "Valentine's Day",
    greeting: "Happy Valentine's Day 💗",
    tier: "medium",
    effect: "hearts",
    banner: "border-rose-400 bg-rose-950/50 text-rose-100",
    date: fixed(2, 14),
  },
  {
    // Janelle's birthday. Gets its own confetti effect and outranks any
    // nearby holiday when windows overlap (see `activeHoliday`).
    id: "janelle-birthday",
    name: "Janelle's birthday",
    greeting: "Happy birthday, Janelle! 🎂",
    tier: "medium",
    effect: "confetti",
    banner: "border-fuchsia-400 bg-fuchsia-950/50 text-fuchsia-100",
    date: fixed(3, 12),
  },
  {
    id: "st-patricks",
    name: "St. Patrick's Day",
    greeting: "Happy St. Patrick's Day ☘️",
    tier: "minor",
    effect: "shamrocks",
    banner: "border-emerald-400 bg-emerald-950/50 text-emerald-100",
    date: fixed(3, 17),
  },
  {
    id: "easter",
    name: "Easter",
    greeting: "Happy Easter 🌷",
    tier: "medium",
    effect: "petals",
    banner: "border-violet-400 bg-violet-950/50 text-violet-100",
    date: easter,
  },
  {
    id: "independence-day",
    name: "the 4th",
    greeting: "Happy 4th of July 🎆",
    tier: "medium",
    effect: "fireworks",
    banner: "border-sky-400 bg-sky-950/50 text-sky-100",
    date: fixed(7, 4),
  },
  {
    id: "halloween",
    name: "Halloween",
    greeting: "Happy Halloween!",
    tier: "major",
    // "bats" is the whole Halloween scene, not just bats — see runHalloween
    // in HolidayTheme.tsx (moon, cobwebs, fog, ghosts, spiders, flicker).
    effect: "bats",
    banner: "border-orange-500 bg-gradient-to-r from-orange-950/70 via-purple-950/60 to-orange-950/70 text-orange-100",
    date: fixed(10, 31),
  },
  {
    id: "thanksgiving",
    name: "Thanksgiving",
    greeting: "Happy Thanksgiving 🍂",
    tier: "medium",
    effect: "leaves",
    banner: "border-amber-500 bg-amber-950/50 text-amber-100",
    date: nthWeekday(11, 4, 4), // 4th Thursday of November
  },
  {
    id: "christmas",
    name: "Christmas",
    greeting: "Merry Christmas 🎄",
    tier: "major",
    effect: "snow",
    banner: "border-red-400 bg-red-950/50 text-red-100",
    date: fixed(12, 25),
  },
];

export interface ActiveHoliday {
  id: string;
  name: string;
  greeting: string;
  tier: HolidayTier;
  effect: HolidayEffect;
  banner: string;
  /** The holiday's date this time around. */
  date: Date;
  /** 0 = today. Positive = still coming. Never negative (window ends on the day). */
  daysUntil: number;
  /**
   * Dismissal key — slug + the year the window ENDS in, e.g.
   * "christmas-2026". Dismissing hides this occurrence only; the theme is
   * back for the next holiday, and again next year.
   */
  key: string;
}

/**
 * The holiday whose window contains `now`, or null on an ordinary day.
 *
 * Years y-1 / y / y+1 are all checked so a window that straddles New Year's
 * (Dec 26 → Jan 1) resolves correctly from either side of the boundary.
 * If two windows overlap, the nearer holiday wins — and a tie goes to
 * Janelle's birthday, since a personal date should never be crowded out by a
 * generic one.
 */
export function activeHoliday(now: Date = new Date()): ActiveHoliday | null {
  const today = startOfDay(now);
  const year = today.getFullYear();
  let best: ActiveHoliday | null = null;

  for (const def of HOLIDAYS) {
    for (const y of [year - 1, year, year + 1]) {
      const date = startOfDay(def.date(y));
      const windowStart = addDays(date, -(TIER_DAYS[def.tier] - 1));
      if (today < windowStart || today > date) continue;

      const candidate: ActiveHoliday = {
        id: def.id,
        name: def.name,
        greeting: def.greeting,
        tier: def.tier,
        effect: def.effect,
        banner: def.banner,
        date,
        daysUntil: dayDiff(today, date),
        key: `${def.id}-${date.getFullYear()}`,
      };

      if (
        best === null ||
        candidate.daysUntil < best.daysUntil ||
        (candidate.daysUntil === best.daysUntil &&
          candidate.id === "janelle-birthday")
      ) {
        best = candidate;
      }
    }
  }

  return best;
}

/**
 * Force-resolve a holiday by id, regardless of today's date — the nearest
 * occurrence, reported as if it were the holiday itself (daysUntil 0).
 *
 * This exists so the theme can be previewed out of season via `?holiday=<id>`
 * on the home screen; there is otherwise no way to look at the Christmas snow
 * in July. Returns null for an unknown id, so a junk query param is inert.
 */
export function holidayById(
  id: string,
  now: Date = new Date(),
): ActiveHoliday | null {
  const def = HOLIDAYS.find((h) => h.id === id);
  if (!def) return null;
  const date = startOfDay(def.date(now.getFullYear()));
  return {
    id: def.id,
    name: def.name,
    greeting: def.greeting,
    tier: def.tier,
    effect: def.effect,
    banner: def.banner,
    date,
    daysUntil: 0,
    key: `${def.id}-${date.getFullYear()}`,
  };
}

/** Every holiday id, in calendar order. Handy for the preview param. */
export const HOLIDAY_IDS: readonly string[] = HOLIDAYS.map((h) => h.id);

/**
 * Halloween builds instead of just running.
 *
 * The 14-day major window is split into six stages, so the home screen looks
 * different every two or three days on the way to the 31st rather than
 * showing one static scene for two weeks. Each stage adds an element — moon,
 * then cobwebs, then fog, then ghosts, then the swarm, then everything —
 * so it reads as something creeping closer.
 *
 * Index 0 is the far end of the window; index 5 is Halloween itself.
 */
export interface HalloweenPhase {
  /** Internal name for the stage. */
  label: string;
  /** Banner line for this stage, shown above the countdown. */
  tagline: string;
  bats: number;
  ghosts: number;
  spiders: number;
  /** Hand-drawn shamblers along the bottom edge — there is no mummy emoji. */
  mummies: number;
  /** Dracula, cape flaring. Shows up only at the very end. */
  draculas: number;
  /** Frankenstein's monster, boxy walk. */
  frankensteins: number;
  /** Witches on brooms, flying across the sky. */
  witches: number;
  webs: boolean;
  fog: boolean;
  pumpkins: number;
  /** Multiplier on the jack-o'-lantern glow pulse. */
  pulse: number;
}

const HALLOWEEN_PHASES: readonly HalloweenPhase[] = [
  {
    label: "moonrise",
    tagline: "Something's stirring…",
    bats: 2, ghosts: 0, spiders: 0,
    mummies: 0, frankensteins: 0, draculas: 0, witches: 0,
    webs: false, fog: false, pumpkins: 0, pulse: 0.3,
  },
  {
    label: "cobwebs",
    tagline: "The cobwebs are going up…",
    bats: 3, ghosts: 0, spiders: 1,
    mummies: 0, frankensteins: 0, draculas: 0, witches: 0,
    webs: true, fog: false, pumpkins: 0, pulse: 0.45,
  },
  {
    label: "fog",
    tagline: "The fog is rolling in…",
    bats: 5, ghosts: 0, spiders: 1,
    mummies: 1, frankensteins: 0, draculas: 0, witches: 0,
    webs: true, fog: true, pumpkins: 1, pulse: 0.6,
  },
  {
    label: "haunting",
    tagline: "Something's shambling out of the fog…",
    bats: 6, ghosts: 2, spiders: 2,
    mummies: 1, frankensteins: 1, draculas: 0, witches: 1,
    webs: true, fog: true, pumpkins: 2, pulse: 0.75,
  },
  {
    label: "swarm",
    tagline: "The count has arrived…",
    bats: 9, ghosts: 3, spiders: 2,
    mummies: 2, frankensteins: 1, draculas: 1, witches: 1,
    webs: true, fog: true, pumpkins: 3, pulse: 0.9,
  },
  {
    label: "all-hallows",
    tagline: "Happy Halloween, Janelle!",
    bats: 13, ghosts: 5, spiders: 3,
    mummies: 3, frankensteins: 2, draculas: 1, witches: 2,
    webs: true, fog: true, pumpkins: 4, pulse: 1.25,
  },
];

/**
 * Map "days until Halloween" onto a stage. The window is 14 days
 * (daysUntil 13 → 0), so the stages land roughly every two to three days:
 *
 *   13–11 moonrise · 10–8 cobwebs · 7–5 fog · 4–3 haunting · 2–1 swarm · 0 all-hallows
 */
export function halloweenPhase(daysUntil: number): HalloweenPhase {
  const idx =
    daysUntil >= 11 ? 0
    : daysUntil >= 8 ? 1
    : daysUntil >= 5 ? 2
    : daysUntil >= 3 ? 3
    : daysUntil >= 1 ? 4
    : 5;
  return HALLOWEEN_PHASES[idx];
}

/** Total number of Halloween stages — used by the preview harness. */
export const HALLOWEEN_PHASE_COUNT = HALLOWEEN_PHASES.length;

/**
 * A Halloween stage by index, for previewing a specific one out of season
 * via `?holiday=halloween&stage=N`. Out-of-range indexes clamp rather than
 * throw, so a bad URL degrades to the first or last stage.
 */
export function halloweenPhaseAt(index: number): HalloweenPhase {
  const i = Math.min(
    HALLOWEEN_PHASES.length - 1,
    Math.max(0, Math.floor(index)),
  );
  return HALLOWEEN_PHASES[i];
}

/** Banner text: a countdown before the day, the greeting on the day itself. */
export function holidayMessage(h: ActiveHoliday): string {
  if (h.daysUntil === 0) return h.greeting;
  if (h.daysUntil === 1) return `${h.name} is tomorrow!`;
  return `${h.name} in ${h.daysUntil} days`;
}
