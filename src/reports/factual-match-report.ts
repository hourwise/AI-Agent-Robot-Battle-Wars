import type { MatchResult, SimulationEvent, FighterState } from "../simulator/types.js";
import type {
  FactualMatchReport,
  MatchMoment,
  FighterMatchSummary,
  FighterStateSummary,
} from "../schemas/factual-report.schema.js";

function buildFighterMatchSummary(
  fighterId: string,
  state: FighterState,
): FighterMatchSummary {
  return {
    fighterId,
    machineName: state.build.proposal.machineName,
    chassisId: state.build.proposal.chassisId,
    mobilityId: state.build.proposal.mobilityId,
    weaponId: state.build.proposal.weaponId,
    utilityId: state.build.proposal.utilityId,
    armour: { ...state.armour },
    totalCost: state.build.totalCost,
    opening: "unknown",
    preferredRange: "unknown",
    aggression: 0,
    primaryTarget: "unknown",
    secondaryTarget: "unknown",
  };
}

function buildFighterStateSummary(state: FighterState): FighterStateSummary {
  return {
    fighterId: state.fighterId,
    machineName: state.build.proposal.machineName,
    integrity: state.integrity,
    maxIntegrity: state.maxIntegrity,
    energy: state.energy,
    heat: state.heat,
    zone: state.zone,
    facing: state.facing,
    weaponCooldown: state.weaponCooldown,
    utilityCooldown: state.utilityCooldown,
    mobilityDisabled: state.components.mobilityDisabled,
    weaponDisabled: state.components.weaponDisabled,
    utilityDisabled: state.components.utilityDisabled,
    conditions: [...state.conditions],
  };
}

function extractMoment(event: SimulationEvent): MatchMoment {
  return {
    round: event.round,
    type: event.type,
    description: formatEventData(event),
    actorId: event.actorId ?? "unknown",
    targetId: event.targetId,
    data: event.data,
  };
}

function formatEventData(event: SimulationEvent): string {
  const data = event.data;
  const actor = event.actorId ?? "unknown";
  const target = event.targetId;

  switch (event.type) {
    case "attack": {
      const weapon = String(data.weaponId ?? "unknown");
      const hit = Boolean(data.hit);
      const damage = Number(data.damage ?? 0);
      if (hit) {
        return `${actor} hits ${target ?? "unknown"} with ${weapon} for ${damage} damage`;
      }
      return `${actor} misses ${target ?? "unknown"} with ${weapon}`;
    }
    case "defend":
      return `${actor} defends`;
    case "movement":
      return `${actor} moves from ${String(data.fromZone ?? "unknown")} to ${String(data.toZone ?? "unknown")}`;
    case "component_damage":
      return `${actor}'s ${String(data.component ?? "unknown")} is damaged`;
    case "overturn":
      return `${actor} is overturned`;
    case "recovery":
      return `${actor} recovers from ${String(data.condition ?? "unknown")}`;
    case "judge_score":
      return `Judge scores recorded`;
    default:
      return `${event.type} by ${actor}`;
  }
}

function findFirstHit(events: readonly SimulationEvent[]): MatchMoment | undefined {
  for (const event of events) {
    if (event.type === "attack" && Boolean(event.data.hit)) {
      return extractMoment(event);
    }
  }
  return undefined;
}

function findCriticalHits(events: readonly SimulationEvent[]): MatchMoment[] {
  const moments: MatchMoment[] = [];
  for (const event of events) {
    if (event.type === "attack" && Boolean(event.data.hit)) {
      const damage = Number(event.data.damage ?? 0);
      if (damage >= 15) {
        moments.push(extractMoment(event));
      }
    }
  }
  return moments;
}

function findComponentFailures(events: readonly SimulationEvent[]): MatchMoment[] {
  const moments: MatchMoment[] = [];
  for (const event of events) {
    if (event.type === "component_damage") {
      moments.push(extractMoment(event));
    }
  }
  return moments;
}

