import { afterEach, describe, expect, it } from "vitest";
import {
  access,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rename,
  rm,
  symlink,
  unlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  runGridMatchCanary,
  type CanaryFileSystem,
} from "../../src/app/grid-match-canary.js";

const FIXED_CANARY_ID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";

const tempRoots: string[] = [];

async function makeTempRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "canary-fs-"));
  tempRoots.push(root);
  return root;
}

afterEach(async () => {
  for (const root of tempRoots.splice(0)) {
    await rm(root, { recursive: true, force: true });
  }
});

interface FakeFsHooks {
  onWriteFile?: (path: string, data: string) => void;
  failWriteAt?: (path: string) => boolean;
  failRenameAt?: (from: string, to: string) => boolean;
  failMkdirTmp?: (path: string) => boolean;
  corruptReadAt?: (path: string) => boolean;
  /** Returns replacement content for a read-back path, or undefined to passthrough. */
  transformReadAt?: (path: string, content: string) => string | undefined;
  /** Runs after each write; used to inject or remove entries in the tmp dir. */
  afterWriteFile?: (path: string, data: string) => Promise<void> | void;
  /** Runs after the temporary → final rename; used to inject final entries. */
  afterRename?: (from: string, to: string) => Promise<void> | void;
  /** Runs just before a simulated rename failure; used to race a final entry in. */
  onRenameFail?: (from: string, to: string) => Promise<void> | void;
}

/** Real filesystem with injectable failure hooks for the canary bundle. */
function makeFakeFs(hooks: FakeFsHooks): CanaryFileSystem {
  return {
    mkdir: async (path, options) => {
      if (hooks.failMkdirTmp && hooks.failMkdirTmp(path)) {
        const err = new Error(`simulated EEXIST for ${path}`) as Error & {
          code?: string;
        };
        err.code = "EEXIST";
        throw err;
      }
      await mkdir(path, options);
    },
    writeFile: async (path, data, encoding) => {
      if (hooks.onWriteFile) hooks.onWriteFile(path, data);
      if (hooks.failWriteAt && hooks.failWriteAt(path)) {
        throw new Error(`simulated write failure: ${path}`);
      }
      await writeFile(path, data, encoding);
      if (hooks.afterWriteFile) await hooks.afterWriteFile(path, data);
    },
    readFile: async (path, encoding) => {
      if (hooks.transformReadAt) {
        const transformed = hooks.transformReadAt(path, await readFile(path, encoding));
        if (transformed !== undefined) return transformed;
      }
      if (hooks.corruptReadAt && hooks.corruptReadAt(path)) {
        return "{ corrupted json";
      }
      return readFile(path, encoding);
    },
    readdir: async (path) => readdir(path),
    lstat: async (path) => lstat(path),
    rename: async (from, to) => {
      if (hooks.failRenameAt && hooks.failRenameAt(from, to)) {
        if (hooks.onRenameFail) await hooks.onRenameFail(from, to);
        throw new Error(`simulated rename failure: ${from} -> ${to}`);
      }
      await rename(from, to);
      if (hooks.afterRename) await hooks.afterRename(from, to);
    },
    rm: async (path, options) => {
      await rm(path, options);
    },
  };
}

const deps = (fs: CanaryFileSystem) => ({
  createUuid: () => FIXED_CANARY_ID,
  fs,
});

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

