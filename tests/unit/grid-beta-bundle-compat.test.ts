import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { sha256Hex } from "../../src/canary/grid-canary-digest.js";
import {
  buildGridBetaMatchManifest,
  buildGridBetaMatchManifestV2,
  buildGridBetaSelection,
  buildGridBetaSelectionV2,
  deserializeGridBetaMatchManifest,
  deserializeGridBetaMatchManifestV2,
  deserializeGridBetaSelection,
  deserializeGridBetaSelectionV2,
  GRID_BETA_MATCH_MANIFEST_FILE,
  GRID_BETA_MATCH_SELECTION_ARTIFACT,
  serializeGridBetaMatchManifest,
  serializeGridBetaMatchManifestV2,
  serializeGridBetaSelection,
  serializeGridBetaSelectionV2,
  validateGridBetaMatchBundle,
} from "../../src/beta/grid-beta-match-bundle.js";
import type { GridBetaLegacyIsolationPreflightV1 } from "../../src/beta/grid-beta-legacy-preflight.js";
import type { GridBetaLegacyIsolationPreflightV2 } from "../../src/beta/grid-beta-legacy-preflight-v2.js";
import {
  GRID_BETA_LEGACY_ISOLATION_REVIEWED_SOURCE_V2_BASELINE_ID,
  GRID_BETA_LEGACY_ISOLATION_REVIEWED_SOURCE_V2_CHECKSUM,
  GRID_BETA_LEGACY_ISOLATION_REVIEWED_SOURCE_V2_COMMIT,
} from "../../src/beta/grid-beta-legacy-isolation-reviewed-source-v2.js";
import {
  BETA_TEST_MATCH_ID,
  betaTempMappedPath,
  createBetaTempEnvironment,
  officialGovernanceBundleAvailable,
  readBetaBundle,
  runBetaMatchToTemp,
} from "../helpers/grid-beta-builder.js";

/**
 * Milestone 0.2D Phase 3C (Commit G) — V1/V2 bundle compatibility.
 *
 * Historical V1 builders remain exported and functional; a complete V1 bundle
 * (Selection V1 + Manifest V1) still validates, a V2 bundle validates, and
 * mixed V1/V2 pairs are rejected by the version dispatcher. No successor v2
 * field is ever fabricated onto a V1 artifact.
 */

/** Canonical V1 preflight pass (historical fields only, no successor fields). */
const canonicalV1Preflight: GridBetaLegacyIsolationPreflightV1 = {
  status: "pass",
  trigger: null,
  failures: [],
  protectedFilesEqualReviewedSnapshot: true,
  normalMatchCallsLegacyRunMatch: true,
  normalSeriesCallsLegacyRunMatch: true,
  neitherNormalPathInvokesGridOrBeta: true,
  globalVersions020020: true,
  catalogueStill1: true,
  qualificationFrozen: true,
  gridIdentitySeparate: true,
  bothCanarySourcesFrozen: true,
  schemaV2LegacyConversionPresent: true,
  schemaV3GridConversionAndReplayPresent: true,
};

/** Canonical V2 preflight pass carrying the frozen successor baseline. */
const canonicalV2Preflight: GridBetaLegacyIsolationPreflightV2 = {
  schemaVersion: "2",
  sourceBaselineId: GRID_BETA_LEGACY_ISOLATION_REVIEWED_SOURCE_V2_BASELINE_ID,
  sourceBaselineCommit: GRID_BETA_LEGACY_ISOLATION_REVIEWED_SOURCE_V2_COMMIT,
  sourceBaselineChecksum: GRID_BETA_LEGACY_ISOLATION_REVIEWED_SOURCE_V2_CHECKSUM,
  sourceBaselineCommitAnchored: true,
  protectedFilesEqualSuccessorSnapshot: true,
  canonicalBulwarkFixtureAnchorValid: true,
  normalMatchCallsLegacyRunMatch: true,
  normalSeriesCallsLegacyRunMatch: true,
  normalMatchUsesCanonicalBulwark: true,
  normalSeriesUsesCanonicalBulwark: true,
  neitherNormalPathInvokesGridOrBeta: true,
  packageRoutingPreservesLegacyDefault: true,
  globalVersions020020: true,
  catalogueStill1: true,
  qualificationFrozen: true,
  gridIdentitySeparate: true,
  bothCanarySourcesFrozen: true,
  schemaV2LegacyConversionPresent: true,
  schemaV3GridConversionAndReplayPresent: true,
  status: "pass",
  trigger: null,
  failures: [],
};

let env: Awaited<ReturnType<typeof createBetaTempEnvironment>> | null = null;
let v2Baseline: Record<string, string> | null = null;

beforeAll(async () => {
  if (!officialGovernanceBundleAvailable()) return;
  env = await createBetaTempEnvironment();
  const result = await runBetaMatchToTemp(env);
  v2Baseline = await readBetaBundle(betaTempMappedPath(env, result.artifactDirectory));
}, 120_000);

