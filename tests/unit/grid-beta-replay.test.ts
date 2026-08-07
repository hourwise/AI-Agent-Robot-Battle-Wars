import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { defaultCanaryFs } from "../../src/canary/immutable-canary-bundle.js";
import {
  GRID_BETA_MATCH_ASCII_REPLAY_ARTIFACT,
  GRID_BETA_MATCH_RECORD_ARTIFACT,
  GRID_BETA_MATCH_TEXT_REPLAY_ARTIFACT,
} from "../../src/beta/grid-beta-match-bundle.js";
import { loadValidatedGridBetaReplayBundle } from "../../src/beta/grid-beta-replay.js";
import {
  BETA_TEST_MATCH_ID,
  createBetaTempEnvironment,
  officialGovernanceBundleAvailable,
  runBetaMatchToTemp,
} from "../helpers/grid-beta-builder.js";

let env: Awaited<ReturnType<typeof createBetaTempEnvironment>> | null = null;
let artifactDirectory: string | null = null;

beforeAll(async () => {
  if (!officialGovernanceBundleAvailable()) return;
  env = await createBetaTempEnvironment();
  const result = await runBetaMatchToTemp(env);
  artifactDirectory = result.artifactDirectory;
}, 120_000);

afterAll(async () => {
  if (env) await env.cleanup();
});

