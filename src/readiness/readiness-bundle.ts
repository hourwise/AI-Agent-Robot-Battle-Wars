import { z } from "zod";
import { sha256Hex } from "../canary/grid-canary-digest.js";
import { machineBuildProposalSchema } from "../schemas/build.schema.js";
import { actionPolicySchema } from "../schemas/policy.schema.js";
import {
  loadGridReadinessSeedRegistry,
  gridReadinessSeedRegistryChecksum,
  type GridReadinessSeedRegistry,
} from "./seed-registry.js";
import {
  gridReadinessScenarioRegistryChecksum,
  type GridReadinessScenarioRegistry,
} from "./scenario-registry.js";
import {
  buildGridActivationReadinessRunPlan,
  gridActivationReadinessSuiteChecksum,
  GRID_ACTIVATION_READINESS_RUN_COUNT,
  GRID_ACTIVATION_READINESS_SUITE_ID,
} from "./run-plan.js";
import {
  deserializeGridActivationReadinessRunIndex,
  deserializeGridActivationReadinessMatchRecords,
  deserializeGridActivationReadinessFactualReports,
  type GridActivationReadinessRunIndexEnvelope,
  type GridActivationReadinessMatchRecordsEnvelope,
  type GridActivationReadinessFactualReportsEnvelope,
} from "./envelopes.schema.js";
import { deserializeGridActivationReadinessMetrics } from "./metrics.js";
import {
  deserializeGridActivationReadinessDecision,
  GRID_ACTIVATION_READINESS_DISCLAIMER,
  type GridActivationReadinessDecisionV1,
} from "./decision.js";

/**
 * Grid activation-readiness immutable evaluation bundle (Milestone 0.2C Phase
 * 3E1).
 *
 * Each official evaluation writes exactly nine regular files under
 * `data/readiness/grid/<evaluationId>/`:
 *
 *   manifest.json, seed-registry.json, scenario-registry.json, run-index.json,
 *   match-records.json, factual-reports.json, metrics.json, decision.json,
 *   report.txt
 *
 * The manifest carries the evaluation UUID, creation time, suite and runtime
 * identity, exact counts, registry/suite/outcome/report checksums, the
 * readiness decision, fixed artifact names and the SHA-256 digest of every
 * non-manifest artifact. Individual replay text is never included.
 */
export const GRID_READINESS_MANIFEST_FILE = "manifest.json" as const;
export const GRID_READINESS_SEED_REGISTRY_ARTIFACT = "seed-registry.json" as const;
export const GRID_READINESS_SCENARIO_REGISTRY_ARTIFACT =
  "scenario-registry.json" as const;
export const GRID_READINESS_RUN_INDEX_ARTIFACT = "run-index.json" as const;
export const GRID_READINESS_MATCH_RECORDS_ARTIFACT = "match-records.json" as const;
export const GRID_READINESS_FACTUAL_REPORTS_ARTIFACT = "factual-reports.json" as const;
export const GRID_READINESS_METRICS_ARTIFACT = "metrics.json" as const;
export const GRID_READINESS_DECISION_ARTIFACT = "decision.json" as const;
export const GRID_READINESS_REPORT_ARTIFACT = "report.txt" as const;

/** Exact nine-entry bundle inventory (regular files only, no symlinks). */
export const GRID_READINESS_BUNDLE_ENTRIES: readonly string[] = Object.freeze([
  GRID_READINESS_MANIFEST_FILE,
  GRID_READINESS_SEED_REGISTRY_ARTIFACT,
  GRID_READINESS_SCENARIO_REGISTRY_ARTIFACT,
  GRID_READINESS_RUN_INDEX_ARTIFACT,
  GRID_READINESS_MATCH_RECORDS_ARTIFACT,
  GRID_READINESS_FACTUAL_REPORTS_ARTIFACT,
  GRID_READINESS_METRICS_ARTIFACT,
  GRID_READINESS_DECISION_ARTIFACT,
  GRID_READINESS_REPORT_ARTIFACT,
]);

