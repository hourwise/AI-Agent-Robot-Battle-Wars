import { describe, expect, it } from "vitest";
import seedFixture from "../../data/seeds/benchmark-100-v1.json";
import { loadSeedBank } from "../../src/bench/seed-bank.js";
import { loadLifecycleFixtureSuite } from "../../src/bench/lifecycle-fixture-schema.js";
import { runBenchmarkSuite } from "../../src/bench/run-lifecycle-suite.js";
import { runLifecycleBenchmarkCli } from "../../src/app/run-lifecycle-benchmark.js";

const suite = loadLifecycleFixtureSuite();
const bank = loadSeedBank(seedFixture);
const fullReport = runBenchmarkSuite({
  suite,
  seedBank: bank,
  partition: "development",
});

describe("component lifecycle suite runner", () => {
  it("runs all fixtures with the expected development simulation totals", () => {
    expect(
      fullReport.fixtureReports.map((fixture) => fixture.benchmark.totalSimulations),
    ).toEqual([80, 80, 80, 160]);
    expect(fullReport.aggregateLifecycleSummary.totalSimulations).toBe(400);
  });

  it("role-swaps the asymmetric fixture and reports competitor identities", () => {
    const fixture = fullReport.fixtureReports.find(
      (candidate) => candidate.fixtureId === "bulwark-vs-glass-cannon",
    )!;
    expect(fixture.benchmark.roleSwapped).toBe(true);
    expect(fixture.benchmark.roleAssignmentsPerSeed).toBe(2);
    expect(fixture.benchmark.metrics.competitorOutcomes).not.toBeNull();
  });

  it("reproduces the guarded Bulwark development checksums", () => {
    const fixture = fullReport.fixtureReports.find(
      (candidate) => candidate.fixtureId === "bulwark-guarded-mirror",
    )!;
    expect(fixture.benchmark.outcomesChecksum).toBe("6d5ccc01ddc76064");
    expect(fixture.benchmark.reportChecksum).toBe("2df267be422b70ab");
  });

  it("has a stable full-suite checksum and explicit decision", () => {
    expect(fullReport.suiteChecksum).toBe("04fe9aeb6cd48dbe");
    expect(fullReport.decision).toBe(
      "B. Candidate C1 fails revised lifecycle gates and requires one bounded tuning candidate.",
    );
  });

  it("is deterministic on a bounded development-only bank", () => {
    const smallBank = {
      ...bank,
      developmentSeeds: bank.developmentSeeds.slice(0, 2),
    };
    const first = runBenchmarkSuite({
      suite,
      seedBank: smallBank,
      partition: "development",
    });
    const second = runBenchmarkSuite({
      suite,
      seedBank: smallBank,
      partition: "development",
    });
    expect(second).toEqual(first);
  });

  it("supports selecting a single fixture", () => {
    const selected = runBenchmarkSuite({
      suite,
      seedBank: bank,
      partition: "development",
      fixtureId: "bulwark-guarded-mirror",
    });
    expect(selected.fixtureReports).toHaveLength(1);
    expect(selected.fixtureReports[0]!.fixtureId).toBe("bulwark-guarded-mirror");
    expect(selected.aggregateLifecycleSummary.totalSimulations).toBe(80);
  });

  it("rejects held-out and all partitions before executing matches", () => {
    expect(() =>
      runBenchmarkSuite({ suite, seedBank: bank, partition: "held-out" }),
    ).toThrow("development-only");
    expect(() => runBenchmarkSuite({ suite, seedBank: bank, partition: "all" })).toThrow(
      "development-only",
    );
    expect(() => runLifecycleBenchmarkCli(["--partition", "held-out"])).toThrow(
      'Only "development" is authorised',
    );
  });
});
