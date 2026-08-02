import { beforeAll, describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  buildReadinessTestBundle,
  type ReadinessTestBundle,
} from "../helpers/grid-readiness-bundle-builder.js";
import {
  validateGridActivationReadinessBundle,
  validateGridActivationReadinessCoreArtifacts,
  deserializeGridActivationReadinessManifest,
  GRID_READINESS_BUNDLE_ENTRIES,
  GRID_READINESS_MANIFEST_FILE,
  GRID_READINESS_NON_MANIFEST_ARTIFACTS,
  GRID_READINESS_RUN_INDEX_ARTIFACT,
  GRID_READINESS_SEED_REGISTRY_ARTIFACT,
  GRID_READINESS_SCENARIO_REGISTRY_ARTIFACT,
  GRID_READINESS_MATCH_RECORDS_ARTIFACT,
  GRID_READINESS_FACTUAL_REPORTS_ARTIFACT,
  GRID_READINESS_METRICS_ARTIFACT,
  GRID_READINESS_DECISION_ARTIFACT,
  GRID_READINESS_REPORT_ARTIFACT,
  GridActivationReadinessBundleError,
} from "../../src/readiness/readiness-bundle.js";
import { buildGridActivationReadinessReport } from "../../src/readiness/report.js";
import {
  deserializeGridActivationReadinessRunIndex,
  deserializeGridActivationReadinessMatchRecords,
  deserializeGridActivationReadinessFactualReports,
  serializeGridActivationReadinessEnvelope,
  type GridActivationReadinessRunIndexEnvelopeV3,
} from "../../src/readiness/envelopes.schema.js";
import {
  deserializeGridActivationReadinessMetrics,
  type GridActivationReadinessMetrics,
} from "../../src/readiness/metrics.js";
import {
  deserializeGridActivationReadinessDecision,
  buildGridActivationReadinessDecision,
} from "../../src/readiness/decision.js";
import { evaluateGridActivationReadinessGates } from "../../src/readiness/gates.js";
import { deriveGridActivationReadinessDecision } from "../../src/readiness/decision.js";
import { sha256Hex } from "../../src/canary/grid-canary-digest.js";
import { assertValidBundleDeclaration } from "../../src/canary/immutable-canary-bundle.js";
import { GRID_ACTIVATION_READINESS_RUN_COUNT } from "../../src/readiness/run-plan.js";

const FROZEN_V1_SUITE_CHECKSUM =
  "dd38ac8a5d2e35007b4b6890418b21aca8f621f3e165fa7d158d2f179672ae5a";
const FROZEN_V2_SUITE_CHECKSUM =
  "df9444101ca68f7b7ca9fef24adfe8575363ef744e9f37b4449b111e0bb29fd9";

/**
 * Corrupts one artifact, recomputes its manifest digest so the bundle stays
 * digest-coherent, and returns the tampered bundle. The validator must still
 * reject it through cross-agreement and recomputation.
 */
function redigestArtifact(
  bundle: ReadinessTestBundle,
  artifactName: string,
  mutate: (parsed: unknown) => void,
): Record<string, string> {
  const corrupted = { ...bundle.contents };
  const parsed = JSON.parse(corrupted[artifactName]!);
  mutate(parsed);
  corrupted[artifactName] = JSON.stringify(parsed, null, 2);
  const manifest = JSON.parse(corrupted[GRID_READINESS_MANIFEST_FILE]!) as {
    digests: Record<string, string>;
  };
  manifest.digests[artifactName] = sha256Hex(corrupted[artifactName]!);
  corrupted[GRID_READINESS_MANIFEST_FILE] = JSON.stringify(manifest, null, 2);
  return corrupted;
}

/**
 * Evaluates the frozen gates against the persisted bundle metrics with the
 * given informational timing override, returning the gate outcomes and the
 * derived classification. Used to prove timing changes cannot alter a gate or
 * the decision.
 */
function evaluateReadinessGatesForMetrics(
  bundle: ReadinessTestBundle,
  timing: GridActivationReadinessTimingLike,
): { outcomes: string[]; decision: string } {
  const metrics = JSON.parse(bundle.contents[GRID_READINESS_METRICS_ARTIFACT]!) as {
    timing: Record<string, number>;
  };
  metrics.timing = { ...timing };
  const gates = evaluateGridActivationReadinessGates({
    metrics: metrics as never,
    results: [],
    operational: {
      deterministicReexecutionPassed: true,
      inputsUnmodified: true,
      artifactIntegrityVerified: true,
      legacyIsolationVerified: true,
    },
  });
  return {
    outcomes: gates.gates.map((g) => g.outcome),
    decision: deriveGridActivationReadinessDecision({
      anyFail: gates.anyFail,
      anyInconclusive: gates.anyInconclusive,
    }),
  };
}

interface GridActivationReadinessTimingLike {
  totalElapsedMs: number;
  meanMsPerMatch: number;
  medianMsPerMatch: number;
  p95MsPerMatch: number;
}

/**
 * Applies a timing override to the persisted metrics and coherently
 * regenerates `report.txt` (the report embeds timing), updating the report
 * artifact digest. Used to test that timing validation only enforces the
 * mathematically justified invariants.
 */
