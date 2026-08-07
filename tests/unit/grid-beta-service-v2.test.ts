import { describe, expect, it, beforeAll } from "vitest";
import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { join, resolve, sep } from "node:path";
import { runGridBetaMatch } from "../../src/app/grid-beta-match.js";
import type { CanaryFileSystem } from "../../src/canary/immutable-canary-bundle.js";
import {
  GRID_BETA_MATCH_MANIFEST_FILE,
  GRID_BETA_MATCH_SELECTION_ARTIFACT,
} from "../../src/beta/grid-beta-match-bundle.js";
import { GRID_BETA_LEGACY_ISOLATION_REVIEWED_SOURCE_V2_COMMIT } from "../../src/beta/grid-beta-legacy-isolation-reviewed-source-v2.js";
import { createGridBetaMappedFs } from "../helpers/grid-beta-mapped-fs.js";
import {
  BETA_TEST_MATCH_ID,
  createBetaTempEnvironment,
  readBetaBundle,
} from "../helpers/grid-beta-builder.js";
import { buildDualCommitInMemorySourceReader } from "../helpers/grid-beta-successor-builder.js";

/**
 * Milestone 0.2D Phase 3C (Commit G) — service V2 tests. The production
 * service now requires BOTH authorities (original v1 governance anchor +
 * successor v2 source anchor/current preflight) and emits Selection V2 +
 * Manifest V2. All paths are temporary/mapped; no real beta artifact or
 * marker is created.
 */

let env: Awaited<ReturnType<typeof createBetaTempEnvironment>> | null = null;

function mappedFs(out: string, marker: string): CanaryFileSystem {
  return createGridBetaMappedFs({
    fighterRoot: env!.fighterRoot,
    outputRoot: out,
    governanceDir: env!.governanceDir,
    markerPath: marker,
  });
}

function mutatingReadFs(
  base: CanaryFileSystem,
  overrides: Record<string, string>,
): CanaryFileSystem {
  return {
    ...base,
    readFile: async (path, encoding) => {
      const rel = resolve(path)
        .replace(process.cwd() + sep, "")
        .replace(/\\/g, "/");
      if (overrides[rel] !== undefined) return overrides[rel];
      return base.readFile(path, encoding);
    },
  };
}

function deps(
  overrides: Partial<{
    fs: CanaryFileSystem;
    sourceCommitReader: Awaited<ReturnType<typeof buildDualCommitInMemorySourceReader>>;
    onExecutionStart: () => void;
  }> = {},
) {
  return {
    createUuid: () => BETA_TEST_MATCH_ID,
    now: () => new Date("2026-08-07T00:00:00.000Z"),
    fs: overrides.fs,
    sourceCommitReader: overrides.sourceCommitReader ?? env!.sourceReader,
    ...(overrides.onExecutionStart
      ? { onExecutionStart: overrides.onExecutionStart }
      : {}),
  };
}

