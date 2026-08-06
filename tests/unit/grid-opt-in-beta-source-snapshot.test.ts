import { describe, expect, it } from "vitest";
import { sha256Hex } from "../../src/canary/grid-canary-digest.js";
import {
  GRID_OPT_IN_BETA_REVIEWED_SOURCE_COMMIT,
  GRID_OPT_IN_BETA_REVIEWED_SOURCE_FILES,
  GRID_OPT_IN_BETA_REVIEWED_SOURCE_PATHS,
  GRID_OPT_IN_BETA_REVIEWED_SOURCE_REPOSITORY,
  GRID_OPT_IN_BETA_REVIEWED_SOURCE_SNAPSHOT_CHECKSUM,
  GRID_OPT_IN_BETA_REVIEWED_SOURCE_SNAPSHOT_ID,
  anchorGridOptInBetaReviewedSourceSnapshot,
  buildGridOptInBetaReviewedSourceSnapshot,
  gridOptInBetaReviewedSourceSnapshotChecksum,
} from "../../src/readiness/grid-opt-in-beta-source-snapshot.js";
import {
  buildInMemoryReviewedSourceReader,
  buildUnavailableCommitReader,
} from "../helpers/grid-opt-in-beta-governance-builder.js";

describe("grid opt-in beta reviewed source snapshot (Phase 3F.1 Phase 2)", () => {
  it("declares the frozen snapshot identity and the 26 reviewed paths", () => {
    expect(GRID_OPT_IN_BETA_REVIEWED_SOURCE_SNAPSHOT_ID).toBe(
      "grid-opt-in-beta-reviewed-source-v1",
    );
    expect(GRID_OPT_IN_BETA_REVIEWED_SOURCE_REPOSITORY).toBe(
      "hourwise/AI-Agent-Robot-Battle-Wars",
    );
    expect(GRID_OPT_IN_BETA_REVIEWED_SOURCE_COMMIT).toBe(
      "5173fd0f287465e1181969dbad2f37cee10fd47e",
    );
    expect(GRID_OPT_IN_BETA_REVIEWED_SOURCE_PATHS.length).toBe(26);
    expect(GRID_OPT_IN_BETA_REVIEWED_SOURCE_FILES.length).toBe(26);
    expect(GRID_OPT_IN_BETA_REVIEWED_SOURCE_FILES.map((f) => f.path)).toEqual([
      ...GRID_OPT_IN_BETA_REVIEWED_SOURCE_PATHS,
    ]);
    for (const file of GRID_OPT_IN_BETA_REVIEWED_SOURCE_FILES) {
      expect(file.contentSha256, `${file.path} content hash`).toMatch(/^[0-9a-f]{64}$/);
      expect(file.blobSha, `${file.path} blob sha`).toMatch(/^[0-9a-f]{40}$/);
    }
    expect(GRID_OPT_IN_BETA_REVIEWED_SOURCE_SNAPSHOT_CHECKSUM).toMatch(/^[0-9a-f]{64}$/);
  });

  it("covers the required reviewed critical files", () => {
    const paths = new Set(GRID_OPT_IN_BETA_REVIEWED_SOURCE_PATHS);
    for (const required of [
      "package.json",
      "src/app/run-match.ts",
      "src/app/run-series.ts",
      "src/simulator/constants.ts",
      "src/simulator/runtime-identity.ts",
      "src/simulator/component-qualification-registry.ts",
      "src/catalogue/catalogue.v1.ts",
      "src/persistence/match-converter.ts",
      "src/replay/positioning-model.ts",
      "src/replay/text-replay-renderer.ts",
      "src/replay/ascii/arena-renderer.ts",
      "src/app/grid-match-canary.ts",
      "src/canary/grid-series-canary-core.ts",
      "src/canary/canary-output-root.ts",
      "src/simulator/grid-runtime.ts",
      "src/readiness/grid-grapple-supplement-bundle.ts",
    ]) {
      expect(paths.has(required), `reviewed snapshot must include ${required}`).toBe(
        true,
      );
    }
  });

  it("reads the exact committed bytes and reproduces the frozen snapshot", async () => {
    const reader = await buildInMemoryReviewedSourceReader();
    const built = await buildGridOptInBetaReviewedSourceSnapshot(reader);
    expect(built.snapshot.snapshotId).toBe(GRID_OPT_IN_BETA_REVIEWED_SOURCE_SNAPSHOT_ID);
    expect(built.snapshot.repository).toBe(GRID_OPT_IN_BETA_REVIEWED_SOURCE_REPOSITORY);
    expect(built.snapshot.sourceCommit).toBe(GRID_OPT_IN_BETA_REVIEWED_SOURCE_COMMIT);
    expect(built.snapshot.checksum).toBe(
      GRID_OPT_IN_BETA_REVIEWED_SOURCE_SNAPSHOT_CHECKSUM,
    );
    expect(gridOptInBetaReviewedSourceSnapshotChecksum(built.snapshot)).toBe(
      GRID_OPT_IN_BETA_REVIEWED_SOURCE_SNAPSHOT_CHECKSUM,
    );
    expect(() => anchorGridOptInBetaReviewedSourceSnapshot(built.snapshot)).not.toThrow();
    for (const file of GRID_OPT_IN_BETA_REVIEWED_SOURCE_FILES) {
      expect(sha256Hex(built.contents[file.path]!), `${file.path} committed bytes`).toBe(
        file.contentSha256,
      );
    }
  });

  it("rejects an unavailable commit before building (missing Git object)", async () => {
    const reader = buildUnavailableCommitReader();
    await expect(buildGridOptInBetaReviewedSourceSnapshot(reader)).rejects.toThrow(
      /not available locally/,
    );
  });

  it("rejects a different commit than the exact authorised commit", async () => {
    const reader = await buildInMemoryReviewedSourceReader();
    await expect(
      buildGridOptInBetaReviewedSourceSnapshot(
        reader,
        "9999999999999999999999999999999999999999",
      ),
    ).rejects.toThrow(/exact authorised commit/);
  });

  it("rejects an altered reviewed file through its content hash and snapshot checksum", async () => {
    const reader = await buildInMemoryReviewedSourceReader({
      "src/simulator/constants.ts":
        'export const SIMULATOR_VERSION = "0.3.0" as const;\nexport const RULESET_VERSION = "0.2.0" as const;\n',
    });
    const built = await buildGridOptInBetaReviewedSourceSnapshot(reader);
    // The builder reflects the injected reader bytes (never the working tree).
    const frozenConstants = GRID_OPT_IN_BETA_REVIEWED_SOURCE_FILES.find(
      (f) => f.path === "src/simulator/constants.ts",
    )!;
    const builtConstants = built.snapshot.files.find(
      (f) => f.path === "src/simulator/constants.ts",
    )!;
    expect(builtConstants.contentSha256).not.toBe(frozenConstants.contentSha256);
    expect(built.snapshot.checksum).not.toBe(
      GRID_OPT_IN_BETA_REVIEWED_SOURCE_SNAPSHOT_CHECKSUM,
    );
    expect(() => anchorGridOptInBetaReviewedSourceSnapshot(built.snapshot)).toThrow(
      /frozen reviewed source files|snapshot checksum/,
    );
  });

  it("rejects an altered canary file via the frozen canary hash binding", async () => {
    const reader = await buildInMemoryReviewedSourceReader({
      "src/app/grid-match-canary.ts": "// altered canary source\n",
    });
    const built = await buildGridOptInBetaReviewedSourceSnapshot(reader);
    expect(() => anchorGridOptInBetaReviewedSourceSnapshot(built.snapshot)).toThrow(
      /frozen reviewed source files/,
    );
  });
});