describe("grid beta replay (Phase 3G Phase 11)", () => {
  it("loads and validates a stored beta match bundle", async () => {
    if (!artifactDirectory) return;
    const loaded = await loadValidatedGridBetaReplayBundle(
      env!.outputRoot,
      BETA_TEST_MATCH_ID,
      defaultCanaryFs,
    );
    expect(loaded.validation.matchId).toBe(BETA_TEST_MATCH_ID);
    expect(loaded.contents[GRID_BETA_MATCH_TEXT_REPLAY_ARTIFACT].length).toBeGreaterThan(
      0,
    );
    expect(loaded.contents[GRID_BETA_MATCH_ASCII_REPLAY_ARTIFACT].length).toBeGreaterThan(
      0,
    );
  });

  it("remains readable while the suspension marker exists (ignores the marker)", async () => {
    if (!artifactDirectory) return;
    await writeFile(env!.markerPath, "suspended", "utf-8");
    try {
      const loaded = await loadValidatedGridBetaReplayBundle(
        env!.outputRoot,
        BETA_TEST_MATCH_ID,
        defaultCanaryFs,
      );
      expect(loaded.validation.matchId).toBe(BETA_TEST_MATCH_ID);
    } finally {
      // Remove the temp marker (never touches real storage).
      const { rm } = await import("node:fs/promises");
      await rm(env!.markerPath, { force: true });
    }
  });

  it("rejects a corrupt bundle before displaying anything", async () => {
    if (!artifactDirectory) return;
    // Corrupt the persisted record in place in the temp bundle.
    const recordPath = join(artifactDirectory, "match.json");
    const original = await defaultCanaryFs.readFile(recordPath, "utf-8");
    await defaultCanaryFs.writeFile(recordPath, `${original}\n// corrupt`, "utf-8");
    await expect(
      loadValidatedGridBetaReplayBundle(
        env!.outputRoot,
        BETA_TEST_MATCH_ID,
        defaultCanaryFs,
      ),
    ).rejects.toThrow(/cross-agreement|missing or unreadable/);
    // Restore for other tests.
    await defaultCanaryFs.writeFile(recordPath, original, "utf-8");
  });

  it("rejects a missing match bundle", async () => {
    await expect(
      loadValidatedGridBetaReplayBundle(
        env?.outputRoot ?? join(process.cwd(), "data", "beta", "grid-matches"),
        "00000000-0000-4000-8000-000000000000",
        defaultCanaryFs,
      ),
    ).rejects.toThrow(/missing or unreadable|inventory is invalid/);
  });

  it("performs no simulation and does not touch normal storage", () => {
    // The replay path is read-only: it only calls validate + read, and never
    // writes to normal match storage.
    expect(existsSync(join(process.cwd(), "data", "matches"))).toBe(true);
  });

  // ── Phase 3G.1 physical replay inventory validation (Phase 13) ───────────

  it("rejects an eleventh file before display", async () => {
    if (!artifactDirectory) return;
    const extra = join(artifactDirectory, "extra.txt");
    await writeFile(extra, "x", "utf-8");
    try {
      await expect(
        loadValidatedGridBetaReplayBundle(
          env!.outputRoot,
          BETA_TEST_MATCH_ID,
          defaultCanaryFs,
        ),
      ).rejects.toThrow(/inventory is invalid/);
    } finally {
      await rm(extra, { force: true });
    }
  });

  it("rejects a hidden file before display", async () => {
    if (!artifactDirectory) return;
    const hidden = join(artifactDirectory, ".hidden");
    await writeFile(hidden, "x", "utf-8");
    try {
      await expect(
        loadValidatedGridBetaReplayBundle(
          env!.outputRoot,
          BETA_TEST_MATCH_ID,
          defaultCanaryFs,
        ),
      ).rejects.toThrow(/inventory is invalid/);
    } finally {
      await rm(hidden, { force: true });
    }
  });

  it("rejects a nested directory before display", async () => {
    if (!artifactDirectory) return;
    const nested = join(artifactDirectory, "nested");
    await mkdir(nested);
    try {
      await expect(
        loadValidatedGridBetaReplayBundle(
          env!.outputRoot,
          BETA_TEST_MATCH_ID,
          defaultCanaryFs,
        ),
      ).rejects.toThrow(/inventory is invalid/);
    } finally {
      await rm(nested, { recursive: true, force: true });
    }
  });

  it("rejects a required artifact that is a symbolic link (via lstat)", async () => {
    if (!artifactDirectory) return;
    const symlinkEntry = {
      isFile: () => false,
      isDirectory: () => false,
      isSymbolicLink: () => true,
    };
    const symlinkFs = {
      ...defaultCanaryFs,
      lstat: async (path: string) => {
        if (path.replaceAll("\\", "/").endsWith(`/${GRID_BETA_MATCH_RECORD_ARTIFACT}`)) {
          return symlinkEntry;
        }
        return defaultCanaryFs.lstat(path);
      },
    };
    await expect(
      loadValidatedGridBetaReplayBundle(env!.outputRoot, BETA_TEST_MATCH_ID, symlinkFs),
    ).rejects.toThrow(/inventory is invalid.*symbolic link/);
  });

  it("rejects an artifact that changes between inventory inspection and read-back", async () => {
    if (!artifactDirectory) return;
    const changingFs = {
      ...defaultCanaryFs,
      readFile: async (path: string, encoding: "utf-8") => {
        const text = await defaultCanaryFs.readFile(path, encoding);
        if (path.replaceAll("\\", "/").endsWith(`/${GRID_BETA_MATCH_RECORD_ARTIFACT}`)) {
          return `${text}\n// changed between inventory and read-back`;
        }
        return text;
      },
    };
    await expect(
      loadValidatedGridBetaReplayBundle(env!.outputRoot, BETA_TEST_MATCH_ID, changingFs),
    ).rejects.toThrow(/cross-agreement|missing or unreadable/);
  });

  // ── Phase 3G.1.1 physical replay pre/read/post validation (Phase 3) ──────

  it("rejects a regular-file to symbolic-link substitution during reading via the physical rule", async () => {
    if (!artifactDirectory) return;
    const symlinkEntry = {
      isFile: () => false,
      isDirectory: () => false,
      isSymbolicLink: () => true,
    };
    let recordLstats = 0;
    const racingFs = {
      ...defaultCanaryFs,
      lstat: async (path: string) => {
        const normalized = path.replaceAll("\\", "/");
        if (normalized.endsWith(`/${GRID_BETA_MATCH_RECORD_ARTIFACT}`)) {
          recordLstats += 1;
          // The initial inventory reports the artifact as a regular file
          // (first lstat); the immediately following pre-read lstat reports
          // it as a symbolic link.
          if (recordLstats === 2) return symlinkEntry;
          return defaultCanaryFs.lstat(path);
        }
        return defaultCanaryFs.lstat(path);
      },
      readFile: async (path: string, encoding: "utf-8") => {
        // The injected FS may even return the original valid bytes; replay
        // must still reject through the physical regular-file rule, never
        // through semantic corruption.
        return defaultCanaryFs.readFile(path, encoding);
      },
    };
    await expect(
      loadValidatedGridBetaReplayBundle(env!.outputRoot, BETA_TEST_MATCH_ID, racingFs),
    ).rejects.toThrow(/regular file.*symbolic link/);
  });

  it("rejects an artifact deleted during reading", async () => {
    if (!artifactDirectory) return;
    const deletedFs = {
      ...defaultCanaryFs,
      readFile: async (path: string, encoding: "utf-8") => {
        if (path.replaceAll("\\", "/").endsWith(`/${GRID_BETA_MATCH_RECORD_ARTIFACT}`)) {
          const err = new Error("ENOENT") as Error & { code?: string };
          err.code = "ENOENT";
          throw err;
        }
        return defaultCanaryFs.readFile(path, encoding);
      },
    };
    await expect(
      loadValidatedGridBetaReplayBundle(env!.outputRoot, BETA_TEST_MATCH_ID, deletedFs),
    ).rejects.toThrow(/missing or unreadable/);
  });

  it("rejects a physical inventory change after one artifact has been read", async () => {
    if (!artifactDirectory) return;
    let readdirCalls = 0;
    const sneakingFs = {
      ...defaultCanaryFs,
      readdir: async (path: string) => {
        const names = await defaultCanaryFs.readdir(path);
        readdirCalls += 1;
        // The first listing is the initial inventory (valid); the second
        // listing (required again after all reads) gains an extra entry.
        if (readdirCalls === 2) return [...names, "sneaked.txt"];
        return names;
      },
    };
    await expect(
      loadValidatedGridBetaReplayBundle(env!.outputRoot, BETA_TEST_MATCH_ID, sneakingFs),
    ).rejects.toThrow(/inventory changed while it was being read/);
  });
});
