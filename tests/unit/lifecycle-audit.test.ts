import { describe, expect, it } from "vitest";
import seedFixture from "../../data/seeds/benchmark-100-v1.json";
import { loadSeedBank } from "../../src/bench/seed-bank.js";
import { loadLifecycleFixtureSuite } from "../../src/bench/lifecycle-fixture-schema.js";
import { runBenchmarkDetailed } from "../../src/bench/run-benchmark.js";
import { auditLifecycleExecutions } from "../../src/bench/lifecycle-audit.js";
import type { BenchmarkExecution } from "../../src/bench/lifecycle-suite.types.js";

const suite = loadLifecycleFixtureSuite();
const fixture = suite.fixtures.find(
  (candidate) => candidate.fixtureId === "bulwark-guarded-mirror",
)!;
const transitionFixture = suite.fixtures.find(
  (candidate) => candidate.fixtureId === "glass-cannon-mirror",
)!;
const bank = loadSeedBank(seedFixture);
function executionsFor(selectedFixture: typeof fixture) {
  return runBenchmarkDetailed({
    label: selectedFixture.fixtureId,
    seedBank: bank,
    partition: "development",
    fighterA: {
      build: selectedFixture.fighterX.build,
      policy: selectedFixture.fighterX.policy,
      machineName: selectedFixture.fighterX.build.proposal.machineName,
    },
    fighterB: {
      build: selectedFixture.fighterY.build,
      policy: selectedFixture.fighterY.policy,
      machineName: selectedFixture.fighterY.build.proposal.machineName,
    },
    roleSwapped: false,
  });
}
const executions = executionsFor(fixture);
const transitionExecutions = executionsFor(transitionFixture);

function mutateFirstEvent(
  type: string,
  mutate: (
    event: BenchmarkExecution["match"]["events"][number],
  ) => BenchmarkExecution["match"]["events"][number],
  source = transitionExecutions,
): BenchmarkExecution[] {
  let changed = false;
  return source.map((execution) => ({
    ...execution,
    match: {
      ...execution.match,
      events: execution.match.events.map((event) => {
        if (!changed && event.type === type) {
          changed = true;
          return mutate(event);
        }
        return event;
      }),
    },
  }));
}

describe("lifecycle event audit", () => {
  it("accepts deterministic Candidate C2 transitions and separates resistance", () => {
    const audit = auditLifecycleExecutions(fixture.fixtureId, executions);
    expect(audit.invalidTransitions).toEqual([]);
    expect(audit.guardErrors).toEqual([]);
    expect(audit.factualCompletenessErrors).toEqual([]);
    expect(
      audit.transitionRecords.some(
        (record) => record.eventType === "component_damage_resisted",
      ),
    ).toBe(true);
    expect(
      executions.reduce(
        (sum, execution) => sum + execution.perMatch.componentDamagedTransitions,
        0,
      ),
    ).toBe(
      audit.transitionRecords.filter((record) => record.eventType === "component_damaged")
        .length,
    );
  });

  it("rejects a healthy-to-disabled transition", () => {
    const changed = mutateFirstEvent("component_damaged", (event) => ({
      ...event,
      type: "component_disabled",
      data: {
        ...event.data,
        previousState: "healthy",
        newState: "disabled",
      },
    }));
    expect(
      auditLifecycleExecutions(transitionFixture.fixtureId, changed).invalidTransitions.length,
    ).toBeGreaterThan(0);
  });

  it("rejects invalid resistance guard state", () => {
    const changed = mutateFirstEvent("component_damage_resisted", (event) => ({
      ...event,
      data: { ...event.data, guardStateAfter: "available" },
    }), executions);
    expect(
      auditLifecycleExecutions(fixture.fixtureId, changed).guardErrors.length,
    ).toBeGreaterThan(0);
  });

  it("rejects missing Candidate C2 facts instead of filling defaults", () => {
    const changed = mutateFirstEvent("component_damaged", (event) => {
      const data = { ...event.data };
      delete data.rawDamage;
      return { ...event, data };
    });
    expect(
      auditLifecycleExecutions(transitionFixture.fixtureId, changed).factualCompletenessErrors,
    ).toEqual(expect.arrayContaining([expect.stringContaining("rawDamage")]));
  });
});