export const GRID_READINESS_NON_MANIFEST_ARTIFACTS: readonly string[] = Object.freeze(
  GRID_READINESS_BUNDLE_ENTRIES.filter((name) => name !== GRID_READINESS_MANIFEST_FILE),
);

// ── seed-registry artifact serialization ───────────────────────────────────

export function serializeGridReadinessSeedRegistry(
  registry: GridReadinessSeedRegistry,
): string {
  return JSON.stringify(
    {
      schemaVersion: registry.schemaVersion,
      registryId: registry.registryId,
      purpose: registry.purpose,
      partition: registry.partition,
      seedDomain: registry.seedDomain,
      generatorVersion: registry.generatorVersion,
      simulatorVersion: registry.simulatorVersion,
      positioningModel: registry.positioningModel,
      rulesetVersion: registry.rulesetVersion,
      catalogueVersion: registry.catalogueVersion,
      seeds: [...registry.seeds],
    },
    null,
    2,
  );
}

// ── scenario-registry artifact schema and serialization ────────────────────

const readinessScenarioFighterSchema = z.object({
  displayName: z.string().min(1),
  buildProposal: machineBuildProposalSchema,
  policy: actionPolicySchema,
});

const readinessScenarioArtifactSchema = z
  .object({
    registryId: z.literal("grid-readiness-scenarios-v1"),
    simulatorVersion: z.literal("0.3.0"),
    positioningModel: z.literal("grid-3x3-v1"),
    rulesetVersion: z.literal("0.2.0"),
    catalogueVersion: z.literal("1"),
    scenarios: z.array(
      z.object({
        scenarioId: z.string().min(1),
        familyName: z.string().min(1),
        fighterX: readinessScenarioFighterSchema,
        fighterY: readinessScenarioFighterSchema,
      }),
    ),
    assignments: z.array(
      z.object({
        assignmentId: z.string().min(1),
        scenarioId: z.string().min(1),
        fighterACompetitor: z.enum(["x", "y"]),
        fighterBCompetitor: z.enum(["x", "y"]),
        roleSwapped: z.boolean(),
      }),
    ),
  })
  .strict();

export type GridActivationReadinessScenarioArtifact = z.infer<
  typeof readinessScenarioArtifactSchema
>;

export function serializeGridReadinessScenarioRegistry(
  registry: GridReadinessScenarioRegistry,
): string {
  return JSON.stringify(
    {
      registryId: registry.registryId,
      simulatorVersion: registry.simulatorVersion,
      positioningModel: registry.positioningModel,
      rulesetVersion: registry.rulesetVersion,
      catalogueVersion: registry.catalogueVersion,
      scenarios: registry.scenarios.map((scenario) => ({
        scenarioId: scenario.scenarioId,
        familyName: scenario.familyName,
        fighterX: {
          displayName: scenario.fighterX.displayName,
          buildProposal: scenario.fighterX.buildProposal,
          policy: scenario.fighterX.policy,
        },
        fighterY: {
          displayName: scenario.fighterY.displayName,
          buildProposal: scenario.fighterY.buildProposal,
          policy: scenario.fighterY.policy,
        },
      })),
      assignments: registry.assignments.map((assignment) => ({
        assignmentId: assignment.assignmentId,
        scenarioId: assignment.scenarioId,
        fighterACompetitor: assignment.fighterACompetitor,
        fighterBCompetitor: assignment.fighterBCompetitor,
        roleSwapped: assignment.roleSwapped,
      })),
    },
    null,
    2,
  );
}

