import { describe, expect, it } from "vitest";
import { parseGridCanaryCliArgs } from "../../src/app/grid-canary-cli-args.js";

describe("grid canary CLI argument contract (Phase 3D2A)", () => {
  it("parses a valid non-negative integer seed", () => {
    expect(parseGridCanaryCliArgs(["--seed", "42"])).toEqual({ seed: 42 });
    expect(parseGridCanaryCliArgs(["--seed", "0"])).toEqual({ seed: 0 });
  });

  it("rejects a missing seed", () => {
    expect(() => parseGridCanaryCliArgs([])).toThrow(/Missing required --seed/);
    expect(() => parseGridCanaryCliArgs(["--seed"])).toThrow(/Missing value for --seed/);
  });

  it("rejects a negative seed", () => {
    expect(() => parseGridCanaryCliArgs(["--seed", "-1"])).toThrow(/non-negative/);
  });

  it("rejects a non-integer seed", () => {
    for (const raw of ["1.5", "abc", "", "--ai", "1e3"]) {
      expect(() => parseGridCanaryCliArgs(["--seed", raw])).toThrow(
        /--seed must be an integer/,
      );
    }
  });

  it("rejects duplicate seed arguments", () => {
    expect(() => parseGridCanaryCliArgs(["--seed", "1", "--seed", "2"])).toThrow(
      /Duplicate --seed/,
    );
  });

  it("rejects unknown arguments", () => {
    expect(() => parseGridCanaryCliArgs(["1"])).toThrow(/Unknown argument: 1/);
    expect(() => parseGridCanaryCliArgs(["--seed", "1", "extra"])).toThrow(
      /Unknown argument: extra/,
    );
  });

  it("rejects --ai and --review", () => {
    expect(() => parseGridCanaryCliArgs(["--seed", "1", "--ai"])).toThrow(
      /Unsupported argument: --ai/,
    );
    expect(() => parseGridCanaryCliArgs(["--seed", "1", "--review"])).toThrow(
      /Unsupported argument: --review/,
    );
  });

  it("rejects runtime-selection flags", () => {
    for (const flag of ["--runtime", "--grid", "--legacy", "--mode"]) {
      expect(() => parseGridCanaryCliArgs(["--seed", "1", flag])).toThrow(
        /Unsupported argument/,
      );
    }
  });

  it("rejects provider arguments", () => {
    for (const flag of ["--provider", "--api-key", "--model", "--ai-provider"]) {
      expect(() => parseGridCanaryCliArgs(["--seed", "1", flag])).toThrow(
        /Unsupported argument/,
      );
    }
  });

  it("rejects a seed supplied via the --seed=value form", () => {
    expect(() => parseGridCanaryCliArgs(["--seed=5"])).toThrow(
      /Unsupported argument: --seed=5/,
    );
  });
});