describe("grid beta service successor v2 (0.2D Phase 3C)", () => {
  beforeAll(async () => {
    env = await createBetaTempEnvironment();
  }, 120_000);

  it("emits Selection V2 and Manifest V2 with the dual source-authority identity and a passing bundle", async () => {
    if (!env) return;
    const out = join(env.root, "out-v2-positive");
    const marker = join(env.root, "marker-v2-positive");
    await mkdir(out, { recursive: true });
    let executionStarts = 0;
    const result = await runGridBetaMatch(
      { seed: 1, fighterA: "alpha", fighterB: "beta", acknowledgement: true },
      deps({
        fs: mappedFs(out, marker),
        onExecutionStart: () => {
          executionStarts += 1;
        },
      }),
    );
    expect(executionStarts).toBe(1);
    expect(result.selection.schemaVersion).toBe("2");
    expect(result.manifest.schemaVersion).toBe("2");
    expect(result.selection.sourceAuthority.originalGovernance.governanceDecisionId).toBe(
      "58e8cd87-504e-4b5f-9bac-f6b81d82377b",
    );
    expect(result.selection.sourceAuthority.currentSource.baselineId).toBe(
      "grid-beta-legacy-isolation-reviewed-source-v2",
    );
    expect(result.selection.sourceAuthority.currentSource.sourceCommit).toBe(
      GRID_BETA_LEGACY_ISOLATION_REVIEWED_SOURCE_V2_COMMIT,
    );
    expect(result.selection.sourceAuthority.currentSource.baselineChecksum).toMatch(
      /^[0-9a-f]{64}$/,
    );
    // The manifest read-back is V2 and cross-agrees on the source authority.
    expect(result.manifest.sourceAuthority).toEqual(result.selection.sourceAuthority);

    // The persisted bundle lives under the mapped temp matches root and
    // contains V2 selection + V2 manifest.
    const bundle = await readBetaBundle(join(out, BETA_TEST_MATCH_ID));
    expect(JSON.parse(bundle[GRID_BETA_MATCH_SELECTION_ARTIFACT]!).schemaVersion).toBe(
      "2",
    );
    expect(JSON.parse(bundle[GRID_BETA_MATCH_MANIFEST_FILE]!).schemaVersion).toBe("2");
    // A successful match never creates a suspension marker.
    expect(existsSync(marker)).toBe(false);
  });

  it("suspends with legacy_default_regression and zero execution when the successor M commit is missing", async () => {
    if (!env) return;
    const out = join(env.root, "out-v2-missing-m");
    const marker = join(env.root, "marker-v2-missing-m");
    await mkdir(out, { recursive: true });
    let executionStarts = 0;
    const forged = await buildDualCommitInMemorySourceReader({
      unavailableCommits: [GRID_BETA_LEGACY_ISOLATION_REVIEWED_SOURCE_V2_COMMIT],
    });
    await expect(
      runGridBetaMatch(
        { seed: 1, fighterA: "alpha", fighterB: "beta", acknowledgement: true },
        deps({
          fs: mappedFs(out, marker),
          sourceCommitReader: forged,
          onExecutionStart: () => {
            executionStarts += 1;
          },
        }),
      ),
    ).rejects.toThrow(/legacy_default_regression/);
    expect(executionStarts).toBe(0);
    expect(existsSync(join(out, BETA_TEST_MATCH_ID))).toBe(false);
  });

  it("suspends with legacy_default_regression and zero execution when the successor M source is tampered", async () => {
    if (!env) return;
    const out = join(env.root, "out-v2-tampered-m");
    const marker = join(env.root, "marker-v2-tampered-m");
    await mkdir(out, { recursive: true });
    let executionStarts = 0;
    const forged = await buildDualCommitInMemorySourceReader({
      v2: { "src/opponents/legacy-bulwark.ts": "export const X = 1;\n" },
    });
    await expect(
      runGridBetaMatch(
        { seed: 1, fighterA: "alpha", fighterB: "beta", acknowledgement: true },
        deps({
          fs: mappedFs(out, marker),
          sourceCommitReader: forged,
          onExecutionStart: () => {
            executionStarts += 1;
          },
        }),
      ),
    ).rejects.toThrow(/legacy_default_regression/);
    expect(executionStarts).toBe(0);
    expect(existsSync(join(out, BETA_TEST_MATCH_ID))).toBe(false);
  });

  it("suspends with legacy_default_regression when the current protected source no longer matches the successor snapshot", async () => {
    if (!env) return;
    const out = join(env.root, "out-v2-current-mismatch");
    const marker = join(env.root, "marker-v2-current-mismatch");
    await mkdir(out, { recursive: true });
    let executionStarts = 0;
    const fs = mutatingReadFs(mappedFs(out, marker), {
      "src/app/run-match.ts": "export function runGridMatch() {}\n",
    });
    await expect(
      runGridBetaMatch(
        { seed: 1, fighterA: "alpha", fighterB: "beta", acknowledgement: true },
        deps({
          fs,
          onExecutionStart: () => {
            executionStarts += 1;
          },
        }),
      ),
    ).rejects.toThrow(/legacy_default_regression/);
    expect(executionStarts).toBe(0);
    expect(existsSync(join(out, BETA_TEST_MATCH_ID))).toBe(false);
  });

  it("suspends with legacy_default_regression when the canonical Bulwark anchor mismatches", async () => {
    if (!env) return;
    const out = join(env.root, "out-v2-bulwark-mismatch");
    const marker = join(env.root, "marker-v2-bulwark-mismatch");
    await mkdir(out, { recursive: true });
    let executionStarts = 0;
    const fs = mutatingReadFs(mappedFs(out, marker), {
      "data/opponents/bulwark.v1.json": JSON.stringify(
        { fixtureChecksum: "0".repeat(64) },
        null,
        2,
      ),
    });
    await expect(
      runGridBetaMatch(
        { seed: 1, fighterA: "alpha", fighterB: "beta", acknowledgement: true },
        deps({
          fs,
          onExecutionStart: () => {
            executionStarts += 1;
          },
        }),
      ),
    ).rejects.toThrow(/legacy_default_regression/);
    expect(executionStarts).toBe(0);
    expect(existsSync(join(out, BETA_TEST_MATCH_ID))).toBe(false);
  });

  it("suspends with governance_anchor_failure when the original v1 governance source is corrupted", async () => {
    if (!env) return;
    const out = join(env.root, "out-v2-gov-corrupt");
    const marker = join(env.root, "marker-v2-gov-corrupt");
    await mkdir(out, { recursive: true });
    let executionStarts = 0;
    const forged = await buildDualCommitInMemorySourceReader({
      v1: {
        "src/simulator/constants.ts":
          'export const SIMULATOR_VERSION = "0.3.0" as const;\nexport const RULESET_VERSION = "0.2.0" as const;\n',
      },
    });
    await expect(
      runGridBetaMatch(
        { seed: 1, fighterA: "alpha", fighterB: "beta", acknowledgement: true },
        deps({
          fs: mappedFs(out, marker),
          sourceCommitReader: forged,
          onExecutionStart: () => {
            executionStarts += 1;
          },
        }),
      ),
    ).rejects.toThrow(/suspended/);
    expect(executionStarts).toBe(0);
  });
});
