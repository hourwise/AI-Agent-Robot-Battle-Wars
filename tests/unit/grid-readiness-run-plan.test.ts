import { describe, expect, it } from "vitest";
import registryJson from "../../config/readiness/grid-readiness-development-v1.json";
import { loadGridReadinessSeedRegistry } from "../../src/readiness/seed-registry.js";
import {
  createGridReadinessScenarioRegistry,
  type GridReadinessScenarioRegistry,
} from "../../src/readiness/scenario-registry.js";
import {
  buildGridActivationReadinessRunPlan,
  gridActivationReadinessSuiteChecksum,
  GRID_ACTIVATION_READINESS_RUN_COUNT,
  GRID_ACTIVATION_READINESS_SUITE_ID,
  GRID_ACTIVATION_READINESS_SUITE_ID_V1,
  GRID_ACTIVATION_READINESS_SUITE_ID_V2,
  GRID_ACTIVATION_READINESS_V1_SUITE_CHECKSUM,
  GRID_ACTIVATION_READINESS_V2_SUITE_CHECKSUM,
  GRID_READINESS_ACTION_EVIDENCE_MODEL,
  GRID_READINESS_PROVENANCE_MODEL,
  GridActivationReadinessRunPlanError,
  type GridActivationReadinessRunPlan,
} from "../../src/readiness/run-plan.js";

// Milestone 0.2C Phase 3E1.2 v3 provenance-finalisation suite checksum.
// Includes the v3 suite id, the policy-triggered action-evidence model, the
// canonical-registry-record-derived provenance model, registry IDs and
// checksums, runtime identity and the ordered 312 runs.
const FROZEN_SUITE_CHECKSUM =
  "c3b8a16d407891d0a92966fb9d6ed20fe5e11776bf545624fb3dbcadb4e2503c";

// Historical suite checksums stay frozen for archival inspection.
const FROZEN_V1_SUITE_CHECKSUM =
  "dd38ac8a5d2e35007b4b6890418b21aca8f621f3e165fa7d158d2f179672ae5a";
const FROZEN_V2_SUITE_CHECKSUM =
  "df9444101ca68f7b7ca9fef24adfe8575363ef744e9f37b4449b111e0bb29fd9";

function buildPlan(): GridActivationReadinessRunPlan {
  const seedRegistry = loadGridReadinessSeedRegistry(registryJson);
  const scenarioRegistry = createGridReadinessScenarioRegistry();
  return buildGridActivationReadinessRunPlan({ seedRegistry, scenarioRegistry });
}

