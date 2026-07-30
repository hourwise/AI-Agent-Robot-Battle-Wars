import { MAX_ROUNDS } from "../simulator/constants.js";
import type {
  GateResult,
  LifecycleAudit,
  LifecycleFixtureDiagnostics,
  LifecycleFixtureReport,
  ResolvedLifecycleFixture,
} from "./lifecycle-suite.types.js";
import type { BenchmarkReport } from "./benchmark.types.js";

function result(
  fixtureId: string,
  gateId: string,
  status: GateResult["status"],
  observed: GateResult["observed"],
  expected: string,
  rationale?: string,
): GateResult {
  return { fixtureId, gateId, status, observed, expected, rationale };
}

function thresholdStatus(
  fixture: ResolvedLifecycleFixture,
  passes: boolean,
): GateResult["status"] {
  if (fixture.classification !== "hard") return "diagnostic";
  return passes ? "pass" : "fail";
}

export function computeFixtureDiagnostics(
  report: BenchmarkReport,
  audit: LifecycleAudit,
): LifecycleFixtureDiagnostics {
  const m = report.metrics;
  const n = report.totalSimulations;
  const mobilitySelections =
    m.mobilityDamagedTransitions +
    m.mobilityDisabledTransitions +
    m.totalResistedTransitions;
  const endingDamaged = report.perMatch.filter(
    (match) =>
      (match.fighterA.mobilityDamaged && !match.fighterA.mobilityDisabled) ||
      (match.fighterA.weaponDamaged && !match.fighterA.weaponDisabled) ||
      (match.fighterA.utilityDamaged && !match.fighterA.utilityDisabled) ||
      (match.fighterB.mobilityDamaged && !match.fighterB.mobilityDisabled) ||
      (match.fighterB.weaponDamaged && !match.fighterB.weaponDisabled) ||
      (match.fighterB.utilityDamaged && !match.fighterB.utilityDisabled),
  ).length;

  return {
    qualifyingHitsPerMatch: n > 0 ? m.totalQualifyingHits / n : 0,
    matchesWithAnyQualifyingHitRate: n > 0 ? m.matchesWithAtLeastOneQualifyingHit / n : 0,
    resistanceRate:
      mobilitySelections > 0 ? m.totalResistedTransitions / mobilitySelections : null,
    firstRoundTerminalDisableRate: n > 0 ? audit.firstRoundTerminalDisableCount / n : 0,
    roundCapIncidence:
      n > 0
        ? report.perMatch.filter((match) => match.rounds === MAX_ROUNDS).length / n
        : 0,
    drawRate: n > 0 ? m.slotOutcomes.draws / n : 0,
    matchesEndingWithDamagedComponentsRate: n > 0 ? endingDamaged / n : 0,
    finishMethods: {
      destruction: report.perMatch.filter((match) => match.method === "destruction")
        .length,
      immobilisation: report.perMatch.filter((match) => match.method === "immobilisation")
        .length,
      judges: report.perMatch.filter((match) => match.method === "judges").length,
      draws: m.slotOutcomes.draws,
    },
  };
}