export function deserializeGridActivationReadinessScenarioRegistry(
  json: string,
): { ok: true; registry: GridReadinessScenarioRegistry } | { ok: false; errors: string } {
  try {
    const data = JSON.parse(json) as unknown;
    const result = readinessScenarioArtifactSchema.safeParse(data);
    if (!result.success) return { ok: false, errors: result.error.message };
    const artifact = result.data;
    const registry: GridReadinessScenarioRegistry = Object.freeze({
      registryId: artifact.registryId,
      simulatorVersion: artifact.simulatorVersion,
      positioningModel: artifact.positioningModel,
      rulesetVersion: artifact.rulesetVersion,
      catalogueVersion: artifact.catalogueVersion,
      scenarios: Object.freeze(
        artifact.scenarios.map((scenario) =>
          Object.freeze({
            scenarioId: scenario.scenarioId,
            familyName: scenario.familyName,
            fighterX: Object.freeze(scenario.fighterX),
            fighterY: Object.freeze(scenario.fighterY),
          }),
        ),
      ),
      assignments: Object.freeze(
        artifact.assignments.map((assignment) => Object.freeze(assignment)),
      ),
    });
    return { ok: true, registry };
  } catch (e) {
    return { ok: false, errors: e instanceof SyntaxError ? e.message : String(e) };
  }
}

// ── manifest v1 ─────────────────────────────────────────────────────────────

export const gridActivationReadinessManifestSchema = z
  .object({
    schemaVersion: z.literal("1"),
    evaluationKind: z.literal("grid-activation-readiness"),
    suiteId: z.literal(GRID_ACTIVATION_READINESS_SUITE_ID),
    evaluationId: z.string().uuid(),
    createdAt: z.string().min(1),
    simulatorVersion: z.literal("0.3.0"),
    positioningModel: z.literal("grid-3x3-v1"),
    rulesetVersion: z.literal("0.2.0"),
    catalogueVersion: z.literal("1"),
    seedCount: z.literal(24),
    scenarioCount: z.literal(7),
    assignmentCount: z.literal(13),
    runCount: z.literal(GRID_ACTIVATION_READINESS_RUN_COUNT),
    seedRegistryId: z.literal("grid-readiness-development-v1"),
    seedRegistryChecksum: z.string().regex(/^[a-f0-9]{64}$/),
    scenarioRegistryId: z.literal("grid-readiness-scenarios-v1"),
    scenarioRegistryChecksum: z.string().regex(/^[a-f0-9]{64}$/),
    suiteChecksum: z.string().regex(/^[a-f0-9]{64}$/),
    decisionChecksum: z.string().regex(/^[a-f0-9]{64}$/),
    reportChecksum: z.string().regex(/^[a-f0-9]{64}$/),
    decision: z.enum(["ready_for_opt_in_beta_review", "inconclusive", "not_ready"]),
    artifacts: z.object({
      manifest: z.literal(GRID_READINESS_MANIFEST_FILE),
      seedRegistry: z.literal(GRID_READINESS_SEED_REGISTRY_ARTIFACT),
      scenarioRegistry: z.literal(GRID_READINESS_SCENARIO_REGISTRY_ARTIFACT),
      runIndex: z.literal(GRID_READINESS_RUN_INDEX_ARTIFACT),
      matchRecords: z.literal(GRID_READINESS_MATCH_RECORDS_ARTIFACT),
      factualReports: z.literal(GRID_READINESS_FACTUAL_REPORTS_ARTIFACT),
      metrics: z.literal(GRID_READINESS_METRICS_ARTIFACT),
      decision: z.literal(GRID_READINESS_DECISION_ARTIFACT),
      report: z.literal(GRID_READINESS_REPORT_ARTIFACT),
    }),
    digests: z.record(z.string(), z.string().regex(/^[a-f0-9]{64}$/)),
    evidence: z.object({
      allArtifactsReadBack: z.literal(true),
      bundleCrossAgreementPassed: z.literal(true),
      deterministicReexecutionPassed: z.literal(true),
    }),
  })
  .strict();

export type GridActivationReadinessManifestV1 = z.infer<
  typeof gridActivationReadinessManifestSchema
>;

