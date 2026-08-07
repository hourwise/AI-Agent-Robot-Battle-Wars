import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  defaultCanaryFs,
  type CanaryFileSystem,
} from "../../src/canary/immutable-canary-bundle.js";
import {
  GRID_BETA_MATCH_BUNDLE_ENTRIES,
  validateGridBetaMatchBundle,
} from "../../src/beta/grid-beta-match-bundle.js";
import { GRID_OPT_IN_BETA_GOVERNANCE_BUNDLE_ENTRIES } from "../../src/readiness/grid-opt-in-beta-governance-bundle.js";
import { gridBetaSuspensionMarkerV1Schema } from "../../src/beta/grid-beta-suspension.js";
import {
  BETA_TEST_MATCH_ID,
  createBetaTempEnvironment,
  officialGovernanceBundleAvailable,
  readBetaBundle,
  runBetaMatchToTemp,
} from "../helpers/grid-beta-builder.js";
import { buildInMemoryReviewedSourceReader } from "../helpers/grid-opt-in-beta-governance-builder.js";
import { runGridBetaMatchWithTestEnvironment } from "../../src/app/grid-beta-match-test-harness.js";

let env: Awaited<ReturnType<typeof createBetaTempEnvironment>> | null = null;

beforeAll(async () => {
  if (!officialGovernanceBundleAvailable()) return;
  env = await createBetaTempEnvironment();
}, 120_000);

afterAll(async () => {
  if (env) await env.cleanup();
});

function deps(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    createUuid: () => BETA_TEST_MATCH_ID,
    now: () => new Date("2026-08-06T00:00:00.000Z"),
    fs: defaultCanaryFs,
    sourceCommitReader: env!.sourceReader,
    ...overrides,
  };
}

/**
 * Phase 3G.1.1 test harness runner: the production `runGridBetaMatch` has a
 * fixed execution boundary (canonical roots, fixed `executeGridBetaMatch`
 * core, no root overrides and no alternate execution injection), so tests use
 * the structurally separate `runGridBetaMatchWithTestEnvironment` with
 * temporary roots and an optional execution-entry observer.
 */
function harnessRun(
  request: { seed: number; fighterA: string; fighterB: string; acknowledgement: true },
  options: {
    outputRoot: string;
    fighterRoot: string;
    governanceBundleDir: string;
    suspensionMarkerPath: string;
    onExecutionStart?: () => void;
  },
  overrides: Partial<Record<string, unknown>> = {},
) {
  return runGridBetaMatchWithTestEnvironment(request, options, deps(overrides));
}

