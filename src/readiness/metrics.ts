import type {
  GridZone,
  PlanarArmourZone,
  RelativeBearing,
} from "../simulator/arena-grid.js";
import type { CombatAction, MovementAction, VictoryMethod } from "../simulator/types.js";
import {
  GRID_ACTIVATION_READINESS_RUN_COUNT,
  GRID_ACTIVATION_READINESS_SUITE_ID,
  GRID_ACTIVATION_READINESS_SUITE_ID_V2,
} from "./run-plan.js";
import {
  assertGridReadinessRecordReportFinalAgreement,
  inspectGridReadinessRecordEvidence,
  type GridActivationReadinessRunEvidence,
} from "./record-evidence.js";
import type { GridReadinessCompetitor } from "./scenario-registry.js";
import type {
  GridActivationReadinessRunIndexEnvelopeV3,
  GridActivationReadinessMatchRecordsEnvelope,
  GridActivationReadinessFactualReportsEnvelope,
} from "./envelopes.schema.js";
import { z } from "zod";

/**
 * Pure grid activation-readiness metrics reducer (Milestone 0.2C Phase 3E1 /
 * 3E1.1).
 *
 * Reduces the 312 canonical run sources into aggregate execution, movement,
 * combat, result, slot-order and timing diagnostics. Slot-order diagnostics
 * detect gross slot-order pathology only; they are not design-balance
 * qualification. Timing is informational only and never affects the readiness
 * decision. The reducer is source-agnostic: it consumes either live suite
 * results or persisted run-index entries, so the persisted metrics artifact
 * can be recomputed exactly from the persisted records and reports.
 */
export interface GridActivationReadinessMetricRunSource {
  readonly resultMethod: VictoryMethod;
  readonly rounds: number;
  readonly winner: string | null;
  readonly scenarioId: string;
  readonly seed: number;
  readonly fighterACompetitor: GridReadinessCompetitor;
  readonly roleSwapped: boolean;
  readonly evidence: GridActivationReadinessRunEvidence;
}

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
  /** Selected combat-action counts from `policy_triggered` (v2). */
  readonly selectedCombatActionCounts: Readonly<Record<string, number>>;
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
  /** 312 canonical run sources (live outcome or persisted run index). */
  runs: readonly GridActivationReadinessMetricRunSource[];
  /**
   * Authoritative execution metrics (Phase 3E1.2, Phase 9). These are the
   * value being verified, never copied from a persisted metrics artifact:
   * totalPlannedRuns from the canonical plan, totalCompletedRuns / schema
   * counts from the parsed and bound records, replayAgreeingMatches from the
   * complete report/final-state agreement check, invalidEventCount is zero
   * after every record passes the authoritative inspector, and
   * deterministicMatches / mutationFailures come from the explicit
   * operational attestations.
   */
  execution: GridActivationReadinessExecutionMetrics;
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
  run: GridActivationReadinessMetricRunSource,
): "win" | "loss" | "draw" {
  if (run.winner === null) return "draw";
  if (run.fighterACompetitor === "x") {
    return run.winner === "fighter_a" ? "win" : "loss";
  }
  return run.winner === "fighter_b" ? "win" : "loss";
}

/**
 * Pure metrics reducer. Consumes 312 canonical run sources plus execution and
 * timing context and returns aggregate diagnostics.
 */
