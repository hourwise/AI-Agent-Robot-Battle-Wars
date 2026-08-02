import { beforeAll, describe, expect, it } from "vitest";
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
  GridActivationReadinessBundleError,
} from "../../src/readiness/readiness-bundle.js";
import {
  deserializeGridActivationReadinessRunIndex,
  deserializeGridActivationReadinessMatchRecords,
  deserializeGridActivationReadinessFactualReports,
} from "../../src/readiness/envelopes.schema.js";
import { sha256Hex } from "../../src/canary/grid-canary-digest.js";
import { assertValidBundleDeclaration } from "../../src/canary/immutable-canary-bundle.js";
import { GRID_ACTIVATION_READINESS_RUN_COUNT } from "../../src/readiness/run-plan.js";

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
        runIndex: runIndexParsed.envelope,
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
});
