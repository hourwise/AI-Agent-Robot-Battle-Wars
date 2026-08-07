import { describe, expect, it } from "vitest";
import { GitSourceCommitReader } from "../../src/readiness/grid-source-commit-reader.js";
import {
  GRID_BETA_LEGACY_ISOLATION_REVIEWED_SOURCE_V2_BASELINE_ID,
  GRID_BETA_LEGACY_ISOLATION_REVIEWED_SOURCE_V2_BULWARK_CONTENT_SHA256,
  GRID_BETA_LEGACY_ISOLATION_REVIEWED_SOURCE_V2_BULWARK_FIXTURE_CHECKSUM,
  GRID_BETA_LEGACY_ISOLATION_REVIEWED_SOURCE_V2_BULWARK_PATH,
  GRID_BETA_LEGACY_ISOLATION_REVIEWED_SOURCE_V2_CHECKSUM,
  GRID_BETA_LEGACY_ISOLATION_REVIEWED_SOURCE_V2_COMMIT,
  GRID_BETA_LEGACY_ISOLATION_REVIEWED_SOURCE_V2_FILES,
  GRID_BETA_LEGACY_ISOLATION_REVIEWED_SOURCE_V2_PATHS,
  GRID_BETA_LEGACY_ISOLATION_REVIEWED_SOURCE_V2_REPOSITORY,
  anchorGridBetaLegacyIsolationReviewedSourceV2,
  buildGridBetaLegacyIsolationReviewedSourceV2,
  gridBetaLegacyIsolationReviewedSourceV2Checksum,
} from "../../src/beta/grid-beta-legacy-isolation-reviewed-source-v2.js";
import { GRID_OPT_IN_BETA_REVIEWED_SOURCE_COMMIT } from "../../src/readiness/grid-opt-in-beta-source-snapshot.js";
import {
  buildDualCommitInMemorySourceReader,
  buildDualUnavailableCommitReader,
} from "../helpers/grid-beta-successor-builder.js";

/**
 * Milestone 0.2D Phase 3C (Commit G) — successor source baseline v2 snapshot.
 * Builds/anchors the frozen v2 baseline from exact Commit M Git objects and
 * proves every fail-closed corruption path.
 */

