import { sha256Hex } from "../canary/grid-canary-digest.js";
import {
  gridReadinessSeedRegistryChecksum,
  type GridReadinessSeedRegistry,
} from "./seed-registry.js";
import {
  gridReadinessScenarioRegistryChecksum,
  type GridReadinessCompetitor,
  type GridReadinessScenarioRegistry,
} from "./scenario-registry.js";

/**
 * Frozen grid activation-readiness run plan (Milestone 0.2C Phase 3E1 /
 * 3E1.1 / 3E1.2).
 *
 * The exact suite is 24 seeds × 13 assignments = 312 primary matches. Every
 * assignment executes once for every seed in registry order. Ordering is
 * frozen: scenario registry order → assignment order within scenario → seed
 * registry order. There is no random shuffling; the plan and every entry are
 * frozen at runtime; the suite checksum includes the suite ID, the
 * action-evidence model, the provenance model, the registry IDs, registry
 * checksums, runtime identity and the ordered runs.
 *
 * Phase 3E1.1 introduced the corrected action-evidence model
 * `policy-triggered-round-actions-v1` (selected actions derived from
 * `policy_triggered` events) under suite identity `grid-activation-readiness-v2`.
 * Phase 3E1.2 introduces the current suite identity
 * `grid-activation-readiness-v3` with the provenance model
 * `canonical-registry-record-derived-decision-v1` (exact canonical registries,
 * complete event chronology, record-derived metrics, complete report/final-state
 * agreement and operational attestations). The historical v1
 * (`grid-activation-readiness-v1`, checksum `dd38ac8a...`) and v2
 * (`grid-activation-readiness-v2`, checksum `df944410...`) suites remain
 * frozen and readable through historical parsers but are superseded for
 * current readiness classification.
 */
export const GRID_ACTIVATION_READINESS_SUITE_ID = "grid-activation-readiness-v3" as const;

/** Historical v1 suite identity, retained for historical parsers only. */
export const GRID_ACTIVATION_READINESS_SUITE_ID_V1 =
  "grid-activation-readiness-v1" as const;

/** Historical v2 suite identity, retained for historical parsers only. */
export const GRID_ACTIVATION_READINESS_SUITE_ID_V2 =
  "grid-activation-readiness-v2" as const;

/**
 * The corrected action-evidence model: selected movement and combat actions
 * are derived from `policy_triggered` events (one per fighter per completed
 * round), while translated ordinary movement continues to come from
 * `movement_resolved`.
 */
export const GRID_READINESS_ACTION_EVIDENCE_MODEL =
  "policy-triggered-round-actions-v1" as const;

/**
 * The Phase 3E1.2 provenance model: the final decision is derived from the
 * exact canonical registries, the complete record event chronology, the
 * record-derived metrics and the complete report/final-state agreement, with
 * only non-reconstructible execution facts supplied as explicit operational
 * attestations.
 */
export const GRID_READINESS_PROVENANCE_MODEL =
  "canonical-registry-record-derived-decision-v1" as const;

/** Frozen v1 suite checksum, retained for historical inspection only. */
export const GRID_ACTIVATION_READINESS_V1_SUITE_CHECKSUM =
  "dd38ac8a5d2e35007b4b6890418b21aca8f621f3e165fa7d158d2f179672ae5a" as const;

/** Frozen v2 suite checksum, retained for historical inspection only. */
export const GRID_ACTIVATION_READINESS_V2_SUITE_CHECKSUM =
  "df9444101ca68f7b7ca9fef24adfe8575363ef744e9f37b4449b111e0bb29fd9" as const;

export const GRID_ACTIVATION_READINESS_RUN_COUNT = 312 as const;

export interface GridActivationReadinessRun {
  readonly runNumber: number;
  readonly scenarioId: string;
  readonly assignmentId: string;
  readonly seed: number;
  readonly roleSwapped: boolean;
  readonly fighterACompetitor: GridReadinessCompetitor;
  readonly fighterBCompetitor: GridReadinessCompetitor;
}

export interface GridActivationReadinessRunPlan {
  readonly suiteId: "grid-activation-readiness-v3";
  readonly actionEvidenceModel: "policy-triggered-round-actions-v1";
  readonly provenanceModel: "canonical-registry-record-derived-decision-v1";
  readonly runCount: 312;
  readonly seedCount: 24;
  readonly scenarioCount: 7;
  readonly assignmentCount: 13;
  readonly seedRegistryId: "grid-readiness-development-v1";
  readonly seedRegistryChecksum: string;
  readonly scenarioRegistryId: "grid-readiness-scenarios-v1";
  readonly scenarioRegistryChecksum: string;
  readonly simulatorVersion: "0.3.0";
  readonly positioningModel: "grid-3x3-v1";
  readonly rulesetVersion: "0.2.0";
  readonly catalogueVersion: "1";
  readonly runs: readonly GridActivationReadinessRun[];
}

