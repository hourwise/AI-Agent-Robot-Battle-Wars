import { describe, expect, it } from "vitest";
import {
  buildGridGrappleSupplementFixture,
  grappleSupplementFixtureBaseIdentity,
} from "../helpers/grid-grapple-supplement-builder.js";
import {
  validateGridGrappleCoverageSupplementBundle,
  deserializeGridGrappleCoverageSupplementManifest,
  GRID_GRAPPLE_SUPPLEMENT_BUNDLE_ENTRIES,
  GRID_GRAPPLE_SUPPLEMENT_MANIFEST_FILE,
  GRID_GRAPPLE_SUPPLEMENT_BASE_REFERENCE_ARTIFACT,
  GRID_GRAPPLE_SUPPLEMENT_RUN_INDEX_ARTIFACT,
  GRID_GRAPPLE_SUPPLEMENT_MATCH_RECORDS_ARTIFACT,
  GRID_GRAPPLE_SUPPLEMENT_FACTUAL_REPORTS_ARTIFACT,
  GRID_GRAPPLE_SUPPLEMENT_METRICS_ARTIFACT,
  GRID_GRAPPLE_SUPPLEMENT_DECISION_ARTIFACT,
  GRID_GRAPPLE_SUPPLEMENT_REPORT_ARTIFACT,
  GridGrappleCoverageSupplementBundleError,
  type GridGrappleCoverageSupplementManifestV1,
} from "../../src/readiness/grid-grapple-supplement-bundle.js";
import { sha256Hex } from "../../src/canary/grid-canary-digest.js";

function buildFixture() {
  return buildGridGrappleSupplementFixture();
}