describe("grid beta successor source baseline v2 (0.2D Phase 3C)", () => {
  it("builds and anchors the exact v2 baseline from Commit M Git objects", async () => {
    const snapshot = await buildGridBetaLegacyIsolationReviewedSourceV2(
      new GitSourceCommitReader(),
    );
    expect(snapshot.baselineId).toBe(
      GRID_BETA_LEGACY_ISOLATION_REVIEWED_SOURCE_V2_BASELINE_ID,
    );
    expect(snapshot.repository).toBe(
      GRID_BETA_LEGACY_ISOLATION_REVIEWED_SOURCE_V2_REPOSITORY,
    );
    expect(snapshot.sourceCommit).toBe(
      GRID_BETA_LEGACY_ISOLATION_REVIEWED_SOURCE_V2_COMMIT,
    );
    expect(snapshot.originalAuthority.snapshotId).toBe(
      "grid-opt-in-beta-reviewed-source-v1",
    );
    expect(snapshot.originalAuthority.sourceCommit).toBe(
      GRID_OPT_IN_BETA_REVIEWED_SOURCE_COMMIT,
    );
    expect(snapshot.files).toHaveLength(23);
    expect(snapshot.files.map((f) => f.path)).toEqual([
      ...GRID_BETA_LEGACY_ISOLATION_REVIEWED_SOURCE_V2_PATHS,
    ]);
    expect(snapshot.canonicalBulwark.path).toBe(
      GRID_BETA_LEGACY_ISOLATION_REVIEWED_SOURCE_V2_BULWARK_PATH,
    );
    expect(snapshot.canonicalBulwark.contentSha256).toBe(
      GRID_BETA_LEGACY_ISOLATION_REVIEWED_SOURCE_V2_BULWARK_CONTENT_SHA256,
    );
    expect(snapshot.canonicalBulwark.fixtureChecksum).toBe(
      GRID_BETA_LEGACY_ISOLATION_REVIEWED_SOURCE_V2_BULWARK_FIXTURE_CHECKSUM,
    );
    // The deterministic checksum is stable and equals the frozen anchor.
    expect(gridBetaLegacyIsolationReviewedSourceV2Checksum(snapshot)).toBe(
      GRID_BETA_LEGACY_ISOLATION_REVIEWED_SOURCE_V2_CHECKSUM,
    );
    // The frozen anchor accepts the exact built snapshot.
    expect(() => anchorGridBetaLegacyIsolationReviewedSourceV2(snapshot)).not.toThrow();
  });

  it("freezes the exact ordered 23-path inventory including the migrated M files", () => {
    expect(GRID_BETA_LEGACY_ISOLATION_REVIEWED_SOURCE_V2_PATHS).toHaveLength(23);
    expect([...GRID_BETA_LEGACY_ISOLATION_REVIEWED_SOURCE_V2_PATHS]).toEqual([
      ...GRID_BETA_LEGACY_ISOLATION_REVIEWED_SOURCE_V2_FILES.map((f) => f.path),
    ]);
    // The new/changed Commit M files are present in the frozen inventory.
    for (const path of [
      "src/app/run-match.ts",
      "src/app/run-series.ts",
      "src/agents/scripted/bulwark-agent.ts",
      "src/opponents/opponent-fixture.ts",
      "src/opponents/opponent-fixture-loader.ts",
      "src/opponents/opponent-runtime-compatibility.ts",
      "src/opponents/legacy-bulwark.ts",
      "package.json",
    ]) {
      expect(
        GRID_BETA_LEGACY_ISOLATION_REVIEWED_SOURCE_V2_FILES.some((f) => f.path === path),
        path,
      ).toBe(true);
    }
    // No unrelated benchmark/readiness path crept into the set.
    expect(
      GRID_BETA_LEGACY_ISOLATION_REVIEWED_SOURCE_V2_PATHS.some((p) =>
        p.includes("benchmark"),
      ),
    ).toBe(false);
    expect(
      GRID_BETA_LEGACY_ISOLATION_REVIEWED_SOURCE_V2_PATHS.some((p) =>
        p.includes("readiness"),
      ),
    ).toBe(false);
  });

  it("rejects a wrong source commit", async () => {
    const reader = await buildDualCommitInMemorySourceReader();
    const tampered = {
      ...reader,
      commitAvailable: async (c: string) =>
        c === "0000000000000000000000000000000000000000",
    };
    await expect(buildGridBetaLegacyIsolationReviewedSourceV2(tampered)).rejects.toThrow(
      /unavailable or the repository is shallow/,
    );
  });

  it("rejects an unavailable commit", async () => {
    await expect(
      buildGridBetaLegacyIsolationReviewedSourceV2(buildDualUnavailableCommitReader()),
    ).rejects.toThrow(/unavailable/);
  });

  it("rejects a missing reviewed path", async () => {
    const reader = await buildDualCommitInMemorySourceReader();
    const tampered = {
      ...reader,
      blobAvailable: async (c: string, p: string) =>
        p === "src/opponents/legacy-bulwark.ts" ? false : reader.blobAvailable(c, p),
    };
    await expect(buildGridBetaLegacyIsolationReviewedSourceV2(tampered)).rejects.toThrow(
      /missing at commit/,
    );
  });

  it("rejects a wrong blob SHA (tampered blob object id)", async () => {
    const snapshot = await buildGridBetaLegacyIsolationReviewedSourceV2(
      new GitSourceCommitReader(),
    );
    const tampered = {
      ...snapshot,
      files: snapshot.files.map((f, i) =>
        i === 0 ? { ...f, blobSha: "0".repeat(40) } : f,
      ),
    };
    expect(() => anchorGridBetaLegacyIsolationReviewedSourceV2(tampered)).toThrow(
      /does not match the frozen v2 identity/,
    );
  });

  it("rejects changed source content (coherently rebuilt snapshot)", async () => {
    const reader = await buildDualCommitInMemorySourceReader({
      v2: {
        "src/app/run-match.ts":
          "export function runMatch() {}\nexport function runGridMatch() {}\n",
      },
    });
    const snapshot = await buildGridBetaLegacyIsolationReviewedSourceV2(reader);
    expect(() => anchorGridBetaLegacyIsolationReviewedSourceV2(snapshot)).toThrow(
      /does not match the frozen v2 identity|baseline checksum/,
    );
  });

  it("rejects reordered file identities", async () => {
    const snapshot = await buildGridBetaLegacyIsolationReviewedSourceV2(
      new GitSourceCommitReader(),
    );
    const reordered = {
      ...snapshot,
      files: [...snapshot.files].reverse(),
    };
    expect(() => anchorGridBetaLegacyIsolationReviewedSourceV2(reordered)).toThrow(
      /does not match the frozen v2 identity/,
    );
  });

  it("rejects changed canonical Bulwark bytes and a wrong fixtureChecksum", async () => {
    const changedBytes = await buildDualCommitInMemorySourceReader({
      v2: {
        [GRID_BETA_LEGACY_ISOLATION_REVIEWED_SOURCE_V2_BULWARK_PATH]: JSON.stringify(
          { ...JSON.parse("{}"), fixtureChecksum: "0".repeat(64) },
          null,
          2,
        ),
      },
    });
    const changedSnapshot =
      await buildGridBetaLegacyIsolationReviewedSourceV2(changedBytes);
    expect(() => anchorGridBetaLegacyIsolationReviewedSourceV2(changedSnapshot)).toThrow(
      /content SHA-256|fixtureChecksum/,
    );

    // Wrong internal fixtureChecksum with otherwise-correct bytes.
    const realBulwarkBytes = await new GitSourceCommitReader().readBlobBytes(
      GRID_BETA_LEGACY_ISOLATION_REVIEWED_SOURCE_V2_COMMIT,
      GRID_BETA_LEGACY_ISOLATION_REVIEWED_SOURCE_V2_BULWARK_PATH,
    );
    const realBulwarkJson = JSON.parse(
      new TextDecoder().decode(realBulwarkBytes),
    ) as Record<string, unknown>;
    const wrongChecksumReader = await buildDualCommitInMemorySourceReader({
      v2: {
        [GRID_BETA_LEGACY_ISOLATION_REVIEWED_SOURCE_V2_BULWARK_PATH]: JSON.stringify(
          { ...realBulwarkJson, fixtureChecksum: "0".repeat(64) },
          null,
          2,
        ),
      },
    });
    const wrongChecksumSnapshot =
      await buildGridBetaLegacyIsolationReviewedSourceV2(wrongChecksumReader);
    expect(() =>
      anchorGridBetaLegacyIsolationReviewedSourceV2(wrongChecksumSnapshot),
    ).toThrow(/fixtureChecksum/);
  });

  it("rejects a recomputed coherent tamper through the frozen v2 anchor", async () => {
    const reader = await buildDualCommitInMemorySourceReader({
      v2: {
        "src/opponents/legacy-bulwark.ts": "export const x = 1;\n",
      },
    });
    const snapshot = await buildGridBetaLegacyIsolationReviewedSourceV2(reader);
    // Recompute the baseline checksum over the tampered snapshot: the frozen
    // anchor still rejects because the frozen checksum constant is unchanged.
    const recomputed = gridBetaLegacyIsolationReviewedSourceV2Checksum(snapshot);
    expect(recomputed).not.toBe(GRID_BETA_LEGACY_ISOLATION_REVIEWED_SOURCE_V2_CHECKSUM);
    expect(() => anchorGridBetaLegacyIsolationReviewedSourceV2(snapshot)).toThrow(
      /baseline checksum|frozen v2 identity/,
    );
  });

  it("never substitutes working-tree bytes for Git-object bytes", async () => {
    // The dual in-memory reader serves exact Git commit bytes (read through
    // the real reader); the builder uses only the reader. Every built content
    // hash must equal the frozen v2 identities (computed from Git objects at
    // Commit M), regardless of working-tree state.
    const reader = await buildDualCommitInMemorySourceReader();
    const snapshot = await buildGridBetaLegacyIsolationReviewedSourceV2(reader);
    for (const file of snapshot.files) {
      const frozen = GRID_BETA_LEGACY_ISOLATION_REVIEWED_SOURCE_V2_FILES.find(
        (f) => f.path === file.path,
      );
      expect(file.contentSha256, file.path).toBe(frozen!.contentSha256);
    }
  });
});
