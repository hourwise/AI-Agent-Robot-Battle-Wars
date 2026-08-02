import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SeedBank } from "../../src/bench/benchmark.types.js";
import type { ResolvedLifecycleFixtureSuite } from "../../src/bench/lifecycle-suite.types.js";

// The simulation entry point is wrapped so the authorisation tests can prove
// that a rejected partition never reaches match simulation, while the
// development path still executes through the real implementation.
const runBenchmarkDetailedMock = vi.hoisted(() => vi.fn());

vi.mock("../../src/bench/run-benchmark.js", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../../src/bench/run-benchmark.js")>();
  return {
    ...actual,
    runBenchmarkDetailed: runBenchmarkDetailedMock.mockImplementation(
      actual.runBenchmarkDetailed,
    ),
  };
});

import {
  parseLifecycleBenchmarkArgs,
  runLifecycleBenchmarkCli,
} from "../../src/app/run-lifecycle-benchmark.js";
import { loadLifecycleFixtureSuite } from "../../src/bench/lifecycle-fixture-schema.js";
import { runBenchmarkSuite } from "../../src/bench/run-lifecycle-suite.js";

/** Synthetic seed bank: never reads the authoritative seed fixture. */
function syntheticBank(): SeedBank {
  return {
    schemaVersion: "1",
    bankId: "synthetic-authorization-bank",
    generatorVersion: "test",
    simulatorVersion: "0.2.0",
    rulesetVersion: "0.2.0",
    catalogueVersion: "1",
    developmentSeeds: [101, 202, 303],
    heldOutSeeds: [],
  };
}

/** Reuses the fixture manifest (contains no seed values). */
function syntheticSuite(): ResolvedLifecycleFixtureSuite {
  return loadLifecycleFixtureSuite();
}

describe("lifecycle benchmark authorisation after the AB2 held-out seal", () => {
  beforeEach(() => {
    runBenchmarkDetailedMock.mockClear();
  });

  it("rejects held-out through the CLI before any simulation", () => {
    expect(() => runLifecycleBenchmarkCli(["--partition", "held-out"])).toThrow(
      /permanently sealed/i,
    );
    expect(runBenchmarkDetailedMock).not.toHaveBeenCalled();
  });

  it("cannot be reopened by the historical confirmation flag", () => {
    const historicalCommand = [
      "--partition",
      "held-out",
      "--qualification",
      "component-impact-ab2",
      "--confirm-held-out",
    ];
    expect(() => parseLifecycleBenchmarkArgs(historicalCommand)).toThrow(
      "Unknown or incomplete argument: --confirm-held-out",
    );
    expect(() => runLifecycleBenchmarkCli(historicalCommand)).toThrow(
      "Unknown or incomplete argument: --confirm-held-out",
    );
    expect(runBenchmarkDetailedMock).not.toHaveBeenCalled();
  });

  it("keeps the all partition rejected through the CLI", () => {
    expect(() => runLifecycleBenchmarkCli(["--partition", "all"])).toThrow(/prohibited/i);
    expect(runBenchmarkDetailedMock).not.toHaveBeenCalled();
  });

  it("rejects held-out and all through the suite runner without simulation", () => {
    const suite = syntheticSuite();
    const bank = syntheticBank();
    expect(() =>
      runBenchmarkSuite({ suite, seedBank: bank, partition: "held-out" }),
    ).toThrow(/permanently sealed/i);
    expect(() => runBenchmarkSuite({ suite, seedBank: bank, partition: "all" })).toThrow(
      /prohibited/i,
    );
    expect(() =>
      runBenchmarkSuite({
        suite,
        seedBank: bank,
        partition: "held-out",
        componentQualificationId: "component-impact-ab2",
      }),
    ).toThrow(/permanently sealed/i);
    expect(runBenchmarkDetailedMock).not.toHaveBeenCalled();
  });

  it("still parses the development CLI shape without a confirmation flag", () => {
    expect(parseLifecycleBenchmarkArgs(["--partition", "development"])).toMatchObject({
      partition: "development",
    });
    expect(
      parseLifecycleBenchmarkArgs([
        "--partition",
        "development",
        "--qualification",
        "component-impact-c2",
        "--fixture",
        "glass-cannon-mirror",
        "--json",
      ]),
    ).toMatchObject({
      partition: "development",
      qualificationId: "component-impact-c2",
      fixtureId: "glass-cannon-mirror",
      json: true,
    });
  });

  it("still runs the development partition through the suite runner", () => {
    const suite = syntheticSuite();
    const bank = syntheticBank();
    const report = runBenchmarkSuite({
      suite,
      seedBank: bank,
      partition: "development",
    });
    expect(report.partition).toBe("development");
    expect(report.fixtureReports.length).toBeGreaterThan(0);
    expect(runBenchmarkDetailedMock).toHaveBeenCalled();
  });
});
