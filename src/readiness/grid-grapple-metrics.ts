import type { GridZone } from "../simulator/arena-grid.js";
import { GRID_GRAPPLE_COVERAGE_SUPPLEMENT_RUN_COUNT } from "./grid-grapple-run-plan.js";
import type { GridGrappleRunEvidence } from "./grid-grapple-evidence.js";
import type { GridGrappleCoverageRunResult } from "./grid-grapple-execution-core.js";

/**
 * Pure grid grapple-coverage supplemental metrics reducer (Milestone 0.2C
 * Phase 3E2, Phase 9).
 *
 * Reduces the 48 canonical supplemental run sources into aggregate execution,
 * grapple-feature and isolation diagnostics. Grapple feature counts come
 * exclusively from the authoritative event contract via
 * `extractGridGrappleRunEvidence`; they are never derived from report-only
 * statements. Timing is informational only and never affects the supplement
 * decision. The reducer is source-agnostic: it consumes either live suite
 * results or persisted run-index entries.
 */
export interface GridGrappleCoverageMetricRunSource {
  readonly runNumber: number;
  readonly seed: number;
  readonly attackerSlot: "fighter_a" | "fighter_b";
  readonly winner: string | null;
  readonly resultMethod: string;
  readonly rounds: number;
  readonly eventCount: number;
  readonly evidence: GridGrappleRunEvidence;
}

export interface GridGrappleCoverageExecutionMetrics {
  readonly totalPlannedRuns: number;
  readonly totalCompletedRuns: number;
  readonly deterministicRuns: number;
  readonly schemaValidRecords: number;
  readonly schemaValidReports: number;
  readonly finalStateAgreements: number;
  readonly invalidEventCount: number;
  readonly mutationFailures: number;
}

export interface GridGrappleCoverageGrappleMetrics {
  readonly totalGrapplerAttackAttempts: number;
  readonly totalGrapplerHits: number;
  readonly totalGrapplerMisses: number;
  readonly validGrappleRepositionEvents: number;
  readonly sameCellGrapplerHitsWithoutReposition: number;
  readonly distinctSeedsProducingReposition: number;
  readonly fighterAAttackerRepositionCount: number;
  readonly fighterBAttackerRepositionCount: number;
  readonly distinctSeedsProducingFighterAAttackerReposition: number;
  readonly distinctSeedsProducingFighterBAttackerReposition: number;
  readonly grappleSourceZoneCounts: Readonly<Record<GridZone, number>>;
  readonly grappleDestinationZoneCounts: Readonly<Record<GridZone, number>>;
  readonly grappleRoundMin: number | null;
  readonly grappleRoundMax: number | null;
  readonly grappleRoundMedian: number | null;
}

export interface GridGrappleCoverageIsolationMetrics {
  readonly nonGrappleKnockbackEvents: number;
  readonly overturnEvents: number;
  readonly grappleEventsAttributedToWrongFighter: number;
  readonly malformedOrResolverDisagreeingGrappleEvents: number;
}

export interface GridGrappleCoverageTimingMetrics {
  readonly totalElapsedMs: number;
  readonly meanMsPerMatch: number;
  readonly medianMsPerMatch: number;
  readonly p95MsPerMatch: number;
}

export interface GridGrappleCoverageMetrics {
  readonly execution: GridGrappleCoverageExecutionMetrics;
  readonly grapple: GridGrappleCoverageGrappleMetrics;
  readonly isolation: GridGrappleCoverageIsolationMetrics;
  readonly timing: GridGrappleCoverageTimingMetrics;
}

function emptyZoneCounts(): Record<GridZone, number> {
  return {
    north_west: 0,
    north: 0,
    north_east: 0,
    west: 0,
    center: 0,
    east: 0,
    south_west: 0,
    south: 0,
    south_east: 0,
  };
}

function medianSorted(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid]!;
  return (sorted[mid - 1]! + sorted[mid]!) / 2;
}

export interface ComputeGridGrappleCoverageMetricsParams {
  runs: readonly GridGrappleCoverageMetricRunSource[];
  execution: {
    deterministicRuns: number;
    schemaValidRecords: number;
    schemaValidReports: number;
    finalStateAgreements: number;
    invalidEventCount: number;
    mutationFailures: number;
  };
  timing: {
    totalElapsedMs: number;
    perMatchMs: readonly number[];
  };
}

/**
 * Pure reducer over the 48 supplemental runs. Asserts the exact run count and
 * aggregates the authoritative grapple evidence.
 */
