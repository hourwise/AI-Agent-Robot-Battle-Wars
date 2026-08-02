import { describe, expect, it } from "vitest";
import { parseGridSeriesCanaryCliArgs } from "../../src/app/grid-series-canary-cli-args.js";
import { GRID_SERIES_CANARY_MAX_BASE_SEED } from "../../src/canary/grid-series-canary-seed-plan.js";

describe("grid series canary CLI args (Phase 3D2B)", () => {
  it("parses a valid base seed", () => {
    expect(parseGridSeriesCanaryCliArgs(["--seed", "3"])).toEqual({ baseSeed: 3 });
    expect(parseGridSeriesCanaryCliArgs(["--seed", "0"])).toEqual({ baseSeed: 0 });
    expect(
      parseGridSeriesCanaryCliArgs(["--seed", String(GRID_SERIES_CANARY_MAX_BASE_SEED)]),
    ).toEqual({ baseSeed: GRID_SERIES_CANARY_MAX_BASE_SEED });
  });

  it("rejects a missing seed", () => {
    expect(() => parseGridSeriesCanaryCliArgs([])).toThrow(/Missing required --seed/);
    expect(() => parseGridSeriesCanaryCliArgs(["--seed"])).toThrow(/Missing value/);
  });

  it("rejects a negative seed", () => {
    expect(() => parseGridSeriesCanaryCliArgs(["--seed", "-1"])).toThrow(/non-negative/);
  });

  it("rejects a non-integer seed", () => {
    expect(() => parseGridSeriesCanaryCliArgs(["--seed", "3.5"])).toThrow(/integer/);
    expect(() => parseGridSeriesCanaryCliArgs(["--seed", "abc"])).toThrow(/integer/);
  });

  it("rejects an unsafe seed", () => {
    expect(() =>
      parseGridSeriesCanaryCliArgs(["--seed", String(Number.MAX_SAFE_INTEGER + 1)]),
    ).toThrow(/safe integer/);
  });

  it("rejects an overflowing base seed", () => {
    expect(() =>
      parseGridSeriesCanaryCliArgs([
        "--seed",
        String(GRID_SERIES_CANARY_MAX_BASE_SEED + 1),
      ]),
    ).toThrow(/at most/);
  });

  it("rejects a duplicate seed", () => {
    expect(() => parseGridSeriesCanaryCliArgs(["--seed", "3", "--seed", "4"])).toThrow(
      /Duplicate/,
    );
  });

  it("rejects unknown and positional arguments", () => {
    expect(() => parseGridSeriesCanaryCliArgs(["--seed", "3", "extra"])).toThrow(
      /Unknown argument/,
    );
    expect(() => parseGridSeriesCanaryCliArgs(["--wat", "3"])).toThrow(
      /Unsupported argument/,
    );
  });

  it("rejects target-wins and maximum-matches overrides", () => {
    for (const flag of [
      "--target-wins",
      "--targetwins",
      "--maximum-matches",
      "--max-matches",
    ]) {
      expect(() => parseGridSeriesCanaryCliArgs(["--seed", "3", flag, "1"])).toThrow(
        /Unsupported argument/,
      );
    }
  });

  it("rejects runtime selectors", () => {
    for (const flag of ["--runtime", "--simulator", "--model", "--positioning"]) {
      expect(() => parseGridSeriesCanaryCliArgs(["--seed", "3", flag, "x"])).toThrow(
        /Unsupported argument/,
      );
    }
  });

  it("rejects --ai, --review, provider and API-key arguments", () => {
    for (const flag of ["--ai", "--review", "--provider", "--api-key", "--apikey"]) {
      expect(() => parseGridSeriesCanaryCliArgs(["--seed", "3", flag])).toThrow(
        /Unsupported argument/,
      );
    }
  });
});