describe("grid beta match service (Phase 3G Phases 1, 8 and 12)", () => {
  it("publishes a validated ten-file beta match bundle to a temp output root", async () => {
    if (!env) return;
    const result = await runBetaMatchToTemp(env);
    expect(result.matchId).toBe(BETA_TEST_MATCH_ID);
    expect(result.winner).not.toBeUndefined();
    expect(result.rounds).toBeGreaterThan(0);
    const files = (await readdir(result.artifactDirectory)).sort();
    expect(files).toEqual([...GRID_BETA_MATCH_BUNDLE_ENTRIES].sort());
    const contents = await readBetaBundle(result.artifactDirectory);
    expect(() => validateGridBetaMatchBundle(contents)).not.toThrow();
    expect(existsSync(env.markerPath)).toBe(false);
  });

  it("requires the explicit acknowledgement before any match activity (no suspension marker)", async () => {
    if (!env) return;
    const marker = join(env.root, "marker-ack");
    await expect(
      harnessRun(
        { seed: 1, fighterA: "alpha", fighterB: "beta", acknowledgement: false as never },
        {
          outputRoot: env.outputRoot,
          fighterRoot: env.fighterRoot,
          governanceBundleDir: env.governanceDir,
          suspensionMarkerPath: marker,
        },
      ),
    ).rejects.toThrow(/acknowledgement/);
    expect(existsSync(marker)).toBe(false);
  });

  it("suspends (with marker) and publishes nothing when the governance bundle is absent", async () => {
    if (!env) return;
    const out = join(env.root, "out-absent-gov");
    const marker = join(env.root, "marker-absent-gov");
    await expect(
      harnessRun(
        { seed: 1, fighterA: "alpha", fighterB: "beta", acknowledgement: true },
        {
          outputRoot: out,
          fighterRoot: env.fighterRoot,
          governanceBundleDir: join(env.root, "does-not-exist"),
          suspensionMarkerPath: marker,
        },
      ),
    ).rejects.toThrow(/suspended|governance/);
    expect(existsSync(marker)).toBe(true);
    expect(existsSync(join(out, BETA_TEST_MATCH_ID))).toBe(false);
  });

  it("suspends (with marker) when the governance bundle is altered and no longer anchors", async () => {
    if (!env) return;
    const govDir = join(env.root, "tampered-gov");
    await mkdir(govDir, { recursive: true });
    const sourceDir = env.governanceDir;
    for (const name of GRID_OPT_IN_BETA_GOVERNANCE_BUNDLE_ENTRIES) {
      const text = readFileSync(join(sourceDir, name), "utf-8");
      await writeFile(
        join(govDir, name),
        name === "report.txt" ? `${text}\ntampered` : text,
        "utf-8",
      );
    }
    const out = join(env.root, "out-tampered-gov");
    const marker = join(env.root, "marker-tampered-gov");
    await expect(
      harnessRun(
        { seed: 1, fighterA: "alpha", fighterB: "beta", acknowledgement: true },
        {
          outputRoot: out,
          fighterRoot: env.fighterRoot,
          governanceBundleDir: govDir,
          suspensionMarkerPath: marker,
        },
      ),
    ).rejects.toThrow(/suspended/);
    expect(existsSync(marker)).toBe(true);
    const markerText = await readFile(marker, "utf-8");
    const parsed = gridBetaSuspensionMarkerV1Schema.safeParse(JSON.parse(markerText));
    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data.trigger).toBe("governance_anchor_failure");
    expect(existsSync(join(out, BETA_TEST_MATCH_ID))).toBe(false);
  });

  it("suspends (with marker) when the exact reviewed Git source snapshot cannot be validated", async () => {
    if (!env) return;
    // Forge the reader to report the exact commit but serve altered constants
    // source bytes, so the reviewed source snapshot can no longer validate.
    const forgedReader = await buildInMemoryReviewedSourceReader({
      "src/simulator/constants.ts":
        'export const SIMULATOR_VERSION = "0.3.0" as const;\nexport const RULESET_VERSION = "0.2.0" as const;\n',
    });
    const out = join(env.root, "out-forged-source");
    const marker = join(env.root, "marker-forged-source");
    await expect(
      harnessRun(
        { seed: 1, fighterA: "alpha", fighterB: "beta", acknowledgement: true },
        {
          outputRoot: out,
          fighterRoot: env.fighterRoot,
          governanceBundleDir: env.governanceDir,
          suspensionMarkerPath: marker,
        },
        { sourceCommitReader: forgedReader },
      ),
    ).rejects.toThrow(/suspended/);
    expect(existsSync(marker)).toBe(true);
  });

  it("fails before publication when governance bytes change after anchoring (race before simulation)", async () => {
    if (!env) return;
    const out = join(env.root, "out-gov-race-sim");
    const marker = join(env.root, "marker-gov-race-sim");
    let governanceReads = 0;
    const mutatingFs: CanaryFileSystem = {
      ...defaultCanaryFs,
      readFile: async (path, encoding) => {
        const text = await defaultCanaryFs.readFile(path, encoding);
        const normalized = path.replaceAll("\\", "/");
        if (normalized.includes("governance") && normalized.endsWith("report.txt")) {
          governanceReads += 1;
          // Read 1 anchors; the before-simulation re-check (read 2) sees a change.
          if (governanceReads === 2) {
            return `${text}\n// changed`;
          }
        }
        return text;
      },
    };
    await expect(
      harnessRun(
        { seed: 1, fighterA: "alpha", fighterB: "beta", acknowledgement: true },
        {
          outputRoot: out,
          fighterRoot: env.fighterRoot,
          governanceBundleDir: env.governanceDir,
          suspensionMarkerPath: marker,
        },
        { fs: mutatingFs },
      ),
    ).rejects.toThrow(/suspended/);
    expect(existsSync(marker)).toBe(true);
    expect(existsSync(join(out, BETA_TEST_MATCH_ID))).toBe(false);
  });

  it("fails before publication when a protected legacy source changes (legacy_default_regression)", async () => {
    if (!env) return;
    const out = join(env.root, "out-legacy-regression");
    const marker = join(env.root, "marker-legacy-regression");
    let runMatchReads = 0;
    const mutatingFs: CanaryFileSystem = {
      ...defaultCanaryFs,
      readFile: async (path, encoding) => {
        const text = await defaultCanaryFs.readFile(path, encoding);
        const normalized = path.replaceAll("\\", "/");
        if (normalized.endsWith("src/app/run-match.ts")) {
          runMatchReads += 1;
          // First preflight hash read returns tampered bytes.
          if (runMatchReads === 1) {
            return `${text}\n// tampered protected source`;
          }
        }
        return text;
      },
    };
    await expect(
      harnessRun(
        { seed: 1, fighterA: "alpha", fighterB: "beta", acknowledgement: true },
        {
          outputRoot: out,
          fighterRoot: env.fighterRoot,
          governanceBundleDir: env.governanceDir,
          suspensionMarkerPath: marker,
        },
        { fs: mutatingFs },
      ),
    ).rejects.toThrow(/suspended/);
    expect(existsSync(marker)).toBe(true);
    expect(existsSync(join(out, BETA_TEST_MATCH_ID))).toBe(false);
  });

  it("fails before publication when the suspension marker appears during execution", async () => {
    if (!env) return;
    const out = join(env.root, "out-marker-race");
    const marker = join(env.root, "marker-race");
    let markerChecks = 0;
    const mutatingFs: CanaryFileSystem = {
      ...defaultCanaryFs,
      lstat: async (path) => {
        const normalized = path.replaceAll("\\", "/");
        if (normalized === marker.replaceAll("\\", "/")) {
          markerChecks += 1;
          // Checkpoint #3 (immediately before publication) sees the marker.
          if (markerChecks === 3) {
            await defaultCanaryFs.writeFile(marker, "appeared during execution", "utf-8");
          }
        }
        return defaultCanaryFs.lstat(path);
      },
    };
    await expect(
      harnessRun(
        { seed: 1, fighterA: "alpha", fighterB: "beta", acknowledgement: true },
        {
          outputRoot: out,
          fighterRoot: env.fighterRoot,
          governanceBundleDir: env.governanceDir,
          suspensionMarkerPath: marker,
        },
        { fs: mutatingFs },
      ),
    ).rejects.toThrow(/suspended/);
    expect(existsSync(marker)).toBe(true);
    expect(existsSync(join(out, BETA_TEST_MATCH_ID))).toBe(false);
  });

  it("never creates a real beta artifact or marker in official storage", async () => {
    if (!env) return;
    // The temp environment only ever wrote under the temp root.
    expect(env.root).toContain(tmpdir());
    expect(existsSync(join(env.root, "..", "data", "beta", "grid-matches"))).toBe(false);
  });

  // ── Phase 3G.1 pre-simulation race closure (Phases 1 and 15) ─────────────

  it("suspends with zero execution calls when the marker appears during the pre-simulation preflight", async () => {
    if (!env) return;
    const out = join(env.root, "out-race-marker-preflight");
    const marker = join(env.root, "marker-race-preflight");
    await mkdir(out);
    let executionCalls = 0;
    let createdMarker = false;
    const racingFs: CanaryFileSystem = {
      ...defaultCanaryFs,
      readFile: async (path, encoding) => {
        const text = await defaultCanaryFs.readFile(path, encoding);
        // During the protected-source preflight (a run-match.ts read), create
        // the suspension marker so the final pre-simulation marker check sees it.
        if (
          !createdMarker &&
          path.replaceAll("\\", "/").endsWith("src/app/run-match.ts")
        ) {
          createdMarker = true;
          await defaultCanaryFs.writeFileExclusive(
            marker,
            "appeared during preflight",
            "utf-8",
          );
        }
        return text;
      },
    };
    await expect(
      harnessRun(
        { seed: 1, fighterA: "alpha", fighterB: "beta", acknowledgement: true },
        {
          outputRoot: out,
          fighterRoot: env.fighterRoot,
          governanceBundleDir: env.governanceDir,
          suspensionMarkerPath: marker,
          onExecutionStart: () => {
            executionCalls += 1;
          },
        },
        { fs: racingFs },
      ),
    ).rejects.toThrow(/suspended/);
    expect(executionCalls).toBe(0);
    expect(existsSync(marker)).toBe(true);
    expect(existsSync(join(out, BETA_TEST_MATCH_ID))).toBe(false);
  });

  it("suspends with zero execution calls when governance changes during the pre-simulation preflight", async () => {
    if (!env) return;
    const out = join(env.root, "out-race-gov-preflight");
    const marker = join(env.root, "marker-race-gov-preflight");
    await mkdir(out);
    let executionCalls = 0;
    let tampered = false;
    const racingFs: CanaryFileSystem = {
      ...defaultCanaryFs,
      readFile: async (path, encoding) => {
        const text = await defaultCanaryFs.readFile(path, encoding);
        if (!tampered && path.replaceAll("\\", "/").endsWith("src/app/run-match.ts")) {
          tampered = true;
          // Tamper a governance artifact during the preflight; the re-read
          // immediately before simulation must detect it.
          const reportPath = join(env.governanceDir, "report.txt");
          const report = await defaultCanaryFs.readFile(reportPath, "utf-8");
          await defaultCanaryFs.writeFile(reportPath, `${report}\n// changed`, "utf-8");
        }
        return text;
      },
    };
    await expect(
      harnessRun(
        { seed: 1, fighterA: "alpha", fighterB: "beta", acknowledgement: true },
        {
          outputRoot: out,
          fighterRoot: env.fighterRoot,
          governanceBundleDir: env.governanceDir,
          suspensionMarkerPath: marker,
          onExecutionStart: () => {
            executionCalls += 1;
          },
        },
        { fs: racingFs },
      ),
    ).rejects.toThrow(/suspended/);
    expect(executionCalls).toBe(0);
    expect(existsSync(marker)).toBe(true);
    const markerText = await readFile(marker, "utf-8");
    const parsed = gridBetaSuspensionMarkerV1Schema.safeParse(JSON.parse(markerText));
    expect(parsed.success && parsed.data.trigger).toBe("governance_anchor_failure");
    expect(existsSync(join(out, BETA_TEST_MATCH_ID))).toBe(false);
    // Restore the temp governance bundle for later tests.
    const reportPath = join(env.governanceDir, "report.txt");
    const report = await defaultCanaryFs.readFile(reportPath, "utf-8");
    await defaultCanaryFs.writeFile(
      reportPath,
      report.replace("\n// changed", ""),
      "utf-8",
    );
  });

  // ── Phase 3G.1 pre-publication races through the final safety hook (Phase 2) ──

  it("publishes no final bundle when the marker appears during temporary artifact writing", async () => {
    if (!env) return;
    const out = join(env.root, "out-race-marker-write");
    const marker = join(env.root, "marker-race-write");
    await mkdir(out);
    let executionCalls = 0;
    let createdMarker = false;
    const racingFs: CanaryFileSystem = {
      ...defaultCanaryFs,
      writeFile: async (path, data, encoding) => {
        if (!createdMarker && path.includes(".tmp-")) {
          createdMarker = true;
          await defaultCanaryFs.writeFileExclusive(
            marker,
            "appeared during write",
            "utf-8",
          );
        }
        return defaultCanaryFs.writeFile(path, data, encoding);
      },
    };
    await expect(
      harnessRun(
        { seed: 1, fighterA: "alpha", fighterB: "beta", acknowledgement: true },
        {
          outputRoot: out,
          fighterRoot: env.fighterRoot,
          governanceBundleDir: env.governanceDir,
          suspensionMarkerPath: marker,
          onExecutionStart: () => {
            executionCalls += 1;
          },
        },
        { fs: racingFs },
      ),
    ).rejects.toThrow(/suspended/);
    // Simulation may already have completed, but no final bundle and no temp
    // directory may remain, and the marker is present. The observer counts
    // entry into the fixed execution core exactly once (it never replaces or
    // modifies the execution result).
    expect(executionCalls).toBe(1);
    expect(existsSync(join(out, BETA_TEST_MATCH_ID))).toBe(false);
    expect(existsSync(join(out, `.tmp-${BETA_TEST_MATCH_ID}`))).toBe(false);
    expect(existsSync(marker)).toBe(true);
  });

  it("suspends with governance_anchor_failure when governance changes during temporary artifact writing", async () => {
    if (!env) return;
    const out = join(env.root, "out-race-gov-write");
    const marker = join(env.root, "marker-race-gov-write");
    await mkdir(out);
    let tampered = false;
    const racingFs: CanaryFileSystem = {
      ...defaultCanaryFs,
      writeFile: async (path, data, encoding) => {
        if (!tampered && path.includes(".tmp-")) {
          tampered = true;
          const reportPath = join(env.governanceDir, "report.txt");
          const report = await defaultCanaryFs.readFile(reportPath, "utf-8");
          await defaultCanaryFs.writeFile(reportPath, `${report}\n// changed`, "utf-8");
        }
        return defaultCanaryFs.writeFile(path, data, encoding);
      },
    };
    await expect(
      harnessRun(
        { seed: 1, fighterA: "alpha", fighterB: "beta", acknowledgement: true },
        {
          outputRoot: out,
          fighterRoot: env.fighterRoot,
          governanceBundleDir: env.governanceDir,
          suspensionMarkerPath: marker,
        },
        { fs: racingFs },
      ),
    ).rejects.toThrow(/suspended/);
    expect(existsSync(join(out, BETA_TEST_MATCH_ID))).toBe(false);
    expect(existsSync(join(out, `.tmp-${BETA_TEST_MATCH_ID}`))).toBe(false);
    expect(existsSync(marker)).toBe(true);
    const markerText = await readFile(marker, "utf-8");
    const parsed = gridBetaSuspensionMarkerV1Schema.safeParse(JSON.parse(markerText));
    expect(parsed.success && parsed.data.trigger).toBe("governance_anchor_failure");
    const reportPath = join(env.governanceDir, "report.txt");
    const report = await defaultCanaryFs.readFile(reportPath, "utf-8");
    await defaultCanaryFs.writeFile(
      reportPath,
      report.replace("\n// changed", ""),
      "utf-8",
    );
  });

  it("suspends with legacy_default_regression when a protected source changes during temporary artifact writing", async () => {
    if (!env) return;
    const out = join(env.root, "out-race-source-write");
    const marker = join(env.root, "marker-race-source-write");
    await mkdir(out);
    let tamperSource = false;
    const racingFs: CanaryFileSystem = {
      ...defaultCanaryFs,
      readFile: async (path, encoding) => {
        const text = await defaultCanaryFs.readFile(path, encoding);
        if (tamperSource && path.replaceAll("\\", "/").endsWith("src/app/run-match.ts")) {
          return `${text}\n// tampered during publication`;
        }
        return text;
      },
      writeFile: async (path, data, encoding) => {
        if (path.includes(".tmp-")) {
          tamperSource = true;
        }
        return defaultCanaryFs.writeFile(path, data, encoding);
      },
    };
    await expect(
      harnessRun(
        { seed: 1, fighterA: "alpha", fighterB: "beta", acknowledgement: true },
        {
          outputRoot: out,
          fighterRoot: env.fighterRoot,
          governanceBundleDir: env.governanceDir,
          suspensionMarkerPath: marker,
        },
        { fs: racingFs },
      ),
    ).rejects.toThrow(/suspended/);
    expect(existsSync(join(out, BETA_TEST_MATCH_ID))).toBe(false);
    expect(existsSync(join(out, `.tmp-${BETA_TEST_MATCH_ID}`))).toBe(false);
    expect(existsSync(marker)).toBe(true);
    const markerText = await readFile(marker, "utf-8");
    const parsed = gridBetaSuspensionMarkerV1Schema.safeParse(JSON.parse(markerText));
    expect(parsed.success && parsed.data.trigger).toBe("legacy_default_regression");
  });

  // ── Phase 3G.1 governance inventory hardening (Phase 11) ─────────────────

  it("tolerates reordered governance directory listings (sorted exact match)", async () => {
    if (!env) return;
    const out = join(env.root, "out-gov-reordered");
    await mkdir(out);
    const reorderingFs: CanaryFileSystem = {
      ...defaultCanaryFs,
      readdir: async (path) => {
        const names = await defaultCanaryFs.readdir(path);
        if (path === env.governanceDir) return [...names].reverse();
        return names;
      },
    };
    const result = await harnessRun(
      { seed: 1, fighterA: "alpha", fighterB: "beta", acknowledgement: true },
      {
        outputRoot: out,
        fighterRoot: env.fighterRoot,
        governanceBundleDir: env.governanceDir,
        suspensionMarkerPath: join(env.root, "marker-gov-reordered"),
      },
      { fs: reorderingFs },
    );
    expect(result.matchId).toBe(BETA_TEST_MATCH_ID);
  });

  it("rejects a hidden extra governance file", async () => {
    if (!env) return;
    const out = join(env.root, "out-gov-hidden");
    const marker = join(env.root, "marker-gov-hidden");
    await mkdir(out);
    const extraFs: CanaryFileSystem = {
      ...defaultCanaryFs,
      readdir: async (path) => {
        const names = await defaultCanaryFs.readdir(path);
        if (path === env.governanceDir) return [...names, ".hidden"];
        return names;
      },
    };
    await expect(
      harnessRun(
        { seed: 1, fighterA: "alpha", fighterB: "beta", acknowledgement: true },
        {
          outputRoot: out,
          fighterRoot: env.fighterRoot,
          governanceBundleDir: env.governanceDir,
          suspensionMarkerPath: marker,
        },
        { fs: extraFs },
      ),
    ).rejects.toThrow(/suspended/);
    expect(existsSync(marker)).toBe(true);
  });

  it("rejects an extra governance directory entry", async () => {
    if (!env) return;
    const out = join(env.root, "out-gov-extra-dir");
    const marker = join(env.root, "marker-gov-extra-dir");
    await mkdir(out);
    const extraFs: CanaryFileSystem = {
      ...defaultCanaryFs,
      readdir: async (path) => {
        const names = await defaultCanaryFs.readdir(path);
        if (path === env.governanceDir) return [...names, "extra-dir"];
        return names;
      },
    };
    await expect(
      harnessRun(
        { seed: 1, fighterA: "alpha", fighterB: "beta", acknowledgement: true },
        {
          outputRoot: out,
          fighterRoot: env.fighterRoot,
          governanceBundleDir: env.governanceDir,
          suspensionMarkerPath: marker,
        },
        { fs: extraFs },
      ),
    ).rejects.toThrow(/suspended/);
    expect(existsSync(marker)).toBe(true);
  });

  it("rejects a governance artifact that is a symbolic link", async () => {
    if (!env) return;
    const out = join(env.root, "out-gov-symlink");
    const marker = join(env.root, "marker-gov-symlink");
    await mkdir(out);
    const symlinkFs: CanaryFileSystem = {
      ...defaultCanaryFs,
      lstat: async (path) => {
        const normalized = path.replaceAll("\\", "/");
        if (normalized.includes("governance") && normalized.endsWith("report.txt")) {
          return {
            isFile: () => false,
            isDirectory: () => false,
            isSymbolicLink: () => true,
          };
        }
        return defaultCanaryFs.lstat(path);
      },
    };
    await expect(
      harnessRun(
        { seed: 1, fighterA: "alpha", fighterB: "beta", acknowledgement: true },
        {
          outputRoot: out,
          fighterRoot: env.fighterRoot,
          governanceBundleDir: env.governanceDir,
          suspensionMarkerPath: marker,
        },
        { fs: symlinkFs },
      ),
    ).rejects.toThrow(/suspended/);
    expect(existsSync(marker)).toBe(true);
  });

  it("creates the suspension marker exactly once for a pre-publication safety failure", async () => {
    if (!env) return;
    const out = join(env.root, "out-marker-once");
    const marker = join(env.root, "marker-once");
    await mkdir(out);
    let markerWrites = 0;
    let tampered = false;
    const countingFs: CanaryFileSystem = {
      ...defaultCanaryFs,
      writeFileExclusive: async (path, data, encoding) => {
        if (path === marker) markerWrites += 1;
        return defaultCanaryFs.writeFileExclusive(path, data, encoding);
      },
      writeFile: async (path, data, encoding) => {
        // Tamper the temp governance report exactly once so the single
        // restore below leaves the shared temp bundle byte-identical.
        if (!tampered && path.includes(".tmp-")) {
          tampered = true;
          const reportPath = join(env.governanceDir, "report.txt");
          const report = await defaultCanaryFs.readFile(reportPath, "utf-8");
          await defaultCanaryFs.writeFile(reportPath, `${report}\n// changed`, "utf-8");
        }
        return defaultCanaryFs.writeFile(path, data, encoding);
      },
    };
    await expect(
      harnessRun(
        { seed: 1, fighterA: "alpha", fighterB: "beta", acknowledgement: true },
        {
          outputRoot: out,
          fighterRoot: env.fighterRoot,
          governanceBundleDir: env.governanceDir,
          suspensionMarkerPath: marker,
        },
        { fs: countingFs },
      ),
    ).rejects.toThrow(/suspended/);
    expect(markerWrites).toBe(1);
    expect(existsSync(marker)).toBe(true);
    const reportPath = join(env.governanceDir, "report.txt");
    const report = await defaultCanaryFs.readFile(reportPath, "utf-8");
    await defaultCanaryFs.writeFile(
      reportPath,
      report.replace("\n// changed", ""),
      "utf-8",
    );
  });
});