function applyTimingToBundle(
  bundle: ReadinessTestBundle,
  timing: GridActivationReadinessTimingLike,
): Record<string, string> {
  const corrupted = { ...bundle.contents };
  const metrics = JSON.parse(corrupted[GRID_READINESS_METRICS_ARTIFACT]!) as {
    timing: Record<string, number>;
  };
  metrics.timing = { ...timing };
  corrupted[GRID_READINESS_METRICS_ARTIFACT] = JSON.stringify(metrics, null, 2);

  const decision = JSON.parse(corrupted[GRID_READINESS_DECISION_ARTIFACT]!) as {
    gates: Parameters<typeof buildGridActivationReadinessReport>[0]["gates"];
    decision: string;
    evaluationId: string;
    createdAt: string;
  };
  const manifest = JSON.parse(corrupted[GRID_READINESS_MANIFEST_FILE]!) as {
    suiteId: string;
    actionEvidenceModel: string;
    provenanceModel: string;
    seedRegistryId: string;
    seedRegistryChecksum: string;
    scenarioRegistryId: string;
    scenarioRegistryChecksum: string;
    suiteChecksum: string;
    seedCount: number;
    scenarioCount: number;
    assignmentCount: number;
  };
  const regenerated = buildGridActivationReadinessReport({
    evaluationId: decision.evaluationId,
    suiteId: manifest.suiteId,
    actionEvidenceModel: manifest.actionEvidenceModel,
    provenanceModel: manifest.provenanceModel,
    createdAt: decision.createdAt,
    seedRegistryId: manifest.seedRegistryId,
    seedRegistryChecksum: manifest.seedRegistryChecksum,
    scenarioRegistryId: manifest.scenarioRegistryId,
    scenarioRegistryChecksum: manifest.scenarioRegistryChecksum,
    suiteChecksum: manifest.suiteChecksum,
    seedCount: manifest.seedCount,
    scenarioCount: manifest.scenarioCount,
    assignmentCount: manifest.assignmentCount,
    totalSimulations: GRID_ACTIVATION_READINESS_RUN_COUNT,
    deterministic: true,
    metrics: metrics as never,
    gates: decision.gates,
    decision: decision.decision as never,
  });
  corrupted[GRID_READINESS_REPORT_ARTIFACT] = regenerated;

  const manifestCopy = JSON.parse(corrupted[GRID_READINESS_MANIFEST_FILE]!) as {
    digests: Record<string, string>;
    reportChecksum: string;
  };
  manifestCopy.digests[GRID_READINESS_METRICS_ARTIFACT] = sha256Hex(
    corrupted[GRID_READINESS_METRICS_ARTIFACT]!,
  );
  manifestCopy.digests[GRID_READINESS_REPORT_ARTIFACT] = sha256Hex(regenerated);
  manifestCopy.reportChecksum = sha256Hex(regenerated);
  corrupted[GRID_READINESS_MANIFEST_FILE] = JSON.stringify(manifestCopy, null, 2);
  return corrupted;
}

/**
 * Corrupts one factual report's final state, then coherently updates the
 * report artifact digest and the run-index report checksum (and its digest) so
 * the bundle remains digest-coherent. The validator must still reject it
 * because the report no longer agrees with the authoritative record event
 * stream.
 */
function corruptReportFinalState(
  bundle: ReadinessTestBundle,
  mutate: (state: {
    fighterA: Record<string, unknown>;
    fighterB: Record<string, unknown>;
  }) => void,
): Record<string, string> {
  const corrupted = { ...bundle.contents };
  const reports = JSON.parse(corrupted[GRID_READINESS_FACTUAL_REPORTS_ARTIFACT]!) as {
    items: Array<{
      finalStates: {
        fighterA: Record<string, unknown>;
        fighterB: Record<string, unknown>;
      };
    }>;
  };
  mutate(reports.items[0]!.finalStates);
  corrupted[GRID_READINESS_FACTUAL_REPORTS_ARTIFACT] = JSON.stringify(reports, null, 2);

  const runIndex = JSON.parse(corrupted[GRID_READINESS_RUN_INDEX_ARTIFACT]!) as {
    items: Array<{ reportChecksum: string }>;
  };
  runIndex.items[0]!.reportChecksum = sha256Hex(
    JSON.stringify(reports.items[0], null, 2),
  );
  corrupted[GRID_READINESS_RUN_INDEX_ARTIFACT] = JSON.stringify(runIndex, null, 2);

  const manifest = JSON.parse(corrupted[GRID_READINESS_MANIFEST_FILE]!) as {
    digests: Record<string, string>;
  };
  manifest.digests[GRID_READINESS_FACTUAL_REPORTS_ARTIFACT] = sha256Hex(
    corrupted[GRID_READINESS_FACTUAL_REPORTS_ARTIFACT]!,
  );
  manifest.digests[GRID_READINESS_RUN_INDEX_ARTIFACT] = sha256Hex(
    corrupted[GRID_READINESS_RUN_INDEX_ARTIFACT]!,
  );
  corrupted[GRID_READINESS_MANIFEST_FILE] = JSON.stringify(manifest, null, 2);
  return corrupted;
}

/**
 * Corrupts a factual report's top-level identity/result fields and coherently
 * updates the report digest and the run-index report checksum.
 */
function corruptReportIdentity(
  bundle: ReadinessTestBundle,
  mutate: (report: Record<string, unknown>) => void,
): Record<string, string> {
  const corrupted = { ...bundle.contents };
  const reports = JSON.parse(corrupted[GRID_READINESS_FACTUAL_REPORTS_ARTIFACT]!) as {
    items: Array<Record<string, unknown>>;
  };
  mutate(reports.items[0]!);
  corrupted[GRID_READINESS_FACTUAL_REPORTS_ARTIFACT] = JSON.stringify(reports, null, 2);

  const runIndex = JSON.parse(corrupted[GRID_READINESS_RUN_INDEX_ARTIFACT]!) as {
    items: Array<{ reportChecksum: string }>;
  };
  runIndex.items[0]!.reportChecksum = sha256Hex(
    JSON.stringify(reports.items[0], null, 2),
  );
  corrupted[GRID_READINESS_RUN_INDEX_ARTIFACT] = JSON.stringify(runIndex, null, 2);

  const manifest = JSON.parse(corrupted[GRID_READINESS_MANIFEST_FILE]!) as {
    digests: Record<string, string>;
  };
  manifest.digests[GRID_READINESS_FACTUAL_REPORTS_ARTIFACT] = sha256Hex(
    corrupted[GRID_READINESS_FACTUAL_REPORTS_ARTIFACT]!,
  );
  manifest.digests[GRID_READINESS_RUN_INDEX_ARTIFACT] = sha256Hex(
    corrupted[GRID_READINESS_RUN_INDEX_ARTIFACT]!,
  );
  corrupted[GRID_READINESS_MANIFEST_FILE] = JSON.stringify(manifest, null, 2);
  return corrupted;
}

/**
 * Phase 3E1.3: builds a FULLY coherent false bundle. One schema-valid factual
 * report's final state is corrupted, and then EVERY downstream artifact is
 * coherently rewritten to match the false state: the report artifact and its
 * run-index checksum, the persisted metrics (replayAgreeingMatches = 311 so
 * H05 fails), the recomputed gates (H05 fail), the decision (not_ready), the
 * regenerated report.txt, and every manifest digest/checksum plus the manifest
 * classification (not_ready). The resulting bundle is internally consistent
 * in every artifact except for the single record/report final-state
 * disagreement, which is exactly the defect the validator must reject.
 */
