import type {
  GridActivationReadinessSuiteOutcome,
  GridActivationReadinessRunResult,
} from "./execution-core.js";
import type {
  GridZone,
  PlanarArmourZone,
  RelativeBearing,
} from "../simulator/arena-grid.js";
import type { MovementAction } from "../simulator/types.js";
import { GRID_ACTIVATION_READINESS_RUN_COUNT } from "./run-plan.js";
import { z } from "zod";

/**
 * Pure grid activation-readiness metrics reducer (Milestone 0.2C Phase 3E1).
 *
 * Reduces the 312 canonical run results into aggregate execution, movement,
 * combat, result, slot-order and timing diagnostics. Slot-order diagnostics
 * detect gross slot-order pathology only; they are not design-balance
 * qualification. Timing is informational only and never affects the readiness
 * decision.
 */
export interface GridActivationReadinessExecutionMetrics {
  readonly totalPlannedRuns: number;
  readonly totalCompletedRuns: number;
  readonly deterministicMatches: number;
  readonly schemaValidRecords: number;
  readonly schemaValidReports: number;
  readonly replayAgreeingMatches: number;
  readonly invalidEventCount: number;
  readonly mutationFailures: number;
}

export interface GridActivationReadinessMovementMetrics {
  readonly actionCounts: Readonly<Record<MovementAction, number>>;
  readonly translatedActionCounts: Readonly<Record<MovementAction, number>>;
  readonly stationaryHoldCount: number;
  readonly zoneVisits: Readonly<Record<GridZone, number>>;
  readonly bearingCounts: Readonly<Record<RelativeBearing, number>>;
  readonly exposedPlanarArmourZoneCounts: Readonly<Record<PlanarArmourZone, number>>;
}

export interface GridActivationReadinessCombatMetrics {
  readonly attacksAttempted: number;
  readonly hits: number;
  readonly misses: number;
  readonly integrityDamageEvents: number;
  readonly criticalHits: number;
  readonly knockbackEvents: number;
  readonly grappleRepositionEvents: number;
  readonly overturnEvents: number;
  readonly componentDamaged: number;
  readonly componentDisabled: number;
  readonly componentDamageResisted: number;
}

export interface GridActivationReadinessResultMetrics {
  readonly judges: number;
  readonly destruction: number;
  readonly immobilisation: number;
  readonly draws: number;
  readonly roundCapMatches: number;
  readonly roundsMin: number;
  readonly roundsMax: number;
  readonly roundsMean: number;
  readonly roundsMedian: number;
  readonly maximumConsecutiveNoProgressRounds: number;
}

export interface GridActivationReadinessSlotOrderMetrics {
  readonly fighterAWins: number;
  readonly fighterBWins: number;
  readonly decisiveMatches: number;
  readonly absoluteFirstSlotAdvantage: number;
  readonly bulwarkMirrorDecisiveCount: number;
  readonly bulwarkMirrorSlotImbalance: number;
  readonly pairedAsymmetricComparisons: number;
  readonly pairedOutcomeStableComparisons: number;
  readonly pairedSlotSensitiveComparisons: number;
  readonly pairedSlotSensitivityRatio: number;
}

export interface GridActivationReadinessTimingMetrics {
  readonly totalElapsedMs: number;
  readonly meanMsPerMatch: number;
  readonly medianMsPerMatch: number;
  readonly p95MsPerMatch: number;
}

export interface GridActivationReadinessMetrics {
  readonly execution: GridActivationReadinessExecutionMetrics;
  readonly movement: GridActivationReadinessMovementMetrics;
  readonly combat: GridActivationReadinessCombatMetrics;
  readonly results: GridActivationReadinessResultMetrics;
  readonly slotOrder: GridActivationReadinessSlotOrderMetrics;
  readonly timing: GridActivationReadinessTimingMetrics;
  /** Attackless rate over non-Sentinel runs (P01 input). */
  readonly attacklessRate: number;
  /** Round-cap rate over all runs (P02 input). */
  readonly roundCapRate: number;
}

export interface GridActivationReadinessMetricsInput {
  outcome: GridActivationReadinessSuiteOutcome;
  execution: {
    deterministicMatches: number;
    invalidEventCount: number;
    mutationFailures: number;
  };
  timing: {
    totalElapsedMs: number;
    perMatchMs: readonly number[];
  };
}

const MOVEMENT_ACTIONS: readonly MovementAction[] = [
  "advance",
  "retreat",
  "circle_left",
  "circle_right",
  "hold",
];

const GRID_ZONES: readonly GridZone[] = [
  "north_west",
  "north",
  "north_east",
  "west",
  "center",
  "east",
  "south_west",
  "south",
  "south_east",
];

