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
  GRID_READINESS_MATCH_RECORDS_ARTIFACT,
  GRID_READINESS_FACTUAL_REPORTS_ARTIFACT,
  GRID_READINESS_METRICS_ARTIFACT,
  GRID_READINESS_DECISION_ARTIFACT,
  GRID_READINESS_REPORT_ARTIFACT,
  GridActivationReadinessBundleError,
} from "../../src/readiness/readiness-bundle.js";
import {
  deserializeGridActivationReadinessRunIndex,
  deserializeGridActivationReadinessMatchRecords,
  deserializeGridActivationReadinessFactualReports,
  type GridActivationReadinessRunIndexEnvelopeV2,
} from "../../src/readiness/envelopes.schema.js";
import { deserializeGridActivationReadinessMetrics } from "../../src/readiness/metrics.js";
import { deserializeGridActivationReadinessDecision } from "../../src/readiness/decision.js";
import { sha256Hex } from "../../src/canary/grid-canary-digest.js";
import { assertValidBundleDeclaration } from "../../src/canary/immutable-canary-bundle.js";
import { GRID_ACTIVATION_READINESS_RUN_COUNT } from "../../src/readiness/run-plan.js";

const FROZEN_V1_SUITE_CHECKSUM =
  "dd38ac8a5d2e35007b4b6890418b21aca8f621f3e165fa7d158d2f179672ae5a";

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
    expect(runIndexParsed.schemaVersion).toBe("2");

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
        runIndex: runIndexParsed.envelope as GridActivationReadinessRunIndexEnvelopeV2,
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
    const corrupted = redigestArtifact(bundle, GRID_READINESS_RUN_INDEX_ARTIFACT, (parsed) => {
      (parsed as { items: Array<{ selectedMovementActionCounts: Record<string, number> }> })
        .items[0]!.selectedMovementActionCounts.hold += 1;
    });
    expect(() => validateGridActivationReadinessBundle(corrupted)).toThrow(
      /evidence|run-index|recomputed/i,
    );
  });

  it("rejects a run-index selected-combat count change even after redigesting", () => {
    const corrupted = redigestArtifact(bundle, GRID_READINESS_RUN_INDEX_ARTIFACT, (parsed) => {
      (parsed as { items: Array<{ selectedCombatActionCounts: Record<string, number> }> })
        .items[0]!.selectedCombatActionCounts.attack += 1;
    });
    expect(() => validateGridActivationReadinessBundle(corrupted)).toThrow(
      /evidence|run-index|recomputed/i,
    );
  });

  it("rejects a run-index translated-action change even after redigesting", () => {
    const corrupted = redigestArtifact(bundle, GRID_READINESS_RUN_INDEX_ARTIFACT, (parsed) => {
      (parsed as { items: Array<{ translatedActionCounts: Record<string, number> }> })
        .items[0]!.translatedActionCounts.advance += 1;
    });
    expect(() => validateGridActivationReadinessBundle(corrupted)).toThrow(
      /evidence|run-index|recomputed/i,
    );
  });

  it("rejects a run-index zone-visit change even after redigesting", () => {
    const corrupted = redigestArtifact(bundle, GRID_READINESS_RUN_INDEX_ARTIFACT, (parsed) => {
      (parsed as { items: Array<{ zoneVisits: Record<string, number> }> }).items[0]!
        .zoneVisits.center += 1;
    });
    expect(() => validateGridActivationReadinessBundle(corrupted)).toThrow(
      /evidence|run-index|recomputed/i,
    );
  });

  it("rejects a run-index event-type-count change even after redigesting", () => {
    const corrupted = redigestArtifact(bundle, GRID_READINESS_RUN_INDEX_ARTIFACT, (parsed) => {
      const first = (parsed as { items: Array<{ eventTypeCounts: Record<string, number> }> })
        .items[0]!;
      const key = Object.keys(first.eventTypeCounts)[0]!;
      first.eventTypeCounts[key] += 1;
    });
    expect(() => validateGridActivationReadinessBundle(corrupted)).toThrow(
      /evidence|run-index|recomputed/i,
    );
  });

  it("rejects a run-index no-progress-streak change even after redigesting", () => {
    const corrupted = redigestArtifact(bundle, GRID_READINESS_RUN_INDEX_ARTIFACT, (parsed) => {
      (parsed as { items: Array<{ maximumConsecutiveNoProgressRounds: number }> }).items[0]!
        .maximumConsecutiveNoProgressRounds += 1;
    });
    expect(() => validateGridActivationReadinessBundle(corrupted)).toThrow(
      /evidence|run-index|recomputed/i,
    );
  });

  it("rejects a run-index checksum change even after redigesting", () => {
    const corrupted = redigestArtifact(bundle, GRID_READINESS_RUN_INDEX_ARTIFACT, (parsed) => {
      (parsed as { items: Array<{ recordChecksum: string }> }).items[0]!.recordChecksum =
        "0".repeat(64);
    });
    expect(() => validateGridActivationReadinessBundle(corrupted)).toThrow(
      /checksum|recomputed|evidence/i,
    );
  });

  // ── Phase 3E1.1: coherent derived-artifact corruption ────────────────────

  it("rejects a coherently redigested metrics change that disagrees with recomputation", () => {
    const corrupted = redigestArtifact(bundle, GRID_READINESS_METRICS_ARTIFACT, (parsed) => {
      const metrics = parsed as {
        movement: { actionCounts: Record<string, number> };
      };
      metrics.movement.actionCounts.advance += 1;
    });
    expect(() => validateGridActivationReadinessBundle(corrupted)).toThrow(
      /persisted metrics do not match/i,
    );
  });

  it("rejects a coherently redigested decision classification change", () => {
    const corrupted = redigestArtifact(bundle, GRID_READINESS_DECISION_ARTIFACT, (parsed) => {
      const decision = parsed as { decision: string };
      decision.decision =
        decision.decision === "inconclusive" ? "not_ready" : "inconclusive";
    });
    expect(() => validateGridActivationReadinessBundle(corrupted)).toThrow(
      /classification does not match/i,
    );
  });

  it("rejects a coherently redigested decision gate outcome change", () => {
    const corrupted = redigestArtifact(bundle, GRID_READINESS_DECISION_ARTIFACT, (parsed) => {
      const decision = parsed as {
        gates: Array<{ gateId: string; outcome: string }>;
      };
      const gate = decision.gates.find((g) => g.outcome === "pass");
      if (gate) gate.outcome = "fail";
    });
    expect(() => validateGridActivationReadinessBundle(corrupted)).toThrow(
      /gates do not match|fail-summary|inconclusive-summary/i,
    );
  });

  it("rejects a coherently redigested report.txt change", () => {
    const corrupted = { ...bundle.contents };
    corrupted[GRID_READINESS_REPORT_ARTIFACT] = `${bundle.contents[GRID_READINESS_REPORT_ARTIFACT]}\ntampered`;
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
    // The v1 bundle is not current v2 evidence.
    expect(() => validateGridActivationReadinessBundle(v1Contents)).toThrow(
      /historical v1/,
    );
  });

  it("records the v2 evidence model on every run-index entry (policy-triggered provenance)", () => {
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
