import { describe, expect, it } from "vitest";
import seedFixture from "../../data/seeds/benchmark-100-v1.json";
import { loadSeedBank } from "../../src/bench/seed-bank.js";
import { loadLifecycleFixtureSuite } from "../../src/bench/lifecycle-fixture-schema.js";
import { runBenchmarkSuite } from "../../src/bench/run-lifecycle-suite.js";
import {
  computeFixtureDiagnostics,
  evaluateFixtureGates,
} from "../../src/bench/lifecycle-gates.js";

const suite = loadLifecycleFixtureSuite();
const bank = loadSeedBank(seedFixture);
const smallReport = runBenchmarkSuite({
  suite,
  seedBank: { ...bank, developmentSeeds: bank.developmentSeeds.slice(0, 2) },
  partition: "development",
  fixtureId: "bulwark-guarded-mirror",
});
const fixtureDefinition = suite.fixtures.find(
  (fixture) => fixture.fixtureId === "bulwark-guarded-mirror",
)!;
const fixtureReport = smallReport.fixtureReports[0]!;

describe("lifecycle gate evaluator", () => {
  it("emits pass and not-applicable statuses", () => {
    const gates = evaluateFixtureGates(
      fixtureDefinition,
      fixtureReport.benchmark,
      fixtureReport.audit,
    );
    expect(gates.some((gate) => gate.status === "pass")).toBe(true);
    expect(gates.some((gate) => gate.status === "not-applicable")).toBe(true);
  });

  it("fails exact first-round and terminal-disable boundaries", () => {
    const benchmark = {
      ...fixtureReport.benchmark,
      metrics: {
        ...fixtureReport.benchmark.metrics,
        firstRoundImmobilisationRate: 0.132,
        matchesWithAnyDisable: 0.85,
      },
    };
    const gates = evaluateFixtureGates(fixtureDefinition, benchmark, fixtureReport.audit);
    expect(
      gates.find((gate) => gate.gateId === "first-round-immobilisation")?.status,
    ).toBe("fail");
    expect(
      gates.find((gate) => gate.gateId === "terminal-disable-incidence")?.status,
    ).toBe("fail");
  });

  it("marks threshold results diagnostic for the asymmetric fixture", () => {
    const diagnosticDefinition = suite.fixtures.find(
      (fixture) => fixture.fixtureId === "bulwark-vs-glass-cannon",
    )!;
    const gates = evaluateFixtureGates(
      diagnosticDefinition,
      fixtureReport.benchmark,
      fixtureReport.audit,
    );
    expect(
      gates.find((gate) => gate.gateId === "terminal-disable-incidence")?.status,
    ).toBe("diagnostic");
  });

  it("handles zero denominators", () => {
    const benchmark = {
      ...fixtureReport.benchmark,
      totalSimulations: 0,
      perMatch: [],
      metrics: {
        ...fixtureReport.benchmark.metrics,
        totalSimulations: 0,
        totalQualifyingHits: 0,
        totalDamagedTransitions: 0,
        totalDisabledTransitions: 0,
        totalResistedTransitions: 0,
        mobilityDamagedTransitions: 0,
        mobilityDisabledTransitions: 0,
        matchesWithAtLeastOneQualifyingHit: 0,
      },
    };
    const diagnostics = computeFixtureDiagnostics(benchmark, fixtureReport.audit);
    expect(diagnostics.qualifyingHitsPerMatch).toBe(0);
    expect(diagnostics.matchesWithAnyQualifyingHitRate).toBe(0);
    expect(diagnostics.resistanceRate).toBeNull();
  });
});
