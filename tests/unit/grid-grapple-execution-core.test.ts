import { beforeAll, describe, expect, it } from "vitest";
import {
  executeGridGrappleCoverageSupplement,
  verifyGridGrappleCoverageDeterminism,
  grappleAttackerSlotForRun,
  GridGrappleCoverageCoreError,
  type GridGrappleCoverageSupplementOutcome,
} from "../../src/readiness/grid-grapple-execution-core.js";
import { readinessTestSeedRegistry } from "../helpers/grid-readiness-bundle-builder.js";
import { createGridGrappleCoverageScenarioRegistry } from "../../src/readiness/grid-grapple-scenarios.js";
import { buildGridGrappleCoverageRunPlan } from "../../src/readiness/grid-grapple-run-plan.js";
import {
  GRAPPLE_SUPPLEMENT_TEST_ID,
  GRAPPLE_SUPPLEMENT_TEST_CREATED_AT,
  grappleSupplementTestMatchIds,
} from "../helpers/grid-grapple-supplement-builder.js";
import {
  GRID_GRAPPLE_COVERAGE_BASE_V3_EVALUATION_ID,
  GRID_GRAPPLE_COVERAGE_BASE_V3_SUITE_CHECKSUM,
} from "../../src/readiness/grid-grapple-supplement-bundle.js";
import { assertGridReadinessRecordReportFinalAgreement } from "../../src/readiness/record-evidence.js";

let outcome: GridGrappleCoverageSupplementOutcome;

function buildContext() {
  const seedRegistry = readinessTestSeedRegistry();
  const scenarioRegistry = createGridGrappleCoverageScenarioRegistry();
  const runPlan = buildGridGrappleCoverageRunPlan({
    seedRegistry,
    scenarioRegistry,
    baseV3EvaluationId: GRID_GRAPPLE_COVERAGE_BASE_V3_EVALUATION_ID,
    baseV3SuiteChecksum: GRID_GRAPPLE_COVERAGE_BASE_V3_SUITE_CHECKSUM,
  });
  return { seedRegistry, scenarioRegistry, runPlan };
}

beforeAll(() => {
  const { seedRegistry, scenarioRegistry, runPlan } = buildContext();
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
}, 300_000);