const BEARINGS: readonly RelativeBearing[] = [
  "same",
  "front",
  "front_right",
  "right",
  "rear_right",
  "rear",
  "rear_left",
  "left",
  "front_left",
];

const PLANAR_ZONES: readonly PlanarArmourZone[] = ["front", "left", "right", "rear"];

/** Scenario IDs with role-swapped assignment pairs (R2–R7). */
const PAIRED_SCENARIO_IDS: ReadonlySet<string> = new Set<string>([
  "flanker-bulwark",
  "spinner-bulwark",
  "grappler-bulwark",
  "flipper-bulwark",
  "runner-bulwark",
  "sentinel-bulwark",
]);

function sortedMedian(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid]!;
  return (sorted[mid - 1]! + sorted[mid]!) / 2;
}

function percentile(values: readonly number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil((p / 100) * sorted.length) - 1),
  );
  return sorted[rank]!;
}

/** Categorical result of competitor X in a run for slot-order pairing. */
function competitorXCategoricalResult(
  run: GridActivationReadinessRunResult,
): "win" | "loss" | "draw" {
  if (run.winner === null) return "draw";
  if (run.fighterACompetitor === "x") {
    return run.winner === "fighter_a" ? "win" : "loss";
  }
  return run.winner === "fighter_b" ? "win" : "loss";
}

/**
 * Pure metrics reducer. Consumes one validated suite outcome plus execution
 * and timing context and returns aggregate diagnostics.
 */