export class GridActivationReadinessBundleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GridActivationReadinessBundleError";
  }
}

export interface BuildGridActivationReadinessManifestInput {
  evaluationId: string;
  createdAt: string;
  seedRegistry: GridReadinessSeedRegistry;
  scenarioRegistry: GridReadinessScenarioRegistry;
  suiteChecksum: string;
  decision: GridActivationReadinessDecisionV1;
  /** SHA-256 digest of every non-manifest artifact, keyed by artifact name. */
  digests: Record<string, string>;
  decisionChecksum: string;
  reportChecksum: string;
}

export function buildGridActivationReadinessManifest(
  input: BuildGridActivationReadinessManifestInput,
): GridActivationReadinessManifestV1 {
  const manifest: GridActivationReadinessManifestV1 = {
    schemaVersion: "1",
    evaluationKind: "grid-activation-readiness",
    suiteId: GRID_ACTIVATION_READINESS_SUITE_ID,
    evaluationId: input.evaluationId,
    createdAt: input.createdAt,
    simulatorVersion: "0.3.0",
    positioningModel: "grid-3x3-v1",
    rulesetVersion: "0.2.0",
    catalogueVersion: "1",
    seedCount: input.seedRegistry.seeds.length as 24,
    scenarioCount: input.scenarioRegistry.scenarios.length as 7,
    assignmentCount: input.scenarioRegistry.assignments.length as 13,
    runCount: GRID_ACTIVATION_READINESS_RUN_COUNT,
    seedRegistryId: input.seedRegistry.registryId,
    seedRegistryChecksum: gridReadinessSeedRegistryChecksum(input.seedRegistry),
    scenarioRegistryId: input.scenarioRegistry.registryId,
    scenarioRegistryChecksum: gridReadinessScenarioRegistryChecksum(
      input.scenarioRegistry,
    ),
    suiteChecksum: input.suiteChecksum,
    decisionChecksum: input.decisionChecksum,
    reportChecksum: input.reportChecksum,
    decision: input.decision.decision,
    artifacts: {
      manifest: GRID_READINESS_MANIFEST_FILE,
      seedRegistry: GRID_READINESS_SEED_REGISTRY_ARTIFACT,
      scenarioRegistry: GRID_READINESS_SCENARIO_REGISTRY_ARTIFACT,
      runIndex: GRID_READINESS_RUN_INDEX_ARTIFACT,
      matchRecords: GRID_READINESS_MATCH_RECORDS_ARTIFACT,
      factualReports: GRID_READINESS_FACTUAL_REPORTS_ARTIFACT,
      metrics: GRID_READINESS_METRICS_ARTIFACT,
      decision: GRID_READINESS_DECISION_ARTIFACT,
      report: GRID_READINESS_REPORT_ARTIFACT,
    },
    digests: { ...input.digests },
    evidence: {
      allArtifactsReadBack: true,
      bundleCrossAgreementPassed: true,
      deterministicReexecutionPassed: true,
    },
  };
  const parsed = deserializeGridActivationReadinessManifest(
    serializeGridActivationReadinessManifest(manifest),
  );
  if (!parsed.ok) {
    throw new GridActivationReadinessBundleError(
      `Grid activation readiness manifest failed its authoritative schema: ${parsed.errors}`,
    );
  }
  return parsed.manifest;
}

export function serializeGridActivationReadinessManifest(
  manifest: GridActivationReadinessManifestV1,
): string {
  return JSON.stringify(manifest, null, 2);
}

export function deserializeGridActivationReadinessManifest(
  json: string,
):
  | { ok: true; manifest: GridActivationReadinessManifestV1 }
  | { ok: false; errors: string } {
  try {
    const data = JSON.parse(json) as unknown;
    const result = gridActivationReadinessManifestSchema.safeParse(data);
    if (result.success) return { ok: true, manifest: result.data };
    return { ok: false, errors: result.error.message };
  } catch (e) {
    return { ok: false, errors: e instanceof SyntaxError ? e.message : String(e) };
  }
}

