import { describe, expect, it } from "vitest";
import { runMatch } from "../../src/simulator/simulator.js";
import { runGridMatch } from "../../src/simulator/grid-runtime.js";
import { CATALOGUE_V1 } from "../../src/catalogue/catalogue.v1.js";
import {
  createBulwarkBuild,
  BULWARK_POLICY,
} from "../../src/agents/scripted/bulwark-agent.js";
import {
  buildFactualReport,
  buildGridFactualReport,
  enrichMatchSummariesWithPolicy,
} from "../../src/reports/factual-match-report.js";
import {
  validateFactualMatchReport,
  isFactualReportV1,
  isFactualReportV2,
} from "../../src/schemas/factual-report.schema.js";
import {
  buildReviewUserPrompt,
  buildFallbackReview,
} from "../../src/prompts/review-prompt.v1.js";
import { formatFactualReportForPrompt } from "../../src/reports/review-formatter.js";
import type {
  GridMatchResult,
  MatchResult,
  SimulationEvent,
} from "../../src/simulator/types.js";

const build = createBulwarkBuild();

function legacyResult(seed = 42): MatchResult {
  return runMatch({
    seed,
    fighterA: { build, policy: BULWARK_POLICY },
    fighterB: { build, policy: BULWARK_POLICY },
    rulesetVersion: "0.1.0",
    catalogueVersion: CATALOGUE_V1.version,
  });
}

function gridResult(seed = 42): GridMatchResult {
  return runGridMatch({
    seed,
    fighterA: { build, policy: BULWARK_POLICY },
    fighterB: { build, policy: BULWARK_POLICY },
    rulesetVersion: "0.2.0",
    catalogueVersion: CATALOGUE_V1.version,
  });
}

function withEvent<T extends { events: SimulationEvent[] }>(
  result: T,
  event: SimulationEvent,
): T {
  return { ...result, events: [...result.events, event] };
}

function movementEvent(overrides: Partial<SimulationEvent> = {}): SimulationEvent {
  return {
    schemaVersion: "1",
    sequence: 999,
    round: 99,
    timestampMs: 0,
    type: "movement_resolved",
    actorId: "fighter_a",
    targetId: "fighter_b",
    data: { from: "south", to: "center", facing: "north", action: "advance" },
    ...overrides,
  };
}

function roundEnd(
  fighterA: Record<string, unknown>,
  fighterB: Record<string, unknown> = {
    integrity: 100,
    energy: 60,
    heat: 5,
    zone: "north",
    conditions: [],
  },
): SimulationEvent {
  return {
    schemaVersion: "1",
    sequence: 999,
    round: 99,
    timestampMs: 0,
    type: "round_ended",
    data: { fighterA, fighterB },
  };
}