export function computeGridActivationReadinessMetrics(
  input: GridActivationReadinessMetricsInput,
): GridActivationReadinessMetrics {
  const { outcome, execution, timing } = input;
  const results = outcome.results;

  const actionCounts = {} as Record<MovementAction, number>;
  const translatedActionCounts = {} as Record<MovementAction, number>;
  for (const action of MOVEMENT_ACTIONS) {
    actionCounts[action] = 0;
    translatedActionCounts[action] = 0;
  }
  const zoneVisits = {} as Record<GridZone, number>;
  for (const zone of GRID_ZONES) zoneVisits[zone] = 0;
  const bearingCounts = {} as Record<RelativeBearing, number>;
  for (const bearing of BEARINGS) bearingCounts[bearing] = 0;
  const exposed = {} as Record<PlanarArmourZone, number>;
  for (const zone of PLANAR_ZONES) exposed[zone] = 0;

  let stationaryHoldCount = 0;
  let attacksAttempted = 0;
  let hits = 0;
  let misses = 0;
  let integrityDamageEvents = 0;
  let criticalHits = 0;
  let knockbackEvents = 0;
  let grappleRepositionEvents = 0;
  let overturnEvents = 0;
  let componentDamaged = 0;
  let componentDisabled = 0;
  let componentDamageResisted = 0;

  let judges = 0;
  let destruction = 0;
  let immobilisation = 0;
  let draws = 0;
  let roundCapMatches = 0;
  let fighterAWins = 0;
  let fighterBWins = 0;
  let maximumConsecutiveNoProgressRounds = 0;
  const roundsList: number[] = [];

  let nonSentinelRuns = 0;
  let attacklessNonSentinel = 0;

  for (const run of results) {
    const evidence = run.evidence;
    for (const action of MOVEMENT_ACTIONS) {
      actionCounts[action] += evidence.actionCounts[action] ?? 0;
      translatedActionCounts[action] += evidence.translatedActionCounts[action] ?? 0;
    }
    stationaryHoldCount += evidence.stationaryHoldCount;
    for (const zone of GRID_ZONES) zoneVisits[zone] += evidence.zoneVisits[zone] ?? 0;
    for (const bearing of BEARINGS) {
      bearingCounts[bearing] += evidence.bearingCounts[bearing] ?? 0;
    }
    for (const zone of PLANAR_ZONES) {
      exposed[zone] += evidence.exposedPlanarArmourZoneCounts[zone] ?? 0;
    }
    attacksAttempted += evidence.attacksAttempted;
    hits += evidence.hits;
    misses += evidence.misses;
    integrityDamageEvents += evidence.integrityDamageEvents;
    criticalHits += evidence.criticalHits;
    knockbackEvents += evidence.knockbackEvents;
    grappleRepositionEvents += evidence.grappleRepositionEvents;
    overturnEvents += evidence.overturnEvents;
    componentDamaged += evidence.componentDamaged;
    componentDisabled += evidence.componentDisabled;
    componentDamageResisted += evidence.componentDamageResisted;

    if (run.resultMethod === "judges") judges += 1;
    else if (run.resultMethod === "destruction") destruction += 1;
    else if (run.resultMethod === "immobilisation") immobilisation += 1;
    else draws += 1;
    if (run.rounds >= 20) roundCapMatches += 1;
    if (run.winner === "fighter_a") fighterAWins += 1;
    else if (run.winner === "fighter_b") fighterBWins += 1;
    if (
      run.evidence.maximumConsecutiveNoProgressRounds > maximumConsecutiveNoProgressRounds
    ) {
      maximumConsecutiveNoProgressRounds =
        run.evidence.maximumConsecutiveNoProgressRounds;
    }
    roundsList.push(run.rounds);

    if (run.scenarioId !== "sentinel-bulwark") {
      nonSentinelRuns += 1;
      if (run.evidence.attacksAttempted === 0) attacklessNonSentinel += 1;
    }
  }

  const decisiveMatches = fighterAWins + fighterBWins;
  const absoluteFirstSlotAdvantage = Math.abs(fighterAWins - fighterBWins);

  // Bulwark-mirror slot diagnostics.
  const mirrorRuns = results.filter((run) => run.scenarioId === "bulwark-mirror");
  const mirrorDecisive = mirrorRuns.filter((run) => run.winner !== null);
  const mirrorAWins = mirrorRuns.filter((run) => run.winner === "fighter_a").length;
  const mirrorBWins = mirrorRuns.filter((run) => run.winner === "fighter_b").length;
  const bulwarkMirrorSlotImbalance =
    mirrorDecisive.length > 0
      ? Math.abs(mirrorAWins - mirrorBWins) / mirrorDecisive.length
      : 0;

  // Paired role-swap diagnostics (R2–R7 × 24 seeds).
  let pairedAsymmetricComparisons = 0;
  let pairedOutcomeStableComparisons = 0;
  let pairedSlotSensitiveComparisons = 0;
  const byScenarioAndSeed = new Map<string, GridActivationReadinessRunResult[]>();
  for (const run of results) {
    if (!PAIRED_SCENARIO_IDS.has(run.scenarioId)) continue;
    const key = `${run.scenarioId}|${run.seed}`;
    const list = byScenarioAndSeed.get(key) ?? [];
    list.push(run);
    byScenarioAndSeed.set(key, list);
  }
  for (const runs of byScenarioAndSeed.values()) {
    if (runs.length !== 2) continue;
    const a = runs.find((run) => !run.roleSwapped);
    const b = runs.find((run) => run.roleSwapped);
    if (!a || !b) continue;
    pairedAsymmetricComparisons += 1;
    if (competitorXCategoricalResult(a) === competitorXCategoricalResult(b)) {
      pairedOutcomeStableComparisons += 1;
    } else {
      pairedSlotSensitiveComparisons += 1;
    }
  }

  const meanMs =
    timing.perMatchMs.length > 0
      ? timing.totalElapsedMs / Math.max(1, timing.perMatchMs.length)
      : 0;

  const metrics: GridActivationReadinessMetrics = {
    execution: {
      totalPlannedRuns: GRID_ACTIVATION_READINESS_RUN_COUNT,
      totalCompletedRuns: results.length,
      deterministicMatches: execution.deterministicMatches,
      schemaValidRecords: results.length,
      schemaValidReports: results.length,
      replayAgreeingMatches: results.length,
      invalidEventCount: execution.invalidEventCount,
      mutationFailures: execution.mutationFailures,
    },
    movement: {
      actionCounts,
      translatedActionCounts,
      stationaryHoldCount,
      zoneVisits,
      bearingCounts,
      exposedPlanarArmourZoneCounts: exposed,
    },
    combat: {
      attacksAttempted,
      hits,
      misses,
      integrityDamageEvents,
      criticalHits,
      knockbackEvents,
      grappleRepositionEvents,
      overturnEvents,
      componentDamaged,
      componentDisabled,
      componentDamageResisted,
    },
    results: {
      judges,
      destruction,
      immobilisation,
      draws,
      roundCapMatches,
      roundsMin: roundsList.length > 0 ? Math.min(...roundsList) : 0,
      roundsMax: roundsList.length > 0 ? Math.max(...roundsList) : 0,
      roundsMean:
        roundsList.length > 0
          ? roundsList.reduce((a, b) => a + b, 0) / roundsList.length
          : 0,
      roundsMedian: sortedMedian(roundsList),
      maximumConsecutiveNoProgressRounds,
    },
    slotOrder: {
      fighterAWins,
      fighterBWins,
      decisiveMatches,
      absoluteFirstSlotAdvantage,
      bulwarkMirrorDecisiveCount: mirrorDecisive.length,
      bulwarkMirrorSlotImbalance,
      pairedAsymmetricComparisons,
      pairedOutcomeStableComparisons,
      pairedSlotSensitiveComparisons,
      pairedSlotSensitivityRatio:
        pairedAsymmetricComparisons > 0
          ? pairedSlotSensitiveComparisons / pairedAsymmetricComparisons
          : 0,
    },
    timing: {
      totalElapsedMs: timing.totalElapsedMs,
      meanMsPerMatch: meanMs,
      medianMsPerMatch: sortedMedian(timing.perMatchMs),
      p95MsPerMatch: percentile(timing.perMatchMs, 95),
    },
    attacklessRate: nonSentinelRuns > 0 ? attacklessNonSentinel / nonSentinelRuns : 0,
    roundCapRate: results.length > 0 ? roundCapMatches / results.length : 0,
  };
  return metrics;
}

