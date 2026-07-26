import type { MatchConfig, MatchResult, FighterState, SimulationEvent } from "./types.js";
import { SeededRandom } from "./seeded-random.js";
import { deriveAction } from "./actions.js";
import { applyRound, RoundState } from "./reducer.js";
import { checkVictory } from "./victory.js";
import {
  MAX_ROUNDS,
  STARTING_ENERGY,
  STARTING_HEAT,
  SIMULATOR_VERSION,
} from "./constants.js";

export function runMatch(config: MatchConfig): MatchResult {
  const rng = new SeededRandom(config.seed);
  const stateA = createFighterState(
    config.fighterA.build,
    "fighter_a",
    "south_edge",
    "north",
  );
  const stateB = createFighterState(
    config.fighterB.build,
    "fighter_b",
    "north_edge",
    "south",
  );

  let seq = 0;

  let roundState: RoundState = {
    fighterA: stateA,
    fighterB: stateB,
    events: [],
    damageDealt: { a: 0, b: 0 },
    roundsAttacked: { a: 0, b: 0 },
  };

  const emit = (
    type: string,
    round: number,
    timestampMs: number,
    actorId?: string,
    targetId?: string,
    data: Record<string, unknown> = {},
  ): SimulationEvent => {
    const event: SimulationEvent = {
      schemaVersion: "1",
      sequence: seq++,
      round,
      timestampMs,
      type,
      actorId,
      targetId,
      data,
    };
    roundState.events.push(event);
    return event;
  };

  const startTs = 0;
  emit("competition_started", 0, startTs, undefined, undefined, {
    seed: config.seed,
    rulesetVersion: config.rulesetVersion,
    catalogueVersion: config.catalogueVersion,
    simulatorVersion: SIMULATOR_VERSION,
    fighterA: { id: stateA.fighterId, build: stateA.build.proposal },
    fighterB: { id: stateB.fighterId, build: stateB.build.proposal },
  });

  let finalResult = null;

  for (let round = 1; round <= MAX_ROUNDS; round++) {
    const roundTs = round * 1000;
    emit("round_started", round, roundTs);

    const actionA = deriveAction(
      roundState.fighterA,
      config.fighterA.policy,
      roundState.fighterB,
      rng,
    );
    const actionB = deriveAction(
      roundState.fighterB,
      config.fighterB.policy,
      roundState.fighterA,
      rng,
    );

    emit("policy_triggered", round, roundTs, roundState.fighterA.fighterId, undefined, {
      action: actionA,
    });
    emit("policy_triggered", round, roundTs, roundState.fighterB.fighterId, undefined, {
      action: actionB,
    });

    roundState = applyRound(
      roundState,
      { fighterA: actionA, fighterB: actionB },
      rng,
      round,
      roundTs,
      config.fighterA.policy,
      config.fighterB.policy,
    );

    emit("round_ended", round, roundTs, undefined, undefined, {
      fighterA: {
        integrity: roundState.fighterA.integrity,
        energy: roundState.fighterA.energy,
        heat: roundState.fighterA.heat,
        zone: roundState.fighterA.zone,
        conditions: roundState.fighterA.conditions,
      },
      fighterB: {
        integrity: roundState.fighterB.integrity,
        energy: roundState.fighterB.energy,
        heat: roundState.fighterB.heat,
        zone: roundState.fighterB.zone,
        conditions: roundState.fighterB.conditions,
      },
    });

    const result = checkVictory(
      roundState.fighterA,
      roundState.fighterB,
      round,
      MAX_ROUNDS,
      roundState.damageDealt,
      roundState.roundsAttacked,
    );

    if (result) {
      finalResult = result;
      emit("competition_ended", round, roundTs, undefined, undefined, {
        winner: result.winner,
        loser: result.loser,
        method: result.method,
        rounds: round,
      });
      break;
    }
  }

  if (!finalResult) {
    finalResult = {
      winner: null,
      loser: null,
      method: "draw" as const,
    };
    emit("competition_ended", MAX_ROUNDS, MAX_ROUNDS * 1000, undefined, undefined, {
      winner: null,
      loser: null,
      method: "draw",
      rounds: MAX_ROUNDS,
    });
  }

  return {
    config,
    events: roundState.events,
    result: finalResult,
    rounds:
      finalResult.method === "draw"
        ? MAX_ROUNDS
        : roundState.events.filter((e) => e.type === "round_ended").length,
    initialState: { fighterA: stateA, fighterB: stateB },
  };
}

function createFighterState(
  build: MatchConfig["fighterA"]["build"],
  fighterId: string,
  zone: FighterState["zone"],
  facing: FighterState["facing"],
): FighterState {
  return {
    fighterId,
    build,
    integrity:
      build.proposal.chassisId === "heavy"
        ? 150
        : build.proposal.chassisId === "medium"
          ? 100
          : 60,
    maxIntegrity:
      build.proposal.chassisId === "heavy"
        ? 150
        : build.proposal.chassisId === "medium"
          ? 100
          : 60,
    energy: STARTING_ENERGY,
    heat: STARTING_HEAT,
    zone,
    facing,
    weaponCooldown: 0,
    utilityCooldown: 0,
    armour: {
      front: build.proposal.armour.front,
      left: build.proposal.armour.left,
      right: build.proposal.armour.right,
      rear: build.proposal.armour.rear,
      top: build.proposal.armour.top,
    },
    components: {
      mobilityDisabled: false,
      weaponDisabled: false,
      utilityDisabled: false,
    },
    conditions: [],
  };
}