function corruptReportFinalStateCoherently(
  bundle: ReadinessTestBundle,
  mutate: (state: {
    fighterA: Record<string, unknown>;
    fighterB: Record<string, unknown>;
  }) => void,
): Record<string, string> {
  // 1. Corrupt the factual report final state and update the report artifact.
  const corrupted = { ...bundle.contents };
  const reports = JSON.parse(corrupted[GRID_READINESS_FACTUAL_REPORTS_ARTIFACT]!) as {
    items: Array<{
      finalStates: {
        fighterA: Record<string, unknown>;
        fighterB: Record<string, unknown>;
      };
    }>;
  };
  mutate(reports.items[0]!.finalStates);
  corrupted[GRID_READINESS_FACTUAL_REPORTS_ARTIFACT] = JSON.stringify(reports, null, 2);

  // 2. Update the run-index report checksum.
  const runIndex = JSON.parse(corrupted[GRID_READINESS_RUN_INDEX_ARTIFACT]!) as {
    items: Array<{ reportChecksum: string }>;
  };
  runIndex.items[0]!.reportChecksum = sha256Hex(
    JSON.stringify(reports.items[0], null, 2),
  );
  corrupted[GRID_READINESS_RUN_INDEX_ARTIFACT] = JSON.stringify(runIndex, null, 2);

  // 3. Persist the disagreement as replayAgreeingMatches = 311 (H05 fails).
  const metrics = JSON.parse(
    corrupted[GRID_READINESS_METRICS_ARTIFACT]!,
  ) as GridActivationReadinessMetrics & {
    execution: GridActivationReadinessMetrics["execution"];
  };
  metrics.execution = {
    ...metrics.execution,
    replayAgreeingMatches: GRID_ACTIVATION_READINESS_RUN_COUNT - 1,
  };
  corrupted[GRID_READINESS_METRICS_ARTIFACT] = JSON.stringify(metrics, null, 2);

  // 4. Recompute the gates from the persisted (corrupt) metrics: only H05
  // fails, so the classification becomes not_ready.
  const gates = evaluateGridActivationReadinessGates({
    metrics: metrics as unknown as GridActivationReadinessMetrics,
    results: [],
    operational: {
      deterministicReexecutionPassed: true,
      inputsUnmodified: true,
      artifactIntegrityVerified: true,
      legacyIsolationVerified: true,
    },
  });

  // 5. Rebuild decision.json as not_ready with the recomputed gates.
  const decision = buildGridActivationReadinessDecision({
    evaluationId: bundle.decision.evaluationId,
    createdAt: bundle.decision.createdAt,
    gates: gates.gates,
    anyFail: gates.anyFail,
    anyInconclusive: gates.anyInconclusive,
  });
  const serializedDecision = serializeGridActivationReadinessEnvelope(decision);
  corrupted[GRID_READINESS_DECISION_ARTIFACT] = serializedDecision;

  // 6. Regenerate report.txt byte-for-byte from the corrupt metrics, gates
  // and not_ready decision.
  const manifestSource = JSON.parse(corrupted[GRID_READINESS_MANIFEST_FILE]!) as {
    suiteId: string;
    actionEvidenceModel: string;
    provenanceModel: string;
    seedRegistryId: string;
    seedRegistryChecksum: string;
    scenarioRegistryId: string;
    scenarioRegistryChecksum: string;
    suiteChecksum: string;
    seedCount: number;
    scenarioCount: number;
    assignmentCount: number;
  };
  const regeneratedReport = buildGridActivationReadinessReport({
    evaluationId: decision.evaluationId,
    suiteId: manifestSource.suiteId,
    actionEvidenceModel: manifestSource.actionEvidenceModel,
    provenanceModel: manifestSource.provenanceModel,
    createdAt: decision.createdAt,
    seedRegistryId: manifestSource.seedRegistryId,
    seedRegistryChecksum: manifestSource.seedRegistryChecksum,
    scenarioRegistryId: manifestSource.scenarioRegistryId,
    scenarioRegistryChecksum: manifestSource.scenarioRegistryChecksum,
    suiteChecksum: manifestSource.suiteChecksum,
    seedCount: manifestSource.seedCount,
    scenarioCount: manifestSource.scenarioCount,
    assignmentCount: manifestSource.assignmentCount,
    totalSimulations: GRID_ACTIVATION_READINESS_RUN_COUNT,
    deterministic: true,
    metrics: metrics as unknown as GridActivationReadinessMetrics,
    gates: gates.gates,
    decision: decision.decision,
  });
  corrupted[GRID_READINESS_REPORT_ARTIFACT] = regeneratedReport;

  // 7. Coherently update the manifest: not_ready classification, digests for
  // every rewritten artifact, and the decision/report checksums.
  const manifest = JSON.parse(corrupted[GRID_READINESS_MANIFEST_FILE]!) as {
    decision: string;
    digests: Record<string, string>;
    decisionChecksum: string;
    reportChecksum: string;
  };
  manifest.decision = "not_ready";
  manifest.digests[GRID_READINESS_FACTUAL_REPORTS_ARTIFACT] = sha256Hex(
    corrupted[GRID_READINESS_FACTUAL_REPORTS_ARTIFACT]!,
  );
  manifest.digests[GRID_READINESS_RUN_INDEX_ARTIFACT] = sha256Hex(
    corrupted[GRID_READINESS_RUN_INDEX_ARTIFACT]!,
  );
  manifest.digests[GRID_READINESS_METRICS_ARTIFACT] = sha256Hex(
    corrupted[GRID_READINESS_METRICS_ARTIFACT]!,
  );
  manifest.digests[GRID_READINESS_DECISION_ARTIFACT] = sha256Hex(serializedDecision);
  manifest.digests[GRID_READINESS_REPORT_ARTIFACT] = sha256Hex(regeneratedReport);
  manifest.decisionChecksum = sha256Hex(serializedDecision);
  manifest.reportChecksum = sha256Hex(regeneratedReport);
  corrupted[GRID_READINESS_MANIFEST_FILE] = JSON.stringify(manifest, null, 2);
  return corrupted;
}