afterAll(async () => {
  if (env) await env.cleanup();
});

describe("grid beta V1/V2 bundle compatibility (0.2D Phase 3C)", () => {
  it("retains the historical V1 selection builder: schema v1, no successor fields", () => {
    const selection = buildGridBetaSelection({
      seed: 1,
      fighterA: { fighterId: "alpha", checksum: "a".repeat(64) },
      fighterB: { fighterId: "beta", checksum: "b".repeat(64) },
      protectedSourcePreflight: canonicalV1Preflight,
    });
    expect(selection.schemaVersion).toBe("1");
    expect((selection as { sourceAuthority?: unknown }).sourceAuthority).toBeUndefined();
    const json = serializeGridBetaSelection(selection);
    const parsed = deserializeGridBetaSelection(json);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.selection.schemaVersion).toBe("1");
      expect(parsed.selection.seed).toBe(1);
    }
    // Fabricating a successor v2 field onto a V1 selection is rejected by the
    // strict V1 schema (no silent upgrade).
    const withSuccessorField = JSON.parse(json) as Record<string, unknown>;
    withSuccessorField.sourceAuthority = { currentSource: { baselineId: "x" } };
    expect(deserializeGridBetaSelection(JSON.stringify(withSuccessorField)).ok).toBe(
      false,
    );
  });

  it("retains the historical V1 manifest builder: schema v1, single reviewed source", () => {
    const manifest = buildGridBetaMatchManifest({
      matchId: BETA_TEST_MATCH_ID,
      createdAt: "2026-08-07T00:00:00.000Z",
      result: { winner: "alpha", method: "grid", rounds: 3 },
      fighterChecksums: { fighterA: "a".repeat(64), fighterB: "b".repeat(64) },
      protectedSourcePreflightStatus: "pass",
      suspensionStatus: "clear",
      digests: { "fighter-a.json": "a".repeat(64) },
    });
    expect(manifest.schemaVersion).toBe("1");
    expect(manifest.reviewedSourceCommit).toMatch(/^[0-9a-f]{40}$/);
    expect((manifest as { sourceAuthority?: unknown }).sourceAuthority).toBeUndefined();
    const json = serializeGridBetaMatchManifest(manifest);
    const parsed = deserializeGridBetaMatchManifest(json);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.manifest.schemaVersion).toBe("1");
  });

  it("builds V2 selection and manifest with the exact dual source-authority identity", () => {
    const selection = buildGridBetaSelectionV2({
      seed: 1,
      fighterA: { fighterId: "alpha", checksum: "a".repeat(64) },
      fighterB: { fighterId: "beta", checksum: "b".repeat(64) },
      protectedSourcePreflight: canonicalV2Preflight,
    });
    expect(selection.schemaVersion).toBe("2");
    expect(selection.sourceAuthority.originalGovernance.governanceDecisionId).toBe(
      "58e8cd87-504e-4b5f-9bac-f6b81d82377b",
    );
    expect(selection.sourceAuthority.currentSource.baselineId).toBe(
      GRID_BETA_LEGACY_ISOLATION_REVIEWED_SOURCE_V2_BASELINE_ID,
    );
    expect(selection.sourceAuthority.currentSource.sourceCommit).toBe(
      GRID_BETA_LEGACY_ISOLATION_REVIEWED_SOURCE_V2_COMMIT,
    );
    const selJson = serializeGridBetaSelectionV2(selection);
    const selParsed = deserializeGridBetaSelectionV2(selJson);
    expect(selParsed.ok).toBe(true);
    if (selParsed.ok) expect(selParsed.selection.schemaVersion).toBe("2");

    const manifest = buildGridBetaMatchManifestV2({
      matchId: BETA_TEST_MATCH_ID,
      createdAt: "2026-08-07T00:00:00.000Z",
      result: { winner: "alpha", method: "grid", rounds: 3 },
      fighterChecksums: { fighterA: "a".repeat(64), fighterB: "b".repeat(64) },
      protectedSourcePreflightStatus: "pass",
      suspensionStatus: "clear",
      digests: { "fighter-a.json": "a".repeat(64) },
    });
    expect(manifest.schemaVersion).toBe("2");
    expect(manifest.sourceAuthority).toEqual(selection.sourceAuthority);
    const manJson = serializeGridBetaMatchManifestV2(manifest);
    const manParsed = deserializeGridBetaMatchManifestV2(manJson);
    expect(manParsed.ok).toBe(true);
    if (manParsed.ok) expect(manParsed.manifest.schemaVersion).toBe("2");
  });

  it("accepts a complete V1 bundle (downgraded selection+manifest, shared payload)", () => {
    if (!v2Baseline) return;
    const v2Selection = JSON.parse(v2Baseline[GRID_BETA_MATCH_SELECTION_ARTIFACT]!) as {
      seed: number;
      fighterA: { fighterId: string; checksum: string };
      fighterB: { fighterId: string; checksum: string };
    };
    const v2Manifest = JSON.parse(v2Baseline[GRID_BETA_MATCH_MANIFEST_FILE]!) as {
      matchId: string;
      createdAt: string;
      result: { winner: string | null; method: string; rounds: number };
      fighterChecksums: { fighterA: string; fighterB: string };
      safety: {
        protectedSourcePreflightStatus: "pass" | "fail";
        suspensionStatus: "active" | "clear";
      };
      digests: Record<string, string>;
    };
    const v1Selection = buildGridBetaSelection({
      seed: v2Selection.seed,
      fighterA: v2Selection.fighterA,
      fighterB: v2Selection.fighterB,
      protectedSourcePreflight: canonicalV1Preflight,
    });
    const v1SelectionJson = serializeGridBetaSelection(v1Selection);
    // The V1 manifest digest for selection.json must cover the V1 selection
    // bytes (selection is a non-manifest artifact).
    const v1Digests = {
      ...v2Manifest.digests,
      [GRID_BETA_MATCH_SELECTION_ARTIFACT]: sha256Hex(v1SelectionJson),
    };
    const v1Manifest = buildGridBetaMatchManifest({
      matchId: v2Manifest.matchId,
      createdAt: v2Manifest.createdAt,
      result: v2Manifest.result,
      fighterChecksums: v2Manifest.fighterChecksums,
      protectedSourcePreflightStatus: v2Manifest.safety.protectedSourcePreflightStatus,
      suspensionStatus: v2Manifest.safety.suspensionStatus,
      digests: v1Digests,
    });
    const v1Bundle: Record<string, string> = {
      ...v2Baseline,
      [GRID_BETA_MATCH_SELECTION_ARTIFACT]: v1SelectionJson,
      [GRID_BETA_MATCH_MANIFEST_FILE]: serializeGridBetaMatchManifest(v1Manifest),
    };
    const result = validateGridBetaMatchBundle(v1Bundle);
    expect(result.matchId).toBe(BETA_TEST_MATCH_ID);
    expect(result.validationStatus).toBe("validated");
    // The V1 bundle artifacts never carry successor v2 fields.
    expect(JSON.parse(v1Bundle[GRID_BETA_MATCH_SELECTION_ARTIFACT]!)).not.toHaveProperty(
      "sourceAuthority",
    );
    expect(JSON.parse(v1Bundle[GRID_BETA_MATCH_MANIFEST_FILE]!)).not.toHaveProperty(
      "sourceAuthority",
    );
  });

  it("accepts the complete V2 bundle produced by the service", () => {
    if (!v2Baseline) return;
    const result = validateGridBetaMatchBundle(v2Baseline);
    expect(result.matchId).toBe(BETA_TEST_MATCH_ID);
    expect(result.validationStatus).toBe("validated");
  });

  it("rejects a V1 selection + V2 manifest mixed pair", () => {
    if (!v2Baseline) return;
    const v2Selection = JSON.parse(v2Baseline[GRID_BETA_MATCH_SELECTION_ARTIFACT]!) as {
      seed: number;
      fighterA: { fighterId: string; checksum: string };
      fighterB: { fighterId: string; checksum: string };
    };
    const v1Selection = buildGridBetaSelection({
      seed: v2Selection.seed,
      fighterA: v2Selection.fighterA,
      fighterB: v2Selection.fighterB,
      protectedSourcePreflight: canonicalV1Preflight,
    });
    const mixed: Record<string, string> = {
      ...v2Baseline,
      [GRID_BETA_MATCH_SELECTION_ARTIFACT]: serializeGridBetaSelection(v1Selection),
    };
    expect(() => validateGridBetaMatchBundle(mixed)).toThrow(
      /schema versions are incompatible/,
    );
  });

  it("rejects a V2 selection + V1 manifest mixed pair", () => {
    if (!v2Baseline) return;
    const v2Manifest = JSON.parse(v2Baseline[GRID_BETA_MATCH_MANIFEST_FILE]!) as {
      matchId: string;
      createdAt: string;
      result: { winner: string | null; method: string; rounds: number };
      fighterChecksums: { fighterA: string; fighterB: string };
      safety: {
        protectedSourcePreflightStatus: "pass" | "fail";
        suspensionStatus: "active" | "clear";
      };
      digests: Record<string, string>;
    };
    const v1Manifest = buildGridBetaMatchManifest({
      matchId: v2Manifest.matchId,
      createdAt: v2Manifest.createdAt,
      result: v2Manifest.result,
      fighterChecksums: v2Manifest.fighterChecksums,
      protectedSourcePreflightStatus: v2Manifest.safety.protectedSourcePreflightStatus,
      suspensionStatus: v2Manifest.safety.suspensionStatus,
      digests: v2Manifest.digests,
    });
    const mixed: Record<string, string> = {
      ...v2Baseline,
      [GRID_BETA_MATCH_MANIFEST_FILE]: serializeGridBetaMatchManifest(v1Manifest),
    };
    expect(() => validateGridBetaMatchBundle(mixed)).toThrow(
      /schema versions are incompatible/,
    );
  });
});
