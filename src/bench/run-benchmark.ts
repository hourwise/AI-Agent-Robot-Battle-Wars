import { createHash } from "node:crypto";
import { runMatch } from "../simulator/simulator.js";
import { CATALOGUE_V1 } from "../catalogue/catalogue.v1.js";
import type { BenchmarkConfig, PerMatchResult } from "./benchmark.types.js";
import type { BenchmarkExecution } from "./lifecycle-suite.types.js";
import { getSeedsForPartition } from "./seed-bank.js";
import {
  RULESET_VERSION,
  CRITICAL_COMPONENT_IMPACT_THRESHOLD,
  HIGH_COMPONENT_IMPACT_THRESHOLD,
} from "../simulator/constants.js";

export function fingerprintBuild(build: BenchmarkConfig["fighterA"]["build"]): string {
  const canonical = JSON.stringify(build.proposal, Object.keys(build.proposal).sort());
  return createHash("sha256").update(canonical).digest("hex").slice(0, 16);
}

export function fingerprintPolicy(policy: BenchmarkConfig["fighterA"]["policy"]): string {
  const canonical = JSON.stringify(policy, Object.keys(policy).sort());
  return createHash("sha256").update(canonical).digest("hex").slice(0, 16);
}

function extractPerMatch(
  seed: number,
  roleSwapped: boolean,
  config: BenchmarkConfig,
): BenchmarkExecution {
  const aBuild = roleSwapped ? config.fighterB.build : config.fighterA.build;
  const aPolicy = roleSwapped ? config.fighterB.policy : config.fighterA.policy;
  const bBuild = roleSwapped ? config.fighterA.build : config.fighterB.build;
  const bPolicy = roleSwapped ? config.fighterA.policy : config.fighterB.policy;

  const aName = roleSwapped ? config.fighterB.machineName : config.fighterA.machineName;
  const bName = roleSwapped ? config.fighterA.machineName : config.fighterB.machineName;

  const result = runMatch({
    seed,
    fighterA: { build: aBuild, policy: aPolicy },
    fighterB: { build: bBuild, policy: bPolicy },
    rulesetVersion: RULESET_VERSION,
    catalogueVersion: CATALOGUE_V1.version,
  });

  const finalA = result.initialState.fighterA;
  const finalB = result.initialState.fighterB;

  // Compute final state from events
  let integrityA = finalA.integrity;
  let integrityB = finalB.integrity;
  let mobilityDisabledA = false;
  let mobilityDisabledB = false;
  let weaponDisabledA = false;
  let weaponDisabledB = false;
  let utilityDisabledA = false;
  let utilityDisabledB = false;
  let mobilityDamagedA = false;
  let mobilityDamagedB = false;
  let weaponDamagedA = false;
  let weaponDamagedB = false;
  let utilityDamagedA = false;
  let utilityDamagedB = false;
  let criticalHits = 0;
  let attacksHit = 0;
  let attacksMissed = 0;
  let qualifyingHits = 0;
  let criticalQualifiedHits = 0;
  let highImpactQualifiedHits = 0;
  let hitsSatisfyingBothConditions = 0;
  // v2 transition counters
  let componentDamagedTransitions = 0;
  let componentDisabledTransitions = 0;
  let componentResistedTransitions = 0;
  let guardsSpent = 0;
  let guardsLost = 0;
  let mobilityDamagedCount = 0;
  let weaponDamagedCount = 0;
  let utilityDamagedCount = 0;
  let mobilityDisabledCount = 0;
  let weaponDisabledCount = 0;
  let utilityDisabledCount = 0;

  for (const event of result.events) {
    if (event.type === "integrity_damaged") {
      if (event.targetId === "fighter_a")
        integrityA = Number(event.data.remaining ?? integrityA);
      if (event.targetId === "fighter_b")
        integrityB = Number(event.data.remaining ?? integrityB);
    }
    if (event.type === "component_damaged") {
      componentDamagedTransitions++;
      const comp = String(event.data.component ?? "");
      if (event.targetId === "fighter_a") {
        if (comp === "mobility") {
          mobilityDamagedA = true;
          mobilityDamagedCount++;
        }
        if (comp === "weapon") {
          weaponDamagedA = true;
          weaponDamagedCount++;
        }
        if (comp === "utility") {
          utilityDamagedA = true;
          utilityDamagedCount++;
        }
      }
      if (event.targetId === "fighter_b") {
        if (comp === "mobility") {
          mobilityDamagedB = true;
          mobilityDamagedCount++;
        }
        if (comp === "weapon") {
          weaponDamagedB = true;
          weaponDamagedCount++;
        }
        if (comp === "utility") {
          utilityDamagedB = true;
          utilityDamagedCount++;
        }
      }
      // Check for guard loss on utility damage
      if (event.data.utilityRuntimeChange) {
        const change = event.data.utilityRuntimeChange as Record<string, string>;
        if (
          change.reinforcedDriveGuardBefore === "available" &&
          change.reinforcedDriveGuardAfter === "lost"
        ) {
          guardsLost++;
        }
      }
    }
    if (event.type === "component_damage_resisted") {
      componentResistedTransitions++;
      guardsSpent++;
    }
    if (event.type === "component_disabled") {
      componentDisabledTransitions++;
      const comp = String(event.data.component ?? "");
      if (event.targetId === "fighter_a") {
        if (comp === "mobility") {
          mobilityDisabledA = true;
          mobilityDamagedA = true;
          mobilityDisabledCount++;
        }
        if (comp === "weapon") {
          weaponDisabledA = true;
          weaponDamagedA = true;
          weaponDisabledCount++;
        }
        if (comp === "utility") {
          utilityDisabledA = true;
          utilityDamagedA = true;
          utilityDisabledCount++;
        }
      }
      if (event.targetId === "fighter_b") {
        if (comp === "mobility") {
          mobilityDisabledB = true;
          mobilityDamagedB = true;
          mobilityDisabledCount++;
        }
        if (comp === "weapon") {
          weaponDisabledB = true;
          weaponDamagedB = true;
          weaponDisabledCount++;
        }
        if (comp === "utility") {
          utilityDisabledB = true;
          utilityDamagedB = true;
          utilityDisabledCount++;
        }
      }
      // Check for guard loss on utility disable
      if (event.data.utilityRuntimeChange) {
        const change = event.data.utilityRuntimeChange as Record<string, string>;
        if (
          change.reinforcedDriveGuardBefore === "available" &&
          change.reinforcedDriveGuardAfter === "lost"
        ) {
          guardsLost++;
        }
      }
    }
    if (event.type === "attack_hit") {
      attacksHit++;
      if (event.data.isCritical) criticalHits++;
      const impact = Number(event.data.componentImpact ?? 0);
      const critical = Boolean(event.data.isCritical);
      const criticalQualified = critical && impact >= CRITICAL_COMPONENT_IMPACT_THRESHOLD;
      const highQualified = impact >= HIGH_COMPONENT_IMPACT_THRESHOLD;
      if (criticalQualified || highQualified) qualifyingHits++;
      if (criticalQualified) criticalQualifiedHits++;
      if (highQualified) highImpactQualifiedHits++;
      if (criticalQualified && highQualified) hitsSatisfyingBothConditions++;
    }
    if (event.type === "attack_missed") {
      attacksMissed++;
    }
  }

  const attacksAttempted = attacksHit + attacksMissed;

  const disabledA: string[] = [];
  if (mobilityDisabledA) disabledA.push("mobility");
  if (weaponDisabledA) disabledA.push("weapon");
  if (utilityDisabledA) disabledA.push("utility");

  const disabledB: string[] = [];
  if (mobilityDisabledB) disabledB.push("mobility");
  if (weaponDisabledB) disabledB.push("weapon");
  if (utilityDisabledB) disabledB.push("utility");

  const perMatch: PerMatchResult = {
    seed,
    roleSwapped,
    // Competitor X = config.fighterA, Competitor Y = config.fighterB
    // When roleSwapped, X is in fighter_b slot, Y in fighter_a slot
    fighterACompetitor: roleSwapped ? "y" : "x",
    fighterBCompetitor: roleSwapped ? "x" : "y",
    winner: result.result.winner,
    method: result.result.method,
    rounds: result.rounds,
    fighterA: {
      machineName: aName,
      integrity: integrityA,
      maxIntegrity: finalA.maxIntegrity,
      mobilityDisabled: mobilityDisabledA,
      weaponDisabled: weaponDisabledA,
      utilityDisabled: utilityDisabledA,
      disabledComponents: disabledA,
      mobilityDamaged: mobilityDamagedA,
      weaponDamaged: weaponDamagedA,
      utilityDamaged: utilityDamagedA,
    },
    fighterB: {
      machineName: bName,
      integrity: integrityB,
      maxIntegrity: finalB.maxIntegrity,
      mobilityDisabled: mobilityDisabledB,
      weaponDisabled: weaponDisabledB,
      utilityDisabled: utilityDisabledB,
      disabledComponents: disabledB,
      mobilityDamaged: mobilityDamagedB,
      weaponDamaged: weaponDamagedB,
      utilityDamaged: utilityDamagedB,
    },
    criticalHits,
    attacksAttempted,
    attacksHit,
    qualifyingHits,
    criticalQualifiedHits,
    highImpactQualifiedHits,
    hitsSatisfyingBothConditions,
    nonQualifyingSuccessfulHits: attacksHit - qualifyingHits,
    componentDamagedTransitions,
    componentDisabledTransitions,
    componentResistedTransitions,
    guardsSpent,
    guardsLost,
    mobilityDamagedCount,
    weaponDamagedCount,
    utilityDamagedCount,
    mobilityDisabledCount,
    weaponDisabledCount,
    utilityDisabledCount,
    terminalDisable: disabledA.length > 0 || disabledB.length > 0,
  };
  return { perMatch, match: result };
}

export function runBenchmarkDetailed(config: BenchmarkConfig): BenchmarkExecution[] {
  const seeds = getSeedsForPartition(config.seedBank, config.partition);
  const results: BenchmarkExecution[] = [];

  for (const seed of seeds) {
    results.push(extractPerMatch(seed, false, config));
  }

  if (config.roleSwapped) {
    for (const seed of seeds) {
      results.push(extractPerMatch(seed, true, config));
    }
  }

  return results;
}

export function runBenchmark(config: BenchmarkConfig): PerMatchResult[] {
  return runBenchmarkDetailed(config).map((execution) => execution.perMatch);
}
