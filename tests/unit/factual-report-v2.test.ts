import { describe, expect, it } from "vitest";
import { runMatch } from "../../src/simulator/simulator.js";
import { runGridMatch } from "../../src/simulator/grid-runtime.js";
import { GRID_ZONES } from "../../src/simulator/arena-grid.js";
import { CATALOGUE_V1 } from "../../src/catalogue/catalogue.v1.js";
import {
  createBulwarkBuild,
  BULWARK_POLICY,
} from "../../src/agents/scripted/bulwark-agent.js";
import {
  buildGridFactualReport,
  buildFactualReportForResult,
} from "../../src/reports/factual-match-report.js";
import {
  isFactualReportV2,
  validateFactualMatchReport,
  serializeFactualMatchReport,
  deserializeFactualMatchReport,
} from "../../src/schemas/factual-report.schema.js";
import type { FactualMatchReportV2 } from "../../src/schemas/factual-report.schema.js";

const build = createBulwarkBuild();

function gridResult(seed = 42) {
  return runGridMatch({
    seed,
    fighterA: { build, policy: BULWARK_POLICY },
    fighterB: { build, policy: BULWARK_POLICY },
    rulesetVersion: "0.2.0",
    catalogueVersion: CATALOGUE_V1.version,
  });
}

function legacyResult(seed = 42) {
  return runMatch({
    seed,
    fighterA: { build, policy: BULWARK_POLICY },
    fighterB: { build, policy: BULWARK_POLICY },
    rulesetVersion: "0.1.0",
    catalogueVersion: CATALOGUE_V1.version,
  });
}

function withZone(
  report: FactualMatchReportV2,
  fighter: "fighterA" | "fighterB",
  zone: string,
): FactualMatchReportV2 {
  return {
    ...report,
    finalStates: {
      ...report.finalStates,
      [fighter]: { ...report.finalStates[fighter], zone },
    },
  };
}

const V2_IDENTITY = {
  schemaVersion: "2",
  simulatorVersion: "0.3.0",
  positioningModel: "grid-3x3-v1",
  rulesetVersion: "0.2.0",
  catalogueVersion: "1",
} as const;

describe("factual report v2 (Phase 3D1)", () => {
  it("builds a valid grid v2 report with explicit identity", () => {
    const report = buildGridFactualReport(gridResult());
    expect(isFactualReportV2(report)).toBe(true);
    expect(report.schemaVersion).toBe("2");
    expect(report.simulatorVersion).toBe(V2_IDENTITY.simulatorVersion);
    expect(report.positioningModel).toBe(V2_IDENTITY.positioningModel);
    expect(report.rulesetVersion).toBe(V2_IDENTITY.rulesetVersion);
    expect(report.catalogueVersion).toBe(V2_IDENTITY.catalogueVersion);
    expect(validateFactualMatchReport(report).ok).toBe(true);
  });

  it("accepts every one of the nine grid zones in final states", () => {
    const report = buildGridFactualReport(gridResult());
    for (const zone of GRID_ZONES) {
      const result = validateFactualMatchReport(withZone(report, "fighterA", zone));
      expect(result.ok, `zone ${zone}`).toBe(true);
    }
  });

  it("omits weapon/utility cooldowns (event stream cannot reconstruct them)", () => {
    const report = buildGridFactualReport(gridResult());
    expect("weaponCooldown" in report.finalStates.fighterA).toBe(false);
    expect("utilityCooldown" in report.finalStates.fighterA).toBe(false);
    expect("weaponCooldown" in report.finalStates.fighterB).toBe(false);
    expect("utilityCooldown" in report.finalStates.fighterB).toBe(false);
  });

  it("rejects incorrect simulator identity", () => {
    const report = buildGridFactualReport(gridResult());
    for (const simulatorVersion of ["0.2.0", "0.3.1", "1.0.0"]) {
      const result = validateFactualMatchReport({
        ...report,
        simulatorVersion,
      });
      expect(result.ok, `simulatorVersion ${simulatorVersion}`).toBe(false);
    }
  });

  it("rejects a non-grid positioning model", () => {
    const report = buildGridFactualReport(gridResult());
    for (const positioningModel of ["legacy-five-zone-v1", "grid-4x4-v1", "nope"]) {
      const result = validateFactualMatchReport({
        ...report,
        positioningModel,
      });
      expect(result.ok, `positioningModel ${positioningModel}`).toBe(false);
    }
  });

  it("rejects incorrect ruleset and catalogue versions", () => {
    const report = buildGridFactualReport(gridResult());
    for (const rulesetVersion of ["0.1.0", "0.3.0", "1.0.0"]) {
      const result = validateFactualMatchReport({ ...report, rulesetVersion });
      expect(result.ok, `rulesetVersion ${rulesetVersion}`).toBe(false);
    }
    for (const catalogueVersion of ["0", "2", "1.0"]) {
      const result = validateFactualMatchReport({ ...report, catalogueVersion });
      expect(result.ok, `catalogueVersion ${catalogueVersion}`).toBe(false);
    }
  });

  it("rejects legacy five-zone values in grid v2 final states", () => {
    const report = buildGridFactualReport(gridResult());
    for (const zone of ["north_edge", "south_edge", "east_edge", "west_edge"]) {
      const result = validateFactualMatchReport(withZone(report, "fighterB", zone));
      expect(result.ok, `zone ${zone}`).toBe(false);
    }
  });

  it("round-trips through serialization unchanged", () => {
    const report = buildGridFactualReport(gridResult());
    const serialized = serializeFactualMatchReport(report);
    const restored = deserializeFactualMatchReport(serialized);
    expect(restored.ok).toBe(true);
    if (restored.ok) {
      expect(restored.report).toEqual(report);
      expect(isFactualReportV2(restored.report)).toBe(true);
    }
  });

  it("does not mutate the grid result while building", () => {
    const result = gridResult();
    const snapshot = JSON.stringify(result);
    buildGridFactualReport(result);
    expect(JSON.stringify(result)).toBe(snapshot);
  });

  it("dispatches on explicit runtime identity", () => {
    expect(isFactualReportV2(buildFactualReportForResult(gridResult()))).toBe(true);
    expect(isFactualReportV2(buildFactualReportForResult(legacyResult()))).toBe(false);
    expect(buildFactualReportForResult(legacyResult()).schemaVersion).toBe("1");
  });

  it("rejects a grid result whose runtime identity was corrupted", () => {
    const result = gridResult();
    const corrupted = {
      ...result,
      runtime: {
        simulatorVersion: "0.2.0",
        positioningModel: "grid-3x3-v1",
      },
    } as never;
    expect(() => buildFactualReportForResult(corrupted)).toThrow();
  });

  it("produces deterministic v2 output for the same seed", () => {
    const a = buildGridFactualReport(gridResult(7));
    const b = buildGridFactualReport(gridResult(7));
    expect(a).toEqual(b);
    expect(a.seed).toBe(7);
  });
});
