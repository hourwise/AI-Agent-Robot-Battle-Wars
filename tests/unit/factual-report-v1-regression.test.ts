import { describe, expect, it } from "vitest";
import { runMatch } from "../../src/simulator/simulator.js";
import { CATALOGUE_V1 } from "../../src/catalogue/catalogue.v1.js";
import {
  createBulwarkBuild,
  BULWARK_POLICY,
} from "../../src/agents/scripted/bulwark-agent.js";
import {
  buildFactualReport,
  enrichMatchSummariesWithPolicy,
} from "../../src/reports/factual-match-report.js";
import {
  isFactualReportV1,
  validateFactualMatchReport,
  serializeFactualMatchReport,
  deserializeFactualMatchReport,
} from "../../src/schemas/factual-report.schema.js";
import { formatFactualReportForPrompt } from "../../src/reports/review-formatter.js";
import type { FactualMatchReportV1 } from "../../src/schemas/factual-report.schema.js";

const LEGACY_ZONES = [
  "center",
  "north_edge",
  "south_edge",
  "east_edge",
  "west_edge",
] as const;
const GRID_CORNERS = ["north_west", "north_east", "south_west", "south_east"] as const;

function legacyResult() {
  return runMatch({
    seed: 42,
    fighterA: { build: createBulwarkBuild(), policy: BULWARK_POLICY },
    fighterB: { build: createBulwarkBuild(), policy: BULWARK_POLICY },
    rulesetVersion: "0.1.0",
    catalogueVersion: CATALOGUE_V1.version,
  });
}

function withZone(
  report: FactualMatchReportV1,
  fighter: "fighterA" | "fighterB",
  zone: string,
): FactualMatchReportV1 {
  return {
    ...report,
    finalStates: {
      ...report.finalStates,
      [fighter]: { ...report.finalStates[fighter], zone },
    },
  };
}

describe("factual report v1 regression (Phase 3D1)", () => {
  it("canonical v1 report validates and round-trips unchanged", () => {
    const report = buildFactualReport(legacyResult());
    expect(isFactualReportV1(report)).toBe(true);
    expect(validateFactualMatchReport(report).ok).toBe(true);

    const serialized = serializeFactualMatchReport(report);
    const restored = deserializeFactualMatchReport(serialized);
    expect(restored.ok).toBe(true);
    if (restored.ok) {
      expect(restored.report).toEqual(report);
      expect(JSON.parse(serialized)).toEqual(JSON.parse(JSON.stringify(report)));
    }
  });

  it("keeps schemaVersion 1 with no grid identity fields", () => {
    const report = buildFactualReport(legacyResult());
    expect(report.schemaVersion).toBe("1");
    expect("simulatorVersion" in report).toBe(false);
    expect("positioningModel" in report).toBe(false);
  });

  it("accepts every legacy five-zone value in final states", () => {
    const report = buildFactualReport(legacyResult());
    for (const zone of LEGACY_ZONES) {
      const result = validateFactualMatchReport(withZone(report, "fighterA", zone));
      expect(result.ok, `zone ${zone}`).toBe(true);
    }
  });

  it("rejects grid-only corner zones in final states", () => {
    const report = buildFactualReport(legacyResult());
    for (const zone of GRID_CORNERS) {
      const result = validateFactualMatchReport(withZone(report, "fighterB", zone));
      expect(result.ok, `zone ${zone}`).toBe(false);
    }
  });

  it("rejects grid-only edge-adjacent zones and unknown zones", () => {
    const report = buildFactualReport(legacyResult());
    for (const zone of ["north", "south", "east", "west", "limbo"]) {
      const result = validateFactualMatchReport(withZone(report, "fighterA", zone));
      expect(result.ok, `zone ${zone}`).toBe(false);
    }
  });

  it("keeps the v1 review prompt rendering unchanged (no simulator line, raw zones)", () => {
    const report = buildFactualReport(legacyResult());
    const enriched = enrichMatchSummariesWithPolicy(
      report,
      BULWARK_POLICY,
      BULWARK_POLICY,
    );
    const text = formatFactualReportForPrompt(enriched);
    expect(text).toContain("=== MATCH RESULT ===");
    expect(text).not.toContain("Simulator:");
    expect(text).not.toContain("Ruleset:");
    // v1 renders raw legacy zone values, never human-readable grid names
    expect(text).toMatch(/Zone: (center|north_edge|south_edge|east_edge|west_edge)/);
    expect(text).not.toContain("North West");
    expect(text).not.toContain("South East");
  });

  it("keeps normal match production at v1", () => {
    const report = buildFactualReport(legacyResult());
    expect(report.schemaVersion).toBe("1");
    expect(isFactualReportV1(report)).toBe(true);
  });
});
