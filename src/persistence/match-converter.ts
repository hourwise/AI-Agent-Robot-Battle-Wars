import { randomUUID } from "node:crypto";
import type { MatchResult } from "../simulator/types.js";
import type { MatchRecord } from "../schemas/match-record.schema.js";
import { SIMULATOR_VERSION } from "../simulator/constants.js";

export function matchResultToRecord(result: MatchResult): MatchRecord {
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
  };
}
