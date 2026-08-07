import { describe, expect, it } from "vitest";
import { parseOpponentSuiteCliArgs } from "../../src/app/run-opponent-suite.js";
import {
  formatOpponentSuiteRunV1,
  type OpponentSuiteRunV1,
} from "../../src/opponents/opponent-suite-runner.js";

/**
 * Milestone 0.2D Phase 4 — development-only CLI argument parsing.
 *
 * Pure argument-parser tests only: no provider, no operational command, no
 * match execution. `--runtime` is required and only `legacy` is authorised;
 * `--runtime grid` is rejected as separately unauthorised; `--seed` is
 * required and must be a non-negative safe integer; duplicates, unknown
 * flags and positional arguments fail.
 */

describe("opponent suite development CLI (0.2D Phase 4)", () => {
  it("accepts --runtime legacy --seed 44001", () => {
    const result = parseOpponentSuiteCliArgs(["--runtime", "legacy", "--seed", "44001"]);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.args).toEqual({ runtime: "legacy", seed: 44001 });
    }
  });

  it("rejects a missing --runtime", () => {
    const result = parseOpponentSuiteCliArgs(["--seed", "44001"]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("missing required --runtime");
  });

  it("rejects --runtime grid as separately unauthorised", () => {
    const result = parseOpponentSuiteCliArgs(["--runtime", "grid", "--seed", "44001"]);
    expect(result.ok).toBe(false);
    if (!result.ok)
      expect(result.error).toContain(
        "general grid opponent-suite execution is not authorised",
      );
  });

  it("rejects an unknown runtime", () => {
    const result = parseOpponentSuiteCliArgs(["--runtime", "quantum", "--seed", "44001"]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('runtime must be "legacy"');
  });

  it("rejects a missing --seed", () => {
    const result = parseOpponentSuiteCliArgs(["--runtime", "legacy"]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("missing required --seed");
  });

  it("rejects a negative seed", () => {
    const result = parseOpponentSuiteCliArgs(["--runtime", "legacy", "--seed", "-1"]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("non-negative safe integer");
  });

  it("rejects a fractional seed", () => {
    const result = parseOpponentSuiteCliArgs(["--runtime", "legacy", "--seed", "1.5"]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("non-negative safe integer");
  });

  it("rejects an unsafe integer seed", () => {
    const result = parseOpponentSuiteCliArgs([
      "--runtime",
      "legacy",
      "--seed",
      "9007199254740992",
    ]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("non-negative safe integer");
  });

  it("rejects a non-numeric seed", () => {
    const result = parseOpponentSuiteCliArgs(["--runtime", "legacy", "--seed", "abc"]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("non-negative safe integer");
  });

  it("rejects a duplicate --runtime", () => {
    const result = parseOpponentSuiteCliArgs([
      "--runtime",
      "legacy",
      "--runtime",
      "legacy",
      "--seed",
      "44001",
    ]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("duplicate --runtime");
  });

  it("rejects a duplicate --seed", () => {
    const result = parseOpponentSuiteCliArgs([
      "--runtime",
      "legacy",
      "--seed",
      "44001",
      "--seed",
      "44002",
    ]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("duplicate --seed");
  });

  it("rejects an unknown flag", () => {
    const result = parseOpponentSuiteCliArgs([
      "--runtime",
      "legacy",
      "--seed",
      "44001",
      "--provider",
      "x",
    ]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("unknown argument");
  });

  it("rejects positional opponent IDs and missing flag values", () => {
    expect(parseOpponentSuiteCliArgs(["bulwark", "--seed", "44001"]).ok).toBe(false);
    expect(parseOpponentSuiteCliArgs(["--runtime"]).ok).toBe(false);
    expect(parseOpponentSuiteCliArgs(["--seed"]).ok).toBe(false);
  });

  it("serializes a suite run deterministically as JSON only", () => {
    const run: OpponentSuiteRunV1 = {
      schemaVersion: "1",
      suiteId: "canonical-opponent-suite-v1",
      suiteVersion: 1,
      suiteChecksum: "2a276edc8fe6958cb06b0f2a844dd261a878ccf092da238f8ddc2b381c1b8fae",
      runtime: { simulatorVersion: "0.2.0", positioningModel: "legacy-five-zone-v1" },
      seed: 44001,
      fixtureInventory: [],
      runnableOpponentIds: ["bulwark", "crusher", "spinner", "generalist"],
      incompatibleOpponentIds: ["skirmisher", "controller"],
      matches: [],
    };
    const first = formatOpponentSuiteRunV1(run);
    const second = formatOpponentSuiteRunV1(run);
    expect(second).toBe(first);
    expect(() => JSON.parse(first)).not.toThrow();
    // No timestamp, no paths, no random IDs in the serialized surface.
    const parsed = JSON.parse(first) as Record<string, unknown>;
    expect(parsed).not.toHaveProperty("timestamp");
    expect(parsed).not.toHaveProperty("createdAt");
  });
});
