import { afterEach, describe, expect, it } from "vitest";
import {
  mkdtemp,
  readdir,
  readFile,
  rm,
  access,
  writeFile,
  mkdir,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runGridSeriesCanary } from "../../src/app/grid-series-canary.js";
import { deserializeGridSeriesCanaryManifestV1 } from "../../src/schemas/grid-series-canary-manifest.schema.js";
import {
  deserializeSeriesRecord,
  isSeriesRecordV2,
} from "../../src/schemas/series.schema.js";

const tempRoots: string[] = [];

async function makeTempRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "series-canary-"));
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

function deps() {
  let i = 0;
  return {
    createUuid: () => FIXED_IDS[i++]!,
    now: () => new Date("2024-06-01T00:00:00.000Z"),
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

describe("grid series canary service end-to-end (Phase 3D2B)", () => {
  it("publishes a complete eight-artifact bundle with exact inventory", async () => {
    const root = await makeTempRoot();
    const outcome = await runGridSeriesCanary({ baseSeed: 3, outputRoot: root }, deps());

    const dir = join(root, FIXED_IDS[0]);
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
    expect(await pathExists(join(root, `.tmp-${FIXED_IDS[0]}`))).toBe(false);
    expect((await readdir(root)).filter((f) => f !== FIXED_IDS[0])).toEqual([]);
    expect(outcome.artifactDirectory).toBe(dir);
  });

  it("produces a valid manifest, series record and score", async () => {
    const root = await makeTempRoot();
    const outcome = await runGridSeriesCanary({ baseSeed: 3, outputRoot: root }, deps());

    const manifestRaw = await readFile(
      join(outcome.artifactDirectory, "manifest.json"),
      "utf-8",
    );
    const manifestParsed = deserializeGridSeriesCanaryManifestV1(manifestRaw);
    expect(manifestParsed.ok).toBe(true);
    if (manifestParsed.ok) {
      expect(manifestParsed.manifest.canaryId).toBe(FIXED_IDS[0]);
      expect(manifestParsed.manifest.seriesId).toBe(FIXED_IDS[1]);
      expect(manifestParsed.manifest.matchCount).toBe(3);
      expect(manifestParsed.manifest.evidence.bundleCrossAgreementPassed).toBe(true);
    }

    const seriesRaw = await readFile(
      join(outcome.artifactDirectory, "series.json"),
      "utf-8",
    );
    const seriesParsed = deserializeSeriesRecord(seriesRaw);
    expect(seriesParsed.ok).toBe(true);
    expect(isSeriesRecordV2(seriesParsed.ok ? seriesParsed.record : null)).toBe(true);
    if (seriesParsed.ok) {
      const series = seriesParsed.record;
      if (isSeriesRecordV2(series)) {
        expect(series.entries).toHaveLength(3);
        expect(series.status).toBe("completed");
        expect(series.score).toEqual(outcome.score);
        expect(series.winner).toBe(outcome.winner);
        expect(series.seriesId).toBe(FIXED_IDS[1]);
      }
    }

    // Match IDs are the injected ones, unique and bound.
    const matchIds = outcome.matches.map((m) => m.matchId);
    expect(matchIds).toEqual([FIXED_IDS[2], FIXED_IDS[3], FIXED_IDS[4]]);
    expect(new Set(matchIds).size).toBe(3);
  });

  it("never writes to normal match or series storage", async () => {
    const dataDir = join(process.cwd(), "data");
    const matchesBefore = await readdir(join(dataDir, "matches")).catch(() => []);
    const seriesBefore = await readdir(join(dataDir, "series")).catch(() => []);

    const root = await makeTempRoot();
    await runGridSeriesCanary({ baseSeed: 3, outputRoot: root }, deps());

    expect(await readdir(join(dataDir, "matches")).catch(() => [])).toEqual(
      matchesBefore,
    );
    expect(await readdir(join(dataDir, "series")).catch(() => [])).toEqual(seriesBefore);
  });

  it("is deterministic under injected identities across two runs", async () => {
    const rootA = await makeTempRoot();
    const rootB = await makeTempRoot();
    const a = await runGridSeriesCanary({ baseSeed: 11, outputRoot: rootA }, deps());
    const b = await runGridSeriesCanary({ baseSeed: 11, outputRoot: rootB }, deps());
    expect(a.manifest).toEqual(b.manifest);
    expect(a.score).toEqual(b.score);
    expect(a.matches).toEqual(b.matches);
    expect(a.adaptations).toEqual(b.adaptations);
  });

  it("rejects an existing final canary directory", async () => {
    const root = await makeTempRoot();
    const finalDir = join(root, FIXED_IDS[0]);
    await mkdir(finalDir, { recursive: true });
    await writeFile(join(finalDir, "manifest.json"), "{}", "utf-8");
    await expect(
      runGridSeriesCanary({ baseSeed: 3, outputRoot: root }, deps()),
    ).rejects.toThrow(/already exists/);
    expect(await pathExists(finalDir)).toBe(true);
  });

  it("rejects an invalid seed before any filesystem activity", async () => {
    const root = await makeTempRoot();
    await expect(
      runGridSeriesCanary({ baseSeed: -5, outputRoot: root }, deps()),
    ).rejects.toThrow(/non-negative/);
    expect(await readdir(root)).toEqual([]);
  });

  it("rejects duplicate generated identities", async () => {
    const root = await makeTempRoot();
    await expect(
      runGridSeriesCanary(
        { baseSeed: 3, outputRoot: root },
        {
          createUuid: () => FIXED_IDS[0]!,
          now: () => new Date("2024-06-01T00:00:00.000Z"),
        },
      ),
    ).rejects.toThrow(/distinct/);
  });

  it("adapts the policy twice with deterministic structured decisions", async () => {
    const root = await makeTempRoot();
    const outcome = await runGridSeriesCanary({ baseSeed: 3, outputRoot: root }, deps());
    expect(outcome.adaptations).toHaveLength(2);
    expect(outcome.adaptations[0].sourceMatchNumber).toBe(1);
    expect(outcome.adaptations[1].sourceMatchNumber).toBe(2);
    for (const adaptation of outcome.adaptations) {
      expect(["ahead_or_equal", "behind"]).toContain(adaptation.integrityComparison);
      expect(["impaired", "behind", "stable"]).toContain(adaptation.openingReason);
    }
  });
});