// ── Phase 3G.1.1 production fixed-boundary regression (Phase 1) ────────────

const PRODUCTION_SERVICE_SOURCE = readFileSync(
  join(__dirname, "..", "..", "src", "app", "grid-beta-match.ts"),
  "utf-8",
);

describe("grid beta production fixed boundary (Phase 3G.1.1 Phase 1)", () => {
  it("exposes no root override on the public match request", () => {
    const block = PRODUCTION_SERVICE_SOURCE.slice(
      PRODUCTION_SERVICE_SOURCE.indexOf("export interface GridBetaMatchRequest"),
      PRODUCTION_SERVICE_SOURCE.indexOf("export interface GridBetaMatchDependencies"),
    );
    expect(block).toContain("readonly seed");
    expect(block).toContain("readonly fighterA");
    expect(block).toContain("readonly fighterB");
    expect(block).toContain("readonly acknowledgement");
    expect(block).not.toContain("outputRoot");
    expect(block).not.toContain("fighterRoot");
    expect(block).not.toContain("governanceBundleDir");
    expect(block).not.toContain("suspensionMarkerPath");
  });

  it("exposes no execution replacement in the production dependency contract", () => {
    const block = PRODUCTION_SERVICE_SOURCE.slice(
      PRODUCTION_SERVICE_SOURCE.indexOf("export interface GridBetaMatchDependencies"),
      PRODUCTION_SERVICE_SOURCE.indexOf("export interface GridBetaMatchEnvironment"),
    );
    expect(block).not.toContain("execute?:");
    expect(block).not.toContain("readonly execute");
  });

  it("always uses the fixed canonical roots in the production entry point", () => {
    expect(PRODUCTION_SERVICE_SOURCE).toContain("GRID_OPT_IN_BETA_MATCH_OUTPUT_ROOT");
    expect(PRODUCTION_SERVICE_SOURCE).toContain("GRID_OPT_IN_BETA_FIGHTER_ROOT");
    expect(PRODUCTION_SERVICE_SOURCE).toContain("GRID_OPT_IN_BETA_GOVERNANCE_BUNDLE_DIR");
    expect(PRODUCTION_SERVICE_SOURCE).toContain(
      "GRID_OPT_IN_BETA_SUSPENSION_MARKER_PATH",
    );
    // The production entry point must never read a root override from the
    // request, so even programmatic production calls cannot redirect the
    // suspension marker, output root, fighter root or governance directory.
    expect(PRODUCTION_SERVICE_SOURCE).not.toMatch(/request\.outputRoot/);
    expect(PRODUCTION_SERVICE_SOURCE).not.toMatch(/request\.fighterRoot/);
    expect(PRODUCTION_SERVICE_SOURCE).not.toMatch(/request\.governanceBundleDir/);
    expect(PRODUCTION_SERVICE_SOURCE).not.toMatch(/request\.suspensionMarkerPath/);
    const runEntry = PRODUCTION_SERVICE_SOURCE.slice(
      PRODUCTION_SERVICE_SOURCE.indexOf("export async function runGridBetaMatch("),
    );
    expect(runEntry).toContain("outputRoot: GRID_OPT_IN_BETA_MATCH_OUTPUT_ROOT");
    expect(runEntry).toContain("fighterRoot: GRID_OPT_IN_BETA_FIGHTER_ROOT");
    expect(runEntry).toContain(
      "governanceBundleDir: GRID_OPT_IN_BETA_GOVERNANCE_BUNDLE_DIR",
    );
    expect(runEntry).toContain(
      "suspensionMarkerPath: GRID_OPT_IN_BETA_SUSPENSION_MARKER_PATH",
    );
  });

  it("always enters the fixed execution core and cannot provide an alternate execution result", () => {
    // No alternate result-producing simulator exists anywhere in the
    // production dependency contract or service flow.
    expect(PRODUCTION_SERVICE_SOURCE).not.toMatch(/dependencies\.execute/);
    expect(PRODUCTION_SERVICE_SOURCE).toMatch(/environment\.onExecutionStart\?\.\(\);/);
    // The one execution call site is the fixed imported executeGridBetaMatch.
    expect(PRODUCTION_SERVICE_SOURCE).toContain(
      "const execution = executeGridBetaMatch({",
    );
  });

  it("the harness observer counts exactly one entry into the real fixed execution core", async () => {
    if (!env) return;
    const out = join(env.root, "out-observer-once");
    const marker = join(env.root, "marker-observer-once");
    await mkdir(out);
    let executionStarts = 0;
    const result = await harnessRun(
      { seed: 1, fighterA: "alpha", fighterB: "beta", acknowledgement: true },
      {
        outputRoot: out,
        fighterRoot: env.fighterRoot,
        governanceBundleDir: env.governanceDir,
        suspensionMarkerPath: marker,
        onExecutionStart: () => {
          executionStarts += 1;
        },
      },
    );
    expect(executionStarts).toBe(1);
    expect(result.matchId).toBe(BETA_TEST_MATCH_ID);
    expect(existsSync(marker)).toBe(false);
  });
});
