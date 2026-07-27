import { createHash } from "node:crypto";
import { runMatch } from "../simulator/simulator.js";
import { CATALOGUE_V1 } from "../catalogue/catalogue.v1.js";
import type { BenchmarkConfig, PerMatchResult } from "./benchmark.types.js";
import { getSeedsForPartition } from "./seed-bank.js";

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
): PerMatchResult {
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
    rulesetVersion: config.seedBank.rulesetVersion,
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
  let criticalHits = 0;
  let attacksAttempted = 0;
  let attacksHit = 0;

  for (const event of result.events) {
    if (event.type === "integrity_damaged") {
      if (event.targetId === "fighter_a")
        integrityA = Number(event.data.remaining ?? integrityA);
      if (event.targetId === "fighter_b")
        integrityB = Number(event.data.remaining ?? integrityB);
    }
    if (event.type === "component_disabled") {
      const comp = String(event.data.component ?? "");
      if (event.targetId === "fighter_a") {
        if (comp === "mobility") mobilityDisabledA = true;
        if (comp === "weapon") weaponDisabledA = true;
        if (comp === "utility") utilityDisabledA = true;
      }
      if (event.targetId === "fighter_b") {
        if (comp === "mobility") mobilityDisabledB = true;
        if (comp === "weapon") weaponDisabledB = true;
        if (comp === "utility") utilityDisabledB = true;
      }
    }
    if (event.type === "attack_attempted") attacksAttempted++;
    if (event.type === "attack_hit") {
      attacksHit++;
      if (event.data.isCritical) criticalHits++;
    }
  }

  const disabledA: string[] = [];
  if (mobilityDisabledA) disabledA.push("mobility");
  if (weaponDisabledA) disabledA.push("weapon");
  if (utilityDisabledA) disabledA.push("utility");

  const disabledB: string[] = [];
  if (mobilityDisabledB) disabledB.push("mobility");
  if (weaponDisabledB) disabledB.push("weapon");
  if (utilityDisabledB) disabledB.push("utility");

  return {
    seed,
    roleSwapped,
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
    },
    fighterB: {
      machineName: bName,
      integrity: integrityB,
      maxIntegrity: finalB.maxIntegrity,
      mobilityDisabled: mobilityDisabledB,
      weaponDisabled: weaponDisabledB,
      utilityDisabled: utilityDisabledB,
      disabledComponents: disabledB,
    },
    criticalHits,
    attacksAttempted,
    attacksHit,
  };
}

export function runBenchmark(config: BenchmarkConfig): PerMatchResult[] {
  const seeds = getSeedsForPartition(config.seedBank, config.partition);
  const results: PerMatchResult[] = [];

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