describe("grid grapple coverage supplement bundle (Phase 3E2 Phase 12)", () => {
  it("declares exactly the ten fixed artifact names", () => {
    expect(GRID_GRAPPLE_SUPPLEMENT_BUNDLE_ENTRIES).toEqual([
      "manifest.json",
      "base-readiness-reference.json",
      "seed-registry.json",
      "scenario-registry.json",
      "run-index.json",
      "match-records.json",
      "factual-reports.json",
      "metrics.json",
      "decision.json",
      "report.txt",
    ]);
    expect(GRID_GRAPPLE_SUPPLEMENT_BUNDLE_ENTRIES.length).toBe(10);
  });

  it("validates a fully consistent supplement bundle (complete read-back)", () => {
    const fixture = buildFixture();
    const identity = grappleSupplementFixtureBaseIdentity();
    const result = validateGridGrappleCoverageSupplementBundle(
      fixture.contents,
      identity,
    );
    expect(result.supplementId).toBe(fixture.supplementId);
    expect(result.decision).toBe("coverage_confirmed");
  });

  it("verifies every non-manifest digest and the decision/report checksums", () => {
    const fixture = buildFixture();
    const manifestParsed = deserializeGridGrappleCoverageSupplementManifest(
      fixture.contents[GRID_GRAPPLE_SUPPLEMENT_MANIFEST_FILE]!,
    );
    expect(manifestParsed.ok).toBe(true);
    if (!manifestParsed.ok) return;
    const manifest = manifestParsed.manifest;
    expect(Object.keys(manifest.digests).length).toBe(9);
    for (const name of GRID_GRAPPLE_SUPPLEMENT_BUNDLE_ENTRIES.filter(
      (n) => n !== GRID_GRAPPLE_SUPPLEMENT_MANIFEST_FILE,
    )) {
      expect(manifest.digests[name]).toBe(sha256Hex(fixture.contents[name]!));
    }
    expect(manifest.decisionChecksum).toBe(
      sha256Hex(fixture.contents[GRID_GRAPPLE_SUPPLEMENT_DECISION_ARTIFACT]!),
    );
    expect(manifest.reportChecksum).toBe(
      sha256Hex(fixture.contents[GRID_GRAPPLE_SUPPLEMENT_REPORT_ARTIFACT]!),
    );
  });

  it("binds the base reference to the frozen official base identity", () => {
    const fixture = buildFixture();
    expect(fixture.manifest.addendum.baseV3.evaluationId).toBe(
      fixture.baseReference.evaluationId,
    );
    expect(fixture.manifest.addendum.baseV3.suiteChecksum).toBe(
      fixture.baseReference.suiteChecksum,
    );
    expect(fixture.manifest.addendum.baseV3.nonPassGates).toEqual(["C04"]);
    expect(fixture.manifest.combinedReadinessClassification).toBe(
      "ready_for_opt_in_beta_review",
    );
  });

  it("rejects a digest mismatch", () => {
    const fixture = buildFixture();
    const identity = grappleSupplementFixtureBaseIdentity();
    const corrupted = { ...fixture.contents };
    const manifest = JSON.parse(corrupted[GRID_GRAPPLE_SUPPLEMENT_MANIFEST_FILE]!) as {
      digests: Record<string, string>;
    };
    manifest.digests[GRID_GRAPPLE_SUPPLEMENT_METRICS_ARTIFACT] = "0".repeat(64);
    corrupted[GRID_GRAPPLE_SUPPLEMENT_MANIFEST_FILE] = JSON.stringify(manifest, null, 2);
    expect(() =>
      validateGridGrappleCoverageSupplementBundle(corrupted, identity),
    ).toThrow(/digest mismatch/);
  });

  it("rejects a missing artifact", () => {
    const fixture = buildFixture();
    const identity = grappleSupplementFixtureBaseIdentity();
    const corrupted = { ...fixture.contents };
    delete corrupted[GRID_GRAPPLE_SUPPLEMENT_FACTUAL_REPORTS_ARTIFACT];
    expect(() =>
      validateGridGrappleCoverageSupplementBundle(corrupted, identity),
    ).toThrow(GridGrappleCoverageSupplementBundleError);
  });

  it("rejects a changed record even when its digest is coherently redigested", () => {
    const fixture = buildFixture();
    const identity = grappleSupplementFixtureBaseIdentity();
    const corrupted = { ...fixture.contents };
    const records = JSON.parse(
      corrupted[GRID_GRAPPLE_SUPPLEMENT_MATCH_RECORDS_ARTIFACT]!,
    ) as {
      items: Array<{ initialState: { fighterA: { integrity: number } } }>;
    };
    records.items[0]!.initialState.fighterA.integrity += 1;
    corrupted[GRID_GRAPPLE_SUPPLEMENT_MATCH_RECORDS_ARTIFACT] = JSON.stringify(
      records,
      null,
      2,
    );
    const manifest = JSON.parse(corrupted[GRID_GRAPPLE_SUPPLEMENT_MANIFEST_FILE]!) as {
      digests: Record<string, string>;
    };
    manifest.digests[GRID_GRAPPLE_SUPPLEMENT_MATCH_RECORDS_ARTIFACT] = sha256Hex(
      corrupted[GRID_GRAPPLE_SUPPLEMENT_MATCH_RECORDS_ARTIFACT]!,
    );
    corrupted[GRID_GRAPPLE_SUPPLEMENT_MANIFEST_FILE] = JSON.stringify(manifest, null, 2);
    // The record/report binding and run-index agreement now disagree.
    expect(() =>
      validateGridGrappleCoverageSupplementBundle(corrupted, identity),
    ).toThrow(GridGrappleCoverageSupplementBundleError);
  });

  it("rejects a run-index checksum change even after redigesting", () => {
    const fixture = buildFixture();
    const identity = grappleSupplementFixtureBaseIdentity();
    const corrupted = { ...fixture.contents };
    const runIndex = JSON.parse(
      corrupted[GRID_GRAPPLE_SUPPLEMENT_RUN_INDEX_ARTIFACT]!,
    ) as {
      items: Array<{ recordChecksum: string }>;
    };
    runIndex.items[0]!.recordChecksum = "0".repeat(64);
    corrupted[GRID_GRAPPLE_SUPPLEMENT_RUN_INDEX_ARTIFACT] = JSON.stringify(
      runIndex,
      null,
      2,
    );
    const manifest = JSON.parse(corrupted[GRID_GRAPPLE_SUPPLEMENT_MANIFEST_FILE]!) as {
      digests: Record<string, string>;
    };
    manifest.digests[GRID_GRAPPLE_SUPPLEMENT_RUN_INDEX_ARTIFACT] = sha256Hex(
      corrupted[GRID_GRAPPLE_SUPPLEMENT_RUN_INDEX_ARTIFACT]!,
    );
    corrupted[GRID_GRAPPLE_SUPPLEMENT_MANIFEST_FILE] = JSON.stringify(manifest, null, 2);
    expect(() =>
      validateGridGrappleCoverageSupplementBundle(corrupted, identity),
    ).toThrow(/checksums do not match/);
  });

  it("rejects a changed base-reference artifact even after redigesting", () => {
    const fixture = buildFixture();
    const identity = grappleSupplementFixtureBaseIdentity();
    const corrupted = { ...fixture.contents };
    const baseRef = JSON.parse(
      corrupted[GRID_GRAPPLE_SUPPLEMENT_BASE_REFERENCE_ARTIFACT]!,
    ) as { baseV3: { knockbackEvents: number } };
    baseRef.baseV3.knockbackEvents = 999;
    corrupted[GRID_GRAPPLE_SUPPLEMENT_BASE_REFERENCE_ARTIFACT] = JSON.stringify(
      baseRef,
      null,
      2,
    );
    const manifest = JSON.parse(corrupted[GRID_GRAPPLE_SUPPLEMENT_MANIFEST_FILE]!) as {
      digests: Record<string, string>;
    };
    manifest.digests[GRID_GRAPPLE_SUPPLEMENT_BASE_REFERENCE_ARTIFACT] = sha256Hex(
      corrupted[GRID_GRAPPLE_SUPPLEMENT_BASE_REFERENCE_ARTIFACT]!,
    );
    corrupted[GRID_GRAPPLE_SUPPLEMENT_MANIFEST_FILE] = JSON.stringify(manifest, null, 2);
    expect(() =>
      validateGridGrappleCoverageSupplementBundle(corrupted, identity),
    ).toThrow(/base reference does not match the frozen official v3 evaluation/);
  });

  it("rejects a report.txt change even after redigesting", () => {
    const fixture = buildFixture();
    const identity = grappleSupplementFixtureBaseIdentity();
    const corrupted = { ...fixture.contents };
    corrupted[GRID_GRAPPLE_SUPPLEMENT_REPORT_ARTIFACT] =
      `${corrupted[GRID_GRAPPLE_SUPPLEMENT_REPORT_ARTIFACT]}\ntampered`;
    const manifest = JSON.parse(corrupted[GRID_GRAPPLE_SUPPLEMENT_MANIFEST_FILE]!) as {
      digests: Record<string, string>;
      reportChecksum: string;
    };
    manifest.digests[GRID_GRAPPLE_SUPPLEMENT_REPORT_ARTIFACT] = sha256Hex(
      corrupted[GRID_GRAPPLE_SUPPLEMENT_REPORT_ARTIFACT]!,
    );
    manifest.reportChecksum = manifest.digests[GRID_GRAPPLE_SUPPLEMENT_REPORT_ARTIFACT];
    corrupted[GRID_GRAPPLE_SUPPLEMENT_MANIFEST_FILE] = JSON.stringify(manifest, null, 2);
    expect(() =>
      validateGridGrappleCoverageSupplementBundle(corrupted, identity),
    ).toThrow(/report.txt does not byte-for-byte match/);
  });

  it("rejects a manifest whose combined classification disagrees with recomputation", () => {
    const fixture = buildFixture();
    const identity = grappleSupplementFixtureBaseIdentity();
    const corrupted = { ...fixture.contents };
    const manifest = JSON.parse(corrupted[GRID_GRAPPLE_SUPPLEMENT_MANIFEST_FILE]!) as {
      combinedReadinessClassification: string;
    };
    manifest.combinedReadinessClassification = "not_ready";
    corrupted[GRID_GRAPPLE_SUPPLEMENT_MANIFEST_FILE] = JSON.stringify(manifest, null, 2);
    expect(() =>
      validateGridGrappleCoverageSupplementBundle(corrupted, identity),
    ).toThrow(/combined readiness classification/);
  });

  it("serializes a manifest that round-trips through its schema", () => {
    const fixture = buildFixture();
    const parsed = deserializeGridGrappleCoverageSupplementManifest(
      fixture.contents[GRID_GRAPPLE_SUPPLEMENT_MANIFEST_FILE]!,
    );
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const manifest: GridGrappleCoverageSupplementManifestV1 = parsed.manifest;
    expect(manifest.schemaVersion).toBe("1");
    expect(manifest.evaluationKind).toBe("grid-grapple-coverage-supplement");
    expect(manifest.runCount).toBe(48);
    expect(manifest.seedCount).toBe(24);
    expect(manifest.scenarioCount).toBe(1);
    expect(manifest.assignmentCount).toBe(2);
    expect(manifest.evidence.baseV3Unmodified).toBe(true);
  });
});