describe("grid match canary atomic bundle (Phase 3D2A)", () => {
  it("publishes a complete seven-artifact bundle", async () => {
    const root = await makeTempRoot();
    const fs = makeFakeFs({});
    const outcome = await runGridMatchCanary({ seed: 3, outputRoot: root }, deps(fs));

    const dir = join(root, FIXED_CANARY_ID);
    const files = (await readdir(dir)).sort();
    expect(files).toEqual([
      "ascii-replay.txt",
      "factual-report.json",
      "fallback-review.json",
      "manifest.json",
      "match.json",
      "review-prompt.txt",
      "text-replay.txt",
    ]);

    // No leftover temporary directory.
    expect(await pathExists(join(root, `.tmp-${FIXED_CANARY_ID}`))).toBe(false);
    // No sibling directories.
    expect((await readdir(root)).filter((f) => f !== FIXED_CANARY_ID)).toEqual([]);
    expect(outcome.artifactDirectory).toBe(dir);
  });

  it("read-backs and revalidates every machine-readable artifact", async () => {
    const root = await makeTempRoot();
    const fs = makeFakeFs({});
    const outcome = await runGridMatchCanary({ seed: 3, outputRoot: root }, deps(fs));
    const dir = join(root, FIXED_CANARY_ID);

    for (const name of [
      "match.json",
      "factual-report.json",
      "fallback-review.json",
      "manifest.json",
    ]) {
      const content = await readFile(join(dir, name), "utf-8");
      expect(() => JSON.parse(content)).not.toThrow();
    }
    for (const name of ["text-replay.txt", "ascii-replay.txt", "review-prompt.txt"]) {
      const content = await readFile(join(dir, name), "utf-8");
      expect(content.length).toBeGreaterThan(0);
    }
    // Manifest matchId agrees with the persisted record's actual UUID.
    const record = JSON.parse(await readFile(join(dir, "match.json"), "utf-8"));
    expect(outcome.manifest.matchId).toBe(record.matchId);
  });

  it("rejects an existing final canary directory", async () => {
    const root = await makeTempRoot();
    const finalDir = join(root, FIXED_CANARY_ID);
    await mkdir(finalDir, { recursive: true });
    await writeFile(
      join(finalDir, "manifest.json"),
      JSON.stringify({ status: "existing" }),
      "utf-8",
    );

    const fs = makeFakeFs({});
    await expect(
      runGridMatchCanary({ seed: 3, outputRoot: root }, deps(fs)),
    ).rejects.toThrow(/already exists/);
  });

  it("cleans up and leaves no final bundle on a simulated write failure", async () => {
    const root = await makeTempRoot();
    const fs = makeFakeFs({
      failWriteAt: (path) => path.includes("factual-report.json"),
    });

    await expect(
      runGridMatchCanary({ seed: 3, outputRoot: root }, deps(fs)),
    ).rejects.toThrow(/simulated write failure/);

    expect(await pathExists(join(root, FIXED_CANARY_ID))).toBe(false);
    const leftovers = (await readdir(root)).filter((f) => f.startsWith(".tmp-"));
    expect(leftovers).toEqual([]);
  });

  it("cleans up and leaves no final bundle on a simulated rename failure", async () => {
    const root = await makeTempRoot();
    const fs = makeFakeFs({
      failRenameAt: (from, to) => from.includes(".tmp-") && to.includes(FIXED_CANARY_ID),
    });

    await expect(
      runGridMatchCanary({ seed: 3, outputRoot: root }, deps(fs)),
    ).rejects.toThrow(/simulated rename failure/);

    expect(await pathExists(join(root, FIXED_CANARY_ID))).toBe(false);
    const leftovers = (await readdir(root)).filter((f) => f.startsWith(".tmp-"));
    expect(leftovers).toEqual([]);
  });

  it("fails closed on a malformed read-back artifact and cleans up", async () => {
    const root = await makeTempRoot();
    const fs = makeFakeFs({
      corruptReadAt: (path) => path.includes(".tmp-") && path.endsWith("match.json"),
    });

    await expect(
      runGridMatchCanary({ seed: 3, outputRoot: root }, deps(fs)),
    ).rejects.toThrow(/read-back/);

    expect(await pathExists(join(root, FIXED_CANARY_ID))).toBe(false);
    const leftovers = (await readdir(root)).filter((f) => f.startsWith(".tmp-"));
    expect(leftovers).toEqual([]);
  });

  it("fails closed on a corrupted fallback review read-back", async () => {
    const root = await makeTempRoot();
    const fs = makeFakeFs({
      corruptReadAt: (path) =>
        path.includes(".tmp-") && path.endsWith("fallback-review.json"),
    });

    await expect(
      runGridMatchCanary({ seed: 3, outputRoot: root }, deps(fs)),
    ).rejects.toThrow(/read-back/);
  });

  it("writes manifest.json only after every other artifact", async () => {
    const root = await makeTempRoot();
    const writes: string[] = [];
    const fs = makeFakeFs({
      onWriteFile: (path) => writes.push(path.split("\\").pop() ?? path),
    });

    await runGridMatchCanary({ seed: 3, outputRoot: root }, deps(fs));

    const names = writes.filter((name) => name.includes("."));
    const manifestIndex = names.findIndex((name) => name === "manifest.json");
    expect(manifestIndex).toBeGreaterThanOrEqual(0);
    for (const expected of [
      "match.json",
      "factual-report.json",
      "text-replay.txt",
      "ascii-replay.txt",
      "review-prompt.txt",
      "fallback-review.json",
    ]) {
      expect(names.indexOf(expected)).toBeGreaterThanOrEqual(0);
      expect(names.indexOf(expected)).toBeLessThan(manifestIndex);
    }
    expect(names.filter((name) => name === "manifest.json")).toHaveLength(1);
  });

  it("never writes to normal match or series storage", async () => {
    const dataDir = join(process.cwd(), "data");
    const matchesBefore = await readdir(join(dataDir, "matches")).catch(() => []);
    const seriesBefore = await readdir(join(dataDir, "series")).catch(() => []);

    const root = await makeTempRoot();
    const fs = makeFakeFs({});
    await runGridMatchCanary({ seed: 3, outputRoot: root }, deps(fs));

    const matchesAfter = await readdir(join(dataDir, "matches")).catch(() => []);
    const seriesAfter = await readdir(join(dataDir, "series")).catch(() => []);
    expect(matchesAfter).toEqual(matchesBefore);
    expect(seriesAfter).toEqual(seriesBefore);
  });

  it("rejects an invalid seed before any filesystem activity", async () => {
    const root = await makeTempRoot();
    const fs = makeFakeFs({});
    await expect(
      runGridMatchCanary({ seed: -5, outputRoot: root }, deps(fs)),
    ).rejects.toThrow(/non-negative integer/);
    expect(await readdir(root)).toEqual([]);
  });
});

