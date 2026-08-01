import { randomUUID } from "node:crypto";
import type {
  AnyMatchResult,
  GridMatchResult,
  MatchConfig,
  MatchResult,
} from "../simulator/types.js";
import type {
  MatchRecord,
  MatchRecordV2,
  MatchRecordV3,
} from "../schemas/match-record.schema.js";
import { LEGACY_ARENA_ZONES } from "../schemas/positioning.schema.js";
import type { AgentUsageRecord } from "../types/agent-usage.js";
import { isGridZone } from "../simulator/arena-grid.js";

/**
 * Persist records according to the explicit immutable result identity, never
 * from global version heuristics or zone-string guessing.
 *
 * - Legacy result (`0.2.0` / `legacy-five-zone-v1`) → MatchRecord v2.
 * - Grid result (`0.3.0` / `grid-3x3-v1`) → MatchRecord v3.
 *
 * Invalid combinations are rejected explicitly. `mapLegacyZoneToGridZone` is
 * never used during persistence.
 */
export function matchResultToRecord(
  result: AnyMatchResult,
  agentUsage: readonly AgentUsageRecord[] = [],
): MatchRecord {
  assertPersistableIdentity(result);
  if (result.runtime.positioningModel === "grid-3x3-v1") {
    return matchResultToRecordV3(result as GridMatchResult, agentUsage);
  }
  return matchResultToRecordV2(result as MatchResult, agentUsage);
}

function assertPersistableIdentity(result: AnyMatchResult): void {
  const { simulatorVersion, positioningModel } = result.runtime;

  if (positioningModel === "grid-3x3-v1") {
    if (simulatorVersion !== "0.3.0") {
      throw new Error(
        `Grid runtime requires simulatorVersion 0.3.0; received ${String(simulatorVersion)}`,
      );
    }
    for (const fighter of [result.initialState.fighterA, result.initialState.fighterB]) {
      if (!isGridZone(fighter.zone)) {
        throw new Error(`Grid result contains a non-grid zone: ${String(fighter.zone)}`);
      }
    }
    return;
  }

  if (positioningModel === "legacy-five-zone-v1") {
    if (simulatorVersion !== "0.2.0") {
      throw new Error(
        `Legacy runtime requires simulatorVersion 0.2.0; received ${String(simulatorVersion)}`,
      );
    }
    const legacySet = new Set<string>(LEGACY_ARENA_ZONES);
    for (const fighter of [result.initialState.fighterA, result.initialState.fighterB]) {
      if (!legacySet.has(fighter.zone)) {
        throw new Error(
          `Legacy result contains a grid-only zone: ${String(fighter.zone)}`,
        );
      }
    }
    return;
  }

  throw new Error(`Unknown positioning model: ${String(positioningModel)}`);
}

function buildRecordConfig(result: { config: MatchConfig }): MatchRecord["config"] {
  return {
    seed: result.config.seed,
    rulesetVersion: result.config.rulesetVersion,
    catalogueVersion: result.config.catalogueVersion,
    componentQualificationId: result.config.componentQualificationId,
    componentQualification: result.config.componentQualification,
    fighterA: {
      build: result.config.fighterA.build,
      policy: result.config.fighterA.policy,
    },
    fighterB: {
      build: result.config.fighterB.build,
      policy: result.config.fighterB.policy,
    },
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
    simulatorVersion: result.runtime.simulatorVersion,
    componentQualificationId: result.config.componentQualificationId,
    componentQualification: result.config.componentQualification,
    seed: result.config.seed,
    config: buildRecordConfig(result),
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

function matchResultToRecordV3(
  result: GridMatchResult,
  agentUsage: readonly AgentUsageRecord[],
): MatchRecordV3 {
  return {
    schemaVersion: "3",
    positioningModel: "grid-3x3-v1",
    matchId: randomUUID(),
    createdAt: new Date().toISOString(),
    rulesetVersion: result.config.rulesetVersion,
    catalogueVersion: result.config.catalogueVersion,
    simulatorVersion: result.runtime.simulatorVersion,
    componentQualificationId: result.config.componentQualificationId,
    componentQualification: result.config.componentQualification,
    seed: result.config.seed,
    config: buildRecordConfig(result),
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