function findOverturns(events: readonly SimulationEvent[]): MatchMoment[] {
  const moments: MatchMoment[] = [];
  for (const event of events) {
    if (event.type === "overturn") {
      moments.push(extractMoment(event));
    }
  }
  return moments;
}

export function buildFactualReport(result: MatchResult): FactualMatchReport {
  const { config, events, result: competitionResult, rounds, initialState } = result;

  return {
    schemaVersion: "1",
    matchId: "pending",
    seed: config.seed,
    rounds,
    winner: competitionResult.winner,
    resultMethod: competitionResult.method,
    fighterA: buildFighterMatchSummary("fighter_a", initialState.fighterA),
    fighterB: buildFighterMatchSummary("fighter_b", initialState.fighterB),
    firstHit: findFirstHit(events),
    criticalHits: findCriticalHits(events),
    componentFailures: findComponentFailures(events),
    overturns: findOverturns(events),
    finalStates: {
      fighterA: buildFighterStateSummary(
        events.reduce(
          (state, event) => applyEvent(state, event, "fighter_a"),
          initialState.fighterA,
        ),
      ),
      fighterB: buildFighterStateSummary(
        events.reduce(
          (state, event) => applyEvent(state, event, "fighter_b"),
          initialState.fighterB,
        ),
      ),
    },
  };
}

function applyEvent(
  state: FighterState,
  event: SimulationEvent,
  fighterId: string,
): FighterState {
  if (event.actorId !== fighterId && event.targetId !== fighterId) {
    return state;
  }

  const next = { ...state };

  if (
    event.type === "attack" &&
    event.targetId === fighterId &&
    Boolean(event.data.hit)
  ) {
    const damage = Number(event.data.damage ?? 0);
    next.integrity = Math.max(0, next.integrity - damage);
  }

  if (event.type === "defend" && event.actorId === fighterId) {
    next.energy = Math.max(0, next.energy - 15);
    next.heat = Math.max(0, next.heat - 10);
  }

  if (event.type === "movement" && event.actorId === fighterId) {
    next.zone = String(event.data.toZone ?? next.zone) as typeof next.zone;
    next.facing = String(event.data.facing ?? next.facing) as typeof next.facing;
    next.energy = Math.max(0, next.energy - Number(event.data.energyCost ?? 0));
  }

  if (event.type === "component_damage" && event.actorId === fighterId) {
    const component = String(event.data.component ?? "");
    if (component === "mobility") {
      next.components = { ...next.components, mobilityDisabled: true };
    } else if (component === "weapon") {
      next.components = { ...next.components, weaponDisabled: true };
    } else if (component === "utility") {
      next.components = { ...next.components, utilityDisabled: true };
    }
  }

  if (event.type === "overturn" && event.actorId === fighterId) {
    if (!next.conditions.includes("overturned")) {
      next.conditions = [...next.conditions, "overturned"];
    }
  }

  if (event.type === "recovery" && event.actorId === fighterId) {
    const condition = String(event.data.condition ?? "");
    next.conditions = next.conditions.filter((c) => c !== condition);
  }

  return next;
}

export function enrichMatchSummariesWithPolicy(
  report: FactualMatchReport,
  policyA: {
    opening: string;
    preferredRange: string;
    aggression: number;
    primaryTarget: string;
    secondaryTarget: string;
  },
  policyB: {
    opening: string;
    preferredRange: string;
    aggression: number;
    primaryTarget: string;
    secondaryTarget: string;
  },
): FactualMatchReport {
  return {
    ...report,
    fighterA: {
      ...report.fighterA,
      opening: policyA.opening,
      preferredRange: policyA.preferredRange,
      aggression: policyA.aggression,
      primaryTarget: policyA.primaryTarget,
      secondaryTarget: policyA.secondaryTarget,
    },
    fighterB: {
      ...report.fighterB,
      opening: policyB.opening,
      preferredRange: policyB.preferredRange,
      aggression: policyB.aggression,
      primaryTarget: policyB.primaryTarget,
      secondaryTarget: policyB.secondaryTarget,
    },
  };
}
