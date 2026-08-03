import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mkdtemp, readdir, readFile, rm, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import {
  runGridGrappleCoverageSupplement,
  GRID_GRAPPLE_COVERAGE_BASE_V3_DIR,
} from "../../src/app/grid-grapple-coverage-supplement.js";
import {
  buildGridGrappleSupplementFixture,
  grappleSupplementFixtureBaseIdentity,
  GRAPPLE_SUPPLEMENT_TEST_ID,
  GRAPPLE_SUPPLEMENT_TEST_CREATED_AT,
} from "../helpers/grid-grapple-supplement-builder.js";
import {
  validateGridGrappleCoverageSupplementBundle,
  GRID_GRAPPLE_SUPPLEMENT_BUNDLE_ENTRIES,
  GRID_GRAPPLE_COVERAGE_BASE_V3_EVALUATION_ID,
  GRID_GRAPPLE_COVERAGE_BASE_V3_SUITE_CHECKSUM,
} from "../../src/readiness/grid-grapple-supplement-bundle.js";
import { existsSync } from "node:fs";
import {
  defaultCanaryFs,
  type CanaryFileSystem,
} from "../../src/canary/immutable-canary-bundle.js";

const OFFICIAL_BASE_ENTRIES = [
  "manifest.json",
  "seed-registry.json",
  "scenario-registry.json",
  "run-index.json",
  "match-records.json",
  "factual-reports.json",
  "metrics.json",
  "decision.json",
  "report.txt",
];

let baseDir: string;
let outputDir: string;
let officialSnapshot: Record<string, string> | null = null;

function dirname(path: string): string {
  return resolve(path, "..");
}

/** Deterministic UUID factory: the supplement ID first, then 48 unique IDs. */
function createSupplementIdFactory(supplementId: string): () => string {
  let counter = 0;
  return () => {
    if (counter === 0) {
      counter += 1;
      return supplementId;
    }
    const tail = String(counter - 1).padStart(12, "0");
    counter += 1;
    return `55555555-5555-4555-8555-${tail}`;
  };
}

beforeAll(async () => {
  const root = await mkdtemp(join(tmpdir(), "grapple-supplement-"));
  baseDir = join(root, "base");
  outputDir = join(root, "output");
  await mkdir(baseDir);
  await mkdir(outputDir);

  // Write the equivalent validated fixture base bundle into the temp base dir.
  const fixture = buildGridGrappleSupplementFixture();
  for (const name of OFFICIAL_BASE_ENTRIES) {
    await writeFile(join(baseDir, name), fixture.baseContents[name]!, "utf-8");
  }

  // Snapshot the official v3 directory if present (must remain untouched).
  if (existsSync(GRID_GRAPPLE_COVERAGE_BASE_V3_DIR)) {
    officialSnapshot = {};
    for (const name of OFFICIAL_BASE_ENTRIES) {
      officialSnapshot[name] = await readFile(
        join(GRID_GRAPPLE_COVERAGE_BASE_V3_DIR, name),
        "utf-8",
      );
    }
  }
}, 300_000);

afterAll(async () => {
  await rm(dirname(baseDir), { recursive: true, force: true });
});

