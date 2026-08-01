import type {
  MatchConfig,
  MatchResult,
  SimulationEvent,
  ZoneFighterState,
  ArenaZone,
  GridZone,
  Direction,
  RoundAction,
  ActionPolicy,
  CompetitionResult,
  RuntimeIdentityFor,
} from "./types.js";
import { LEGACY_RUNTIME_IDENTITY } from "./runtime-identity.js";
import { SeededRandom } from "./seeded-random.js";
import { deriveAction } from "./actions.js";
import { applyRound, type RoundState } from "./reducer.js";
import { checkVictory } from "./victory.js";
import { MAX_ROUNDS, STARTING_ENERGY, STARTING_HEAT } from "./constants.js";
import {
  DEFAULT_COMPONENT_QUALIFICATION_ID,
  getComponentQualificationConfig,
  getComponentQualificationMetadata,
  type ComponentQualificationConfig,
} from "./component-qualification-registry.js";
import {
  createInitialComponentStates,
  deriveBinaryComponents,
} from "./component-state.js";

/**
 * The runtime surface the shared deterministic match loop depends on.
 * The legacy adapter keeps the historical five-zone `runMatch` semantics;
 * the opt-in grid adapter provides the frozen 3×3 semantics via
 * `runGridMatch` without changing the application default.
 *
 * The zone type and runtime identity are paired through the discriminated
 * runtime profile: `MatchRuntimeAdapter<ArenaZone>` requires the legacy
 * identity and `MatchRuntimeAdapter<GridZone>` requires the grid identity.
 * An invalid pairing cannot be constructed through normal typed use.
 */
export interface MatchRuntimeAdapter<Z extends ArenaZone | GridZone> {
  readonly initialZones: { readonly fighterA: Z; readonly fighterB: Z };
  readonly initialFacing: { readonly fighterA: Direction; readonly fighterB: Direction };
  readonly deriveAction: (
    state: ZoneFighterState<Z>,
    policy: ActionPolicy,
    opponent: ZoneFighterState<Z>,
    rng: SeededRandom,
  ) => RoundAction;
  readonly applyRound: (
    state: RoundState<Z>,
    actions: { fighterA: RoundAction; fighterB: RoundAction },
    rng: SeededRandom,
    round: number,
    timestampMs: number,
    policyA: ActionPolicy | undefined,
    policyB: ActionPolicy | undefined,
    qualificationConfig: ComponentQualificationConfig,
  ) => RoundState<Z>;
  /** Extra `competition_started` facts; legacy adds none. */
  readonly competitionStartedExtra: Record<string, unknown>;
  readonly eventSimulatorVersion: "0.2.0" | "0.3.0";
  readonly runtime: RuntimeIdentityFor<Z>;
}

export interface ZoneMatchResult<Z extends ArenaZone | GridZone> {
  config: MatchConfig;
  events: SimulationEvent[];
  result: CompetitionResult;
  rounds: number;
  initialState: { fighterA: ZoneFighterState<Z>; fighterB: ZoneFighterState<Z> };
  runtime: RuntimeIdentityFor<Z>;
}

export function runMatchForZone<Z extends ArenaZone | GridZone>(
  config: MatchConfig,
  adapter: MatchRuntimeAdapter<Z>,
): ZoneMatchResult<Z> {
  const qualificationConfig = getComponentQualificationConfig(
    config.componentQualificationId ?? DEFAULT_COMPONENT_QUALIFICATION_ID,
  );
  const componentQualification = getComponentQualificationMetadata(qualificationConfig);
  const resolvedConfig = {
    ...config,
    componentQualificationId: qualificationConfig.id,
    componentQualification,
  };
  const rng = new SeededRandom(config.seed);
  const stateA = createZoneFighterState(
    config.fighterA.build,
    "fighter_a",
    adapter.initialZones.fighterA,
    adapter.initialFacing.fighterA,
  );
  const stateB = createZoneFighterState(
    config.fighterB.build,
    "fighter_b",
    adapter.initialZones.fighterB,
    adapter.initialFacing.fighterB,
  );

  let seq = 0;

  let roundState: RoundState<Z> = {
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
    seed: resolvedConfig.seed,
    rulesetVersion: resolvedConfig.rulesetVersion,
    catalogueVersion: resolvedConfig.catalogueVersion,
    simulatorVersion: adapter.eventSimulatorVersion,
    componentQualificationId: resolvedConfig.componentQualificationId,
    componentQualification: resolvedConfig.componentQualification,
    fighterA: { id: stateA.fighterId, build: stateA.build.proposal },
    fighterB: { id: stateB.fighterId, build: stateB.build.proposal },
    ...adapter.competitionStartedExtra,
  });

  let finalResult: CompetitionResult | null = null;

  for (let round = 1; round <= MAX_ROUNDS; round++) {
    const roundTs = round * 1000;
    emit("round_started", round, roundTs);

    const actionA = adapter.deriveAction(
      roundState.fighterA,
      config.fighterA.policy,
      roundState.fighterB,
      rng,
    );
    const actionB = adapter.deriveAction(
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

    roundState = adapter.applyRound(
      roundState,
      { fighterA: actionA, fighterB: actionB },
      rng,
      round,
      roundTs,
      config.fighterA.policy,
      config.fighterB.policy,
      qualificationConfig,
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
    config: resolvedConfig,
    events: roundState.events,
    result: finalResult,
    rounds:
      finalResult.method === "draw"
        ? MAX_ROUNDS
        : roundState.events.filter((e) => e.type === "round_ended").length,
    initialState: { fighterA: stateA, fighterB: stateB },
    runtime: adapter.runtime,
  };
}

const LEGACY_MATCH_ADAPTER: MatchRuntimeAdapter<ArenaZone> = {
  initialZones: { fighterA: "south_edge", fighterB: "north_edge" },
  initialFacing: { fighterA: "north", fighterB: "south" },
  deriveAction,
  applyRound,
  competitionStartedExtra: {},
  eventSimulatorVersion: "0.2.0",
  runtime: LEGACY_RUNTIME_IDENTITY,
};

/** Default application path — always the legacy five-zone runtime. */
export function runMatch(config: MatchConfig): MatchResult {
  return runMatchForZone(config, LEGACY_MATCH_ADAPTER);
}

export function createZoneFighterState<Z>(
  build: MatchConfig["fighterA"]["build"],
  fighterId: string,
  zone: Z,
  facing: Direction,
): ZoneFighterState<Z> {
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
    comps: createInitialComponentStates(build.proposal.utilityId),
    components: deriveBinaryComponents(
      createInitialComponentStates(build.proposal.utilityId),
    ),
    conditions: [],
  };
}