export function computeGridActivationReadinessMetrics(
  input: GridActivationReadinessMetricsInput,
): GridActivationReadinessMetrics {
  const { runs, execution, timing } = input;
  const results = runs;

  const actionCounts = {} as Record<MovementAction, number>;
  const translatedActionCounts = {} as Record<MovementAction, number>;
  for (const action of MOVEMENT_ACTIONS) {
    actionCounts[action] = 0;
    translatedActionCounts[action] = 0;
  }
  const selectedCombatActionCounts: Record<CombatAction, number> = {
    attack: 0,
    defend: 0,
    idle: 0,
  };
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
    for (const action of ["attack", "defend", "idle"] as const) {
      selectedCombatActionCounts[action] +=
        evidence.selectedCombatActionCounts[action] ?? 0;
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
  const byScenarioAndSeed = new Map<string, GridActivationReadinessMetricRunSource[]>();
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
      totalPlannedRuns: execution.totalPlannedRuns,
      totalCompletedRuns: execution.totalCompletedRuns,
      deterministicMatches: execution.deterministicMatches,
      schemaValidRecords: execution.schemaValidRecords,
      schemaValidReports: execution.schemaValidReports,
      replayAgreeingMatches: execution.replayAgreeingMatches,
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
      selectedCombatActionCounts,
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

const metricsExecutionSchema = z.object({
  totalPlannedRuns: z.literal(GRID_ACTIVATION_READINESS_RUN_COUNT),
  totalCompletedRuns: z.number().int().nonnegative(),
  deterministicMatches: z.number().int().nonnegative(),
  schemaValidRecords: z.number().int().nonnegative(),
  schemaValidReports: z.number().int().nonnegative(),
  replayAgreeingMatches: z.number().int().nonnegative(),
  invalidEventCount: z.number().int().nonnegative(),
  mutationFailures: z.number().int().nonnegative(),
});

const metricsMovementSchema = z.object({
  actionCounts: z.record(z.string(), z.number().int().nonnegative()),
  translatedActionCounts: z.record(z.string(), z.number().int().nonnegative()),
  stationaryHoldCount: z.number().int().nonnegative(),
  zoneVisits: z.record(z.string(), z.number().int().nonnegative()),
  bearingCounts: z.record(z.string(), z.number().int().nonnegative()),
  exposedPlanarArmourZoneCounts: z.record(z.string(), z.number().int().nonnegative()),
});

const metricsCombatV2Schema = z.object({
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
  selectedCombatActionCounts: z.record(z.string(), z.number().int().nonnegative()),
});

const metricsCombatV1Schema = z.object({
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
});

const metricsResultsSchema = z.object({
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
});

const metricsSlotOrderSchema = z.object({
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
});

const metricsTimingSchema = z.object({
  totalElapsedMs: z.number().nonnegative(),
  meanMsPerMatch: z.number().nonnegative(),
  medianMsPerMatch: z.number().nonnegative(),
  p95MsPerMatch: z.number().nonnegative(),
});

/**
 * Authoritative metrics v3 artifact schema. Used to validate `metrics.json`
 * on read-back and as the reference for exact metrics recomputation. Timing
 * is present but informational only; the non-timing execution fields are
 * record-derived and operational-attestation values, never copied from this
 * artifact.
 */
export const gridActivationReadinessMetricsV3Schema = z
  .object({
    schemaVersion: z.literal("3"),
    suiteId: z.literal(GRID_ACTIVATION_READINESS_SUITE_ID),
    execution: metricsExecutionSchema,
    movement: metricsMovementSchema,
    combat: metricsCombatV2Schema,
    results: metricsResultsSchema,
    slotOrder: metricsSlotOrderSchema,
    timing: metricsTimingSchema,
    attacklessRate: z.number().min(0).max(1),
    roundCapRate: z.number().min(0).max(1),
  })
  .strict();

export type GridActivationReadinessMetricsV3Artifact = z.infer<
  typeof gridActivationReadinessMetricsV3Schema
>;

/** Historical metrics v2 artifact schema (suite v2, selected combat counts). */
export const gridActivationReadinessMetricsV2Schema = z
  .object({
    schemaVersion: z.literal("2"),
    suiteId: z.literal(GRID_ACTIVATION_READINESS_SUITE_ID_V2),
    execution: metricsExecutionSchema,
    movement: metricsMovementSchema,
    combat: metricsCombatV2Schema,
    results: metricsResultsSchema,
    slotOrder: metricsSlotOrderSchema,
    timing: metricsTimingSchema,
    attacklessRate: z.number().min(0).max(1),
    roundCapRate: z.number().min(0).max(1),
  })
  .strict();

export type GridActivationReadinessMetricsV2Artifact = z.infer<
  typeof gridActivationReadinessMetricsV2Schema
>;

/**
 * Historical metrics v1 artifact schema (no suite identity, no selected
 * combat counts). Retained for historical parsers only; never accepted as
 * current activation-readiness evidence.
 */
export const gridActivationReadinessMetricsV1Schema = z
  .object({
    execution: metricsExecutionSchema,
    movement: metricsMovementSchema,
    combat: metricsCombatV1Schema,
    results: metricsResultsSchema,
    slotOrder: metricsSlotOrderSchema,
    timing: metricsTimingSchema,
    attacklessRate: z.number().min(0).max(1),
    roundCapRate: z.number().min(0).max(1),
  })
  .strict();

export type GridActivationReadinessMetricsV1Artifact = z.infer<
  typeof gridActivationReadinessMetricsV1Schema
>;

/** Current (v3) metrics artifact type. */
export type GridActivationReadinessMetricsArtifact =
  GridActivationReadinessMetricsV3Artifact;

/**
 * Wraps reduced metrics with the v3 artifact identity (schemaVersion + suiteId)
 * for the persisted `metrics.json` artifact.
 */
export function wrapGridActivationReadinessMetricsV3(
  metrics: GridActivationReadinessMetrics,
): GridActivationReadinessMetricsV3Artifact {
  return {
    schemaVersion: "3",
    suiteId: GRID_ACTIVATION_READINESS_SUITE_ID,
    ...metrics,
  } as GridActivationReadinessMetricsV3Artifact;
}

/**
 * Strips the v3 artifact identity wrapper, yielding the plain reduced metrics
 * shape used by gates and the report renderer.
 */
export function stripGridActivationReadinessMetricsV3(
  artifact: GridActivationReadinessMetricsV3Artifact,
): GridActivationReadinessMetrics {
  const { schemaVersion: _schemaVersion, suiteId: _suiteId, ...rest } = artifact;
  return rest as GridActivationReadinessMetrics;
}

export function deserializeGridActivationReadinessMetrics(json: string):
  | {
      ok: true;
      metrics: GridActivationReadinessMetricsArtifact;
      schemaVersion: "1" | "2" | "3";
    }
  | { ok: false; errors: string } {
  try {
    const data = JSON.parse(json) as unknown;
    const v3 = gridActivationReadinessMetricsV3Schema.safeParse(data);
    if (v3.success) return { ok: true, metrics: v3.data, schemaVersion: "3" };
    const v2 = gridActivationReadinessMetricsV2Schema.safeParse(data);
    if (v2.success) return { ok: true, metrics: v2.data as never, schemaVersion: "2" };
    const v1 = gridActivationReadinessMetricsV1Schema.safeParse(data);
    if (v1.success) return { ok: true, metrics: v1.data as never, schemaVersion: "1" };
    return {
      ok: false,
      errors: `metrics matched neither v3 (${v3.error.message}) nor v2 (${v2.error.message}) nor v1 (${v1.error.message})`,
    };
  } catch (e) {
    return { ok: false, errors: e instanceof SyntaxError ? e.message : String(e) };
  }
}

/**
 * Explicit operational attestations (Phase 3E1.2, Phase 7/9). These are the
 * only execution facts that cannot be reconstructed from the persisted
 * records: `deterministicMatches` follows the manifest
 * `deterministicReexecutionPassed` attestation (312 when true) and
 * `mutationFailures` follows the manifest `inputsUnmodified` attestation (0
 * when true).
 */
export interface GridActivationReadinessOperationalAttestations {
  readonly deterministicMatches: number;
  readonly mutationFailures: number;
}

/**
 * Recomputes every non-timing metric from the persisted artifacts (Phase 9).
 * Per-run evidence is derived from the persisted match records through the
 * shared record-evidence inspector (any inspector failure invalidates the
 * bundle, so the authoritative invalid-event count is exactly zero);
 * `replayAgreeingMatches` is the number of record/report pairs passing the
 * complete report/final-state agreement check; schema-valid counts are the
 * parsed envelope counts; `totalPlannedRuns` is the canonical 312. Only the
 * explicit operational attestations (deterministic re-execution, input
 * immutability) and timing (informational, passed through from the persisted
 * artifact) are supplied from outside the records. The persisted metrics
 * artifact is the value being verified, never the source of truth for its
 * non-timing execution fields.
 */
export function recomputeGridActivationReadinessMetricsFromArtifacts(input: {
  runIndex: GridActivationReadinessRunIndexEnvelopeV3;
  records: GridActivationReadinessMatchRecordsEnvelope;
  reports: GridActivationReadinessFactualReportsEnvelope;
  operationalAttestations: GridActivationReadinessOperationalAttestations;
  persistedTiming: GridActivationReadinessTimingMetrics;
}): GridActivationReadinessMetrics {
  const { runIndex, records, reports, operationalAttestations, persistedTiming } = input;
  if (
    runIndex.items.length !== GRID_ACTIVATION_READINESS_RUN_COUNT ||
    records.items.length !== GRID_ACTIVATION_READINESS_RUN_COUNT ||
    reports.items.length !== GRID_ACTIVATION_READINESS_RUN_COUNT
  ) {
    throw new Error(
      "Metrics recomputation requires exactly 312 run-index, record and report items",
    );
  }
  const runs = runIndex.items.map((entry, index) => {
    const record = records.items[index]!;
    const report = reports.items[index]!;
    if (record.matchId !== entry.matchId || report.matchId !== entry.matchId) {
      throw new Error(
        `Metrics recomputation: run ${entry.runNumber} record/report matchId does not match the run index`,
      );
    }
    return {
      resultMethod: entry.resultMethod,
      rounds: entry.rounds,
      winner: entry.winner,
      scenarioId: entry.scenarioId,
      seed: entry.seed,
      fighterACompetitor: entry.fighterACompetitor,
      roleSwapped: entry.roleSwapped,
      // Throws on any malformed/chronologically invalid/duplicate/impossible
      // event fact: any inspector failure invalidates the bundle.
      evidence: inspectGridReadinessRecordEvidence(record),
    };
  });
  // Complete report/final-state agreement (Phase 8): count the record/report
  // pairs that pass the complete agreement check. Non-agreeing pairs count as
  // non-replay-agreeing; they never validate a publishable bundle.
  let replayAgreeingMatches = 0;
  for (let index = 0; index < records.items.length; index++) {
    try {
      assertGridReadinessRecordReportFinalAgreement(
        records.items[index]!,
        reports.items[index]!,
      );
      replayAgreeingMatches += 1;
    } catch {
      // Non-agreeing pair: counted, not re-thrown here (metrics recompute
      // completes so the bundle validator can report the disagreement).
    }
  }
  const computed = computeGridActivationReadinessMetrics({
    runs,
    execution: {
      totalPlannedRuns: GRID_ACTIVATION_READINESS_RUN_COUNT,
      totalCompletedRuns: records.items.length,
      deterministicMatches: operationalAttestations.deterministicMatches,
      schemaValidRecords: records.items.length,
      schemaValidReports: reports.items.length,
      replayAgreeingMatches,
      invalidEventCount: 0,
      mutationFailures: operationalAttestations.mutationFailures,
    },
    // Per-run timing samples are not persisted; timing aggregates are
    // supplied from the persisted metrics artifact and passed through.
    timing: {
      totalElapsedMs: persistedTiming.totalElapsedMs,
      perMatchMs: [],
    },
  });
  return {
    ...computed,
    timing: { ...persistedTiming },
  };
}