describe("grid activation readiness run plan (Phase 3E1)", () => {
  it("contains exactly 312 runs", () => {
    const plan = buildPlan();
    expect(plan.runCount).toBe(GRID_ACTIVATION_READINESS_RUN_COUNT);
    expect(plan.runs.length).toBe(312);
    expect(plan.seedCount).toBe(24);
    expect(plan.scenarioCount).toBe(7);
    expect(plan.assignmentCount).toBe(13);
  });

  it("orders runs scenario → assignment → seed", () => {
    const plan = buildPlan();
    expect(plan.runs[0]).toMatchObject({
      runNumber: 1,
      scenarioId: "bulwark-mirror",
      assignmentId: "bulwark-mirror-xa-yb",
      seed: 1703000011,
    });
    expect(plan.runs[1]!.seed).toBe(1703000037);
    // After all 24 seeds of the mirror, the flanker xa-yb assignment starts.
    expect(plan.runs[24]!.scenarioId).toBe("flanker-bulwark");
    expect(plan.runs[24]!.assignmentId).toBe("flanker-bulwark-xa-yb");
    expect(plan.runs[24]!.seed).toBe(1703000011);
    // The final run is the last sentinel role-swapped assignment with the last seed.
    expect(plan.runs[311]).toMatchObject({
      runNumber: 312,
      scenarioId: "sentinel-bulwark",
      assignmentId: "sentinel-bulwark-ya-xb",
      seed: 1703001833,
      roleSwapped: true,
      fighterACompetitor: "y",
      fighterBCompetitor: "x",
    });
  });

  it("has a unique (scenarioId, assignmentId, seed) tuple for every run", () => {
    const plan = buildPlan();
    const tuples = new Set(
      plan.runs.map((r) => `${r.scenarioId}|${r.assignmentId}|${r.seed}`),
    );
    expect(tuples.size).toBe(312);
  });

  it("is frozen with frozen entries", () => {
    const plan = buildPlan();
    expect(Object.isFrozen(plan)).toBe(true);
    expect(Object.isFrozen(plan.runs)).toBe(true);
    expect(Object.isFrozen(plan.runs[0])).toBe(true);
    // @ts-expect-error strict-mode mutation of a frozen object is rejected
    expect(() => {
      plan.runs[0].seed = 1;
    }).toThrow();
    expect(plan.runs[0]!.seed).toBe(1703000011);
  });

  it("is deterministic: separate builds produce identical plans", () => {
    const a = buildPlan();
    const b = buildPlan();
    expect(a.runs).toEqual(b.runs);
    expect(gridActivationReadinessSuiteChecksum(a)).toBe(
      gridActivationReadinessSuiteChecksum(b),
    );
  });

  it("produces the frozen suite checksum including registry IDs, checksums, runtime identity and ordered runs", () => {
    const plan = buildPlan();
    expect(gridActivationReadinessSuiteChecksum(plan)).toBe(FROZEN_SUITE_CHECKSUM);
    // The checksum depends on registry IDs and runtime identity.
    expect(plan.seedRegistryId).toBe("grid-readiness-development-v1");
    expect(plan.scenarioRegistryId).toBe("grid-readiness-scenarios-v1");
    expect(plan.simulatorVersion).toBe("0.3.0");
    expect(plan.positioningModel).toBe("grid-3x3-v1");
  });

  it("uses the v3 suite id, the action-evidence model and the provenance model", () => {
    const plan = buildPlan();
    expect(plan.suiteId).toBe(GRID_ACTIVATION_READINESS_SUITE_ID);
    expect(plan.suiteId).toBe("grid-activation-readiness-v3");
    expect(plan.actionEvidenceModel).toBe(GRID_READINESS_ACTION_EVIDENCE_MODEL);
    expect(plan.actionEvidenceModel).toBe("policy-triggered-round-actions-v1");
    expect(plan.provenanceModel).toBe(GRID_READINESS_PROVENANCE_MODEL);
    expect(plan.provenanceModel).toBe("canonical-registry-record-derived-decision-v1");
    // Historical v1 and v2 identities and checksums remain frozen constants.
    expect(GRID_ACTIVATION_READINESS_SUITE_ID_V1).toBe("grid-activation-readiness-v1");
    expect(GRID_ACTIVATION_READINESS_SUITE_ID_V2).toBe("grid-activation-readiness-v2");
    expect(GRID_ACTIVATION_READINESS_V1_SUITE_CHECKSUM).toBe(FROZEN_V1_SUITE_CHECKSUM);
    expect(GRID_ACTIVATION_READINESS_V2_SUITE_CHECKSUM).toBe(FROZEN_V2_SUITE_CHECKSUM);
    // The v3 checksum differs from both historical checksums.
    expect(FROZEN_SUITE_CHECKSUM).not.toBe(FROZEN_V1_SUITE_CHECKSUM);
    expect(FROZEN_SUITE_CHECKSUM).not.toBe(FROZEN_V2_SUITE_CHECKSUM);
  });

  it("rejects a plan that does not yield exactly 312 runs", () => {
    const seedRegistry = loadGridReadinessSeedRegistry(registryJson);
    const scenarioRegistry = createGridReadinessScenarioRegistry();
    const broken: GridReadinessScenarioRegistry = {
      ...scenarioRegistry,
      assignments: Object.freeze([]),
    };
    expect(() =>
      buildGridActivationReadinessRunPlan({ seedRegistry, scenarioRegistry: broken }),
    ).toThrow(GridActivationReadinessRunPlanError);
  });
});