export class GridActivationReadinessRunPlanError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GridActivationReadinessRunPlanError";
  }
}

export interface BuildGridActivationReadinessRunPlanParams {
  seedRegistry: GridReadinessSeedRegistry;
  scenarioRegistry: GridReadinessScenarioRegistry;
}

/**
 * Pure run-plan builder. Produces exactly 312 frozen runs with a unique
 * `(scenarioId, assignmentId, seed)` tuple, ordered scenario → assignment →
 * seed, and a deterministic suite checksum.
 */
export function buildGridActivationReadinessRunPlan(
  params: BuildGridActivationReadinessRunPlanParams,
): GridActivationReadinessRunPlan {
  const { seedRegistry, scenarioRegistry } = params;

  const seedRegistryChecksum = gridReadinessSeedRegistryChecksum(seedRegistry);
  const scenarioRegistryChecksum =
    gridReadinessScenarioRegistryChecksum(scenarioRegistry);

  const runs: GridActivationReadinessRun[] = [];
  let runNumber = 0;
  const seenTuples = new Set<string>();
  for (const scenario of scenarioRegistry.scenarios) {
    for (const assignment of scenarioRegistry.assignments) {
      if (assignment.scenarioId !== scenario.scenarioId) continue;
      for (const seed of seedRegistry.seeds) {
        runNumber += 1;
        const tuple = `${scenario.scenarioId}|${assignment.assignmentId}|${seed}`;
        if (seenTuples.has(tuple)) {
          throw new GridActivationReadinessRunPlanError(
            `Readiness run plan produced a duplicate (scenarioId, assignmentId, seed) tuple: ${tuple}`,
          );
        }
        seenTuples.add(tuple);
        runs.push(
          Object.freeze({
            runNumber,
            scenarioId: scenario.scenarioId,
            assignmentId: assignment.assignmentId,
            seed,
            roleSwapped: assignment.roleSwapped,
            fighterACompetitor: assignment.fighterACompetitor,
            fighterBCompetitor: assignment.fighterBCompetitor,
          }),
        );
      }
    }
  }

  if (runs.length !== GRID_ACTIVATION_READINESS_RUN_COUNT) {
    throw new GridActivationReadinessRunPlanError(
      `Readiness run plan must contain exactly ${GRID_ACTIVATION_READINESS_RUN_COUNT} runs; built ${runs.length}`,
    );
  }

  const plan: GridActivationReadinessRunPlan = Object.freeze({
    suiteId: GRID_ACTIVATION_READINESS_SUITE_ID,
    actionEvidenceModel: GRID_READINESS_ACTION_EVIDENCE_MODEL,
    provenanceModel: GRID_READINESS_PROVENANCE_MODEL,
    runCount: GRID_ACTIVATION_READINESS_RUN_COUNT,
    seedCount: seedRegistry.seeds.length as 24,
    scenarioCount: scenarioRegistry.scenarios.length as 7,
    assignmentCount: scenarioRegistry.assignments.length as 13,
    seedRegistryId: seedRegistry.registryId,
    seedRegistryChecksum,
    scenarioRegistryId: scenarioRegistry.registryId,
    scenarioRegistryChecksum,
    simulatorVersion: seedRegistry.simulatorVersion,
    positioningModel: seedRegistry.positioningModel,
    rulesetVersion: seedRegistry.rulesetVersion,
    catalogueVersion: seedRegistry.catalogueVersion,
    runs: Object.freeze(runs),
  });
  return plan;
}

/**
 * Deterministic suite checksum over the suite ID, action-evidence model,
 * provenance model, registry IDs, registry checksums, runtime identity and
 * the ordered runs. Because the suite identity and evidence/provenance
 * semantics changed, the v3 checksum differs from the frozen historical v1
 * and v2 checksums.
 */
export function gridActivationReadinessSuiteChecksum(
  plan: GridActivationReadinessRunPlan,
): string {
  const canonical = JSON.stringify({
    suiteId: plan.suiteId,
    actionEvidenceModel: plan.actionEvidenceModel,
    provenanceModel: plan.provenanceModel,
    seedRegistryId: plan.seedRegistryId,
    seedRegistryChecksum: plan.seedRegistryChecksum,
    scenarioRegistryId: plan.scenarioRegistryId,
    scenarioRegistryChecksum: plan.scenarioRegistryChecksum,
    simulatorVersion: plan.simulatorVersion,
    positioningModel: plan.positioningModel,
    rulesetVersion: plan.rulesetVersion,
    catalogueVersion: plan.catalogueVersion,
    runs: plan.runs.map((run) => ({
      runNumber: run.runNumber,
      scenarioId: run.scenarioId,
      assignmentId: run.assignmentId,
      seed: run.seed,
      roleSwapped: run.roleSwapped,
      fighterACompetitor: run.fighterACompetitor,
      fighterBCompetitor: run.fighterBCompetitor,
    })),
  });
  return sha256Hex(canonical);
}
