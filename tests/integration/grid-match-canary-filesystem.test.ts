import { afterEach, describe, expect, it } from "vitest";
import {
  access,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rename,
  rm,
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
  corruptReadAt?: (path: string) => boolean;
}

/** Real filesystem with injectable failure hooks for the canary bundle. */
function makeFakeFs(hooks: FakeFsHooks): CanaryFileSystem {
  return {
    mkdir: async (path, options) => {
      await mkdir(path, options);
    },
    writeFile: async (path, data, encoding) => {
      if (hooks.onWriteFile) hooks.onWriteFile(path, data);
      if (hooks.failWriteAt && hooks.failWriteAt(path)) {
        throw new Error(`simulated write failure: ${path}`);
      }
      await writeFile(path, data, encoding);
    },
    readFile: async (path, encoding) => {
      if (hooks.corruptReadAt && hooks.corruptReadAt(path)) {
        return "{ corrupted json";
      }
      return readFile(path, encoding);
    },
    rename: async (from, to) => {
      if (hooks.failRenameAt && hooks.failRenameAt(from, to)) {
        throw new Error(`simulated rename failure: ${from} -> ${to}`);
      }
      await rename(from, to);
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
