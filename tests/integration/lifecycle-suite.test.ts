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
const c1Report = runBenchmarkSuite({
  suite,
  seedBank: bank,
  partition: "development",
  componentQualificationId: "component-impact-c1",
});

describe("component lifecycle suite runner", () => {
  it("runs all fixtures with the expected development simulation totals", () => {
    expect(
      fullReport.fixtureReports.map((fixture) => fixture.benchmark.totalSimulations),
    ).toEqual([80, 80, 80, 80, 160]);
    expect(fullReport.aggregateLifecycleSummary.totalSimulations).toBe(480);
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
    expect(fixture.benchmark.outcomesChecksum).toBe("8d102dba45ac9eab");
    expect(fixture.benchmark.reportChecksum).toBe("ce1c4395639f4e34");
  });

  it("has a stable full-suite checksum and explicit decision", () => {
    expect(fullReport.fixtureChecksum).toBe("ffc11deb47e6049f");
    expect(fullReport.suiteChecksum).toBe("801981a42474b5b6");
    expect(fullReport.decision).toBe(
      "B. Selected qualification fails revised lifecycle gates.",
    );
  });

  it("reproduces C1 and C2 gameplay from one qualification-independent fixture", () => {
    expect(c1Report.fixtureChecksum).toBe(fullReport.fixtureChecksum);
    expect(c1Report.componentQualification).toEqual({
      id: "component-impact-c1",
      configChecksum: "2a40a56f97062ca3",
      model: "linear-component-impact",
    });
    expect(fullReport.componentQualification).toEqual({
      id: "component-impact-c2",
      configChecksum: "13548462df34a183",
      model: "linear-component-impact",
    });
    const outcomes = (report: typeof fullReport) =>
      Object.fromEntries(
        report.fixtureReports.map((fixture) => [
          fixture.fixtureId,
          fixture.benchmark.outcomesChecksum,
        ]),
      );
    expect(outcomes(c1Report)).toMatchObject({
      "bulwark-guarded-mirror": "6d5ccc01ddc76064",
      "bulwark-unguarded-mirror": "8b182f2598cad6d6",
      "glass-cannon-mirror": "07154dc578aa035f",
      "bulwark-vs-glass-cannon": "af4a1c74f7dce919",
    });
    expect(outcomes(fullReport)).toMatchObject({
      "bulwark-guarded-mirror": "8d102dba45ac9eab",
      "bulwark-unguarded-mirror": "6bc03ef696d68955",
      "glass-cannon-mirror": "dc9194c55baebc4f",
      "bulwark-vs-glass-cannon": "4a36189adcfda57f",
    });
    expect(c1Report.suiteChecksum).toBe("3289f1c9e4ab8398");
    expect(c1Report.suiteChecksum).not.toBe(fullReport.suiteChecksum);
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

  it("supports registered CLI selection and rejects unknown qualification IDs", () => {
    const listed = runLifecycleBenchmarkCli(["--list-qualifications"]);
    expect(listed).toContain(
      "component-impact-c1: linear-component-impact, checksum 2a40a56f97062ca3",
    );
    expect(listed).toContain("component-impact-c2 (default)");
    expect(() =>
      runLifecycleBenchmarkCli([
        "--partition",
        "development",
        "--qualification",
        "component-impact-unknown",
      ]),
    ).toThrow("Unknown component qualification ID");
  });
});
