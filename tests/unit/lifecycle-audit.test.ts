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
const bank = loadSeedBank(seedFixture);
const executions = runBenchmarkDetailed({
  label: fixture.fixtureId,
  seedBank: { ...bank, developmentSeeds: bank.developmentSeeds.slice(0, 10) },
  partition: "development",
  fighterA: {
    build: fixture.fighterX.build,
    policy: fixture.fighterX.policy,
    machineName: fixture.fighterX.build.proposal.machineName,
  },
  fighterB: {
    build: fixture.fighterY.build,
    policy: fixture.fighterY.policy,
    machineName: fixture.fighterY.build.proposal.machineName,
  },
  roleSwapped: false,
});

function mutateFirstEvent(
  type: string,
  mutate: (
    event: BenchmarkExecution["match"]["events"][number],
  ) => BenchmarkExecution["match"]["events"][number],
): BenchmarkExecution[] {
  let changed = false;
  return executions.map((execution) => ({
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
  it("accepts deterministic Candidate C1 transitions and separates resistance", () => {
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
      auditLifecycleExecutions(fixture.fixtureId, changed).invalidTransitions.length,
    ).toBeGreaterThan(0);
  });

  it("rejects invalid resistance guard state", () => {
    const changed = mutateFirstEvent("component_damage_resisted", (event) => ({
      ...event,
      data: { ...event.data, guardStateAfter: "available" },
    }));
    expect(
      auditLifecycleExecutions(fixture.fixtureId, changed).guardErrors.length,
    ).toBeGreaterThan(0);
  });

  it("rejects missing Candidate C1 facts instead of filling defaults", () => {
    const changed = mutateFirstEvent("component_damaged", (event) => {
      const data = { ...event.data };
      delete data.rawDamage;
      return { ...event, data };
    });
    expect(
      auditLifecycleExecutions(fixture.fixtureId, changed).factualCompletenessErrors,
    ).toEqual(expect.arrayContaining([expect.stringContaining("rawDamage")]));
  });
});
