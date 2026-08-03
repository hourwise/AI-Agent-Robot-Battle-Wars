import { describe, expect, it } from "vitest";
import { buildReadinessTestBundle } from "../helpers/grid-readiness-bundle-builder.js";
import {
  anchorGridGrappleCoverageBaseV3,
  GRID_GRAPPLE_COVERAGE_BASE_V3_EVALUATION_ID,
  GRID_GRAPPLE_COVERAGE_BASE_V3_SUITE_CHECKSUM,
  GRID_GRAPPLE_COVERAGE_BASE_V3_SEED_REGISTRY_CHECKSUM,
  GRID_GRAPPLE_COVERAGE_BASE_V3_SCENARIO_REGISTRY_CHECKSUM,
} from "../../src/readiness/grid-grapple-supplement-bundle.js";
import { grappleSupplementFixtureBaseIdentity } from "../helpers/grid-grapple-supplement-builder.js";

function fixtureBase() {
  return buildReadinessTestBundle().contents;
}

describe("grid grapple coverage base anchoring (Phase 3E2 Phase 2)", () => {
  it("anchors the equivalent validated fixture base with the exact identity", () => {
    const identity = grappleSupplementFixtureBaseIdentity();
    const reference = anchorGridGrappleCoverageBaseV3(fixtureBase(), identity);
    expect(reference.evaluationId).toBe(identity.evaluationId);
    expect(reference.suiteId).toBe("grid-activation-readiness-v3");
    expect(reference.suiteChecksum).toBe(GRID_GRAPPLE_COVERAGE_BASE_V3_SUITE_CHECKSUM);
    expect(reference.seedRegistryChecksum).toBe(
      GRID_GRAPPLE_COVERAGE_BASE_V3_SEED_REGISTRY_CHECKSUM,
    );
    expect(reference.scenarioRegistryChecksum).toBe(
      GRID_GRAPPLE_COVERAGE_BASE_V3_SCENARIO_REGISTRY_CHECKSUM,
    );
    expect(reference.classification).toBe("inconclusive");
    expect(reference.nonPassGates).toEqual(["C04"]);
    expect(reference.knockbackEvents).toBe(36);
    expect(reference.overturnEvents).toBe(8);
    expect(reference.grappleRepositionEvents).toBe(0);
    expect(reference.manifestChecksum).toMatch(/^[a-f0-9]{64}$/);
    expect(reference.decisionChecksum).toMatch(/^[a-f0-9]{64}$/);
    expect(reference.metricsChecksum).toMatch(/^[a-f0-9]{64}$/);
  });

  it("requires the exact official evaluation ID", () => {
    const identity = grappleSupplementFixtureBaseIdentity();
    const contents = fixtureBase();
    const manifest = JSON.parse(contents["manifest.json"]!) as { evaluationId: string };
    manifest.evaluationId = GRID_GRAPPLE_COVERAGE_BASE_V3_EVALUATION_ID;
    contents["manifest.json"] = JSON.stringify(manifest, null, 2);
    expect(() => anchorGridGrappleCoverageBaseV3(contents, identity)).toThrow(
      /evaluation ID mismatch|report.txt does not byte-for-byte/,
    );
  });

  it("requires the exact official suite checksum", () => {
    const identity = grappleSupplementFixtureBaseIdentity();
    const contents = fixtureBase();
    const manifest = JSON.parse(contents["manifest.json"]!) as {
      suiteChecksum: string;
    };
    manifest.suiteChecksum = "0".repeat(64);
    contents["manifest.json"] = JSON.stringify(manifest, null, 2);
    // The strong validator rejects the tampered base (suite checksum and
    // report regeneration) before any supplement match can run.
    expect(() => anchorGridGrappleCoverageBaseV3(contents, identity)).toThrow();
  });

  it("requires the base bundle to pass the strong validator", () => {
    const identity = grappleSupplementFixtureBaseIdentity();
    const contents = fixtureBase();
    delete contents["run-index.json"];
    expect(() => anchorGridGrappleCoverageBaseV3(contents, identity)).toThrow();
  });

  it("requires C04 to be the only non-pass gate", () => {
    const identity = grappleSupplementFixtureBaseIdentity();
    const contents = fixtureBase();
    const decision = JSON.parse(contents["decision.json"]!) as {
      gates: Array<{ gateId: string; outcome: string }>;
    };
    const c05 = decision.gates.find((g) => g.gateId === "C05")!;
    c05.outcome = "inconclusive";
    contents["decision.json"] = JSON.stringify(decision, null, 2);
    // A base with an extra non-pass gate is rejected (digest/gate
    // cross-agreement) before any supplement match can run.
    expect(() => anchorGridGrappleCoverageBaseV3(contents, identity)).toThrow();
  });

  it("requires the exact base reposition counts (36/8/0)", () => {
    const identity = grappleSupplementFixtureBaseIdentity();
    const contents = fixtureBase();
    const metrics = JSON.parse(contents["metrics.json"]!) as {
      combat: {
        knockbackEvents: number;
        overturnEvents: number;
        grappleRepositionEvents: number;
      };
    };
    metrics.combat.knockbackEvents = 35;
    contents["metrics.json"] = JSON.stringify(metrics, null, 2);
    expect(() => anchorGridGrappleCoverageBaseV3(contents, identity)).toThrow();

    const contents2 = fixtureBase();
    const metrics2 = JSON.parse(contents2["metrics.json"]!) as {
      combat: { grappleRepositionEvents: number };
    };
    metrics2.combat.grappleRepositionEvents = 1;
    contents2["metrics.json"] = JSON.stringify(metrics2, null, 2);
    expect(() => anchorGridGrappleCoverageBaseV3(contents2, identity)).toThrow();
  });

  it("rejects changed or missing base artifacts", () => {
    const identity = grappleSupplementFixtureBaseIdentity();
    const contents = fixtureBase();
    delete contents["factual-reports.json"];
    expect(() => anchorGridGrappleCoverageBaseV3(contents, identity)).toThrow();
    // A tampered base artifact that still parses is rejected by the strong
    // validator (digest or cross-agreement failure).
    const contents2 = fixtureBase();
    const runIndex = JSON.parse(contents2["run-index.json"]!) as {
      items: Array<{ reportChecksum: string }>;
    };
    runIndex.items[0]!.reportChecksum = "0".repeat(64);
    contents2["run-index.json"] = JSON.stringify(runIndex, null, 2);
    expect(() => anchorGridGrappleCoverageBaseV3(contents2, identity)).toThrow();
  });
});
