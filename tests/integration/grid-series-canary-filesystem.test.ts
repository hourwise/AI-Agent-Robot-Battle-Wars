import { afterEach, describe, expect, it } from "vitest";
import { access, mkdir, mkdtemp, readdir, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  runGridSeriesCanary,
  type GridSeriesCanaryDependencies,
} from "../../src/app/grid-series-canary.js";
import type { CanaryFileSystem } from "../../src/app/grid-match-canary.js";

const tempRoots: string[] = [];

async function makeTempRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "series-canary-fs-"));
  tempRoots.push(root);
  return root;
}

afterEach(async () => {
  for (const root of tempRoots.splice(0)) {
    await rm(root, { recursive: true, force: true });
  }
});

const FIXED_IDS = [
  "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
  "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2",
  "cccccccc-cccc-4ccc-8ccc-ccccccccccc3",
  "dddddddd-dddd-4ddd-8ddd-ddddddddddd4",
  "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee5",
];

interface FakeFsHooks {
  failWriteAt?: (path: string) => boolean;
  failRenameAt?: (from: string, to: string) => boolean;
  failMkdirTmp?: (path: string) => boolean;
  corruptReadAt?: (path: string) => boolean;
  transformReadAt?: (path: string, content: string) => string | undefined;
  onWriteFile?: (path: string, data: string) => void;
  afterWriteFile?: (path: string, data: string) => Promise<void> | void;
}

function makeFakeFs(hooks: FakeFsHooks): CanaryFileSystem {
  const real: CanaryFileSystem = {
    mkdir: (path, options) => mkdir(path, options),
    writeFile: (path, data, encoding) => writeFile(path, data, encoding),
    readFile: (path, encoding) =>
      import("node:fs/promises").then((m) => m.readFile(path, encoding)),
    readdir: (path) => readdir(path),
    lstat: (path) => import("node:fs/promises").then((m) => m.lstat(path)),
    rename: (from, to) => rename(from, to),
    rm: (path, options) => rm(path, options),
  };
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
    writeFileExclusive: (path, data, encoding) =>
      writeFile(path, data, { encoding: encoding ?? "utf-8", flag: "wx" }),
    readFile: async (path, encoding) => {
      if (hooks.transformReadAt) {
        const transformed = hooks.transformReadAt(
          path,
          await real.readFile(path, encoding),
        );
        if (transformed !== undefined) return transformed;
      }
      if (hooks.corruptReadAt && hooks.corruptReadAt(path)) {
        return "{ corrupted json";
      }
      return real.readFile(path, encoding);
    },
    readdir: (path) => readdir(path),
    lstat: (path) => import("node:fs/promises").then((m) => m.lstat(path)),
    rename: async (from, to) => {
      if (hooks.failRenameAt && hooks.failRenameAt(from, to)) {
        throw new Error(`simulated rename failure: ${from} -> ${to}`);
      }
      await rename(from, to);
    },
    rm: (path, options) => rm(path, options),
  };
}

