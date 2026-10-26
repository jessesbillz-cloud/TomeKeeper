/**
 * Effect → scene. Holidays whose `effect` appears here get a hand-built,
 * staged scene; everything else falls back to the simple drift/fireworks
 * effects in HolidayCanvas. Halloween predates this and still runs inline
 * in HolidayTheme.tsx.
 */

import type { HolidayEffect } from "../holidays";
import type { SceneFactory } from "./kit";
import { createBirthdayScene } from "./birthday";
import { createChristmasScene } from "./christmas";
import { createEasterScene } from "./easter";
import { createFourthScene } from "./fourth";
import { createNewYearScene } from "./newyear";
import { createStPatricksScene } from "./stpatricks";
import { createThanksgivingScene } from "./thanksgiving";
import { createValentinesScene } from "./valentines";
import { createVeteransScene } from "./veterans";

export const SCENES: Partial<Record<HolidayEffect, SceneFactory>> = {
  "new-year": createNewYearScene,
  valentines: createValentinesScene,
  birthday: createBirthdayScene,
  "st-patricks": createStPatricksScene,
  easter: createEasterScene,
  fourth: createFourthScene,
  veterans: createVeteransScene,
  thanksgiving: createThanksgivingScene,
  christmas: createChristmasScene,
};

export type { Scene, SceneFactory } from "./kit";
