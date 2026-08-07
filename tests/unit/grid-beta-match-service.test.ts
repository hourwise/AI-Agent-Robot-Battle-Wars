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
import { GRID_OPT_IN_BETA_SUSPENSION_MARKER_PATH } from "../../src/beta/grid-beta-identity.js";
import {
  GRID_OPT_IN_BETA_GOVERNANCE_BUNDLE_DIR,
  runGridBetaMatch,
} from "../../src/app/grid-beta-match.js";
import {
  BETA_TEST_MATCH_ID,
  betaTempMappedPath,
  createBetaTempEnvironment,
  officialGovernanceBundleAvailable,
  readBetaBundle,
  runBetaMatchToTemp,
} from "../helpers/grid-beta-builder.js";
import { createGridBetaMappedFs } from "../helpers/grid-beta-mapped-fs.js";
import { buildDualCommitInMemorySourceReader } from "../helpers/grid-beta-successor-builder.js";

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
 * Phase 3G.1.2 test-only path-remapping filesystem: production
 * `runGridBetaMatch` always uses the frozen canonical beta paths and exposes
 * no alternate-root API, so tests inject a `CanaryFileSystem` that
 * transparently redirects those logical paths onto the external temporary
 * environment. The general injectable-filesystem seam is used, never a
 * beta-root selection API.
 */
function mappedFs(
  options: { out?: string; marker?: string; governanceDir?: string } = {},
): CanaryFileSystem {
  return createGridBetaMappedFs({
    fighterRoot: env!.fighterRoot,
    outputRoot: options.out ?? env!.outputRoot,
    governanceDir: options.governanceDir ?? env!.governanceDir,
    markerPath: options.marker ?? env!.markerPath,
  });
}

