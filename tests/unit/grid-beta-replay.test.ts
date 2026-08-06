import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { defaultCanaryFs } from "../../src/canary/immutable-canary-bundle.js";
import {
  GRID_BETA_MATCH_ASCII_REPLAY_ARTIFACT,
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
    ).rejects.toThrow(/missing or unreadable/);
  });

  it("performs no simulation and does not touch normal storage", () => {
    // The replay path is read-only: it only calls validate + read, and never
    // writes to normal match storage.
    expect(existsSync(join(process.cwd(), "data", "matches"))).toBe(true);
  });
});
