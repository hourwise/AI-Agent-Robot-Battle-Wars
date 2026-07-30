import { createHash } from "node:crypto";
import { RULESET_VERSION, SIMULATOR_VERSION } from "../simulator/constants.js";
import {
  DEFAULT_COMPONENT_QUALIFICATION_ID,
  getComponentQualificationConfig,
  getComponentQualificationMetadata,
} from "../simulator/component-qualification-registry.js";
import type {
  BenchmarkConfig,
  BenchmarkReport,
  PerMatchResult,
} from "./benchmark.types.js";
import { computeMetrics } from "./metrics.js";
import { fingerprintBuild, fingerprintPolicy } from "./run-benchmark.js";

export function createBenchmarkReport(
  benchmarkId: string,
  config: BenchmarkConfig,
  results: readonly PerMatchResult[],
): BenchmarkReport {
  const qualificationConfig = getComponentQualificationConfig(
    config.componentQualificationId ?? DEFAULT_COMPONENT_QUALIFICATION_ID,
  );
  const componentQualification = getComponentQualificationMetadata(qualificationConfig);
  const sortedResults = [...results].sort(
    (a, b) => a.seed - b.seed || (a.roleSwapped ? 1 : 0) - (b.roleSwapped ? 1 : 0),
  );
  const seedCount = config.roleSwapped ? sortedResults.length / 2 : sortedResults.length;
  const roleAssignmentsPerSeed = config.roleSwapped ? 2 : 1;
  const metrics = computeMetrics(sortedResults, seedCount, roleAssignmentsPerSeed);
  const outcomesChecksum = createHash("sha256")
    .update(JSON.stringify(sortedResults))
    .digest("hex")
    .slice(0, 16);

  const report: BenchmarkReport = {
    schemaVersion: "1",
    benchmarkId,
    seedBankId: config.seedBank.bankId,
    partition: config.partition,
    simulatorVersion: SIMULATOR_VERSION,
    rulesetVersion: RULESET_VERSION,
    catalogueVersion: config.seedBank.catalogueVersion,
    componentQualificationId: qualificationConfig.id,
    componentQualification,
    qualificationConstants: {
      armourFactor: qualificationConfig.armourFactor,
      minimumImpact: qualificationConfig.minimumImpact,
      criticalThreshold: qualificationConfig.criticalThreshold,
      highImpactThreshold: qualificationConfig.highImpactThreshold,
    },
    fighterX: {
      machineName: config.fighterA.machineName,
      buildFingerprint: fingerprintBuild(config.fighterA.build),
      policyFingerprint: fingerprintPolicy(config.fighterA.policy),
    },
    fighterY: {
      machineName: config.fighterB.machineName,
      buildFingerprint: fingerprintBuild(config.fighterB.build),
      policyFingerprint: fingerprintPolicy(config.fighterB.policy),
    },
    roleSwapped: config.roleSwapped,
    seedCount,
    roleAssignmentsPerSeed,
    totalSimulations: sortedResults.length,
    perMatch: sortedResults,
    metrics,
    outcomesChecksum,
    reportChecksum: "",
  };
  const reportBody = JSON.stringify({ ...report, reportChecksum: "" });
  return {
    ...report,
    reportChecksum: createHash("sha256").update(reportBody).digest("hex").slice(0, 16),
  };
}
