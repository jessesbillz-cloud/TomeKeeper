/**
 * Effect → scene. Holidays whose `effect` appears here get a hand-built,
 * staged scene; everything else falls back to the simple drift/fireworks
 * effects in HolidayCanvas. Halloween predates this and still runs inline
 * in HolidayTheme.tsx.
 */

import type { HolidayEffect } from "../holidays";
import type { SceneFactory } from "./kit";
import { createVeteransScene } from "./veterans";

export const SCENES: Partial<Record<HolidayEffect, SceneFactory>> = {
  veterans: createVeteransScene,
};

export type { Scene, SceneFactory } from "./kit";
