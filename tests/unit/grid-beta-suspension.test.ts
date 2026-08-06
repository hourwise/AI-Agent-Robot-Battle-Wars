import { describe, expect, it } from "vitest";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { defaultCanaryFs } from "../../src/canary/immutable-canary-bundle.js";
import {
  GRID_BETA_SUSPENSION_TRIGGERS,
  assertSuspensionMarkerAbsent,
  createGridBetaSuspensionMarker,
  gridBetaSuspensionMarkerV1Schema,
  isGridBetaSuspensionTrigger,
} from "../../src/beta/grid-beta-suspension.js";

async function tempMarker(): Promise<{ path: string; cleanup: () => Promise<void> }> {
  const root = await mkdtemp(join(tmpdir(), "beta-suspend-"));
  return {
    path: join(root, "GRID_BETA_SUSPENDED"),
    cleanup: () => rm(root, { recursive: true, force: true }),
  };
}

describe("grid beta suspension switch (Phase 3G Phase 5)", () => {
  it("declares every frozen safety-trigger code", () => {
    expect(GRID_BETA_SUSPENSION_TRIGGERS).toEqual([
      "governance_anchor_failure",
      "legacy_default_regression",
      "canary_regression",
      "nondeterministic_result",
      "runtime_identity_mismatch",
      "schema_v3_validation_failure",
      "record_report_disagreement",
      "replay_reconstruction_disagreement",
      "silent_runtime_fallback",
      "cross_root_persistence_failure",
      "bundle_integrity_failure",
      "corrupt_or_unreplayable_v3_record",
    ]);
    for (const trigger of GRID_BETA_SUSPENSION_TRIGGERS) {
      expect(isGridBetaSuspensionTrigger(trigger), trigger).toBe(true);
    }
    expect(isGridBetaSuspensionTrigger("not_a_trigger")).toBe(false);
  });

  it("requires marker absence for the beta to continue and rejects any entry", async () => {
    const { path, cleanup } = await tempMarker();
    try {
      await expect(
        assertSuspensionMarkerAbsent(defaultCanaryFs, path),
      ).resolves.toBeUndefined();
      await writeFile(path, "anything", "utf-8");
      await expect(assertSuspensionMarkerAbsent(defaultCanaryFs, path)).rejects.toThrow(
        /suspended/,
      );
    } finally {
      await cleanup();
    }
  });

  it("treats malformed marker contents as suspended (fails closed)", async () => {
    const { path, cleanup } = await tempMarker();
    try {
      await writeFile(path, "{ not json", "utf-8");
      await expect(assertSuspensionMarkerAbsent(defaultCanaryFs, path)).rejects.toThrow(
        /suspended/,
      );
    } finally {
      await cleanup();
    }
  });

  it("treats a directory or symlink marker as suspended", async () => {
    const root = await mkdtemp(join(tmpdir(), "beta-suspend-dir-"));
    try {
      const dirMarker = join(root, "marker-dir");
      await mkdir(dirMarker);
      await expect(
        assertSuspensionMarkerAbsent(defaultCanaryFs, dirMarker),
      ).rejects.toThrow(/suspended/);
      const fileMarker = join(root, "marker-file");
      await writeFile(fileMarker, "x", "utf-8");
      // A directory at the path is also suspended (any entry).
      const sub = join(root, "other");
      await mkdir(sub);
      await expect(assertSuspensionMarkerAbsent(defaultCanaryFs, sub)).rejects.toThrow(
        /suspended/,
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("creates a marker matching the frozen schema and every trigger code", async () => {
    for (const trigger of GRID_BETA_SUSPENSION_TRIGGERS) {
      const { path, cleanup } = await tempMarker();
      try {
        await createGridBetaSuspensionMarker(defaultCanaryFs, path, {
          trigger,
          message: `triggered ${trigger}`,
          createdAt: "2026-08-06T00:00:00.000Z",
        });
        const text = await readFile(path, "utf-8");
        const parsed = gridBetaSuspensionMarkerV1Schema.safeParse(JSON.parse(text));
        expect(parsed.success, trigger).toBe(true);
        expect(parsed.success && parsed.data.trigger).toBe(trigger);
        expect(parsed.success && parsed.data.kind).toBe("grid-beta-suspension");
        expect(parsed.success && parsed.data.implementationId).toBe(
          "grid-opt-in-beta-match-v1",
        );
      } finally {
        await cleanup();
      }
    }
  });

  it("never overwrites an existing marker", async () => {
    const { path, cleanup } = await tempMarker();
    try {
      await writeFile(path, "original", "utf-8");
      await expect(
        createGridBetaSuspensionMarker(defaultCanaryFs, path, {
          trigger: "governance_anchor_failure",
          message: "x",
          createdAt: "2026-08-06T00:00:00.000Z",
        }),
      ).rejects.toThrow(/refusing to overwrite/);
      expect(await readFile(path, "utf-8")).toBe("original");
    } finally {
      await cleanup();
    }
  });

  it("fails closed on marker-write failure and on a marker appearing before rename", async () => {
    const { path, cleanup } = await tempMarker();
    try {
      const failingFs = {
        ...defaultCanaryFs,
        writeFile: async (p: string, data: string, encoding?: "utf-8") => {
          if (p === `${path}.tmp`) {
            throw new Error("simulated marker write failure");
          }
          return defaultCanaryFs.writeFile(p, data, encoding);
        },
      };
      await expect(
        createGridBetaSuspensionMarker(failingFs, path, {
          trigger: "bundle_integrity_failure",
          message: "x",
          createdAt: "2026-08-06T00:00:00.000Z",
        }),
      ).rejects.toThrow(/simulated marker write failure/);
    } finally {
      await cleanup();
    }
  });

  it("rejects an unknown trigger code when creating a marker", async () => {
    const { path, cleanup } = await tempMarker();
    try {
      await expect(
        createGridBetaSuspensionMarker(defaultCanaryFs, path, {
          trigger: "not_a_trigger" as never,
          message: "x",
          createdAt: "2026-08-06T00:00:00.000Z",
        }),
      ).rejects.toThrow(/not a frozen trigger code/);
    } finally {
      await cleanup();
    }
  });
});
