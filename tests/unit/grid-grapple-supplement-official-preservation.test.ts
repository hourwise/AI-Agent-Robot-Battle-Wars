import { beforeAll, describe, expect, it } from "vitest";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { existsSync } from "node:fs";
import {
  anchorOfficialGridGrappleCoverageSupplement,
  validateGridGrappleCoverageSupplementBundle,
  GRID_GRAPPLE_COVERAGE_BASE_V3_IDENTITY,
  GRID_GRAPPLE_COVERAGE_OFFICIAL_SUPPLEMENT_ID,
  GRID_GRAPPLE_COVERAGE_OFFICIAL_SUPPLEMENT_IDENTITY,
  GRID_GRAPPLE_SUPPLEMENT_BUNDLE_ENTRIES,
} from "../../src/readiness/grid-grapple-supplement-bundle.js";

const OFFICIAL_SUPPLEMENT_DIR = join(
  process.cwd(),
  "data",
  "readiness",
  "grid-supplements",
  GRID_GRAPPLE_COVERAGE_OFFICIAL_SUPPLEMENT_ID,
);

let snapshot: Record<string, string> | null = null;
let available = false;

beforeAll(async () => {
  available = existsSync(OFFICIAL_SUPPLEMENT_DIR);
  if (!available) return;
  snapshot = {};
  for (const name of GRID_GRAPPLE_SUPPLEMENT_BUNDLE_ENTRIES) {
    snapshot[name] = await readFile(join(OFFICIAL_SUPPLEMENT_DIR, name), "utf-8");
  }
});

describe("official grid grapple coverage supplement preservation (Phase 3E2.1 Phase 14)", () => {
  it("is present with exactly the ten fixed artifact names", async () => {
    if (!available) return;
    const files = (await readdir(OFFICIAL_SUPPLEMENT_DIR)).sort();
    expect(files).toEqual([...GRID_GRAPPLE_SUPPLEMENT_BUNDLE_ENTRIES].sort());
    expect(files.length).toBe(10);
  });

  it("passes the strengthened validator and the frozen official anchor", async () => {
    if (!available) return;
    const contents: Record<string, string> = {};
    for (const name of GRID_GRAPPLE_SUPPLEMENT_BUNDLE_ENTRIES) {
      contents[name] = await readFile(join(OFFICIAL_SUPPLEMENT_DIR, name), "utf-8");
    }
    const result = validateGridGrappleCoverageSupplementBundle(
      contents,
      GRID_GRAPPLE_COVERAGE_BASE_V3_IDENTITY,
    );
    expect(result.supplementId).toBe(GRID_GRAPPLE_COVERAGE_OFFICIAL_SUPPLEMENT_ID);
    expect(result.decision).toBe("coverage_confirmed");
    const anchored = anchorOfficialGridGrappleCoverageSupplement(contents);
    expect(anchored).toEqual(GRID_GRAPPLE_COVERAGE_OFFICIAL_SUPPLEMENT_IDENTITY);
  });

  it("reports the exact official grapple metrics", async () => {
    if (!available) return;
    const metrics = JSON.parse(
      await readFile(join(OFFICIAL_SUPPLEMENT_DIR, "metrics.json"), "utf-8"),
    ) as {
      execution: {
        totalPlannedRuns: number;
        totalCompletedRuns: number;
        deterministicRuns: number;
      };
      grapple: {
        totalGrapplerAttackAttempts: number;
        totalGrapplerHits: number;
        totalGrapplerMisses: number;
        validGrappleRepositionEvents: number;
        sameCellGrapplerHitsWithoutReposition: number;
        fighterAAttackerRepositionCount: number;
        fighterBAttackerRepositionCount: number;
        distinctSeedsProducingFighterAAttackerReposition: number;
        distinctSeedsProducingFighterBAttackerReposition: number;
      };
      isolation: {
        grappleEventsAttributedToWrongFighter: number;
        malformedOrResolverDisagreeingGrappleEvents: number;
      };
    };
    expect(metrics.execution.totalPlannedRuns).toBe(48);
    expect(metrics.execution.totalCompletedRuns).toBe(48);
    expect(metrics.execution.deterministicRuns).toBe(48);
    expect(metrics.grapple.totalGrapplerAttackAttempts).toBe(480);
    expect(metrics.grapple.totalGrapplerHits).toBe(204);
    expect(metrics.grapple.totalGrapplerMisses).toBe(276);
    expect(metrics.grapple.validGrappleRepositionEvents).toBe(8);
    expect(metrics.grapple.fighterAAttackerRepositionCount).toBe(4);
    expect(metrics.grapple.fighterBAttackerRepositionCount).toBe(4);
    expect(metrics.grapple.distinctSeedsProducingFighterAAttackerReposition).toBe(4);
    expect(metrics.grapple.distinctSeedsProducingFighterBAttackerReposition).toBe(4);
    expect(metrics.grapple.sameCellGrapplerHitsWithoutReposition).toBe(186);
    expect(metrics.isolation.grappleEventsAttributedToWrongFighter).toBe(0);
    expect(metrics.isolation.malformedOrResolverDisagreeingGrappleEvents).toBe(0);
  });

  it("leaves every official supplement artifact byte-for-byte unchanged", async () => {
    if (!available) return;
    for (const name of GRID_GRAPPLE_SUPPLEMENT_BUNDLE_ENTRIES) {
      const current = await readFile(join(OFFICIAL_SUPPLEMENT_DIR, name), "utf-8");
      expect(current).toBe(snapshot![name]);
    }
  });
});
