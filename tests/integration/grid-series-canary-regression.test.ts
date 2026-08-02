import { describe, expect, it } from "vitest";
import { executeGridSeriesCanary } from "../../src/canary/grid-series-canary-core.js";
import { buildGridSeriesCanarySeriesRecord } from "../../src/canary/grid-series-canary-series.js";
import { serializeSeriesRecord } from "../../src/schemas/series.schema.js";
import { serializeGridSeriesCanaryEnvelope } from "../../src/schemas/grid-series-canary-envelopes.schema.js";
import { sha256Hex } from "../../src/canary/grid-canary-digest.js";
import { runGridSeriesCanary } from "../../src/app/grid-series-canary.js";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const IDS = [
  "11111111-1111-4111-8111-111111111111",
  "22222222-2222-4222-8222-222222222222",
  "33333333-3333-4333-8333-333333333333",
];
const SERIES_ID = "44444444-4444-4444-8444-444444444444";
const CREATED_AT = "2024-06-01T00:00:00.000Z";
const BASE_SEED = 3;

/**
 * Frozen regression digests for the grid adaptive-series canary at seed 3
 * with fixed injected identities (Milestone 0.2C Phase 3D2B.1). These prove
 * the three-match event streams and the adaptation outputs remain unchanged
 * for existing test seeds. If any simulator, scenario, policy, adaptation or
 * identity-binding behaviour changes, these digests change and this test
 * fails closed.
 */
const FROZEN_MATCHES_DIGEST =
  "6b26b93c86fd8616e5739b7e873d1b107ca42afe4419a2d12e2396d63305f265";
const FROZEN_REPORTS_DIGEST =
  "d64989cabf2a67487c722cfdc58dc35e8b3664ed6ef30201210a0bddab0ed8f4";
const FROZEN_TRACE_DIGEST =
  "f0fa33db0114055c8bc094ea6cac065f754c2d3fa73e86f14a6134f46c301dbc";
const FROZEN_SERIES_DIGEST =
  "11ac219a56964e061f0c74716eb4ee3e84a65157e7f263b3b4ca44a4c330ff81";
const FROZEN_RESULTS = "fighter_b|judges|20,fighter_a|judges|20,fighter_a|judges|20";

describe("grid series canary frozen regression (Phase 3D2B.1)", () => {
  it("keeps the frozen three-match event streams and adaptation outputs for seed 3", () => {
    const outcome = executeGridSeriesCanary({
      baseSeed: BASE_SEED,
      seriesId: SERIES_ID,
      matchIdentities: IDS.map((matchId) => ({ matchId, createdAt: CREATED_AT })),
    });

    expect(
      outcome.matches.map((m) => `${m.winner}|${m.resultMethod}|${m.rounds}`).join(","),
    ).toBe(FROZEN_RESULTS);

    const serializedMatches = serializeGridSeriesCanaryEnvelope({
      schemaVersion: "1",
      seriesId: SERIES_ID,
      items: outcome.matches.map((m) => m.record),
    });
    expect(sha256Hex(serializedMatches)).toBe(FROZEN_MATCHES_DIGEST);

    const serializedReports = serializeGridSeriesCanaryEnvelope({
      schemaVersion: "1",
      seriesId: SERIES_ID,
      items: outcome.matches.map((m) => m.report),
    });
    expect(sha256Hex(serializedReports)).toBe(FROZEN_REPORTS_DIGEST);

    expect(sha256Hex(outcome.serializedAdaptationTrace)).toBe(FROZEN_TRACE_DIGEST);

    const series = buildGridSeriesCanarySeriesRecord({
      seriesId: SERIES_ID,
      createdAt: CREATED_AT,
      updatedAt: CREATED_AT,
      matches: outcome.matches,
    });
    expect(sha256Hex(serializeSeriesRecord(series))).toBe(FROZEN_SERIES_DIGEST);
  });

  it("keeps the series-grid canary artifact versions frozen (record v3 / report v2 / series v2 / manifest v1)", async () => {
    const root = await mkdtemp(join(tmpdir(), "series-canary-reg-"));
    try {
      let i = 0;
      const ids = [
        "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
        "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2",
        "cccccccc-cccc-4ccc-8ccc-ccccccccccc3",
        "dddddddd-dddd-4ddd-8ddd-ddddddddddd4",
        "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee5",
      ];
      const outcome = await runGridSeriesCanary(
        { baseSeed: BASE_SEED, outputRoot: root },
        {
          createUuid: () => ids[i++]!,
          now: () => new Date(CREATED_AT),
        },
      );
      const files = (await readdir(outcome.artifactDirectory)).sort();
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
      expect(outcome.manifest.schemaVersion).toBe("1");
      expect(outcome.manifest.simulatorVersion).toBe("0.3.0");
      expect(outcome.manifest.positioningModel).toBe("grid-3x3-v1");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