describe("grid beta match service (Phase 3G Phases 1, 8 and 12)", () => {
  it("publishes a validated ten-file beta match bundle to a temp output root", async () => {
    if (!env) return;
    const result = await runBetaMatchToTemp(env);
    expect(result.matchId).toBe(BETA_TEST_MATCH_ID);
    expect(result.winner).not.toBeUndefined();
    expect(result.rounds).toBeGreaterThan(0);
    // The production service reports the canonical logical artifact directory;
    // tests translate it back onto the temporary environment to read files.
    const artifactDir = betaTempMappedPath(env, result.artifactDirectory);
    const files = (await readdir(artifactDir)).sort();
    expect(files).toEqual([...GRID_BETA_MATCH_BUNDLE_ENTRIES].sort());
    const contents = await readBetaBundle(artifactDir);
    expect(() => validateGridBetaMatchBundle(contents)).not.toThrow();
    expect(existsSync(env.markerPath)).toBe(false);
  });

  it("requires the explicit acknowledgement before any match activity (no suspension marker)", async () => {
    if (!env) return;
    const marker = join(env.root, "marker-ack");
    await expect(
      runGridBetaMatch(
        { seed: 1, fighterA: "alpha", fighterB: "beta", acknowledgement: false as never },
        deps({ fs: mappedFs({ marker }) }),
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
        { seed: 1, fighterA: "alpha", fighterB: "beta", acknowledgement: true },
        deps({
          fs: mappedFs({ out, marker, governanceDir: join(env.root, "does-not-exist") }),
        }),
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
        { seed: 1, fighterA: "alpha", fighterB: "beta", acknowledgement: true },
        deps({ fs: mappedFs({ out, marker, governanceDir: govDir }) }),
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
    const forgedReader = await buildDualCommitInMemorySourceReader({
      v1: {
        "src/simulator/constants.ts":
          'export const SIMULATOR_VERSION = "0.3.0" as const;\nexport const RULESET_VERSION = "0.2.0" as const;\n',
      },
    });
    const out = join(env.root, "out-forged-source");
    const marker = join(env.root, "marker-forged-source");
    await expect(
      runGridBetaMatch(
        { seed: 1, fighterA: "alpha", fighterB: "beta", acknowledgement: true },
        deps({ fs: mappedFs({ out, marker }), sourceCommitReader: forgedReader }),
      ),
    ).rejects.toThrow(/suspended/);
    expect(existsSync(marker)).toBe(true);
  });

  it("fails before publication when governance bytes change after anchoring (race before simulation)", async () => {
    if (!env) return;
    const out = join(env.root, "out-gov-race-sim");
    const marker = join(env.root, "marker-gov-race-sim");
    await mkdir(out);
    let governanceReads = 0;
    const fs = mappedFs({ out, marker });
    const mutatingFs: CanaryFileSystem = {
      ...fs,
      readFile: async (path, encoding) => {
        const text = await fs.readFile(path, encoding);
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
        { seed: 1, fighterA: "alpha", fighterB: "beta", acknowledgement: true },
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
    await mkdir(out);
    let runMatchReads = 0;
    const fs = mappedFs({ out, marker });
    const mutatingFs: CanaryFileSystem = {
      ...fs,
      readFile: async (path, encoding) => {
        const text = await fs.readFile(path, encoding);
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
        { seed: 1, fighterA: "alpha", fighterB: "beta", acknowledgement: true },
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
    await mkdir(out);
    let markerChecks = 0;
    const fs = mappedFs({ out, marker });
    const mutatingFs: CanaryFileSystem = {
      ...fs,
      lstat: async (path) => {
        const normalized = path.replaceAll("\\", "/");
        if (
          normalized === GRID_OPT_IN_BETA_SUSPENSION_MARKER_PATH.replaceAll("\\", "/")
        ) {
          markerChecks += 1;
          // Checkpoint #3 (immediately before publication) sees the marker.
          if (markerChecks === 3) {
            await defaultCanaryFs.writeFile(marker, "appeared during execution", "utf-8");
          }
        }
        return fs.lstat(path);
      },
    };
    await expect(
      runGridBetaMatch(
        { seed: 1, fighterA: "alpha", fighterB: "beta", acknowledgement: true },
        deps({ fs: mutatingFs }),
      ),
    ).rejects.toThrow(/suspended/);
    expect(existsSync(marker)).toBe(true);
    expect(existsSync(join(out, BETA_TEST_MATCH_ID))).toBe(false);
  });

  it("never creates a real beta artifact or marker in official storage", async () => {
    if (!env) return;
    // The temp environment only ever wrote under the temp root. Real
    // `data/beta` may legitimately contain prior operational smoke-run
    // artifacts (e.g. GRID-BETA-001), so the test proves it never leaked its
    // own test match ID or any marker into real beta storage.
    expect(env.root).toContain(tmpdir());
    expect(existsSync(join(env.root, "..", "data", "beta", "grid-matches"))).toBe(false);
    expect(
      existsSync(join(process.cwd(), "data", "beta", "grid-matches", BETA_TEST_MATCH_ID)),
    ).toBe(false);
    expect(existsSync(join(process.cwd(), "data", "beta", "GRID_BETA_SUSPENDED"))).toBe(
      false,
    );
  });

  // ── Phase 3G.1 pre-simulation race closure (Phases 1 and 15) ─────────────

  it("suspends with zero execution calls when the marker appears during the pre-simulation preflight", async () => {
    if (!env) return;
    const out = join(env.root, "out-race-marker-preflight");
    const marker = join(env.root, "marker-race-preflight");
    await mkdir(out);
    let executionCalls = 0;
    let createdMarker = false;
    const fs = mappedFs({ out, marker });
    const racingFs: CanaryFileSystem = {
      ...fs,
      readFile: async (path, encoding) => {
        const text = await fs.readFile(path, encoding);
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
      runGridBetaMatch(
        { seed: 1, fighterA: "alpha", fighterB: "beta", acknowledgement: true },
        deps({
          fs: racingFs,
          onExecutionStart: () => {
            executionCalls += 1;
          },
        }),
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
    const fs = mappedFs({ out, marker });
    const racingFs: CanaryFileSystem = {
      ...fs,
      readFile: async (path, encoding) => {
        const text = await fs.readFile(path, encoding);
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
      runGridBetaMatch(
        { seed: 1, fighterA: "alpha", fighterB: "beta", acknowledgement: true },
        deps({
          fs: racingFs,
          onExecutionStart: () => {
            executionCalls += 1;
          },
        }),
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
    const fs = mappedFs({ out, marker });
    const racingFs: CanaryFileSystem = {
      ...fs,
      writeFile: async (path, data, encoding) => {
        if (!createdMarker && path.includes(".tmp-")) {
          createdMarker = true;
          await defaultCanaryFs.writeFileExclusive(
            marker,
            "appeared during write",
            "utf-8",
          );
        }
        return fs.writeFile(path, data, encoding);
      },
    };
    await expect(
      runGridBetaMatch(
        { seed: 1, fighterA: "alpha", fighterB: "beta", acknowledgement: true },
        deps({
          fs: racingFs,
          onExecutionStart: () => {
            executionCalls += 1;
          },
        }),
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
    const fs = mappedFs({ out, marker });
    const racingFs: CanaryFileSystem = {
      ...fs,
      writeFile: async (path, data, encoding) => {
        if (!tampered && path.includes(".tmp-")) {
          tampered = true;
          const reportPath = join(env.governanceDir, "report.txt");
          const report = await defaultCanaryFs.readFile(reportPath, "utf-8");
          await defaultCanaryFs.writeFile(reportPath, `${report}\n// changed`, "utf-8");
        }
        return fs.writeFile(path, data, encoding);
      },
    };
    await expect(
      runGridBetaMatch(
        { seed: 1, fighterA: "alpha", fighterB: "beta", acknowledgement: true },
        deps({ fs: racingFs }),
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
    const fs = mappedFs({ out, marker });
    const racingFs: CanaryFileSystem = {
      ...fs,
      readFile: async (path, encoding) => {
        const text = await fs.readFile(path, encoding);
        if (tamperSource && path.replaceAll("\\", "/").endsWith("src/app/run-match.ts")) {
          return `${text}\n// tampered during publication`;
        }
        return text;
      },
      writeFile: async (path, data, encoding) => {
        if (path.includes(".tmp-")) {
          tamperSource = true;
        }
        return fs.writeFile(path, data, encoding);
      },
    };
    await expect(
      runGridBetaMatch(
        { seed: 1, fighterA: "alpha", fighterB: "beta", acknowledgement: true },
        deps({ fs: racingFs }),
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
    const marker = join(env.root, "marker-gov-reordered");
    await mkdir(out);
    const fs = mappedFs({ out, marker });
    const reorderingFs: CanaryFileSystem = {
      ...fs,
      readdir: async (path) => {
        const names = await fs.readdir(path);
        if (path === GRID_OPT_IN_BETA_GOVERNANCE_BUNDLE_DIR) return [...names].reverse();
        return names;
      },
    };
    const result = await runGridBetaMatch(
      { seed: 1, fighterA: "alpha", fighterB: "beta", acknowledgement: true },
      deps({ fs: reorderingFs }),
    );
    expect(result.matchId).toBe(BETA_TEST_MATCH_ID);
  });

  it("rejects a hidden extra governance file", async () => {
    if (!env) return;
    const out = join(env.root, "out-gov-hidden");
    const marker = join(env.root, "marker-gov-hidden");
    await mkdir(out);
    const fs = mappedFs({ out, marker });
    const extraFs: CanaryFileSystem = {
      ...fs,
      readdir: async (path) => {
        const names = await fs.readdir(path);
        if (path === GRID_OPT_IN_BETA_GOVERNANCE_BUNDLE_DIR) return [...names, ".hidden"];
        return names;
      },
    };
    await expect(
      runGridBetaMatch(
        { seed: 1, fighterA: "alpha", fighterB: "beta", acknowledgement: true },
        deps({ fs: extraFs }),
      ),
    ).rejects.toThrow(/suspended/);
    expect(existsSync(marker)).toBe(true);
  });

  it("rejects an extra governance directory entry", async () => {
    if (!env) return;
    const out = join(env.root, "out-gov-extra-dir");
    const marker = join(env.root, "marker-gov-extra-dir");
    await mkdir(out);
    const fs = mappedFs({ out, marker });
    const extraFs: CanaryFileSystem = {
      ...fs,
      readdir: async (path) => {
        const names = await fs.readdir(path);
        if (path === GRID_OPT_IN_BETA_GOVERNANCE_BUNDLE_DIR)
          return [...names, "extra-dir"];
        return names;
      },
    };
    await expect(
      runGridBetaMatch(
        { seed: 1, fighterA: "alpha", fighterB: "beta", acknowledgement: true },
        deps({ fs: extraFs }),
      ),
    ).rejects.toThrow(/suspended/);
    expect(existsSync(marker)).toBe(true);
  });

  it("rejects a governance artifact that is a symbolic link", async () => {
    if (!env) return;
    const out = join(env.root, "out-gov-symlink");
    const marker = join(env.root, "marker-gov-symlink");
    await mkdir(out);
    const fs = mappedFs({ out, marker });
    const symlinkFs: CanaryFileSystem = {
      ...fs,
      lstat: async (path) => {
        const normalized = path.replaceAll("\\", "/");
        if (normalized.includes("governance") && normalized.endsWith("report.txt")) {
          return {
            isFile: () => false,
            isDirectory: () => false,
            isSymbolicLink: () => true,
          };
        }
        return fs.lstat(path);
      },
    };
    await expect(
      runGridBetaMatch(
        { seed: 1, fighterA: "alpha", fighterB: "beta", acknowledgement: true },
        deps({ fs: symlinkFs }),
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
    const fs = mappedFs({ out, marker });
    const countingFs: CanaryFileSystem = {
      ...fs,
      writeFileExclusive: async (path, data, encoding) => {
        if (path === GRID_OPT_IN_BETA_SUSPENSION_MARKER_PATH) markerWrites += 1;
        return fs.writeFileExclusive(path, data, encoding);
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
        return fs.writeFile(path, data, encoding);
      },
    };
    await expect(
      runGridBetaMatch(
        { seed: 1, fighterA: "alpha", fighterB: "beta", acknowledgement: true },
        deps({ fs: countingFs }),
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

// ── Phase 3G.1.2 production API boundary regression (Phase 4) ──────────────

const PRODUCTION_SERVICE_SOURCE = readFileSync(
  join(__dirname, "..", "..", "src", "app", "grid-beta-match.ts"),
  "utf-8",
);

describe("grid beta production API boundary (Phase 3G.1.2 Phase 4)", () => {
  it("does not export any alternate-root environment runner or environment type", () => {
    expect(PRODUCTION_SERVICE_SOURCE).not.toContain("runGridBetaMatchWithEnvironment");
    expect(PRODUCTION_SERVICE_SOURCE).not.toContain("GridBetaMatchEnvironment");
  });

  it("exposes no exported function or interface containing alternate beta roots", () => {
    // The only exported match operation is runGridBetaMatch(request, dependencies?).
    expect(PRODUCTION_SERVICE_SOURCE).toContain(
      "export async function runGridBetaMatch(",
    );
    const requestBlock = PRODUCTION_SERVICE_SOURCE.slice(
      PRODUCTION_SERVICE_SOURCE.indexOf("export interface GridBetaMatchRequest"),
      PRODUCTION_SERVICE_SOURCE.indexOf("export interface GridBetaMatchDependencies"),
    );
    expect(requestBlock).toContain("readonly seed");
    expect(requestBlock).toContain("readonly fighterA");
    expect(requestBlock).toContain("readonly fighterB");
    expect(requestBlock).toContain("readonly acknowledgement");
    expect(requestBlock).not.toContain("outputRoot");
    expect(requestBlock).not.toContain("fighterRoot");
    expect(requestBlock).not.toContain("governanceBundleDir");
    expect(requestBlock).not.toContain("suspensionMarkerPath");
  });

  it("keeps the production dependency contract free of root selection and execution replacement", () => {
    const depsBlock = PRODUCTION_SERVICE_SOURCE.slice(
      PRODUCTION_SERVICE_SOURCE.indexOf("export interface GridBetaMatchDependencies"),
      PRODUCTION_SERVICE_SOURCE.indexOf("export interface GridBetaMatchResult"),
    );
    expect(depsBlock).not.toContain("outputRoot");
    expect(depsBlock).not.toContain("fighterRoot");
    expect(depsBlock).not.toContain("governanceBundleDir");
    expect(depsBlock).not.toContain("suspensionMarkerPath");
    expect(depsBlock).not.toContain("execute?:");
    expect(depsBlock).not.toContain("readonly execute");
    // The only execution observation is a non-result-producing entry observer.
    expect(depsBlock).toContain("onExecutionStart?:");
  });

  it("runGridBetaMatch directly supplies the four canonical constants and only the fixed execution core", () => {
    const runEntry = PRODUCTION_SERVICE_SOURCE.slice(
      PRODUCTION_SERVICE_SOURCE.indexOf("export async function runGridBetaMatch("),
    );
    expect(runEntry).toContain("const outputRoot = GRID_OPT_IN_BETA_MATCH_OUTPUT_ROOT");
    expect(runEntry).toContain("const fighterRoot = GRID_OPT_IN_BETA_FIGHTER_ROOT");
    expect(runEntry).toContain(
      "const governanceDir = GRID_OPT_IN_BETA_GOVERNANCE_BUNDLE_DIR",
    );
    expect(runEntry).toContain(
      "const markerPath = GRID_OPT_IN_BETA_SUSPENSION_MARKER_PATH",
    );
    // Even a programmatic production call cannot redirect the roots or supply
    // an alternate execution result.
    expect(runEntry).not.toMatch(
      /request\.outputRoot|request\.fighterRoot|request\.governanceBundleDir|request\.suspensionMarkerPath/,
    );
    expect(runEntry).not.toContain("dependencies.execute");
    expect(runEntry).toContain("const execution = executeGridBetaMatch({");
    // The observer is invoked immediately before the fixed execution call.
    expect(runEntry).toMatch(/dependencies\.onExecutionStart\?\.\(\);/);
  });
});

// ── Phase 3G.1.2 runtime regression through the real entry point (Phase 5) ─

describe("grid beta runtime through runGridBetaMatch (Phase 3G.1.2 Phase 5)", () => {
  it("executes the complete beta path via production runGridBetaMatch and the mapped filesystem", async () => {
    if (!env) return;
    const out = join(env.root, "out-logical-paths");
    const marker = join(env.root, "marker-logical-paths");
    await mkdir(out);
    let executionStarts = 0;
    const requested: string[] = [];
    const fs = mappedFs({ out, marker });
    const recordingFs: CanaryFileSystem = {
      ...fs,
      readFile: async (path, encoding) => {
        requested.push(path.replaceAll("\\", "/"));
        return fs.readFile(path, encoding);
      },
    };
    const result = await runGridBetaMatch(
      { seed: 1, fighterA: "alpha", fighterB: "beta", acknowledgement: true },
      deps({
        fs: recordingFs,
        onExecutionStart: () => {
          executionStarts += 1;
        },
      }),
    );
    expect(executionStarts).toBe(1);
    expect(result.matchId).toBe(BETA_TEST_MATCH_ID);
    // A valid ten-file temporary bundle was published through the mapped root.
    expect(existsSync(join(out, BETA_TEST_MATCH_ID))).toBe(true);
    const files = (await readdir(join(out, BETA_TEST_MATCH_ID))).sort();
    expect(files).toEqual([...GRID_BETA_MATCH_BUNDLE_ENTRIES].sort());
    // Logical canonical beta paths were requested; never any temp path.
    expect(requested.some((p) => p.includes("data/beta/grid-fighters"))).toBe(true);
    expect(requested.some((p) => p.includes("data/readiness/grid-governance"))).toBe(
      true,
    );
    expect(requested.every((p) => !p.includes(env!.root.replaceAll("\\", "/")))).toBe(
      true,
    );
    // No real beta tree, marker or test match was created by this run. Real
    // `data/beta` may legitimately contain prior operational smoke-run
    // artifacts, so the assertion is scoped to the test match ID and marker.
    expect(existsSync(marker)).toBe(false);
    expect(
      existsSync(join(process.cwd(), "data", "beta", "grid-matches", BETA_TEST_MATCH_ID)),
    ).toBe(false);
    expect(existsSync(join(process.cwd(), "data", "beta", "GRID_BETA_SUSPENDED"))).toBe(
      false,
    );
  });
});
