import { GRID_SERIES_CANARY_MAXIMUM_MATCHES } from "./grid-series-canary-scenario.js";

/**
 * Grid adaptive-series canary seed plan (Milestone 0.2C Phase 3D2B).
 *
 * The three matches of one series canary run use the sequential seeds
 * `[baseSeed, baseSeed + 1, baseSeed + 2]`. The plan is frozen and
 * deterministic, and the base seed must be a non-negative safe integer small
 * enough that the two derived seeds never overflow `Number.MAX_SAFE_INTEGER`.
 */
export interface GridSeriesCanarySeedPlan {
  baseSeed: number;
  seeds: readonly [number, number, number];
}

export class GridSeriesCanarySeedPlanError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GridSeriesCanarySeedPlanError";
  }
}

const MAX_SAFE_INTEGER = Number.MAX_SAFE_INTEGER;

/** The maximum base seed that still leaves room for the two derived seeds. */
export const GRID_SERIES_CANARY_MAX_BASE_SEED =
  MAX_SAFE_INTEGER - (GRID_SERIES_CANARY_MAXIMUM_MATCHES - 1);

/**
 * Pure seed-plan factory. Returns a frozen plan `[baseSeed, baseSeed + 1,
 * baseSeed + 2]` and rejects malformed, unsafe or overflowing base seeds.
 */
export function createGridSeriesCanarySeedPlan(
  baseSeed: number,
): GridSeriesCanarySeedPlan {
  if (!Number.isSafeInteger(baseSeed)) {
    throw new GridSeriesCanarySeedPlanError(
      `Series canary base seed must be a safe integer; received ${String(baseSeed)}`,
    );
  }
  if (baseSeed < 0) {
    throw new GridSeriesCanarySeedPlanError(
      `Series canary base seed must be non-negative; received ${baseSeed}`,
    );
  }
  if (baseSeed > GRID_SERIES_CANARY_MAX_BASE_SEED) {
    throw new GridSeriesCanarySeedPlanError(
      `Series canary base seed must be at most ${GRID_SERIES_CANARY_MAX_BASE_SEED} so the three sequential seeds stay within the safe-integer range; received ${baseSeed}`,
    );
  }
  const seeds = [baseSeed, baseSeed + 1, baseSeed + 2] as const satisfies readonly [
    number,
    number,
    number,
  ];
  return { baseSeed, seeds };
}