// ── pure bundle cross-agreement validators ─────────────────────────────────

function check(failures: string[], condition: boolean, message: string): void {
  if (!condition) failures.push(message);
}

function sameJson(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function buildPolicyMatches(recordPolicy: unknown, expectedPolicy: unknown): boolean {
  return sameJson(recordPolicy, expectedPolicy);
}

function buildProposalMatches(recordBuild: unknown, expectedProposal: unknown): boolean {
  const record = recordBuild as {
    proposal?: {
      machineName?: string;
      chassisId?: string;
      mobilityId?: string;
      weaponId?: string;
      utilityId?: string;
      armour?: unknown;
    };
  };
  const proposal = record?.proposal;
  if (!proposal) return false;
  const expected = expectedProposal as {
    machineName?: string;
    chassisId?: string;
    mobilityId?: string;
    weaponId?: string;
    utilityId?: string;
    armour?: unknown;
  };
  return (
    proposal.machineName === expected.machineName &&
    proposal.chassisId === expected.chassisId &&
    proposal.mobilityId === expected.mobilityId &&
    proposal.weaponId === expected.weaponId &&
    proposal.utilityId === expected.utilityId &&
    sameJson(proposal.armour, expected.armour)
  );
}

export interface GridActivationReadinessCoreArtifactsInput {
  seedRegistry: GridReadinessSeedRegistry;
  scenarioRegistry: GridReadinessScenarioRegistry;
  runIndex: GridActivationReadinessRunIndexEnvelope;
  records: GridActivationReadinessMatchRecordsEnvelope;
  reports: GridActivationReadinessFactualReportsEnvelope;
}

/**
 * Core cross-agreement validation of the records/reports/run-index against
 * the persisted registries. This subset does not require the manifest or the
 * decision, so it can run before the decision is built (feeding the H09 gate)
 * and is reused by the full bundle validator.
 */
export function validateGridActivationReadinessCoreArtifacts(
  input: GridActivationReadinessCoreArtifactsInput,
): void {
  const failures: string[] = [];
  const { seedRegistry, scenarioRegistry, runIndex, records, reports } = input;

  check(
    failures,
    runIndex.items.length === GRID_ACTIVATION_READINESS_RUN_COUNT &&
      records.items.length === GRID_ACTIVATION_READINESS_RUN_COUNT &&
      reports.items.length === GRID_ACTIVATION_READINESS_RUN_COUNT,
    "envelopes must each contain exactly 312 items",
  );
  check(
    failures,
    runIndex.evaluationId === records.evaluationId &&
      runIndex.evaluationId === reports.evaluationId,
    "envelope evaluation IDs do not agree",
  );

  // The persisted registries must reproduce the persisted run index exactly.
  const plan = buildGridActivationReadinessRunPlan({ seedRegistry, scenarioRegistry });
  check(
    failures,
    plan.runs.length === runIndex.items.length,
    "recomputed run plan length does not match run-index",
  );
  for (let i = 0; i < runIndex.items.length; i++) {
    const entry = runIndex.items[i]!;
    const planned = plan.runs[i]!;
    check(
      failures,
      entry.runNumber === planned.runNumber &&
        entry.scenarioId === planned.scenarioId &&
        entry.assignmentId === planned.assignmentId &&
        entry.seed === planned.seed &&
        entry.roleSwapped === planned.roleSwapped &&
        entry.fighterACompetitor === planned.fighterACompetitor &&
        entry.fighterBCompetitor === planned.fighterBCompetitor,
      `run-index item ${i} does not match the recomputed run plan`,
    );
  }

  for (let i = 0; i < runIndex.items.length; i++) {
    const entry = runIndex.items[i]!;
    const record = records.items[i]!;
    const report = reports.items[i]!;
    const label = `run ${entry.runNumber} (index ${i})`;
    check(failures, record.matchId === entry.matchId, `${label} record matchId mismatch`);
    check(failures, report.matchId === entry.matchId, `${label} report matchId mismatch`);
    check(failures, record.seed === entry.seed, `${label} record seed mismatch`);
    check(failures, report.seed === entry.seed, `${label} report seed mismatch`);
    check(failures, record.rounds === entry.rounds, `${label} record rounds mismatch`);
    check(failures, report.rounds === entry.rounds, `${label} report rounds mismatch`);
    check(
      failures,
      record.result.winner === entry.winner,
      `${label} record winner mismatch`,
    );
    check(
      failures,
      record.result.method === entry.resultMethod,
      `${label} record result method mismatch`,
    );
    check(failures, report.winner === entry.winner, `${label} report winner mismatch`);
    check(
      failures,
      report.resultMethod === entry.resultMethod,
      `${label} report result method mismatch`,
    );
    check(
      failures,
      record.simulatorVersion === "0.3.0" &&
        record.positioningModel === "grid-3x3-v1" &&
        record.rulesetVersion === "0.2.0" &&
        record.catalogueVersion === "1",
      `${label} record runtime identity mismatch`,
    );
    check(
      failures,
      report.simulatorVersion === "0.3.0" &&
        report.positioningModel === "grid-3x3-v1" &&
        report.rulesetVersion === "0.2.0" &&
        report.catalogueVersion === "1",
      `${label} report runtime identity mismatch`,
    );
    // Record/report binding.
    check(
      failures,
      report.matchId === record.matchId &&
        report.seed === record.seed &&
        report.rounds === record.rounds &&
        report.winner === record.result.winner &&
        report.resultMethod === record.result.method,
      `${label} record/report binding mismatch`,
    );
    // Build/policy binding to the scenario assignment.
    const scenario = scenarioRegistry.scenarios.find(
      (s) => s.scenarioId === entry.scenarioId,
    );
    check(failures, scenario !== undefined, `${label} unknown scenario in registry`);
    if (scenario) {
      const configA =
        entry.fighterACompetitor === "x" ? scenario.fighterX : scenario.fighterY;
      const configB =
        entry.fighterBCompetitor === "x" ? scenario.fighterX : scenario.fighterY;
      check(
        failures,
        buildProposalMatches(record.config.fighterA.build, configA.buildProposal) &&
          buildPolicyMatches(record.config.fighterA.policy, configA.policy),
        `${label} fighterA build/policy does not match the scenario assignment`,
      );
      check(
        failures,
        buildProposalMatches(record.config.fighterB.build, configB.buildProposal) &&
          buildPolicyMatches(record.config.fighterB.policy, configB.policy),
        `${label} fighterB build/policy does not match the scenario assignment`,
      );
    }
  }

  if (failures.length > 0) {
    throw new GridActivationReadinessBundleError(
      `Grid activation readiness bundle cross-agreement failed: ${failures.join("; ")}`,
    );
  }
}

export interface GridActivationReadinessBundleValidationResult {
  evaluationId: string;
  decision: GridActivationReadinessDecisionV1["decision"];
  digestAgreement: true;
}

/**
 * Pure cross-agreement validation of the complete read-back bundle. Parses
 * every artifact through its authoritative schema, verifies every manifest
 * digest and checksum, verifies cross-envelope identity/ordering/result
 * agreement, recomputes the run plan from the persisted registries, binds each
 * run's record/report to its scenario assignment, and fails closed on any
 * disagreement.
 */
export function validateGridActivationReadinessBundle(
  contents: Record<string, string>,
): GridActivationReadinessBundleValidationResult {
  const failures: string[] = [];

  const manifestText = contents[GRID_READINESS_MANIFEST_FILE];
  const seedText = contents[GRID_READINESS_SEED_REGISTRY_ARTIFACT];
  const scenarioText = contents[GRID_READINESS_SCENARIO_REGISTRY_ARTIFACT];
  const runIndexText = contents[GRID_READINESS_RUN_INDEX_ARTIFACT];
  const recordsText = contents[GRID_READINESS_MATCH_RECORDS_ARTIFACT];
  const reportsText = contents[GRID_READINESS_FACTUAL_REPORTS_ARTIFACT];
  const metricsText = contents[GRID_READINESS_METRICS_ARTIFACT];
  const decisionText = contents[GRID_READINESS_DECISION_ARTIFACT];
  const reportText = contents[GRID_READINESS_REPORT_ARTIFACT];

  for (const name of GRID_READINESS_BUNDLE_ENTRIES) {
    check(
      failures,
      typeof contents[name] === "string",
      `bundle is missing artifact ${name}`,
    );
  }

  const manifestParsed = manifestText
    ? deserializeGridActivationReadinessManifest(manifestText)
    : { ok: false as const, errors: "missing manifest" };
  const seedParsed = seedText ? loadGridReadinessSeedRegistrySafe(seedText) : null;
  const scenarioParsed = scenarioText
    ? deserializeGridActivationReadinessScenarioRegistry(scenarioText)
    : null;
  const runIndexParsed = runIndexText
    ? deserializeGridActivationReadinessRunIndex(runIndexText)
    : null;
  const recordsParsed = recordsText
    ? deserializeGridActivationReadinessMatchRecords(recordsText)
    : null;
  const reportsParsed = reportsText
    ? deserializeGridActivationReadinessFactualReports(reportsText)
    : null;
  const metricsParsed = metricsText
    ? deserializeGridActivationReadinessMetrics(metricsText)
    : null;
  const decisionParsed = decisionText
    ? deserializeGridActivationReadinessDecision(decisionText)
    : null;

  if (!manifestParsed.ok) {
    failures.push(`invalid manifest: ${manifestParsed.errors}`);
  }
  if (seedParsed === null) {
    failures.push("invalid seed-registry artifact");
  }
  if (scenarioParsed && !scenarioParsed.ok) {
    failures.push(`invalid scenario-registry artifact: ${scenarioParsed.errors}`);
  }
  if (runIndexParsed && !runIndexParsed.ok) {
    failures.push(`invalid run-index: ${runIndexParsed.errors}`);
  }
  if (recordsParsed && !recordsParsed.ok) {
    failures.push(`invalid match-records: ${recordsParsed.errors}`);
  }
  if (reportsParsed && !reportsParsed.ok) {
    failures.push(`invalid factual-reports: ${reportsParsed.errors}`);
  }
  if (metricsParsed && !metricsParsed.ok) {
    failures.push(`invalid metrics: ${metricsParsed.errors}`);
  }
  if (decisionParsed && !decisionParsed.ok) {
    failures.push(`invalid decision: ${decisionParsed.errors}`);
  }

  if (failures.length > 0) {
    throw new GridActivationReadinessBundleError(
      `Grid activation readiness bundle validation failed: ${failures.join("; ")}`,
    );
  }

  const manifest = manifestParsed.ok ? manifestParsed.manifest : null;
  const seedRegistry = seedParsed;
  const scenarioRegistry =
    scenarioParsed && scenarioParsed.ok ? scenarioParsed.registry : null;
  const runIndex = runIndexParsed && runIndexParsed.ok ? runIndexParsed.envelope : null;
  const records = recordsParsed && recordsParsed.ok ? recordsParsed.envelope : null;
  const reports = reportsParsed && reportsParsed.ok ? reportsParsed.envelope : null;
  const decision = decisionParsed && decisionParsed.ok ? decisionParsed.decision : null;

  // All artifacts parsed: the failure check above guarantees these are
  // non-null, so the core cross-agreement and manifest checks may proceed.
  if (
    manifest === null ||
    seedRegistry === null ||
    scenarioRegistry === null ||
    runIndex === null ||
    records === null ||
    reports === null ||
    decision === null
  ) {
    throw new GridActivationReadinessBundleError(
      "Grid activation readiness bundle validation failed: one or more artifacts did not parse",
    );
  }

  // Digests: every non-manifest artifact must match its manifest digest.
  {
    for (const name of GRID_READINESS_NON_MANIFEST_ARTIFACTS) {
      const digest = manifest.digests[name];
      const actual = sha256Hex(contents[name]!);
      check(
        failures,
        digest !== undefined && digest === actual,
        `manifest digest mismatch for ${name}`,
      );
    }
    // Registry checksums are the canonical (compact) registry checksums, not
    // the pretty-printed artifact digests: recompute them from the parsed
    // registries and compare.
    check(
      failures,
      gridReadinessSeedRegistryChecksum(seedRegistry) === manifest.seedRegistryChecksum,
      "manifest seed-registry checksum does not match the canonical registry checksum",
    );
    check(
      failures,
      gridReadinessScenarioRegistryChecksum(scenarioRegistry) ===
        manifest.scenarioRegistryChecksum,
      "manifest scenario-registry checksum does not match the canonical registry checksum",
    );
    check(
      failures,
      manifest.decisionChecksum ===
        sha256Hex(contents[GRID_READINESS_DECISION_ARTIFACT]!),
      "manifest decision checksum mismatch",
    );
    check(
      failures,
      manifest.reportChecksum === sha256Hex(contents[GRID_READINESS_REPORT_ARTIFACT]!),
      "manifest report checksum mismatch",
    );
  }

  // Registry/plan recomputation and full cross-envelope agreement are handled
  // by the reusable core validator (which also binds each run's record/report
  // to its scenario assignment).
  if (seedRegistry && scenarioRegistry && runIndex && records && reports) {
    const coreFailures: string[] = [];
    try {
      validateGridActivationReadinessCoreArtifacts({
        seedRegistry,
        scenarioRegistry,
        runIndex,
        records,
        reports,
      });
    } catch (e) {
      coreFailures.push(e instanceof Error ? e.message : String(e));
    }
    if (coreFailures.length > 0) failures.push(...coreFailures);
    const plan = buildGridActivationReadinessRunPlan({ seedRegistry, scenarioRegistry });
    check(
      failures,
      gridActivationReadinessSuiteChecksum(plan) === manifest!.suiteChecksum,
      "manifest suite checksum does not match the recomputed run plan",
    );
  }

  // Decision agreement with the manifest.
  if (decision && manifest) {
    check(
      failures,
      decision.decision === manifest.decision,
      "decision artifact decision does not match manifest decision",
    );
  }

  // Report text contract.
  if (reportText !== undefined) {
    check(failures, reportText.length > 0, "report.txt must be non-empty");
    check(failures, !reportText.includes("\u0000"), "report.txt must not contain NUL");
    check(
      failures,
      reportText.includes(GRID_ACTIVATION_READINESS_DISCLAIMER),
      "report.txt lacks the mandatory non-activation disclaimer",
    );
    check(
      failures,
      !/(^|[^a-z-])benchmark/i.test(reportText),
      "report.txt must not call the suite a benchmark",
    );
    check(
      failures,
      !/balance pass/i.test(reportText),
      "report.txt must not call a result a balance pass",
    );
  }

  if (failures.length > 0) {
    throw new GridActivationReadinessBundleError(
      `Grid activation readiness bundle cross-agreement failed: ${failures.join("; ")}`,
    );
  }

  return {
    evaluationId: manifest!.evaluationId,
    decision: decision!.decision,
    digestAgreement: true,
  };
}

function loadGridReadinessSeedRegistrySafe(
  json: string,
): GridReadinessSeedRegistry | null {
  try {
    return loadGridReadinessSeedRegistry(JSON.parse(json) as unknown);
  } catch {
    return null;
  }
}