function deps(fs: CanaryFileSystem): GridSeriesCanaryDependencies {
  let i = 0;
  return {
    createUuid: () => FIXED_IDS[i++]!,
    now: () => new Date("2024-06-01T00:00:00.000Z"),
    fs,
  };
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

const CANARY_DIR = FIXED_IDS[0];

describe("grid series canary atomic bundle (Phase 3D2B)", () => {
  it("publishes a complete eight-artifact bundle", async () => {
    const root = await makeTempRoot();
    const outcome = await runGridSeriesCanary(
      { baseSeed: 3, outputRoot: root },
      deps(makeFakeFs({})),
    );

    const dir = join(root, CANARY_DIR);
    const files = (await readdir(dir)).sort();
    expect(files).toEqual([
      "adaptation-trace.json",
      "factual-reports.json",
      "fallback-reviews.json",
      "manifest.json",
      "match-artifacts.json",
      "matches.json",
      "series-report.txt",
      "series.json",
    ]);
    expect(await pathExists(join(root, `.tmp-${CANARY_DIR}`))).toBe(false);
    expect(outcome.artifactDirectory).toBe(dir);
  });

  it("writes manifest.json only after every other artifact", async () => {
    const root = await makeTempRoot();
    const writes: string[] = [];
    const fs = makeFakeFs({
      onWriteFile: (path) => writes.push(path.split("\\").pop() ?? path),
    });
    await runGridSeriesCanary({ baseSeed: 3, outputRoot: root }, deps(fs));

    const names = writes.filter((name) => name.includes("."));
    const manifestIndex = names.findIndex((name) => name === "manifest.json");
    expect(manifestIndex).toBeGreaterThanOrEqual(0);
    for (const expected of [
      "series.json",
      "matches.json",
      "factual-reports.json",
      "fallback-reviews.json",
      "match-artifacts.json",
      "adaptation-trace.json",
      "series-report.txt",
    ]) {
      expect(names.indexOf(expected)).toBeGreaterThanOrEqual(0);
      expect(names.indexOf(expected)).toBeLessThan(manifestIndex);
    }
    expect(names.filter((name) => name === "manifest.json")).toHaveLength(1);
  });

  it("cleans up and leaves no final bundle on a simulated write failure", async () => {
    const root = await makeTempRoot();
    const fs = makeFakeFs({ failWriteAt: (path) => path.includes("matches.json") });
    await expect(
      runGridSeriesCanary({ baseSeed: 3, outputRoot: root }, deps(fs)),
    ).rejects.toThrow(/simulated write failure/);
    expect(await pathExists(join(root, CANARY_DIR))).toBe(false);
    expect((await readdir(root)).filter((f) => f.startsWith(".tmp-"))).toEqual([]);
  });

  it("cleans up and leaves no final bundle on a simulated rename failure", async () => {
    const root = await makeTempRoot();
    const fs = makeFakeFs({
      failRenameAt: (from, to) => from.includes(".tmp-") && to.includes(CANARY_DIR),
    });
    await expect(
      runGridSeriesCanary({ baseSeed: 3, outputRoot: root }, deps(fs)),
    ).rejects.toThrow(/simulated rename failure/);
    expect(await pathExists(join(root, CANARY_DIR))).toBe(false);
    expect((await readdir(root)).filter((f) => f.startsWith(".tmp-"))).toEqual([]);
  });

  it("rejects an existing final canary directory", async () => {
    const root = await makeTempRoot();
    const finalDir = join(root, CANARY_DIR);
    await mkdir(finalDir, { recursive: true });
    await writeFile(join(finalDir, "manifest.json"), "{}", "utf-8");
    await expect(
      runGridSeriesCanary({ baseSeed: 3, outputRoot: root }, deps(makeFakeFs({}))),
    ).rejects.toThrow(/already exists/);
    expect(await pathExists(finalDir)).toBe(true);
  });

  it("never writes to normal match or series storage", async () => {
    const dataDir = join(process.cwd(), "data");
    const matchesBefore = await readdir(join(dataDir, "matches")).catch(() => []);
    const seriesBefore = await readdir(join(dataDir, "series")).catch(() => []);

    const root = await makeTempRoot();
    await runGridSeriesCanary({ baseSeed: 3, outputRoot: root }, deps(makeFakeFs({})));

    expect(await readdir(join(dataDir, "matches")).catch(() => [])).toEqual(
      matchesBefore,
    );
    expect(await readdir(join(dataDir, "series")).catch(() => [])).toEqual(seriesBefore);
  });
});

describe("grid series canary artifact corruption (Phase 3D2B)", () => {
  const tmpOnly = (path: string) => path.includes(".tmp-");

  async function assertCorruptionFails(fs: CanaryFileSystem): Promise<void> {
    const root = await makeTempRoot();
    await expect(
      runGridSeriesCanary({ baseSeed: 3, outputRoot: root }, deps(fs)),
    ).rejects.toThrow(/read-back/);
    expect(await pathExists(join(root, CANARY_DIR))).toBe(false);
    expect((await readdir(root)).filter((f) => f.startsWith(".tmp-"))).toEqual([]);
  }

  it("rejects a corrupted series.json read-back", async () => {
    await assertCorruptionFails(
      makeFakeFs({
        transformReadAt: (path, content) => {
          if (tmpOnly(path) && path.endsWith("series.json")) {
            const record = JSON.parse(content);
            record.score.aiWins = 99;
            return JSON.stringify(record, null, 2);
          }
          return undefined;
        },
      }),
    );
  });

  it("rejects a corrupted matches.json read-back", async () => {
    await assertCorruptionFails(
      makeFakeFs({
        transformReadAt: (path, content) => {
          if (tmpOnly(path) && path.endsWith("matches.json")) {
            const envelope = JSON.parse(content);
            envelope.items[0].result.winner =
              envelope.items[0].result.winner === "fighter_a" ? "fighter_b" : "fighter_a";
            return JSON.stringify(envelope, null, 2);
          }
          return undefined;
        },
      }),
    );
  });

  it("rejects a corrupted adaptation-trace read-back", async () => {
    await assertCorruptionFails(
      makeFakeFs({
        transformReadAt: (path, content) => {
          if (tmpOnly(path) && path.endsWith("adaptation-trace.json")) {
            const trace = JSON.parse(content);
            trace.transitions[0].policyAfter.aggression = 55;
            return JSON.stringify(trace, null, 2);
          }
          return undefined;
        },
      }),
    );
  });

  it("rejects a corrupted manifest read-back", async () => {
    await assertCorruptionFails(
      makeFakeFs({
        transformReadAt: (path, content) => {
          if (tmpOnly(path) && path.endsWith("manifest.json")) {
            const manifest = JSON.parse(content);
            manifest.digests.series = "0".repeat(64);
            return JSON.stringify(manifest, null, 2);
          }
          return undefined;
        },
      }),
    );
  });

  it("rejects a malformed read-back artifact and cleans up", async () => {
    await assertCorruptionFails(
      makeFakeFs({
        corruptReadAt: (path) => tmpOnly(path) && path.endsWith("series.json"),
      }),
    );
  });

  it("rejects a corrupted series-report.txt read-back", async () => {
    await assertCorruptionFails(
      makeFakeFs({
        transformReadAt: (path, content) => {
          if (tmpOnly(path) && path.endsWith("series-report.txt")) {
            return `${content}\nWin rate: 66.7%`;
          }
          return undefined;
        },
      }),
    );
  });
});