describe("grid activation readiness bundle (Phase 3E1)", () => {
  let bundle: ReadinessTestBundle;

  beforeAll(() => {
    bundle = buildReadinessTestBundle();
  }, 300_000);

  it("declares exactly the nine fixed artifact names", () => {
    expect(GRID_READINESS_BUNDLE_ENTRIES).toEqual([
      "manifest.json",
      "seed-registry.json",
      "scenario-registry.json",
      "run-index.json",
      "match-records.json",
      "factual-reports.json",
      "metrics.json",
      "decision.json",
      "report.txt",
    ]);
    expect(GRID_READINESS_BUNDLE_ENTRIES.length).toBe(9);
    expect(GRID_READINESS_NON_MANIFEST_ARTIFACTS.length).toBe(8);
    // The declaration satisfies the shared immutable publisher contract.
    expect(() =>
      assertValidBundleDeclaration({
        manifestFileName: GRID_READINESS_MANIFEST_FILE,
        entryNames: GRID_READINESS_BUNDLE_ENTRIES,
        artifacts: GRID_READINESS_NON_MANIFEST_ARTIFACTS.map((name) => ({
          name,
          content: bundle.contents[name]!,
        })),
      }),
    ).not.toThrow();
  });

  it("validates a fully consistent bundle (all artifacts read back, every digest verified)", () => {
    expect(() => validateGridActivationReadinessBundle(bundle.contents)).not.toThrow();
    const manifestParsed = deserializeGridActivationReadinessManifest(
      bundle.contents[GRID_READINESS_MANIFEST_FILE]!,
    );
    expect(manifestParsed.ok).toBe(true);
    const manifest = manifestParsed.ok ? manifestParsed.manifest : null;
    expect(manifest).not.toBeNull();
    for (const name of GRID_READINESS_NON_MANIFEST_ARTIFACTS) {
      expect(manifest!.digests[name]).toBe(sha256Hex(bundle.contents[name]!));
    }
    expect(manifest!.seedCount).toBe(24);
    expect(manifest!.scenarioCount).toBe(7);
    expect(manifest!.assignmentCount).toBe(13);
    expect(manifest!.runCount).toBe(312);
    expect(manifest!.decision).toBe(bundle.decision.decision);
  });

  it("verifies cross-envelope identity, ordering and record/report/run-index binding", () => {
    const runIndexParsed = deserializeGridActivationReadinessRunIndex(
      bundle.contents[GRID_READINESS_RUN_INDEX_ARTIFACT]!,
    );
    const recordsParsed = deserializeGridActivationReadinessMatchRecords(
      bundle.contents[GRID_READINESS_MATCH_RECORDS_ARTIFACT]!,
    );
    const reportsParsed = deserializeGridActivationReadinessFactualReports(
      bundle.contents[GRID_READINESS_FACTUAL_REPORTS_ARTIFACT]!,
    );
    expect(runIndexParsed.ok).toBe(true);
    expect(recordsParsed.ok).toBe(true);
    expect(reportsParsed.ok).toBe(true);
    if (!runIndexParsed.ok || !recordsParsed.ok || !reportsParsed.ok) return;
    expect(runIndexParsed.schemaVersion).toBe("3");

    expect(runIndexParsed.envelope.items.length).toBe(
      GRID_ACTIVATION_READINESS_RUN_COUNT,
    );
    expect(recordsParsed.envelope.items.length).toBe(GRID_ACTIVATION_READINESS_RUN_COUNT);
    expect(reportsParsed.envelope.items.length).toBe(GRID_ACTIVATION_READINESS_RUN_COUNT);
    expect(runIndexParsed.envelope.evaluationId).toBe(bundle.outcome.evaluationId);
    for (let i = 0; i < runIndexParsed.envelope.items.length; i++) {
      const entry = runIndexParsed.envelope.items[i]!;
      const record = recordsParsed.envelope.items[i]!;
      const report = reportsParsed.envelope.items[i]!;
      expect(entry.runNumber).toBe(i + 1);
      expect(entry.recordIndex).toBe(i);
      expect(entry.reportIndex).toBe(i);
      expect(record.matchId).toBe(entry.matchId);
      expect(report.matchId).toBe(entry.matchId);
      expect(record.seed).toBe(entry.seed);
      expect(report.seed).toBe(entry.seed);
      expect(record.result.winner).toBe(entry.winner);
      expect(record.result.method).toBe(entry.resultMethod);
      expect(report.winner).toBe(entry.winner);
      expect(report.resultMethod).toBe(entry.resultMethod);
    }
    // The core cross-agreement (including scenario assignment binding) passes.
    expect(() =>
      validateGridActivationReadinessCoreArtifacts({
        seedRegistry: bundle.seedRegistry,
        scenarioRegistry: bundle.scenarioRegistry,
        runIndex: runIndexParsed.envelope as GridActivationReadinessRunIndexEnvelopeV3,
        records: recordsParsed.envelope,
        reports: reportsParsed.envelope,
      }),
    ).not.toThrow();
  });

  it("rejects coherent schema-valid corruption (swapped record order)", () => {
    const corrupted = { ...bundle.contents };
    const records = JSON.parse(corrupted[GRID_READINESS_MATCH_RECORDS_ARTIFACT]!) as {
      items: unknown[];
    };
    const swapped = [...records.items];
    const first = swapped[0]!;
    const second = swapped[1]!;
    swapped[0] = second;
    swapped[1] = first;
    corrupted[GRID_READINESS_MATCH_RECORDS_ARTIFACT] = JSON.stringify(
      { ...records, items: swapped },
      null,
      2,
    );
    // The record envelope itself is schema-valid, but the cross-envelope
    // ordering/binding now disagrees with the run index and digests.
    expect(() => validateGridActivationReadinessBundle(corrupted)).toThrow(
      GridActivationReadinessBundleError,
    );
  });

  it("rejects a digest mismatch", () => {
    const corrupted = { ...bundle.contents };
    const manifest = JSON.parse(corrupted[GRID_READINESS_MANIFEST_FILE]!) as {
      digests: Record<string, string>;
    };
    manifest.digests[GRID_READINESS_RUN_INDEX_ARTIFACT] = "0".repeat(64);
    corrupted[GRID_READINESS_MANIFEST_FILE] = JSON.stringify(manifest, null, 2);
    expect(() => validateGridActivationReadinessBundle(corrupted)).toThrow(
      /digest mismatch/,
    );
  });

  it("rejects an evaluationId disagreement across envelopes", () => {
    const corrupted = { ...bundle.contents };
    const runIndex = JSON.parse(corrupted[GRID_READINESS_RUN_INDEX_ARTIFACT]!) as {
      evaluationId: string;
    };
    runIndex.evaluationId = "99999999-9999-4999-8999-999999999999";
    corrupted[GRID_READINESS_RUN_INDEX_ARTIFACT] = JSON.stringify(runIndex, null, 2);
    expect(() => validateGridActivationReadinessBundle(corrupted)).toThrow(
      /evaluation IDs do not agree|run-index/,
    );
  });

  it("rejects a removed artifact", () => {
    const corrupted = { ...bundle.contents };
    delete corrupted[GRID_READINESS_METRICS_ARTIFACT];
    expect(() => validateGridActivationReadinessBundle(corrupted)).toThrow(
      /missing artifact|invalid metrics/,
    );
  });

  it("rejects a report without the mandatory disclaimer", () => {
    const corrupted = { ...bundle.contents };
    const key = "report.txt" as const;
    corrupted[key] = corrupted[key]!.replace(
      "This development-only evaluation does not activate the grid runtime",
      "omitted disclaimer",
    );
    expect(() => validateGridActivationReadinessBundle(corrupted)).toThrow(
      /non-activation disclaimer/,
    );
  });

  // ── Phase 3E1.1: run-index provenance corruption ─────────────────────────

  it("rejects a run-index selected-movement count change even after redigesting", () => {
    const corrupted = redigestArtifact(
      bundle,
      GRID_READINESS_RUN_INDEX_ARTIFACT,
      (parsed) => {
        (
          parsed as {
            items: Array<{ selectedMovementActionCounts: Record<string, number> }>;
          }
        ).items[0]!.selectedMovementActionCounts.hold += 1;
      },
    );
    expect(() => validateGridActivationReadinessBundle(corrupted)).toThrow(
      /evidence|run-index|recomputed/i,
    );
  });

  it("rejects a run-index selected-combat count change even after redigesting", () => {
    const corrupted = redigestArtifact(
      bundle,
      GRID_READINESS_RUN_INDEX_ARTIFACT,
      (parsed) => {
        (
          parsed as {
            items: Array<{ selectedCombatActionCounts: Record<string, number> }>;
          }
        ).items[0]!.selectedCombatActionCounts.attack += 1;
      },
    );
    expect(() => validateGridActivationReadinessBundle(corrupted)).toThrow(
      /evidence|run-index|recomputed/i,
    );
  });

  it("rejects a run-index translated-action change even after redigesting", () => {
    const corrupted = redigestArtifact(
      bundle,
      GRID_READINESS_RUN_INDEX_ARTIFACT,
      (parsed) => {
        (
          parsed as { items: Array<{ translatedActionCounts: Record<string, number> }> }
        ).items[0]!.translatedActionCounts.advance += 1;
      },
    );
    expect(() => validateGridActivationReadinessBundle(corrupted)).toThrow(
      /evidence|run-index|recomputed/i,
    );
  });

  it("rejects a run-index zone-visit change even after redigesting", () => {
    const corrupted = redigestArtifact(
      bundle,
      GRID_READINESS_RUN_INDEX_ARTIFACT,
      (parsed) => {
        (
          parsed as { items: Array<{ zoneVisits: Record<string, number> }> }
        ).items[0]!.zoneVisits.center += 1;
      },
    );
    expect(() => validateGridActivationReadinessBundle(corrupted)).toThrow(
      /evidence|run-index|recomputed/i,
    );
  });

  it("rejects a run-index event-type-count change even after redigesting", () => {
    const corrupted = redigestArtifact(
      bundle,
      GRID_READINESS_RUN_INDEX_ARTIFACT,
      (parsed) => {
        const first = (
          parsed as { items: Array<{ eventTypeCounts: Record<string, number> }> }
        ).items[0]!;
        const key = Object.keys(first.eventTypeCounts)[0]!;
        first.eventTypeCounts[key] += 1;
      },
    );
    expect(() => validateGridActivationReadinessBundle(corrupted)).toThrow(
      /evidence|run-index|recomputed/i,
    );
  });

  it("rejects a run-index no-progress-streak change even after redigesting", () => {
    const corrupted = redigestArtifact(
      bundle,
      GRID_READINESS_RUN_INDEX_ARTIFACT,
      (parsed) => {
        (
          parsed as { items: Array<{ maximumConsecutiveNoProgressRounds: number }> }
        ).items[0]!.maximumConsecutiveNoProgressRounds += 1;
      },
    );
    expect(() => validateGridActivationReadinessBundle(corrupted)).toThrow(
      /evidence|run-index|recomputed/i,
    );
  });

  it("rejects a run-index checksum change even after redigesting", () => {
    const corrupted = redigestArtifact(
      bundle,
      GRID_READINESS_RUN_INDEX_ARTIFACT,
      (parsed) => {
        (
          parsed as { items: Array<{ recordChecksum: string }> }
        ).items[0]!.recordChecksum = "0".repeat(64);
      },
    );
    expect(() => validateGridActivationReadinessBundle(corrupted)).toThrow(
      /checksum|recomputed|evidence/i,
    );
  });

  // ── Phase 3E1.1: coherent derived-artifact corruption ────────────────────

  it("rejects a coherently redigested metrics change that disagrees with recomputation", () => {
    const corrupted = redigestArtifact(
      bundle,
      GRID_READINESS_METRICS_ARTIFACT,
      (parsed) => {
        const metrics = parsed as {
          movement: { actionCounts: Record<string, number> };
        };
        metrics.movement.actionCounts.advance += 1;
      },
    );
    expect(() => validateGridActivationReadinessBundle(corrupted)).toThrow(
      /persisted metrics do not match/i,
    );
  });

  it("rejects a coherently redigested decision classification change", () => {
    const corrupted = redigestArtifact(
      bundle,
      GRID_READINESS_DECISION_ARTIFACT,
      (parsed) => {
        const decision = parsed as { decision: string };
        decision.decision =
          decision.decision === "inconclusive" ? "not_ready" : "inconclusive";
      },
    );
    expect(() => validateGridActivationReadinessBundle(corrupted)).toThrow(
      /classification does not match/i,
    );
  });

  it("rejects a coherently redigested decision gate outcome change", () => {
    const corrupted = redigestArtifact(
      bundle,
      GRID_READINESS_DECISION_ARTIFACT,
      (parsed) => {
        const decision = parsed as {
          gates: Array<{ gateId: string; outcome: string }>;
        };
        const gate = decision.gates.find((g) => g.outcome === "pass");
        if (gate) gate.outcome = "fail";
      },
    );
    expect(() => validateGridActivationReadinessBundle(corrupted)).toThrow(
      /gates do not match|fail-summary|inconclusive-summary/i,
    );
  });

  it("rejects a coherently redigested report.txt change", () => {
    const corrupted = { ...bundle.contents };
    corrupted[GRID_READINESS_REPORT_ARTIFACT] =
      `${bundle.contents[GRID_READINESS_REPORT_ARTIFACT]}\ntampered`;
    const manifest = JSON.parse(corrupted[GRID_READINESS_MANIFEST_FILE]!) as {
      digests: Record<string, string>;
    };
    manifest.digests[GRID_READINESS_REPORT_ARTIFACT] = sha256Hex(
      corrupted[GRID_READINESS_REPORT_ARTIFACT]!,
    );
    corrupted[GRID_READINESS_MANIFEST_FILE] = JSON.stringify(manifest, null, 2);
    expect(() => validateGridActivationReadinessBundle(corrupted)).toThrow(
      /report.txt does not byte-for-byte match/i,
    );
  });

  it("rejects a manifest whose evidence attestations are weakened", () => {
    const corrupted = { ...bundle.contents };
    const manifest = JSON.parse(corrupted[GRID_READINESS_MANIFEST_FILE]!) as {
      evidence: Record<string, unknown>;
    };
    manifest.evidence.deterministicReexecutionPassed = false;
    corrupted[GRID_READINESS_MANIFEST_FILE] = JSON.stringify(manifest, null, 2);
    expect(() => validateGridActivationReadinessBundle(corrupted)).toThrow(
      /invalid manifest/,
    );
  });

  // ── Phase 3E1.2: operational execution metrics corruption ────────────────

  it("rejects a coherent redigested deterministicMatches change", () => {
    const corrupted = redigestArtifact(
      bundle,
      GRID_READINESS_METRICS_ARTIFACT,
      (parsed) => {
        (
          parsed as { execution: { deterministicMatches: number } }
        ).execution.deterministicMatches = 300;
      },
    );
    expect(() => validateGridActivationReadinessBundle(corrupted)).toThrow(
      /persisted metrics do not match/i,
    );
  });

  it("rejects a coherent redigested invalidEventCount change", () => {
    const corrupted = redigestArtifact(
      bundle,
      GRID_READINESS_METRICS_ARTIFACT,
      (parsed) => {
        (
          parsed as { execution: { invalidEventCount: number } }
        ).execution.invalidEventCount = 5;
      },
    );
    expect(() => validateGridActivationReadinessBundle(corrupted)).toThrow(
      /persisted metrics do not match/i,
    );
  });

  it("rejects a coherent redigested mutationFailures change", () => {
    const corrupted = redigestArtifact(
      bundle,
      GRID_READINESS_METRICS_ARTIFACT,
      (parsed) => {
        (
          parsed as { execution: { mutationFailures: number } }
        ).execution.mutationFailures = 3;
      },
    );
    expect(() => validateGridActivationReadinessBundle(corrupted)).toThrow(
      /persisted metrics do not match/i,
    );
  });

  it("rejects a coherent redigested schema-valid count change", () => {
    const corrupted = redigestArtifact(
      bundle,
      GRID_READINESS_METRICS_ARTIFACT,
      (parsed) => {
        (
          parsed as { execution: { schemaValidRecords: number } }
        ).execution.schemaValidRecords = 311;
      },
    );
    expect(() => validateGridActivationReadinessBundle(corrupted)).toThrow(
      /persisted metrics do not match/i,
    );
  });

  it("rejects a coherent redigested replayAgreeingMatches change", () => {
    const corrupted = redigestArtifact(
      bundle,
      GRID_READINESS_METRICS_ARTIFACT,
      (parsed) => {
        (
          parsed as { execution: { replayAgreeingMatches: number } }
        ).execution.replayAgreeingMatches = 311;
      },
    );
    expect(() => validateGridActivationReadinessBundle(corrupted)).toThrow(
      /persisted metrics do not match/i,
    );
  });

  // ── Phase 3E1.2: complete report/final-state agreement corruption ────────

  it("rejects a coherent factual-report final integrity corruption", () => {
    const corrupted = corruptReportFinalState(bundle, (state) => {
      state.fighterA.integrity += 1;
    });
    expect(() => validateGridActivationReadinessBundle(corrupted)).toThrow(
      /persisted metrics do not match|final-state|report/,
    );
  });

  it("rejects a coherent factual-report final zone corruption", () => {
    const corrupted = corruptReportFinalState(bundle, (state) => {
      state.fighterB.zone = state.fighterB.zone === "center" ? "north" : "center";
    });
    expect(() => validateGridActivationReadinessBundle(corrupted)).toThrow(
      /persisted metrics do not match|final-state|report/,
    );
  });

  it("rejects a coherent factual-report final facing corruption", () => {
    const corrupted = corruptReportFinalState(bundle, (state) => {
      state.fighterA.facing = state.fighterA.facing === "north" ? "south" : "north";
    });
    expect(() => validateGridActivationReadinessBundle(corrupted)).toThrow(
      /persisted metrics do not match|final-state|report/,
    );
  });

  it("rejects a coherent factual-report final conditions corruption", () => {
    const corrupted = corruptReportFinalState(bundle, (state) => {
      state.fighterA.conditions = ["overturned"];
    });
    expect(() => validateGridActivationReadinessBundle(corrupted)).toThrow(
      /persisted metrics do not match|final-state|report/,
    );
  });

  it("rejects a coherent factual-report disabled-component corruption", () => {
    const corrupted = corruptReportFinalState(bundle, (state) => {
      state.fighterB.weaponDisabled = !state.fighterB.weaponDisabled;
    });
    expect(() => validateGridActivationReadinessBundle(corrupted)).toThrow(
      /persisted metrics do not match|final-state|report/,
    );
  });

  it("rejects a coherent factual-report winner/rounds corruption", () => {
    const corrupted = corruptReportIdentity(bundle, (report) => {
      report.winner = report.winner === "fighter_a" ? "fighter_b" : "fighter_a";
    });
    expect(() => validateGridActivationReadinessBundle(corrupted)).toThrow(
      /persisted metrics do not match|final-state|report|run-index|winner/,
    );
  });

  // ── Phase 3E1.3: report disagreement is fatal to current readiness evidence ──

  it("still validates the unmodified official-shape v3 bundle (positive regression)", () => {
    // The same strong validator that rejects the coherent false bundles below
    // must accept the untouched official-shape v3 bundle.
    expect(() => validateGridActivationReadinessBundle(bundle.contents)).not.toThrow();
  });

  it("rejects a fully coherent false bundle (final integrity corruption, H05 fail, not_ready)", () => {
    const corrupted = corruptReportFinalStateCoherently(bundle, (state) => {
      state.fighterA.integrity += 1;
    });
    expect(() => validateGridActivationReadinessBundle(corrupted)).toThrow(
      /report\/final-state agreement failed/,
    );
  });

  it("rejects a fully coherent false bundle (final zone corruption, H05 fail, not_ready)", () => {
    const corrupted = corruptReportFinalStateCoherently(bundle, (state) => {
      state.fighterB.zone = state.fighterB.zone === "center" ? "north" : "center";
    });
    expect(() => validateGridActivationReadinessBundle(corrupted)).toThrow(
      /report\/final-state agreement failed/,
    );
  });

  it("rejects a fully coherent false bundle (final facing corruption, H05 fail, not_ready)", () => {
    const corrupted = corruptReportFinalStateCoherently(bundle, (state) => {
      state.fighterA.facing = state.fighterA.facing === "north" ? "south" : "north";
    });
    expect(() => validateGridActivationReadinessBundle(corrupted)).toThrow(
      /report\/final-state agreement failed/,
    );
  });

  it("rejects a fully coherent false bundle (final conditions corruption, H05 fail, not_ready)", () => {
    const corrupted = corruptReportFinalStateCoherently(bundle, (state) => {
      state.fighterA.conditions = ["overturned"];
    });
    expect(() => validateGridActivationReadinessBundle(corrupted)).toThrow(
      /report\/final-state agreement failed/,
    );
  });

  it("rejects a fully coherent false bundle (disabled-component corruption, H05 fail, not_ready)", () => {
    const corrupted = corruptReportFinalStateCoherently(bundle, (state) => {
      state.fighterB.weaponDisabled = !state.fighterB.weaponDisabled;
    });
    expect(() => validateGridActivationReadinessBundle(corrupted)).toThrow(
      /report\/final-state agreement failed/,
    );
  });

  it("rejects a fully coherent false bundle (damaged-component projection corruption, H05 fail, not_ready)", () => {
    const corrupted = corruptReportFinalStateCoherently(bundle, (state) => {
      state.fighterA.weaponDamaged = !state.fighterA.weaponDamaged;
    });
    expect(() => validateGridActivationReadinessBundle(corrupted)).toThrow(
      /report\/final-state agreement failed/,
    );
  });

  // ── Phase 3E1.2: canonical registry anchoring through the bundle ─────────

  it("rejects a persisted seed registry with one changed reserved-range seed even when coherently redigested", () => {
    const corrupted = { ...bundle.contents };
    const seedRegistry = JSON.parse(
      corrupted[GRID_READINESS_SEED_REGISTRY_ARTIFACT]!,
    ) as { seeds: number[] };
    seedRegistry.seeds = [...seedRegistry.seeds.slice(1), 1703001841];
    corrupted[GRID_READINESS_SEED_REGISTRY_ARTIFACT] = JSON.stringify(
      seedRegistry,
      null,
      2,
    );
    const manifest = JSON.parse(corrupted[GRID_READINESS_MANIFEST_FILE]!) as {
      digests: Record<string, string>;
    };
    manifest.digests[GRID_READINESS_SEED_REGISTRY_ARTIFACT] = sha256Hex(
      corrupted[GRID_READINESS_SEED_REGISTRY_ARTIFACT]!,
    );
    corrupted[GRID_READINESS_MANIFEST_FILE] = JSON.stringify(manifest, null, 2);
    expect(() => validateGridActivationReadinessBundle(corrupted)).toThrow(
      /not the canonical registry|suite checksum does not match/,
    );
  });

  it("rejects a persisted scenario registry with one changed build even when coherently redigested", () => {
    const corrupted = { ...bundle.contents };
    const scenario = JSON.parse(
      corrupted[GRID_READINESS_SCENARIO_REGISTRY_ARTIFACT]!,
    ) as {
      scenarios: Array<{
        fighterX: { buildProposal: { armour: Record<string, number> } };
      }>;
    };
    scenario.scenarios[0]!.fighterX.buildProposal.armour.front += 1;
    corrupted[GRID_READINESS_SCENARIO_REGISTRY_ARTIFACT] = JSON.stringify(
      scenario,
      null,
      2,
    );
    const manifest = JSON.parse(corrupted[GRID_READINESS_MANIFEST_FILE]!) as {
      digests: Record<string, string>;
    };
    manifest.digests[GRID_READINESS_SCENARIO_REGISTRY_ARTIFACT] = sha256Hex(
      corrupted[GRID_READINESS_SCENARIO_REGISTRY_ARTIFACT]!,
    );
    corrupted[GRID_READINESS_MANIFEST_FILE] = JSON.stringify(manifest, null, 2);
    expect(() => validateGridActivationReadinessBundle(corrupted)).toThrow(
      /not the canonical registry|suite checksum does not match/,
    );
  });

  // ── Phase 3E1.2: timing validation ───────────────────────────────────────

  it("accepts timing where mean is below the median (no invalid median<=mean<=p95 assumption)", () => {
    const corrupted = applyTimingToBundle(bundle, {
      totalElapsedMs: 1000,
      meanMsPerMatch: 3.2,
      medianMsPerMatch: 5,
      p95MsPerMatch: 6,
    });
    expect(() => validateGridActivationReadinessBundle(corrupted)).not.toThrow();
  });

  it("rejects timing where mean does not approximate totalElapsedMs / 312", () => {
    const corrupted = redigestArtifact(
      bundle,
      GRID_READINESS_METRICS_ARTIFACT,
      (parsed) => {
        const timing = (parsed as { timing: Record<string, number> }).timing;
        timing.totalElapsedMs = 1000;
        timing.meanMsPerMatch = 100;
        timing.medianMsPerMatch = 2;
        timing.p95MsPerMatch = 3;
      },
    );
    expect(() => validateGridActivationReadinessBundle(corrupted)).toThrow(
      /does not approximate totalElapsedMs/,
    );
  });

  it("rejects timing where p95 is below the median", () => {
    const corrupted = redigestArtifact(
      bundle,
      GRID_READINESS_METRICS_ARTIFACT,
      (parsed) => {
        const timing = (parsed as { timing: Record<string, number> }).timing;
        timing.totalElapsedMs = 1000;
        timing.meanMsPerMatch = 3.2;
        timing.medianMsPerMatch = 3.5;
        timing.p95MsPerMatch = 3.1;
      },
    );
    expect(() => validateGridActivationReadinessBundle(corrupted)).toThrow(
      /p95MsPerMatch must be at least medianMsPerMatch/,
    );
  });

  it("rejects non-finite or negative timing values", () => {
    const negative = redigestArtifact(
      bundle,
      GRID_READINESS_METRICS_ARTIFACT,
      (parsed) => {
        const timing = (parsed as { timing: Record<string, number> }).timing;
        timing.totalElapsedMs = -1;
      },
    );
    expect(() => validateGridActivationReadinessBundle(negative)).toThrow(
      /invalid metrics|finite and non-negative/,
    );

    const nonFinite = redigestArtifact(
      bundle,
      GRID_READINESS_METRICS_ARTIFACT,
      (parsed) => {
        const timing = (parsed as { timing: Record<string, number> }).timing;
        timing.p95MsPerMatch = Number.POSITIVE_INFINITY;
      },
    );
    expect(() => validateGridActivationReadinessBundle(nonFinite)).toThrow(
      /invalid metrics|finite and non-negative/,
    );
  });

  it("never lets a timing-only change alter a gate outcome or the decision", () => {
    // Timing is informational and decision-excluded: the persisted report.txt
    // embeds timing, so a raw timing-only redigest is rejected by report
    // byte-regeneration (the report must also be regenerated). The decision
    // itself is never affected by timing because the gate evaluator only
    // consumes non-timing metrics.
    const metricsA = JSON.parse(bundle.contents[GRID_READINESS_METRICS_ARTIFACT]!);
    const timing = (metricsA as { timing: Record<string, number> }).timing;
    const before = {
      ...timing,
      totalElapsedMs: 1000,
      meanMsPerMatch: 3.2,
      medianMsPerMatch: 5,
      p95MsPerMatch: 6,
    };
    const after = { ...before, totalElapsedMs: 2000, meanMsPerMatch: 6.4 };
    // A timing-only change cannot alter the gates or decision classification.
    const resultBefore = evaluateReadinessGatesForMetrics(bundle, before);
    const resultAfter = evaluateReadinessGatesForMetrics(bundle, after);
    expect(resultBefore.outcomes).toEqual(resultAfter.outcomes);
    expect(resultBefore.decision).toBe(resultAfter.decision);
  });

  // ── Phase 3E1.1: historical v1 bundle preservation and versioning ────────

  it("parses the historical v1 bundle but rejects it as current readiness evidence", () => {
    const v1Dir = join(
      process.cwd(),
      "data",
      "readiness",
      "grid",
      "864991f7-d060-4669-beec-11e0d42b7e68",
    );
    // The historical bundle is gitignored and may be absent on a clean
    // checkout; the preservation check then degrades gracefully.
    if (!existsSync(v1Dir)) return;
    const v1Contents: Record<string, string> = {};
    for (const name of GRID_READINESS_BUNDLE_ENTRIES) {
      v1Contents[name] = readFileSync(join(v1Dir, name), "utf-8");
    }
    // Every version-aware parser recognises the v1 contract.
    const runIndex = deserializeGridActivationReadinessRunIndex(
      v1Contents[GRID_READINESS_RUN_INDEX_ARTIFACT]!,
    );
    expect(runIndex.ok).toBe(true);
    if (runIndex.ok) expect(runIndex.schemaVersion).toBe("1");
    const metrics = deserializeGridActivationReadinessMetrics(
      v1Contents[GRID_READINESS_METRICS_ARTIFACT]!,
    );
    expect(metrics.ok).toBe(true);
    if (metrics.ok) expect(metrics.schemaVersion).toBe("1");
    const decision = deserializeGridActivationReadinessDecision(
      v1Contents[GRID_READINESS_DECISION_ARTIFACT]!,
    );
    expect(decision.ok).toBe(true);
    if (decision.ok) expect(decision.schemaVersion).toBe("1");
    const manifest = deserializeGridActivationReadinessManifest(
      v1Contents[GRID_READINESS_MANIFEST_FILE]!,
    );
    expect(manifest.ok).toBe(true);
    if (manifest.ok) {
      expect(manifest.schemaVersion).toBe("1");
      expect(manifest.manifest.suiteId).toBe("grid-activation-readiness-v1");
      expect(manifest.manifest.suiteChecksum).toBe(FROZEN_V1_SUITE_CHECKSUM);
    }
    // The v1 bundle is not current v3 evidence.
    expect(() => validateGridActivationReadinessBundle(v1Contents)).toThrow(
      /historical v1/,
    );
  });

  it("parses the historical v2 bundle but rejects it as current readiness evidence", () => {
    const v2Dir = join(
      process.cwd(),
      "data",
      "readiness",
      "grid",
      "d788284d-a795-4125-984c-9146261e271a",
    );
    // The historical bundle is gitignored and may be absent on a clean
    // checkout; the preservation check then degrades gracefully.
    if (!existsSync(v2Dir)) return;
    const v2Contents: Record<string, string> = {};
    for (const name of GRID_READINESS_BUNDLE_ENTRIES) {
      v2Contents[name] = readFileSync(join(v2Dir, name), "utf-8");
    }
    const runIndex = deserializeGridActivationReadinessRunIndex(
      v2Contents[GRID_READINESS_RUN_INDEX_ARTIFACT]!,
    );
    expect(runIndex.ok).toBe(true);
    if (runIndex.ok) expect(runIndex.schemaVersion).toBe("2");
    const metrics = deserializeGridActivationReadinessMetrics(
      v2Contents[GRID_READINESS_METRICS_ARTIFACT]!,
    );
    expect(metrics.ok).toBe(true);
    if (metrics.ok) expect(metrics.schemaVersion).toBe("2");
    const decision = deserializeGridActivationReadinessDecision(
      v2Contents[GRID_READINESS_DECISION_ARTIFACT]!,
    );
    expect(decision.ok).toBe(true);
    if (decision.ok) expect(decision.schemaVersion).toBe("2");
    const manifest = deserializeGridActivationReadinessManifest(
      v2Contents[GRID_READINESS_MANIFEST_FILE]!,
    );
    expect(manifest.ok).toBe(true);
    if (manifest.ok) {
      expect(manifest.schemaVersion).toBe("2");
      expect(manifest.manifest.suiteId).toBe("grid-activation-readiness-v2");
      expect(manifest.manifest.suiteChecksum).toBe(FROZEN_V2_SUITE_CHECKSUM);
    }
    // The v2 bundle is not current v3 evidence.
    expect(() => validateGridActivationReadinessBundle(v2Contents)).toThrow(
      /historical v2/,
    );
  });

  it("validates the official v3 bundle with the stronger validator (Phase 3E1.3, no rerun)", () => {
    const v3Dir = join(
      process.cwd(),
      "data",
      "readiness",
      "grid",
      "0d8487a8-939d-4f9a-a16a-544b71eaa869",
    );
    // The official bundle is gitignored and may be absent on a clean
    // checkout; the preservation check then degrades gracefully.
    if (!existsSync(v3Dir)) return;
    const v3Contents: Record<string, string> = {};
    for (const name of GRID_READINESS_BUNDLE_ENTRIES) {
      v3Contents[name] = readFileSync(join(v3Dir, name), "utf-8");
    }
    // The official v3 evaluation must still pass the stronger validator that
    // makes report disagreement fatal and rejects round-0 structure.
    expect(() => validateGridActivationReadinessBundle(v3Contents)).not.toThrow();
  });

  it("records the selected-action evidence model on every run-index entry (policy-triggered provenance)", () => {
    const runIndex = deserializeGridActivationReadinessRunIndex(
      bundle.contents[GRID_READINESS_RUN_INDEX_ARTIFACT]!,
    );
    expect(runIndex.ok).toBe(true);
    if (!runIndex.ok) return;
    for (const entry of runIndex.envelope.items) {
      expect(entry.selectedMovementActionCounts).toBeDefined();
      expect(entry.selectedCombatActionCounts).toBeDefined();
    }
  });
});