describe("grid match canary artifact corruption (Phase 3D2A.1)", () => {
  const tmpOnly = (path: string) => path.includes(".tmp-");

  async function assertCorruptionFails(fs: CanaryFileSystem): Promise<void> {
    const root = await makeTempRoot();
    await expect(
      runGridMatchCanary({ seed: 3, outputRoot: root }, deps(fs)),
    ).rejects.toThrow(/read-back/);
    // No final directory, no leftover temporary directory.
    expect(await pathExists(join(root, FIXED_CANARY_ID))).toBe(false);
    expect((await readdir(root)).filter((f) => f.startsWith(".tmp-"))).toEqual([]);
  }

  it("rejects a match record corrupted to another schema-valid v3 record", async () => {
    await assertCorruptionFails(
      makeFakeFs({
        transformReadAt: (path, content) => {
          if (tmpOnly(path) && path.endsWith("match.json")) {
            const record = JSON.parse(content);
            record.matchId = "99999999-8888-4777-8666-555555555555";
            return JSON.stringify(record, null, 2);
          }
          return undefined;
        },
      }),
    );
  });

  it("rejects a factual report corrupted to another schema-valid v2 report", async () => {
    await assertCorruptionFails(
      makeFakeFs({
        transformReadAt: (path, content) => {
          if (tmpOnly(path) && path.endsWith("factual-report.json")) {
            const report = JSON.parse(content);
            report.matchId = "99999999-8888-4777-8666-555555555555";
            return JSON.stringify(report, null, 2);
          }
          return undefined;
        },
      }),
    );
  });

  it("rejects a fallback review corrupted to another schema-valid review", async () => {
    await assertCorruptionFails(
      makeFakeFs({
        transformReadAt: (path, content) => {
          if (tmpOnly(path) && path.endsWith("fallback-review.json")) {
            const review = JSON.parse(content);
            review.observedOutcome.rounds = 19;
            return JSON.stringify(review, null, 2);
          }
          return undefined;
        },
      }),
    );
  });

  it("rejects a manifest corrupted to another schema-valid v2 manifest", async () => {
    await assertCorruptionFails(
      makeFakeFs({
        transformReadAt: (path, content) => {
          if (tmpOnly(path) && path.endsWith("manifest.json")) {
            const manifest = JSON.parse(content);
            manifest.seed = manifest.seed + 1;
            return JSON.stringify(manifest, null, 2);
          }
          return undefined;
        },
      }),
    );
  });

  it("rejects a corrupted text replay artifact", async () => {
    await assertCorruptionFails(
      makeFakeFs({
        transformReadAt: (path, content) => {
          if (tmpOnly(path) && path.endsWith("text-replay.txt")) {
            return `${content}\nTAMPERED`;
          }
          return undefined;
        },
      }),
    );
  });

  it("rejects a corrupted ASCII replay artifact", async () => {
    await assertCorruptionFails(
      makeFakeFs({
        transformReadAt: (path, content) => {
          if (tmpOnly(path) && path.endsWith("ascii-replay.txt")) {
            return `${content}\nTAMPERED`;
          }
          return undefined;
        },
      }),
    );
  });

  it("rejects a corrupted review prompt artifact", async () => {
    await assertCorruptionFails(
      makeFakeFs({
        transformReadAt: (path, content) => {
          if (tmpOnly(path) && path.endsWith("review-prompt.txt")) {
            return `${content}\nTAMPERED`;
          }
          return undefined;
        },
      }),
    );
  });

  it("never writes to normal match or series storage during corruption failures", async () => {
    const dataDir = join(process.cwd(), "data");
    const matchesBefore = await readdir(join(dataDir, "matches")).catch(() => []);
    const seriesBefore = await readdir(join(dataDir, "series")).catch(() => []);

    const fs = makeFakeFs({
      transformReadAt: (path, content) => {
        if (tmpOnly(path) && path.endsWith("match.json")) {
          return `${content}\n`;
        }
        return undefined;
      },
    });
    const root = await makeTempRoot();
    await expect(
      runGridMatchCanary({ seed: 3, outputRoot: root }, deps(fs)),
    ).rejects.toThrow(/read-back/);

    expect(await readdir(join(dataDir, "matches")).catch(() => [])).toEqual(
      matchesBefore,
    );
    expect(await readdir(join(dataDir, "series")).catch(() => [])).toEqual(seriesBefore);
  });
});