describe("grid grapple coverage supplement service (Phase 3E2 Phase 13)", () => {
  it("fails before running matches when the official base bundle is absent", async () => {
    const missingBase = join(dirname(baseDir), "missing-base");
    await mkdir(missingBase);
    const out = join(dirname(baseDir), "out-missing");
    await expect(
      runGridGrappleCoverageSupplement(
        { outputRoot: out, baseV3Root: missingBase },
        {
          createUuid: createSupplementIdFactory(GRAPPLE_SUPPLEMENT_TEST_ID),
          now: () => new Date(GRAPPLE_SUPPLEMENT_TEST_CREATED_AT),
          nowMs: () => 0,
        },
      ),
    ).rejects.toThrow(/absent or unreadable/);
    expect(existsSync(out)).toBe(false);
  });

  it("fails before running matches when the base identity does not match", async () => {
    const out = join(dirname(baseDir), "out-bad");
    await expect(
      runGridGrappleCoverageSupplement(
        {
          outputRoot: out,
          baseV3Root: baseDir,
          baseV3Identity: {
            evaluationId: GRID_GRAPPLE_COVERAGE_BASE_V3_EVALUATION_ID,
            suiteChecksum: GRID_GRAPPLE_COVERAGE_BASE_V3_SUITE_CHECKSUM,
          },
        },
        {
          createUuid: createSupplementIdFactory(GRAPPLE_SUPPLEMENT_TEST_ID),
          now: () => new Date(GRAPPLE_SUPPLEMENT_TEST_CREATED_AT),
          nowMs: () => 0,
        },
      ),
    ).rejects.toThrow(/evaluation ID mismatch/);
    expect(existsSync(out)).toBe(false);
  });

  it("publishes a validated ten-file supplement bundle to the temp output root", async () => {
    const identity = grappleSupplementFixtureBaseIdentity();
    const result = await runGridGrappleCoverageSupplement(
      {
        outputRoot: outputDir,
        baseV3Root: baseDir,
        baseV3Identity: identity,
      },
      {
        createUuid: createSupplementIdFactory(GRAPPLE_SUPPLEMENT_TEST_ID),
        now: () => new Date(GRAPPLE_SUPPLEMENT_TEST_CREATED_AT),
        nowMs: () => 0,
      },
    );
    expect(result.supplementId).toBe(GRAPPLE_SUPPLEMENT_TEST_ID);
    expect(result.runCount).toBe(48);
    expect(result.decision).toBe("coverage_confirmed");
    expect(result.combinedReadinessClassification).toBe("ready_for_opt_in_beta_review");
    expect(result.baseV3EvaluationId).toBe(identity.evaluationId);
    expect(result.baseV3SuiteChecksum).toBe(identity.suiteChecksum);

    const dir = result.artifactDirectory;
    const files = (await readdir(dir)).sort();
    expect(files).toEqual([...GRID_GRAPPLE_SUPPLEMENT_BUNDLE_ENTRIES].sort());
    const contents: Record<string, string> = {};
    for (const name of GRID_GRAPPLE_SUPPLEMENT_BUNDLE_ENTRIES) {
      contents[name] = await readFile(join(dir, name), "utf-8");
    }
    expect(() =>
      validateGridGrappleCoverageSupplementBundle(contents, identity),
    ).not.toThrow();
  });

  it("never modifies the temp base bundle directory", async () => {
    const fixture = buildGridGrappleSupplementFixture();
    for (const name of OFFICIAL_BASE_ENTRIES) {
      const current = await readFile(join(baseDir, name), "utf-8");
      expect(current).toBe(fixture.baseContents[name]);
    }
  });

  it("fails operationally when the temp base bundle is mutated after anchoring, before publication", async () => {
    const identity = grappleSupplementFixtureBaseIdentity();
    const raceBase = join(dirname(baseDir), "race-base");
    const raceOut = join(dirname(baseDir), "race-out");
    await mkdir(raceBase);
    await mkdir(raceOut);
    const fixture = buildGridGrappleSupplementFixture();
    for (const name of OFFICIAL_BASE_ENTRIES) {
      await writeFile(join(raceBase, name), fixture.baseContents[name]!, "utf-8");
    }
    // The anchor reads every base artifact once (step 2); the
    // pre-publication immutability re-check reads them again (step 17b).
    // Simulate an on-disk mutation between the two by returning tampered
    // metrics bytes for the second read.
    let metricsReads = 0;
    const mutatingFs: CanaryFileSystem = {
      ...defaultCanaryFs,
      readFile: async (path, encoding) => {
        const text = await defaultCanaryFs.readFile(path, encoding);
        if (
          path.replaceAll("\\", "/").endsWith("metrics.json") &&
          path.includes("race-base")
        ) {
          metricsReads += 1;
          if (metricsReads === 2) {
            return `${text}\n// tampered after anchor`;
          }
        }
        return text;
      },
    };
    await expect(
      runGridGrappleCoverageSupplement(
        { outputRoot: raceOut, baseV3Root: raceBase, baseV3Identity: identity },
        {
          createUuid: createSupplementIdFactory(GRAPPLE_SUPPLEMENT_TEST_ID),
          now: () => new Date(GRAPPLE_SUPPLEMENT_TEST_CREATED_AT),
          nowMs: () => 0,
          fs: mutatingFs,
        },
      ),
    ).rejects.toThrow(/Official v3 base artifact changed during supplement execution/);
    // No supplement artifact may be published anywhere.
    expect(existsSync(join(raceOut, GRAPPLE_SUPPLEMENT_TEST_ID))).toBe(false);
    expect(await readdir(raceOut)).toEqual([]);
  });

  it("leaves the on-disk official v3 bundle unchanged when present", async () => {
    if (!officialSnapshot) return;
    for (const name of OFFICIAL_BASE_ENTRIES) {
      const current = await readFile(
        join(GRID_GRAPPLE_COVERAGE_BASE_V3_DIR, name),
        "utf-8",
      );
      expect(current).toBe(officialSnapshot[name]);
    }
  });
});
