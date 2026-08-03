import { beforeAll, describe, expect, it } from "vitest";
import {
  executeGridGrappleCoverageSupplement,
  type GridGrappleCoverageRunResult,
  type GridGrappleCoverageSupplementOutcome,
} from "../../src/readiness/grid-grapple-execution-core.js";
import { readinessTestSeedRegistry } from "../helpers/grid-readiness-bundle-builder.js";
import { createGridGrappleCoverageScenarioRegistry } from "../../src/readiness/grid-grapple-scenarios.js";
import { buildGridGrappleCoverageRunPlan } from "../../src/readiness/grid-grapple-run-plan.js";
import {
  extractGridGrappleRunEvidence,
  type GridGrappleRunEvidence,
} from "../../src/readiness/grid-grapple-evidence.js";
import { isGridZone } from "../../src/simulator/arena-grid.js";
import {
  GRAPPLE_SUPPLEMENT_TEST_ID,
  GRAPPLE_SUPPLEMENT_TEST_CREATED_AT,
  grappleSupplementTestMatchIds,
} from "../helpers/grid-grapple-supplement-builder.js";
import {
  GRID_GRAPPLE_COVERAGE_BASE_V3_EVALUATION_ID,
  GRID_GRAPPLE_COVERAGE_BASE_V3_SUITE_CHECKSUM,
} from "../../src/readiness/grid-grapple-supplement-bundle.js";

let outcome: GridGrappleCoverageSupplementOutcome;
let repositionRun: GridGrappleCoverageRunResult | null = null;
let sameCellRun: GridGrappleCoverageRunResult | null = null;

beforeAll(() => {
  const seedRegistry = readinessTestSeedRegistry();
  const scenarioRegistry = createGridGrappleCoverageScenarioRegistry();
  const runPlan = buildGridGrappleCoverageRunPlan({
    seedRegistry,
    scenarioRegistry,
    baseV3EvaluationId: GRID_GRAPPLE_COVERAGE_BASE_V3_EVALUATION_ID,
    baseV3SuiteChecksum: GRID_GRAPPLE_COVERAGE_BASE_V3_SUITE_CHECKSUM,
  });
  outcome = executeGridGrappleCoverageSupplement({
    seedRegistry,
    scenarioRegistry,
    runPlan,
    identities: {
      supplementId: GRAPPLE_SUPPLEMENT_TEST_ID,
      createdAt: GRAPPLE_SUPPLEMENT_TEST_CREATED_AT,
      matchIds: grappleSupplementTestMatchIds(),
    },
  });
  repositionRun =
    outcome.results.find((r) => r.evidence.grappleRepositionEvents > 0) ?? null;
  sameCellRun =
    outcome.results.find((r) => r.evidence.sameCellGrapplerHitsWithoutReposition > 0) ??
    null;
}, 300_000);

function findGrappleMovementEvent(
  record: GridGrappleCoverageRunResult["record"],
  attackerSlot: "fighter_a" | "fighter_b",
): { event: (typeof record.events)[number]; index: number } | null {
  for (let index = 0; index < record.events.length; index++) {
    const event = record.events[index]!;
    if (
      event.type === "movement_resolved" &&
      (event.data as { action?: string }).action === "grapple" &&
      event.actorId === attackerSlot
    ) {
      return { event, index };
    }
  }
  return null;
}