describe("grid grapple coverage execution core (Phase 3E2 Phases 6/8)", () => {
  it("executes exactly 48 grid matches with v3 records and v2 reports", () => {
    expect(outcome.matchCount).toBe(48);
    expect(outcome.results.length).toBe(48);
    for (const run of outcome.results) {
      expect(run.record.schemaVersion).toBe("3");
      expect(run.report.schemaVersion).toBe("2");
      expect(run.record.positioningModel).toBe("grid-3x3-v1");
      expect(run.record.simulatorVersion).toBe("0.3.0");
      expect(run.report.positioningModel).toBe("grid-3x3-v1");
    }
  });

  it("runs both role assignments with the attacker in both slots", () => {
    const fighterAAttacker = outcome.results.filter(
      (r) => r.attackerSlot === "fighter_a",
    );
    const fighterBAttacker = outcome.results.filter(
      (r) => r.attackerSlot === "fighter_b",
    );
    expect(fighterAAttacker.length).toBe(24);
    expect(fighterBAttacker.length).toBe(24);
  });

  it("produces byte-identical deterministic repeat under fixed identities", () => {
    const { seedRegistry, scenarioRegistry, runPlan } = buildContext();
    const repeat = executeGridGrappleCoverageSupplement({
      seedRegistry,
      scenarioRegistry,
      runPlan,
      identities: {
        supplementId: GRAPPLE_SUPPLEMENT_TEST_ID,
        createdAt: GRAPPLE_SUPPLEMENT_TEST_CREATED_AT,
        matchIds: grappleSupplementTestMatchIds(),
      },
    });
    expect(() => verifyGridGrappleCoverageDeterminism(outcome, repeat)).not.toThrow();
    for (let i = 0; i < outcome.results.length; i++) {
      expect(outcome.results[i]!.serializedRecord).toBe(
        repeat.results[i]!.serializedRecord,
      );
      expect(outcome.results[i]!.serializedReport).toBe(
        repeat.results[i]!.serializedReport,
      );
    }
  });

  it("verifies complete report/final-state agreement on every pair", () => {
    for (const run of outcome.results) {
      expect(() =>
        assertGridReadinessRecordReportFinalAgreement(run.record, run.report),
      ).not.toThrow();
    }
  });

  it("never mutates its inputs", () => {
    const seedRegistry = readinessTestSeedRegistry();
    const scenarioRegistry = createGridGrappleCoverageScenarioRegistry();
    const runPlan = buildGridGrappleCoverageRunPlan({
      seedRegistry,
      scenarioRegistry,
      baseV3EvaluationId: GRID_GRAPPLE_COVERAGE_BASE_V3_EVALUATION_ID,
      baseV3SuiteChecksum: GRID_GRAPPLE_COVERAGE_BASE_V3_SUITE_CHECKSUM,
    });
    const snapshot = JSON.stringify({ seedRegistry, scenarioRegistry, runPlan });
    executeGridGrappleCoverageSupplement({
      seedRegistry,
      scenarioRegistry,
      runPlan,
      identities: {
        supplementId: GRAPPLE_SUPPLEMENT_TEST_ID,
        createdAt: GRAPPLE_SUPPLEMENT_TEST_CREATED_AT,
        matchIds: grappleSupplementTestMatchIds(),
      },
    });
    expect(JSON.stringify({ seedRegistry, scenarioRegistry, runPlan })).toBe(snapshot);
  });

  it("requires exactly 48 unique match identities", () => {
    const { seedRegistry, scenarioRegistry, runPlan } = buildContext();
    expect(() =>
      executeGridGrappleCoverageSupplement({
        seedRegistry,
        scenarioRegistry,
        runPlan,
        identities: {
          supplementId: GRAPPLE_SUPPLEMENT_TEST_ID,
          createdAt: GRAPPLE_SUPPLEMENT_TEST_CREATED_AT,
          matchIds: grappleSupplementTestMatchIds().slice(0, 47),
        },
      }),
    ).toThrow(GridGrappleCoverageCoreError);
    const duplicated = [...grappleSupplementTestMatchIds()];
    duplicated[47] = duplicated[0]!;
    expect(() =>
      executeGridGrappleCoverageSupplement({
        seedRegistry,
        scenarioRegistry,
        runPlan,
        identities: {
          supplementId: GRAPPLE_SUPPLEMENT_TEST_ID,
          createdAt: GRAPPLE_SUPPLEMENT_TEST_CREATED_AT,
          matchIds: duplicated,
        },
      }),
    ).toThrow(GridGrappleCoverageCoreError);
  });

  it("derives the attacker slot from the role assignment", () => {
    const { runPlan } = buildContext();
    const a = runPlan.runs.find((r) => r.assignmentId.endsWith("xa-target-yb"));
    const b = runPlan.runs.find((r) => r.assignmentId.endsWith("ya-attacker-xb"));
    expect(a).toBeDefined();
    expect(b).toBeDefined();
    expect(grappleAttackerSlotForRun(a!)).toBe("fighter_a");
    expect(grappleAttackerSlotForRun(b!)).toBe("fighter_b");
  });

  it("reports canonical per-run grapple evidence and checksums", () => {
    for (const run of outcome.results) {
      expect(run.evidence.grapplerAttackAttempts).toBeGreaterThanOrEqual(0);
      expect(run.recordChecksum).toMatch(/^[a-f0-9]{64}$/);
      expect(run.reportChecksum).toMatch(/^[a-f0-9]{64}$/);
      expect(run.textReplayChecksum).toMatch(/^[a-f0-9]{64}$/);
      expect(run.asciiReplayChecksum).toMatch(/^[a-f0-9]{64}$/);
      expect(run.reviewPromptChecksum).toMatch(/^[a-f0-9]{64}$/);
    }
  });
});