describe("report-builder boundary validation (Phase 3D1.1)", () => {
  it("returns a valid v1 report that passes its authoritative schema", () => {
    const report = buildFactualReport(legacyResult());
    expect(isFactualReportV1(report)).toBe(true);
    expect(validateFactualMatchReport(report).ok).toBe(true);
  });

  it("returns a valid v2 report with the frozen grid identity passing its schema", () => {
    const report = buildGridFactualReport(gridResult());
    expect(isFactualReportV2(report)).toBe(true);
    expect(report.simulatorVersion).toBe("0.3.0");
    expect(report.positioningModel).toBe("grid-3x3-v1");
    expect(report.rulesetVersion).toBe("0.2.0");
    expect(report.catalogueVersion).toBe("1");
    expect(validateFactualMatchReport(report).ok).toBe(true);
  });

  it("rejects a malformed reconstructed zone at construction", () => {
    const corrupted = withEvent(
      gridResult(),
      movementEvent({
        actorId: "fighter_a",
        data: { from: "south", to: "north_edge", facing: "north", action: "advance" },
      }),
    );
    expect(() => buildGridFactualReport(corrupted)).toThrow(/non-grid zone/);
  });

  it("rejects a malformed reconstructed facing at construction", () => {
    const corrupted = withEvent(
      legacyResult(),
      movementEvent({
        actorId: "fighter_a",
        data: { from: "south_edge", to: "center", facing: "up", action: "advance" },
      }),
    );
    expect(() => buildFactualReport(corrupted)).toThrow(/invalid movement facing/);
  });

  it("rejects non-canonical round-end conditions at construction", () => {
    const corrupted = withEvent(
      gridResult(),
      roundEnd({
        integrity: 90,
        energy: 70,
        heat: 25,
        zone: "west",
        conditions: ["on_fire"],
      }),
    );
    expect(() => buildGridFactualReport(corrupted)).toThrow(
      /non-canonical round_ended condition/,
    );
  });

  it("rejects a fractional reconstructed integrity at the construction boundary", () => {
    const corrupted = withEvent(
      legacyResult(),
      roundEnd(
        {
          integrity: 90.5,
          energy: 70,
          heat: 25,
          zone: "south_edge",
          conditions: [],
        },
        {
          integrity: 100,
          energy: 60,
          heat: 5,
          zone: "north_edge",
          conditions: [],
        },
      ),
    );
    expect(() => buildFactualReport(corrupted)).toThrow(/construction boundary/);
  });

  it("rejects malformed reconstructed lifecycle facts at the construction boundary", () => {
    // A fractional authoritative heat is the last round-end fact, so it must
    // be rejected by the v2 construction boundary rather than silently enter
    // reporting.
    const corrupted = withEvent(
      gridResult(),
      roundEnd({
        integrity: 90,
        energy: 70,
        heat: 25.5,
        zone: "west",
        conditions: [],
      }),
    );
    expect(() => buildGridFactualReport(corrupted)).toThrow(/construction boundary/);
  });

  it("rejects the v1 builder for a non-canonical grid corner in legacy mode", () => {
    const corrupted = withEvent(
      legacyResult(),
      movementEvent({
        actorId: "fighter_a",
        data: {
          from: "south_edge",
          to: "north_east",
          facing: "north",
          action: "advance",
        },
      }),
    );
    expect(() => buildFactualReport(corrupted)).toThrow(/non-legacy zone/);
  });

  it("rejects before review formatting, fallback review and series construction can run", () => {
    // A malformed reconstructed fact makes the builder throw, so the report can
    // never reach review formatting, fallback review or series construction.
    const corrupted = withEvent(
      gridResult(),
      roundEnd({
        integrity: 90.5,
        energy: 70,
        heat: 25,
        zone: "west",
        conditions: [],
      }),
    );

    let report: ReturnType<typeof buildGridFactualReport> | null = null;
    expect(() => {
      report = buildGridFactualReport(corrupted);
    }).toThrow(/construction boundary/);

    expect(report).toBeNull();
    // The consumers below are unreachable with a malformed report: they can
    // only run after a successful builder boundary validation.
    expect(() => {
      const r = report ?? buildGridFactualReport(gridResult());
      formatFactualReportForPrompt(r);
    }).not.toThrow();
    expect(() => {
      const r = report ?? buildGridFactualReport(gridResult());
      buildReviewUserPrompt(r);
      buildFallbackReview(r);
    }).not.toThrow();
  });

  it("preserves valid legacy v1 output and the v1 prompt snapshot", () => {
    const report = buildFactualReport(legacyResult());
    const enriched = enrichMatchSummariesWithPolicy(
      report,
      BULWARK_POLICY,
      BULWARK_POLICY,
    );
    expect(report.schemaVersion).toBe("1");
    expect("simulatorVersion" in report).toBe(false);
    expect("positioningModel" in report).toBe(false);
    expect(report.finalStates.fighterA.zone).toMatch(
      /^(center|north_edge|south_edge|east_edge|west_edge)$/,
    );
    const prompt = formatFactualReportForPrompt(enriched);
    expect(prompt).toContain("=== MATCH RESULT ===");
    expect(prompt).not.toContain("Simulator:");
    const fallback = buildFallbackReview(report);
    expect(fallback).toMatch(
      /^fighter_[ab] by (destruction|immobilisation|judges|draw) in \d+ rounds\.$/,
    );
  });

  it("does not mutate the source match result while building", () => {
    const result = legacyResult();
    const snapshot = JSON.stringify(result);
    buildFactualReport(result);
    expect(JSON.stringify(result)).toBe(snapshot);
  });
});
