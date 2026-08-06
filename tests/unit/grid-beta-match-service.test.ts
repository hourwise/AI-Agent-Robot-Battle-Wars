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
import { runGridBetaMatch } from "../../src/app/grid-beta-match.js";

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
      runGridBetaMatch(
        {
          seed: 1,
          fighterA: "alpha",
          fighterB: "beta",
          acknowledgement: false as never,
          outputRoot: env.outputRoot,
          fighterRoot: env.fighterRoot,
          governanceBundleDir: env.governanceDir,
          suspensionMarkerPath: marker,
        },
        deps(),
      ),
    ).rejects.toThrow(/acknowledgement/);
    expect(existsSync(marker)).toBe(false);
  });

  it("suspends (with marker) and publishes nothing when the governance bundle is absent", async () => {
    if (!env) return;
    const out = join(env.root, "out-absent-gov");
    const marker = join(env.root, "marker-absent-gov");
    await expect(
      runGridBetaMatch(
        {
          seed: 1,
          fighterA: "alpha",
          fighterB: "beta",
          acknowledgement: true,
          outputRoot: out,
          fighterRoot: env.fighterRoot,
          governanceBundleDir: join(env.root, "does-not-exist"),
          suspensionMarkerPath: marker,
        },
        deps(),
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
      runGridBetaMatch(
        {
          seed: 1,
          fighterA: "alpha",
          fighterB: "beta",
          acknowledgement: true,
          outputRoot: out,
          fighterRoot: env.fighterRoot,
          governanceBundleDir: govDir,
          suspensionMarkerPath: marker,
        },
        deps(),
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
      runGridBetaMatch(
        {
          seed: 1,
          fighterA: "alpha",
          fighterB: "beta",
          acknowledgement: true,
          outputRoot: out,
          fighterRoot: env.fighterRoot,
          governanceBundleDir: env.governanceDir,
          suspensionMarkerPath: marker,
        },
        deps({ sourceCommitReader: forgedReader }),
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
      runGridBetaMatch(
        {
          seed: 1,
          fighterA: "alpha",
          fighterB: "beta",
          acknowledgement: true,
          outputRoot: out,
          fighterRoot: env.fighterRoot,
          governanceBundleDir: env.governanceDir,
          suspensionMarkerPath: marker,
        },
        deps({ fs: mutatingFs }),
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
      runGridBetaMatch(
        {
          seed: 1,
          fighterA: "alpha",
          fighterB: "beta",
          acknowledgement: true,
          outputRoot: out,
          fighterRoot: env.fighterRoot,
          governanceBundleDir: env.governanceDir,
          suspensionMarkerPath: marker,
        },
        deps({ fs: mutatingFs }),
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
      runGridBetaMatch(
        {
          seed: 1,
          fighterA: "alpha",
          fighterB: "beta",
          acknowledgement: true,
          outputRoot: out,
          fighterRoot: env.fighterRoot,
          governanceBundleDir: env.governanceDir,
          suspensionMarkerPath: marker,
        },
        deps({ fs: mutatingFs }),
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
});