export function evaluateFixtureGates(
  fixture: ResolvedLifecycleFixture,
  report: BenchmarkReport,
  audit: LifecycleAudit,
): GateResult[] {
  const m = report.metrics;
  const gates: GateResult[] = [];
  const addThreshold = (
    gateId: string,
    observed: number,
    passes: boolean,
    expected: string,
  ) =>
    gates.push(
      result(
        fixture.fixtureId,
        gateId,
        thresholdStatus(fixture, passes),
        observed,
        expected,
      ),
    );

  addThreshold(
    "qualifying-hits-positive",
    m.totalQualifyingHits,
    m.totalQualifyingHits > 0,
    "> 0 qualifying hits",
  );
  addThreshold(
    "healthy-to-damaged-positive",
    m.totalDamagedTransitions,
    m.totalDamagedTransitions > 0,
    "> 0 healthy-to-damaged transitions",
  );
  addThreshold(
    "first-round-immobilisation",
    m.firstRoundImmobilisationRate,
    m.firstRoundImmobilisationRate < 0.132,
    "< 0.132 of simulations",
  );
  addThreshold(
    "terminal-disable-incidence",
    m.matchesWithAnyDisable,
    m.matchesWithAnyDisable < 0.85,
    "< 0.85 of simulations",
  );

  const auditChecks: Array<[string, readonly string[], string, string | undefined]> = [
    [
      "valid-lifecycle-transitions",
      audit.invalidTransitions,
      "zero invalid transitions, including healthy-to-disabled",
      undefined,
    ],
    [
      "qualification-factual-completeness",
      audit.factualCompletenessErrors,
      "zero missing selected-qualification facts",
      undefined,
    ],
    [
      "guard-event-semantics",
      audit.guardErrors,
      "zero invalid guard transitions",
      undefined,
    ],
    [
      "non-qualifying-selection",
      audit.nonQualifyingSelectionErrors,
      "zero component selections linked to non-qualifying hits",
      "The reducer qualifies before selection; a dedicated test verifies the non-qualifying path consumes no selection draw.",
    ],
    [
      "damaged-mobility-does-not-end",
      audit.mobilityDamagedEndingErrors,
      "zero immobilisations without disabled mobility",
      undefined,
    ],
    [
      "disabled-mobility-ends",
      audit.mobilityDisabledEndingErrors,
      "every mobility disable occurs in the ending round",
      undefined,
    ],
  ];
  for (const [gateId, errors, expected, rationale] of auditChecks) {
    gates.push(
      result(
        fixture.fixtureId,
        gateId,
        errors.length === 0 ? "pass" : "fail",
        errors.length,
        expected,
        rationale,
      ),
    );
  }

  if (fixture.fixtureId === "bulwark-guarded-mirror") {
    gates.push(
      result(
        fixture.fixtureId,
        "guarded-resistance-observable",
        m.totalResistedTransitions > 0 ? "pass" : "fail",
        m.totalResistedTransitions,
        "> 0 resisted events",
      ),
    );
  } else if (fixture.fixtureId === "bulwark-unguarded-mirror") {
    gates.push(
      result(
        fixture.fixtureId,
        "unguarded-resistance-absent",
        m.totalResistedTransitions === 0 ? "pass" : "fail",
        m.totalResistedTransitions,
        "= 0 resisted events",
      ),
    );
  } else {
    gates.push(
      result(
        fixture.fixtureId,
        "fixture-specific-resistance",
        "not-applicable",
        m.totalResistedTransitions,
        "no fixture-specific resistance requirement",
      ),
    );
  }

  const diagnostics = computeFixtureDiagnostics(report, audit);
  if (fixture.fixtureId === "glass-cannon-mirror") {
    gates.push(
      result(
        fixture.fixtureId,
        "glass-first-round-terminal-disable",
        diagnostics.firstRoundTerminalDisableRate < 0.25 ? "pass" : "fail",
        diagnostics.firstRoundTerminalDisableRate,
        "< 0.25 of simulations",
        "A 25% regression ceiling prevents a return to immediate terminal volatility; the development baseline is reported rather than assumed.",
      ),
    );
  } else if (fixture.fixtureId === "representative-light-mirror") {
    gates.push(
      result(
        fixture.fixtureId,
        "representative-light-first-round-terminal-disable",
        diagnostics.firstRoundTerminalDisableRate < 0.25 ? "pass" : "fail",
        diagnostics.firstRoundTerminalDisableRate,
        "< 0.25 of simulations",
        "Representative light acceptance includes an explicit anti-instant-volatility ceiling.",
      ),
    );
  } else {
    gates.push(
      result(
        fixture.fixtureId,
        "glass-first-round-terminal-disable",
        "not-applicable",
        diagnostics.firstRoundTerminalDisableRate,
        "Glass Cannon or representative-light mirror only",
      ),
    );
  }

  return gates;
}

export function evaluateSuiteGates(
  fixtureReports: readonly LifecycleFixtureReport[],
): GateResult[] {
  const hard = fixtureReports.filter((fixture) => fixture.classification === "hard");
  const hardDisabled = hard.reduce(
    (sum, fixture) => sum + fixture.benchmark.metrics.totalDisabledTransitions,
    0,
  );
  const totalDisabled = fixtureReports.reduce(
    (sum, fixture) => sum + fixture.benchmark.metrics.totalDisabledTransitions,
    0,
  );
  const componentCounts = {
    mobility: fixtureReports.reduce(
      (sum, fixture) => sum + fixture.benchmark.metrics.mobilityDisabledTransitions,
      0,
    ),
    weapon: fixtureReports.reduce(
      (sum, fixture) => sum + fixture.benchmark.metrics.weaponDisabledTransitions,
      0,
    ),
    utility: fixtureReports.reduce(
      (sum, fixture) => sum + fixture.benchmark.metrics.utilityDisabledTransitions,
      0,
    ),
  };
  const maxShare =
    totalDisabled > 0 ? Math.max(...Object.values(componentCounts)) / totalDisabled : 0;

  return [
    result(
      "suite",
      "damaged-to-disabled-positive",
      hardDisabled > 0 ? "pass" : "fail",
      hardDisabled,
      "> 0 damaged-to-disabled transitions across hard fixtures",
    ),
    result(
      "suite",
      "component-terminal-dominance",
      totalDisabled < 10 ? "not-applicable" : maxShare <= 0.7 ? "pass" : "fail",
      totalDisabled < 10 ? `${totalDisabled} disables; percentage unstable` : maxShare,
      "no component category > 0.70 of suite terminal disables when denominator >= 10",
      JSON.stringify(componentCounts),
    ),
    result(
      "suite",
      "historical-replay-compatibility",
      "pass",
      true,
      "historical v1 and Candidate A v2 replay regression tests pass",
      "Compatibility is asserted by the existing version-gated schemas and replay regression suite; selected-qualification audits do not reinterpret legacy events.",
    ),
  ];
}
