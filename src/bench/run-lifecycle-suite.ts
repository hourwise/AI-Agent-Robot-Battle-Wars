import { createHash } from "node:crypto";
import type { BenchmarkConfig } from "./benchmark.types.js";
import { createBenchmarkReport } from "./benchmark-report.js";
import { runBenchmarkDetailed } from "./run-benchmark.js";
import { auditLifecycleExecutions } from "./lifecycle-audit.js";
import {
  computeFixtureDiagnostics,
  evaluateFixtureGates,
  evaluateSuiteGates,
} from "./lifecycle-gates.js";
import type {
  AggregateLifecycleSummary,
  LifecycleFixtureReport,
  LifecycleSuiteReport,
  RunLifecycleSuiteOptions,
} from "./lifecycle-suite.types.js";
import {
  DEFAULT_COMPONENT_QUALIFICATION_ID,
  canonicalStringify,
  getComponentQualificationConfig,
  getComponentQualificationMetadata,
} from "../simulator/component-qualification-registry.js";

function aggregate(
  fixtureReports: readonly LifecycleFixtureReport[],
): AggregateLifecycleSummary {
  return fixtureReports.reduce<AggregateLifecycleSummary>(
    (summary, fixture) => {
      const metrics = fixture.benchmark.metrics;
      return {
        totalSimulations: summary.totalSimulations + fixture.benchmark.totalSimulations,
        totalHits: summary.totalHits + metrics.totalHits,
        totalQualifyingHits: summary.totalQualifyingHits + metrics.totalQualifyingHits,
        totalDamagedTransitions:
          summary.totalDamagedTransitions + metrics.totalDamagedTransitions,
        totalDisabledTransitions:
          summary.totalDisabledTransitions + metrics.totalDisabledTransitions,
        totalResistedTransitions:
          summary.totalResistedTransitions + metrics.totalResistedTransitions,
        mobilityDisabledTransitions:
          summary.mobilityDisabledTransitions + metrics.mobilityDisabledTransitions,
        weaponDisabledTransitions:
          summary.weaponDisabledTransitions + metrics.weaponDisabledTransitions,
        utilityDisabledTransitions:
          summary.utilityDisabledTransitions + metrics.utilityDisabledTransitions,
      };
    },
    {
      totalSimulations: 0,
      totalHits: 0,
      totalQualifyingHits: 0,
      totalDamagedTransitions: 0,
      totalDisabledTransitions: 0,
      totalResistedTransitions: 0,
      mobilityDisabledTransitions: 0,
      weaponDisabledTransitions: 0,
      utilityDisabledTransitions: 0,
    },
  );
}

function decide(
  fixtureReports: readonly LifecycleFixtureReport[],
  suiteGates: LifecycleSuiteReport["suiteGates"],
): LifecycleSuiteReport["decision"] {
  if (fixtureReports.length === 0) {
    return "D. Fixture suite implementation is insufficient to make a decision.";
  }
  const fixtureGates = fixtureReports.flatMap((fixture) => fixture.gates);
  const allGates = [...fixtureGates, ...suiteGates];
  const designDefectGateIds = new Set([
    "valid-lifecycle-transitions",
    "guard-event-semantics",
    "damaged-mobility-does-not-end",
    "disabled-mobility-ends",
  ]);
  if (
    allGates.some(
      (gate) => gate.status === "fail" && designDefectGateIds.has(gate.gateId),
    )
  ) {
    return "C. Fixture suite exposes a lifecycle-design defect rather than a tuning issue.";
  }
  if (
    allGates.some(
      (gate) =>
        gate.status === "fail" && gate.gateId === "qualification-factual-completeness",
    )
  ) {
    return "D. Fixture suite implementation is insufficient to make a decision.";
  }
  if (allGates.some((gate) => gate.status === "fail")) {
    return "B. Selected qualification fails revised lifecycle gates.";
  }
  return "A. Selected qualification passes revised 0.2B lifecycle gates.";
}

export function runBenchmarkSuite(
  options: RunLifecycleSuiteOptions,
): LifecycleSuiteReport {
  if (options.partition !== "development") {
    throw new Error(
      "Lifecycle benchmark suite is development-only; held-out and all partitions require a future explicitly authorised task.",
    );
  }
  if (options.suite.seedPartition !== "development") {
    throw new Error("Lifecycle fixture suite must declare the development partition");
  }
  const qualificationConfig = getComponentQualificationConfig(
    options.componentQualificationId ?? DEFAULT_COMPONENT_QUALIFICATION_ID,
  );
  const componentQualification = getComponentQualificationMetadata(qualificationConfig);

  const selectedFixtures = options.fixtureId
    ? options.suite.fixtures.filter((fixture) => fixture.fixtureId === options.fixtureId)
    : [...options.suite.fixtures];
  if (options.fixtureId && selectedFixtures.length === 0) {
    throw new Error(`Unknown lifecycle fixture: ${options.fixtureId}`);
  }

  const fixtureReports: LifecycleFixtureReport[] = [];
  for (const fixture of selectedFixtures) {
    const config: BenchmarkConfig = {
      label: fixture.fixtureId,
      seedBank: options.seedBank,
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
      roleSwapped: fixture.roleSwapped,
      componentQualificationId: qualificationConfig.id,
    };
    const executions = runBenchmarkDetailed(config);
    const benchmark = createBenchmarkReport(
      `${fixture.benchmarkId}-development`,
      config,
      executions.map((execution) => execution.perMatch),
    );
    const audit = auditLifecycleExecutions(
      fixture.fixtureId,
      executions,
      componentQualification,
    );
    fixtureReports.push({
      fixtureId: fixture.fixtureId,
      purpose: fixture.purpose,
      classification: fixture.classification,
      fighterXCompetitorId: fixture.fighterXCompetitorId,
      fighterYCompetitorId: fixture.fighterYCompetitorId,
      benchmark,
      diagnostics: computeFixtureDiagnostics(benchmark, audit),
      audit,
      gates: evaluateFixtureGates(fixture, benchmark, audit),
    });
  }

  const suiteGates = evaluateSuiteGates(fixtureReports);
  const reportWithoutChecksum = {
    schemaVersion: "1" as const,
    suiteId: options.suite.suiteId,
    fixtureChecksum: options.suite.fixtureChecksum,
    componentQualificationId: qualificationConfig.id,
    componentQualification,
    seedBankId: options.seedBank.bankId,
    partition: "development" as const,
    fixtureReports,
    aggregateLifecycleSummary: aggregate(fixtureReports),
    suiteGates,
    decision: decide(fixtureReports, suiteGates),
  };

  return {
    ...reportWithoutChecksum,
    suiteChecksum: createHash("sha256")
      .update(canonicalStringify(reportWithoutChecksum))
      .digest("hex")
      .slice(0, 16),
  };
}