describe("grid grapple coverage evidence (Phase 3E2 Phase 7)", () => {
  it("executes the supplement with grapple events present", () => {
    expect(outcome.results.length).toBe(48);
    expect(repositionRun).not.toBeNull();
  });

  it("detects a valid grapple reposition from the actual event contract", () => {
    expect(repositionRun).not.toBeNull();
    const run = repositionRun!;
    const evidence = extractGridGrappleRunEvidence(run.record, run.attackerSlot);
    expect(evidence.grappleRepositionEvents).toBeGreaterThanOrEqual(1);
    expect(evidence.grappleRepositionEvents).toBe(run.evidence.grappleRepositionEvents);
    // Every grapple reposition must have canonical from/to zones, from !== to
    // and a resolver-agreeing destination.
    const grappleEvent = findGrappleMovementEvent(run.record, run.attackerSlot);
    expect(grappleEvent).not.toBeNull();
    const data = grappleEvent!.event.data as {
      from?: string;
      to?: string;
      action?: string;
    };
    expect(data.action).toBe("grapple");
    expect(isGridZone(data.from)).toBe(true);
    expect(isGridZone(data.to)).toBe(true);
    expect(data.from).not.toBe(data.to);
    // The extraction itself validates the destination against the canonical
    // resolver; a valid event is counted exactly once.
    expect(evidence.malformedOrResolverDisagreeingGrappleEvents).toBe(0);
    expect(evidence.grappleRepositionEvents).toBe(run.evidence.grappleRepositionEvents);
    expect(evidence.grappleRounds).toContain(grappleEvent!.event.round);
  });

  it("counts grappler attempts, hits and misses only for the attacker's grappler weapon", () => {
    expect(repositionRun).not.toBeNull();
    const run = repositionRun!;
    const evidence = extractGridGrappleRunEvidence(run.record, run.attackerSlot);
    let attempts = 0;
    let hits = 0;
    let misses = 0;
    for (const event of run.record.events) {
      const data = event.data as { weapon?: string };
      if (event.actorId === run.attackerSlot && data.weapon === "grappler") {
        if (event.type === "attack_attempted") attempts += 1;
        else if (event.type === "attack_hit") hits += 1;
        else if (event.type === "attack_missed") misses += 1;
      }
    }
    expect(evidence.grapplerAttackAttempts).toBe(attempts);
    expect(evidence.grapplerHits).toBe(hits);
    expect(evidence.grapplerMisses).toBe(misses);
  });

  it("does not count a grappler attack attempt without a hit as a reposition", () => {
    expect(repositionRun).not.toBeNull();
    const run = repositionRun!;
    const evidence = extractGridGrappleRunEvidence(run.record, run.attackerSlot);
    const hits = run.record.events.filter(
      (e) =>
        e.type === "attack_hit" &&
        e.actorId === run.attackerSlot &&
        (e.data as { weapon?: string }).weapon === "grappler",
    ).length;
    expect(evidence.grappleRepositionEvents).toBeLessThanOrEqual(hits);
  });

  it("counts same-cell grappler hits without reposition separately and never as repositions", () => {
    expect(sameCellRun).not.toBeNull();
    const run = sameCellRun!;
    const evidence = extractGridGrappleRunEvidence(run.record, run.attackerSlot);
    expect(evidence.sameCellGrapplerHitsWithoutReposition).toBeGreaterThanOrEqual(1);
    // A same-cell hit can never produce a reposition: the resolver returns
    // null when both fighters share a cell.
    expect(evidence.sameCellGrapplerHitsWithoutReposition).toBeGreaterThanOrEqual(
      evidence.grappleRepositionEvents,
    );
  });

  it("rejects a grapple event whose destination disagrees with the canonical resolver", () => {
    expect(repositionRun).not.toBeNull();
    const run = repositionRun!;
    const grappleEvent = findGrappleMovementEvent(run.record, run.attackerSlot);
    expect(grappleEvent).not.toBeNull();
    const cloned = structuredClone(run.record);
    const data = (cloned.events[grappleEvent!.index] as { data: Record<string, unknown> })
      .data;
    const originalTo = data.to as string;
    const wrongTo = originalTo === "north" ? "south" : "north";
    data.to = wrongTo;
    const evidence = extractGridGrappleRunEvidence(cloned, run.attackerSlot);
    expect(evidence.malformedOrResolverDisagreeingGrappleEvents).toBeGreaterThanOrEqual(
      1,
    );
    expect(evidence.grappleRepositionEvents).toBeLessThan(
      run.evidence.grappleRepositionEvents,
    );
  });

  it("rejects a grapple event attributed to the wrong fighter", () => {
    expect(repositionRun).not.toBeNull();
    const run = repositionRun!;
    const grappleEvent = findGrappleMovementEvent(run.record, run.attackerSlot);
    expect(grappleEvent).not.toBeNull();
    const cloned = structuredClone(run.record);
    (cloned.events[grappleEvent!.index] as { actorId?: string }).actorId =
      run.attackerSlot === "fighter_a" ? "fighter_b" : "fighter_a";
    const evidence = extractGridGrappleRunEvidence(cloned, run.attackerSlot);
    expect(evidence.grappleEventsAttributedToWrongFighter).toBeGreaterThanOrEqual(1);
  });

  it("rejects a grapple event with from === to (no reposition)", () => {
    expect(repositionRun).not.toBeNull();
    const run = repositionRun!;
    const grappleEvent = findGrappleMovementEvent(run.record, run.attackerSlot);
    expect(grappleEvent).not.toBeNull();
    const cloned = structuredClone(run.record);
    const data = (cloned.events[grappleEvent!.index] as { data: Record<string, unknown> })
      .data;
    data.to = data.from;
    const evidence = extractGridGrappleRunEvidence(cloned, run.attackerSlot);
    expect(evidence.malformedOrResolverDisagreeingGrappleEvents).toBeGreaterThanOrEqual(
      1,
    );
    expect(evidence.grappleRepositionEvents).toBeLessThan(
      run.evidence.grappleRepositionEvents,
    );
  });

  it("does not count knockback or non-grappler attacks as grapple repositions", () => {
    expect(repositionRun).not.toBeNull();
    const run = repositionRun!;
    const evidence = extractGridGrappleRunEvidence(run.record, run.attackerSlot);
    const nonGrapple = run.record.events.filter(
      (e) =>
        e.type === "movement_resolved" &&
        (e.data as { action?: string }).action === "knockback",
    ).length;
    expect(evidence.nonGrappleKnockbackEvents).toBe(nonGrapple);
    // The target (hammer) never emits grapple events.
    for (const event of run.record.events) {
      if (
        event.type === "movement_resolved" &&
        (event.data as { action?: string }).action === "grapple"
      ) {
        expect(event.actorId).toBe(run.attackerSlot);
      }
    }
  });

  it("reports grapple source/destination zones and rounds", () => {
    expect(repositionRun).not.toBeNull();
    const run = repositionRun!;
    const evidence: GridGrappleRunEvidence = run.evidence;
    expect(evidence.grappleRounds.length).toBe(evidence.grappleRepositionEvents);
    const sourceTotal = Object.values(evidence.grappleSourceZones).reduce(
      (a, b) => a + b,
      0,
    );
    const destTotal = Object.values(evidence.grappleDestinationZones).reduce(
      (a, b) => a + b,
      0,
    );
    expect(sourceTotal).toBe(evidence.grappleRepositionEvents);
    expect(destTotal).toBe(evidence.grappleRepositionEvents);
    for (const round of evidence.grappleRounds) {
      expect(round).toBeGreaterThanOrEqual(1);
    }
  });

  it("maintains the causal ledger invariant attempts = hits + misses on every run", () => {
    for (const run of outcome.results) {
      const evidence = extractGridGrappleRunEvidence(run.record, run.attackerSlot);
      expect(evidence.grapplerAttackAttempts).toBe(
        evidence.grapplerHits + evidence.grapplerMisses,
      );
      // The real runtime produces no ledger violations.
      expect(evidence.malformedOrResolverDisagreeingGrappleEvents).toBe(0);
      expect(evidence.grappleEventsAttributedToWrongFighter).toBe(0);
    }
  });

  it("does not infer the hidden 50% reposition roll: a hit without movement is valid", () => {
    for (const run of outcome.results) {
      const evidence = extractGridGrappleRunEvidence(run.record, run.attackerSlot);
      expect(evidence.grappleRepositionEvents).toBeLessThanOrEqual(evidence.grapplerHits);
      expect(
        evidence.grapplerHits -
          evidence.sameCellGrapplerHitsWithoutReposition -
          evidence.grappleRepositionEvents,
      ).toBeGreaterThanOrEqual(0);
    }
  });

  it("rejects a resolver-valid grapple movement without a preceding Grappler hit", () => {
    expect(repositionRun).not.toBeNull();
    const run = repositionRun!;
    const grappleEvent = findGrappleMovementEvent(run.record, run.attackerSlot);
    expect(grappleEvent).not.toBeNull();
    const cloned = structuredClone(run.record);
    // Remove the attack_hit that precedes the grapple movement (keep the
    // attempt so the ledger sees an attempt without an outcome).
    const hitIndex = (() => {
      for (let i = grappleEvent!.index - 1; i >= 0; i--) {
        const e = cloned.events[i]!;
        if (
          e.type === "attack_hit" &&
          e.actorId === run.attackerSlot &&
          e.round === grappleEvent!.event.round
        ) {
          return i;
        }
      }
      return -1;
    })();
    expect(hitIndex).toBeGreaterThanOrEqual(0);
    cloned.events.splice(hitIndex, 1);
    const evidence = extractGridGrappleRunEvidence(cloned, run.attackerSlot);
    expect(evidence.malformedOrResolverDisagreeingGrappleEvents).toBeGreaterThanOrEqual(
      1,
    );
    expect(evidence.grappleRepositionEvents).toBeLessThan(
      run.evidence.grappleRepositionEvents,
    );
  });

  it("rejects a grapple event with a false tracked defender origin", () => {
    expect(repositionRun).not.toBeNull();
    const run = repositionRun!;
    const grappleEvent = findGrappleMovementEvent(run.record, run.attackerSlot);
    expect(grappleEvent).not.toBeNull();
    const cloned = structuredClone(run.record);
    const data = (cloned.events[grappleEvent!.index] as { data: Record<string, unknown> })
      .data;
    const originalFrom = data.from as string;
    const falseFrom = originalFrom === "north" ? "south" : "north";
    data.from = falseFrom;
    const evidence = extractGridGrappleRunEvidence(cloned, run.attackerSlot);
    expect(evidence.malformedOrResolverDisagreeingGrappleEvents).toBeGreaterThanOrEqual(
      1,
    );
    expect(evidence.grappleRepositionEvents).toBeLessThan(
      run.evidence.grappleRepositionEvents,
    );
  });

  it("rejects a second resolver-valid grapple event for one hit", () => {
    expect(repositionRun).not.toBeNull();
    const run = repositionRun!;
    const grappleEvent = findGrappleMovementEvent(run.record, run.attackerSlot);
    expect(grappleEvent).not.toBeNull();
    const cloned = structuredClone(run.record);
    // Duplicate the grapple movement; only the first may consume the hit.
    cloned.events.splice(
      grappleEvent!.index + 1,
      0,
      structuredClone(grappleEvent!.event),
    );
    const evidence = extractGridGrappleRunEvidence(cloned, run.attackerSlot);
    expect(evidence.malformedOrResolverDisagreeingGrappleEvents).toBeGreaterThanOrEqual(
      1,
    );
    expect(evidence.grappleRepositionEvents).toBe(run.evidence.grappleRepositionEvents);
  });

  it("rejects an attack outcome without a matching attempt", () => {
    expect(repositionRun).not.toBeNull();
    const run = repositionRun!;
    const cloned = structuredClone(run.record);
    const attemptIndex = (() => {
      for (let i = 0; i < cloned.events.length; i++) {
        const e = cloned.events[i]!;
        if (
          e.type === "attack_attempted" &&
          e.actorId === run.attackerSlot &&
          (e.data as { weapon?: string }).weapon === "grappler"
        ) {
          return i;
        }
      }
      return -1;
    })();
    expect(attemptIndex).toBeGreaterThanOrEqual(0);
    cloned.events.splice(attemptIndex, 1);
    const evidence = extractGridGrappleRunEvidence(cloned, run.attackerSlot);
    expect(evidence.malformedOrResolverDisagreeingGrappleEvents).toBeGreaterThanOrEqual(
      1,
    );
    expect(evidence.grapplerAttackAttempts).toBeLessThan(
      run.evidence.grapplerAttackAttempts,
    );
  });
});
