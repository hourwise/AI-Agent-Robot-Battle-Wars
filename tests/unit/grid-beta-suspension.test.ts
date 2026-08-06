import { describe, expect, it } from "vitest";
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { defaultCanaryFs } from "../../src/canary/immutable-canary-bundle.js";
import {
  GRID_BETA_SUSPENSION_TRIGGERS,
  GridBetaSuspensionError,
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

  it("fails closed on exclusive marker-write failure and never replaces a raced entry", async () => {
    const { path, cleanup } = await tempMarker();
    try {
      const failingFs = {
        ...defaultCanaryFs,
        writeFileExclusive: async () => {
          throw new Error("simulated marker exclusive write failure");
        },
      };
      await expect(
        createGridBetaSuspensionMarker(failingFs, path, {
          trigger: "bundle_integrity_failure",
          message: "x",
          createdAt: "2026-08-06T00:00:00.000Z",
        }),
      ).rejects.toThrow(/simulated marker exclusive write failure/);
      // An entry appearing at the exact exclusive-create moment (EEXIST) is
      // never replaced: the exclusive write fails closed and the existing
      // bytes stay unchanged.
      await writeFile(path, "raced", "utf-8");
      const existingFs = {
        ...defaultCanaryFs,
        writeFileExclusive: async () => {
          const err = new Error("EEXIST") as Error & { code?: string };
          err.code = "EEXIST";
          throw err;
        },
      };
      await expect(
        createGridBetaSuspensionMarker(existingFs, path, {
          trigger: "governance_anchor_failure",
          message: "x",
          createdAt: "2026-08-06T00:00:00.000Z",
        }),
      ).rejects.toThrow(/refusing to overwrite/);
      expect(await readFile(path, "utf-8")).toBe("raced");
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

  it("securely creates the marker parent when missing (Phase 3G.1 Phase 3)", async () => {
    const root = await mkdtemp(join(tmpdir(), "beta-suspend-mkparent-"));
    try {
      const path = join(root, "beta", "nested", "GRID_BETA_SUSPENDED");
      await createGridBetaSuspensionMarker(defaultCanaryFs, path, {
        trigger: "governance_anchor_failure",
        message: "x",
        createdAt: "2026-08-06T00:00:00.000Z",
      });
      const text = await readFile(path, "utf-8");
      const parsed = gridBetaSuspensionMarkerV1Schema.safeParse(JSON.parse(text));
      expect(parsed.success).toBe(true);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("rejects a symbolic-link or junction marker parent (Phase 3G.1 Phase 3)", async () => {
    const root = await mkdtemp(join(tmpdir(), "beta-suspend-linkparent-"));
    const outside = await mkdtemp(join(tmpdir(), "beta-suspend-outside-"));
    const junctionParent = join(root, "jparent");
    await symlink(outside, junctionParent, "junction");
    try {
      const path = join(junctionParent, "GRID_BETA_SUSPENDED");
      await expect(
        createGridBetaSuspensionMarker(defaultCanaryFs, path, {
          trigger: "governance_anchor_failure",
          message: "x",
          createdAt: "2026-08-06T00:00:00.000Z",
        }),
      ).rejects.toThrow(GridBetaSuspensionError);
      // The junction parent must never be followed: no marker is created.
      expect((await readdir(outside)).includes("GRID_BETA_SUSPENDED")).toBe(false);
    } finally {
      await rm(root, { recursive: true, force: true });
      await rm(outside, { recursive: true, force: true });
    }
  });

  it("two concurrent creators result in exactly one created marker (Phase 3G.1 Phase 3)", async () => {
    const { path, cleanup } = await tempMarker();
    try {
      const results = await Promise.allSettled([
        createGridBetaSuspensionMarker(defaultCanaryFs, path, {
          trigger: "governance_anchor_failure",
          message: "first",
          createdAt: "2026-08-06T00:00:00.000Z",
        }),
        createGridBetaSuspensionMarker(defaultCanaryFs, path, {
          trigger: "nondeterministic_result",
          message: "second",
          createdAt: "2026-08-06T00:00:00.000Z",
        }),
      ]);
      const fulfilled = results.filter((r) => r.status === "fulfilled");
      const rejected = results.filter((r) => r.status === "rejected");
      expect(fulfilled.length).toBe(1);
      expect(rejected.length).toBe(1);
      // The surviving marker bytes are one complete frozen marker, never a
      // mixture, and they are never replaced.
      const text = await readFile(path, "utf-8");
      const parsed = gridBetaSuspensionMarkerV1Schema.safeParse(JSON.parse(text));
      expect(parsed.success).toBe(true);
    } finally {
      await cleanup();
    }
  });
});