/**
 * Authoritative metrics-artifact schema. Used to validate `metrics.json` on
 * read-back. Timing is present but informational only.
 */
export const gridActivationReadinessMetricsSchema = z
  .object({
    execution: z.object({
      totalPlannedRuns: z.literal(GRID_ACTIVATION_READINESS_RUN_COUNT),
      totalCompletedRuns: z.number().int().nonnegative(),
      deterministicMatches: z.number().int().nonnegative(),
      schemaValidRecords: z.number().int().nonnegative(),
      schemaValidReports: z.number().int().nonnegative(),
      replayAgreeingMatches: z.number().int().nonnegative(),
      invalidEventCount: z.number().int().nonnegative(),
      mutationFailures: z.number().int().nonnegative(),
    }),
    movement: z.object({
      actionCounts: z.record(z.string(), z.number().int().nonnegative()),
      translatedActionCounts: z.record(z.string(), z.number().int().nonnegative()),
      stationaryHoldCount: z.number().int().nonnegative(),
      zoneVisits: z.record(z.string(), z.number().int().nonnegative()),
      bearingCounts: z.record(z.string(), z.number().int().nonnegative()),
      exposedPlanarArmourZoneCounts: z.record(z.string(), z.number().int().nonnegative()),
    }),
    combat: z.object({
      attacksAttempted: z.number().int().nonnegative(),
      hits: z.number().int().nonnegative(),
      misses: z.number().int().nonnegative(),
      integrityDamageEvents: z.number().int().nonnegative(),
      criticalHits: z.number().int().nonnegative(),
      knockbackEvents: z.number().int().nonnegative(),
      grappleRepositionEvents: z.number().int().nonnegative(),
      overturnEvents: z.number().int().nonnegative(),
      componentDamaged: z.number().int().nonnegative(),
      componentDisabled: z.number().int().nonnegative(),
      componentDamageResisted: z.number().int().nonnegative(),
    }),
    results: z.object({
      judges: z.number().int().nonnegative(),
      destruction: z.number().int().nonnegative(),
      immobilisation: z.number().int().nonnegative(),
      draws: z.number().int().nonnegative(),
      roundCapMatches: z.number().int().nonnegative(),
      roundsMin: z.number().int().nonnegative(),
      roundsMax: z.number().int().nonnegative(),
      roundsMean: z.number().nonnegative(),
      roundsMedian: z.number().nonnegative(),
      maximumConsecutiveNoProgressRounds: z.number().int().nonnegative(),
    }),
    slotOrder: z.object({
      fighterAWins: z.number().int().nonnegative(),
      fighterBWins: z.number().int().nonnegative(),
      decisiveMatches: z.number().int().nonnegative(),
      absoluteFirstSlotAdvantage: z.number().int().nonnegative(),
      bulwarkMirrorDecisiveCount: z.number().int().nonnegative(),
      bulwarkMirrorSlotImbalance: z.number().nonnegative(),
      pairedAsymmetricComparisons: z.number().int().nonnegative(),
      pairedOutcomeStableComparisons: z.number().int().nonnegative(),
      pairedSlotSensitiveComparisons: z.number().int().nonnegative(),
      pairedSlotSensitivityRatio: z.number().nonnegative(),
    }),
    timing: z.object({
      totalElapsedMs: z.number().nonnegative(),
      meanMsPerMatch: z.number().nonnegative(),
      medianMsPerMatch: z.number().nonnegative(),
      p95MsPerMatch: z.number().nonnegative(),
    }),
    attacklessRate: z.number().min(0).max(1),
    roundCapRate: z.number().min(0).max(1),
  })
  .strict();

export type GridActivationReadinessMetricsArtifact = z.infer<
  typeof gridActivationReadinessMetricsSchema
>;

export function deserializeGridActivationReadinessMetrics(
  json: string,
):
  | { ok: true; metrics: GridActivationReadinessMetricsArtifact }
  | { ok: false; errors: string } {
  try {
    const data = JSON.parse(json) as unknown;
    const result = gridActivationReadinessMetricsSchema.safeParse(data);
    if (result.success) return { ok: true, metrics: result.data };
    return { ok: false, errors: result.error.message };
  } catch (e) {
    return { ok: false, errors: e instanceof SyntaxError ? e.message : String(e) };
  }
}