describe("grid match canary immutable publication (Phase 3D2A.2)", () => {
  const finalDir = (root: string) => join(root, FIXED_CANARY_ID);
  const tmpDir = (root: string) => join(root, `.tmp-${FIXED_CANARY_ID}`);

  async function trySymlink(target: string, path: string): Promise<boolean> {
    try {
      await symlink(target, path);
      return true;
    } catch {
      return false;
    }
  }

  async function assertNoLeftovers(root: string): Promise<void> {
    expect(await pathExists(finalDir(root))).toBe(false);
    expect((await readdir(root)).filter((f) => f.startsWith(".tmp-"))).toEqual([]);
  }

  // --- Final collisions ---

  it("rejects and preserves an empty final directory", async () => {
    const root = await makeTempRoot();
    await mkdir(finalDir(root), { recursive: true });
    await expect(
      runGridMatchCanary({ seed: 3, outputRoot: root }, deps(makeFakeFs({}))),
    ).rejects.toThrow(/final path already exists/);
    expect(await pathExists(finalDir(root))).toBe(true);
    expect(await readdir(finalDir(root))).toEqual([]);
  });

  it("rejects and preserves a non-empty final directory", async () => {
    const root = await makeTempRoot();
    await mkdir(finalDir(root), { recursive: true });
    await writeFile(join(finalDir(root), "unrelated.txt"), "keep", "utf-8");
    await expect(
      runGridMatchCanary({ seed: 3, outputRoot: root }, deps(makeFakeFs({}))),
    ).rejects.toThrow(/final path already exists/);
    expect(await readFile(join(finalDir(root), "unrelated.txt"), "utf-8")).toBe("keep");
  });

  it("rejects and preserves an existing manifest bundle", async () => {
    const root = await makeTempRoot();
    await mkdir(finalDir(root), { recursive: true });
    await writeFile(
      join(finalDir(root), "manifest.json"),
      JSON.stringify({ status: "existing" }),
      "utf-8",
    );
    await expect(
      runGridMatchCanary({ seed: 3, outputRoot: root }, deps(makeFakeFs({}))),
    ).rejects.toThrow(/final path already exists/);
    expect(await pathExists(join(finalDir(root), "manifest.json"))).toBe(true);
  });

  it("rejects and preserves a regular final file", async () => {
    const root = await makeTempRoot();
    await writeFile(finalDir(root), "i am a file", "utf-8");
    await expect(
      runGridMatchCanary({ seed: 3, outputRoot: root }, deps(makeFakeFs({}))),
    ).rejects.toThrow(/final path already exists/);
    expect(await readFile(finalDir(root), "utf-8")).toBe("i am a file");
  });

  it("rejects and preserves a final symbolic link where the platform permits", async () => {
    const root = await makeTempRoot();
    const ok = await trySymlink(join(root, "some-target"), finalDir(root));
    if (!ok) return;
    await expect(
      runGridMatchCanary({ seed: 3, outputRoot: root }, deps(makeFakeFs({}))),
    ).rejects.toThrow(/final path already exists/);
    expect((await lstat(finalDir(root))).isSymbolicLink()).toBe(true);
  });

  it("rejects and preserves a broken final symbolic link where the platform permits", async () => {
    const root = await makeTempRoot();
    const ok = await trySymlink(join(root, "does-not-exist"), finalDir(root));
    if (!ok) return;
    await expect(
      runGridMatchCanary({ seed: 3, outputRoot: root }, deps(makeFakeFs({}))),
    ).rejects.toThrow(/final path already exists/);
    expect((await lstat(finalDir(root))).isSymbolicLink()).toBe(true);
  });

  // --- Temporary collisions ---

  it("rejects and preserves an empty temporary directory", async () => {
    const root = await makeTempRoot();
    await mkdir(tmpDir(root), { recursive: true });
    await expect(
      runGridMatchCanary({ seed: 3, outputRoot: root }, deps(makeFakeFs({}))),
    ).rejects.toThrow(/temporary path already exists/);
    expect(await pathExists(tmpDir(root))).toBe(true);
    expect(await readdir(tmpDir(root))).toEqual([]);
  });

  it("rejects a temporary directory with a sentinel and preserves the sentinel", async () => {
    const root = await makeTempRoot();
    await mkdir(tmpDir(root), { recursive: true });
    await writeFile(join(tmpDir(root), "sentinel.txt"), "keep", "utf-8");
    await expect(
      runGridMatchCanary({ seed: 3, outputRoot: root }, deps(makeFakeFs({}))),
    ).rejects.toThrow(/temporary path already exists/);
    expect(await readFile(join(tmpDir(root), "sentinel.txt"), "utf-8")).toBe("keep");
  });

  it("rejects and preserves a temporary regular file", async () => {
    const root = await makeTempRoot();
    await writeFile(tmpDir(root), "i am a file", "utf-8");
    await expect(
      runGridMatchCanary({ seed: 3, outputRoot: root }, deps(makeFakeFs({}))),
    ).rejects.toThrow(/temporary path already exists/);
    expect(await readFile(tmpDir(root), "utf-8")).toBe("i am a file");
  });

  it("rejects and preserves a temporary symbolic link where the platform permits", async () => {
    const root = await makeTempRoot();
    const ok = await trySymlink(join(root, "some-target"), tmpDir(root));
    if (!ok) return;
    await expect(
      runGridMatchCanary({ seed: 3, outputRoot: root }, deps(makeFakeFs({}))),
    ).rejects.toThrow(/temporary path already exists/);
    expect((await lstat(tmpDir(root))).isSymbolicLink()).toBe(true);
  });

  // --- Races ---

  it("does not clean a raced-in temporary path when exclusive mkdir fails with EEXIST", async () => {
    const root = await makeTempRoot();
    const fs = makeFakeFs({
      failMkdirTmp: (path) => path.includes(`.tmp-${FIXED_CANARY_ID}`),
    });
    await expect(
      runGridMatchCanary({ seed: 3, outputRoot: root }, deps(fs)),
    ).rejects.toThrow(/simulated EEXIST/);
    await assertNoLeftovers(root);
  });

  it("preserves a raced-in final entry and removes only the invocation-owned temporary directory", async () => {
    const root = await makeTempRoot();
    const fs = makeFakeFs({
      failRenameAt: (from, to) => from.includes(".tmp-") && to.includes(FIXED_CANARY_ID),
      onRenameFail: async (_from, to) => {
        // A final entry races in after preflight and before the rename.
        await mkdir(to, { recursive: true });
        await writeFile(join(to, "racer.txt"), "keep", "utf-8");
      },
    });
    await expect(
      runGridMatchCanary({ seed: 3, outputRoot: root }, deps(fs)),
    ).rejects.toThrow(/simulated rename failure/);
    // Invocation-owned temporary directory removed.
    expect(await pathExists(tmpDir(root))).toBe(false);
    // Raced-in final entry preserved (never owned by this invocation).
    expect(await readFile(join(finalDir(root), "racer.txt"), "utf-8")).toBe("keep");
  });

  // --- Exact inventories ---

  it("publishes a bundle containing exactly seven regular files", async () => {
    const root = await makeTempRoot();
    await runGridMatchCanary({ seed: 3, outputRoot: root }, deps(makeFakeFs({})));
    const files = (await readdir(finalDir(root))).sort();
    expect(files).toEqual([
      "ascii-replay.txt",
      "factual-report.json",
      "fallback-review.json",
      "manifest.json",
      "match.json",
      "review-prompt.txt",
      "text-replay.txt",
    ]);
    for (const name of files) {
      expect((await lstat(join(finalDir(root), name))).isFile()).toBe(true);
    }
  });

  it("rejects an injected extra temporary file", async () => {
    const root = await makeTempRoot();
    const fs = makeFakeFs({
      afterWriteFile: async (path) => {
        if (path.endsWith("manifest.json") && path.includes(`.tmp-${FIXED_CANARY_ID}`)) {
          await writeFile(join(tmpDir(root), "injected.txt"), "extra", "utf-8");
        }
      },
    });
    await expect(
      runGridMatchCanary({ seed: 3, outputRoot: root }, deps(fs)),
    ).rejects.toThrow(/inventory mismatch/);
    await assertNoLeftovers(root);
  });

  it("rejects an injected extra temporary directory", async () => {
    const root = await makeTempRoot();
    const fs = makeFakeFs({
      afterWriteFile: async (path) => {
        if (path.endsWith("manifest.json") && path.includes(`.tmp-${FIXED_CANARY_ID}`)) {
          await mkdir(join(tmpDir(root), "extra-dir"), { recursive: true });
        }
      },
    });
    await expect(
      runGridMatchCanary({ seed: 3, outputRoot: root }, deps(fs)),
    ).rejects.toThrow(/inventory mismatch/);
    await assertNoLeftovers(root);
  });

  it("rejects a missing temporary artifact", async () => {
    const root = await makeTempRoot();
    const fs = makeFakeFs({
      afterWriteFile: async (path) => {
        if (path.endsWith("manifest.json") && path.includes(`.tmp-${FIXED_CANARY_ID}`)) {
          await unlink(join(tmpDir(root), "match.json"));
        }
      },
    });
    await expect(
      runGridMatchCanary({ seed: 3, outputRoot: root }, deps(fs)),
    ).rejects.toThrow(/inventory mismatch/);
    await assertNoLeftovers(root);
  });

  it("rejects a symbolic-link artifact where the platform permits", async () => {
    const root = await makeTempRoot();
    let textReplayContent = "";
    const fs = makeFakeFs({
      afterWriteFile: async (path, data) => {
        if (path.endsWith("text-replay.txt")) textReplayContent = data;
        if (path.endsWith("manifest.json") && path.includes(`.tmp-${FIXED_CANARY_ID}`)) {
          const target = join(tmpDir(root), "text-replay.txt");
          await unlink(target);
          const ok = await trySymlink(join(tmpDir(root), "some-target"), target);
          if (!ok) {
            // Platform does not permit symlinks; restore the original content
            // so the bundle remains valid and this case is moot here.
            await writeFile(target, textReplayContent, "utf-8");
          }
        }
      },
    });
    try {
      await runGridMatchCanary({ seed: 3, outputRoot: root }, deps(fs));
    } catch (e) {
      expect(e instanceof Error ? e.message : String(e)).toMatch(/symbolic link/);
      await assertNoLeftovers(root);
    }
  });

  it("rejects an injected extra final file and removes the final directory", async () => {
    const root = await makeTempRoot();
    const fs = makeFakeFs({
      afterRename: async (from, to) => {
        if (from.includes(".tmp-") && to.includes(FIXED_CANARY_ID)) {
          await writeFile(join(to, "injected-final.txt"), "extra", "utf-8");
        }
      },
    });
    await expect(
      runGridMatchCanary({ seed: 3, outputRoot: root }, deps(fs)),
    ).rejects.toThrow(/inventory mismatch/);
    // The final directory is removed because this invocation published it.
    await assertNoLeftovers(root);
  });
});
