import { randomUUID } from "node:crypto";
import type { MatchResult } from "../simulator/types.js";
import type { MatchRecord, MatchRecordV2 } from "../schemas/match-record.schema.js";
import type { AgentUsageRecord } from "../types/agent-usage.js";
import { SIMULATOR_VERSION } from "../simulator/constants.js";

function isV2Simulator(): boolean {
  const major = parseInt(SIMULATOR_VERSION.split(".")[0] ?? "0", 10);
  const minor = parseInt(SIMULATOR_VERSION.split(".")[1] ?? "0", 10);
  return major > 0 || minor >= 2;
}

export function matchResultToRecord(
  result: MatchResult,
  agentUsage: readonly AgentUsageRecord[] = [],
): MatchRecord {
  if (isV2Simulator()) {
    return matchResultToRecordV2(result, agentUsage);
  }
  return matchResultToRecordV1(result, agentUsage);
}

function matchResultToRecordV1(
  result: MatchResult,
  agentUsage: readonly AgentUsageRecord[],
): MatchRecord {
  return {
    schemaVersion: "1",
    matchId: randomUUID(),
    createdAt: new Date().toISOString(),
    rulesetVersion: result.config.rulesetVersion,
    catalogueVersion: result.config.catalogueVersion,
    simulatorVersion: SIMULATOR_VERSION,
    seed: result.config.seed,
    config: {
      seed: result.config.seed,
      rulesetVersion: result.config.rulesetVersion,
      catalogueVersion: result.config.catalogueVersion,
      fighterA: {
        build: result.config.fighterA.build,
        policy: result.config.fighterA.policy,
      },
      fighterB: {
        build: result.config.fighterB.build,
        policy: result.config.fighterB.policy,
      },
    },
    initialState: {
      fighterA: result.initialState.fighterA,
      fighterB: result.initialState.fighterB,
    },
    events: result.events,
    result: result.result,
    rounds: result.rounds,
    agentUsage: [...agentUsage],
  };
}

function matchResultToRecordV2(
  result: MatchResult,
  agentUsage: readonly AgentUsageRecord[],
): MatchRecordV2 {
  return {
    schemaVersion: "2",
    matchId: randomUUID(),
    createdAt: new Date().toISOString(),
    rulesetVersion: result.config.rulesetVersion,
    catalogueVersion: result.config.catalogueVersion,
    simulatorVersion: SIMULATOR_VERSION,
    seed: result.config.seed,
    config: {
      seed: result.config.seed,
      rulesetVersion: result.config.rulesetVersion,
      catalogueVersion: result.config.catalogueVersion,
      fighterA: {
        build: result.config.fighterA.build,
        policy: result.config.fighterA.policy,
      },
      fighterB: {
        build: result.config.fighterB.build,
        policy: result.config.fighterB.policy,
      },
    },
    initialState: {
      fighterA: {
        ...result.initialState.fighterA,
        comps: result.initialState.fighterA.comps,
      },
      fighterB: {
        ...result.initialState.fighterB,
        comps: result.initialState.fighterB.comps,
      },
    },
    events: result.events,
    result: result.result,
    rounds: result.rounds,
    agentUsage: [...agentUsage],
  };
}