export function computeGridGrappleCoverageMetrics(
  params: ComputeGridGrappleCoverageMetricsParams,
): GridGrappleCoverageMetrics {
  const { runs, execution, timing } = params;
  if (runs.length !== GRID_GRAPPLE_COVERAGE_SUPPLEMENT_RUN_COUNT) {
    throw new Error(
      `Grid grapple coverage metrics require exactly ${GRID_GRAPPLE_COVERAGE_SUPPLEMENT_RUN_COUNT} runs; received ${runs.length}`,
    );
  }

  const sourceZones = emptyZoneCounts();
  const destinationZones = emptyZoneCounts();
  const grappleRounds: number[] = [];
  const seedsProducingReposition = new Set<number>();
  const seedsProducingFighterAAttacker = new Set<number>();
  const seedsProducingFighterBAttacker = new Set<number>();

  let totalGrapplerAttackAttempts = 0;
  let totalGrapplerHits = 0;
  let totalGrapplerMisses = 0;
  let validGrappleRepositionEvents = 0;
  let sameCellGrapplerHitsWithoutReposition = 0;
  let fighterAAttackerRepositionCount = 0;
  let fighterBAttackerRepositionCount = 0;
  let nonGrappleKnockbackEvents = 0;
  let overturnEvents = 0;
  let grappleEventsAttributedToWrongFighter = 0;
  let malformedOrResolverDisagreeingGrappleEvents = 0;

  for (const run of runs) {
    const e = run.evidence;
    totalGrapplerAttackAttempts += e.grapplerAttackAttempts;
    totalGrapplerHits += e.grapplerHits;
    totalGrapplerMisses += e.grapplerMisses;
    validGrappleRepositionEvents += e.grappleRepositionEvents;
    sameCellGrapplerHitsWithoutReposition += e.sameCellGrapplerHitsWithoutReposition;
    nonGrappleKnockbackEvents += e.nonGrappleKnockbackEvents;
    overturnEvents += e.overturnEvents;
    grappleEventsAttributedToWrongFighter += e.grappleEventsAttributedToWrongFighter;
    malformedOrResolverDisagreeingGrappleEvents +=
      e.malformedOrResolverDisagreeingGrappleEvents;

    for (const zone of Object.keys(e.grappleSourceZones) as GridZone[]) {
      sourceZones[zone] += e.grappleSourceZones[zone]!;
    }
    for (const zone of Object.keys(e.grappleDestinationZones) as GridZone[]) {
      destinationZones[zone] += e.grappleDestinationZones[zone]!;
    }
    grappleRounds.push(...e.grappleRounds);

    if (e.grappleRepositionEvents > 0) {
      seedsProducingReposition.add(run.seed);
      if (run.attackerSlot === "fighter_a") {
        fighterAAttackerRepositionCount += e.grappleRepositionEvents;
        seedsProducingFighterAAttacker.add(run.seed);
      } else {
        fighterBAttackerRepositionCount += e.grappleRepositionEvents;
        seedsProducingFighterBAttacker.add(run.seed);
      }
    }
  }

  const perMatchMs = [...timing.perMatchMs];
  const sortedMs = [...perMatchMs].sort((a, b) => a - b);
  const meanMs =
    perMatchMs.length === 0
      ? 0
      : perMatchMs.reduce((sum, value) => sum + value, 0) / perMatchMs.length;
  const medianMs = medianSorted(sortedMs) ?? 0;
  const p95Ms =
    sortedMs.length === 0
      ? 0
      : sortedMs[Math.min(sortedMs.length - 1, Math.floor(sortedMs.length * 0.95))]!;

  return {
    execution: {
      totalPlannedRuns: GRID_GRAPPLE_COVERAGE_SUPPLEMENT_RUN_COUNT,
      totalCompletedRuns: runs.length,
      deterministicRuns: execution.deterministicRuns,
      schemaValidRecords: execution.schemaValidRecords,
      schemaValidReports: execution.schemaValidReports,
      finalStateAgreements: execution.finalStateAgreements,
      invalidEventCount: execution.invalidEventCount,
      mutationFailures: execution.mutationFailures,
    },
    grapple: {
      totalGrapplerAttackAttempts,
      totalGrapplerHits,
      totalGrapplerMisses,
      validGrappleRepositionEvents,
      sameCellGrapplerHitsWithoutReposition,
      distinctSeedsProducingReposition: seedsProducingReposition.size,
      fighterAAttackerRepositionCount,
      fighterBAttackerRepositionCount,
      distinctSeedsProducingFighterAAttackerReposition:
        seedsProducingFighterAAttacker.size,
      distinctSeedsProducingFighterBAttackerReposition:
        seedsProducingFighterBAttacker.size,
      grappleSourceZoneCounts: sourceZones,
      grappleDestinationZoneCounts: destinationZones,
      grappleRoundMin: grappleRounds.length === 0 ? null : Math.min(...grappleRounds),
      grappleRoundMax: grappleRounds.length === 0 ? null : Math.max(...grappleRounds),
      grappleRoundMedian: medianSorted(grappleRounds),
    },
    isolation: {
      nonGrappleKnockbackEvents,
      overturnEvents,
      grappleEventsAttributedToWrongFighter,
      malformedOrResolverDisagreeingGrappleEvents,
    },
    timing: {
      totalElapsedMs: timing.totalElapsedMs,
      meanMsPerMatch: meanMs,
      medianMsPerMatch: medianMs,
      p95MsPerMatch: p95Ms,
    },
  };
}

/** Converts a live run result into the source-agnostic metric run source. */
export function gridGrappleRunToMetricSource(
  run: GridGrappleCoverageRunResult,
): GridGrappleCoverageMetricRunSource {
  return {
    runNumber: run.runNumber,
    seed: run.seed,
    attackerSlot: run.attackerSlot,
    winner: run.winner,
    resultMethod: run.resultMethod,
    rounds: run.rounds,
    eventCount: run.eventCount,
    evidence: run.evidence,
  };
}
