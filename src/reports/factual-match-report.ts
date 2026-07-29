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
    mobilityDamaged: state.comps.mobility.state === "damaged",
    weaponDamaged: state.comps.weapon.state === "damaged",
    utilityDamaged: state.comps.utility.state === "damaged",
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
    case "attack_hit": {
      const weapon = String(data.weapon ?? "unknown");
      const damage = Number(data.effectiveDamage ?? 0);
      const isCritical = Boolean(data.isCritical);
      const critText = isCritical ? " critically" : "";
      return `${actor}${critText} hits ${target ?? "unknown"} with ${weapon} for ${damage} damage`;
    }
    case "attack_missed": {
      const weapon = String(data.weapon ?? "unknown");
      return `${actor} misses ${target ?? "unknown"} with ${weapon}`;
    }
    case "attack_attempted": {
      const weapon = String(data.weapon ?? "unknown");
      return `${actor} attacks with ${weapon}`;
    }
    case "movement_resolved": {
      const to = String(data.to ?? "unknown");
      return `${actor} moves to ${to}`;
    }
    case "component_damaged": {
      const component = String(data.component ?? "unknown");
      const prev = String(data.previousState ?? "");
      const next = String(data.newState ?? "");
      if (data.componentImpact !== undefined) {
        return `${target ?? actor}'s ${component} damaged at component impact ${data.componentImpact} (${String(data.qualificationReason ?? "unknown")})`;
      }
      return `${target ?? actor}'s ${component} damaged (${prev} → ${next})`;
    }
    case "component_damage_resisted": {
      const guardAfter = String(data.guardStateAfter ?? "unknown");
      if (data.componentImpact !== undefined) {
        return `${target ?? actor}'s reinforced drive absorbs component impact ${data.componentImpact} (guard: ${guardAfter})`;
      }
      return `${target ?? actor}'s reinforced drive absorbs impact (guard: ${guardAfter})`;
    }
    case "component_disabled": {
      const component = String(data.component ?? "unknown");
      const prev = String(data.previousState ?? "");
      const next = String(data.newState ?? "");
      if (data.componentImpact !== undefined) {
        return `${target ?? actor}'s ${component} disabled at component impact ${data.componentImpact}`;
      }
      return `${target ?? actor}'s ${component} disabled (${prev} → ${next})`;
    }
    case "robot_overturned":
      return `${target ?? actor} is overturned`;
    case "integrity_damaged": {
      const damage = Number(data.damage ?? 0);
      const remaining = Number(data.remaining ?? 0);
      return `${target ?? actor} takes ${damage} integrity damage (${remaining} remaining)`;
    }
    default:
      return `${event.type} by ${actor}`;
  }
}

function findFirstHit(events: readonly SimulationEvent[]): MatchMoment | undefined {
  for (const event of events) {
    if (event.type === "attack_hit") {
      return extractMoment(event);
    }
  }
  return undefined;
}

function findCriticalHits(events: readonly SimulationEvent[]): MatchMoment[] {
  const moments: MatchMoment[] = [];
  for (const event of events) {
    if (event.type === "attack_hit" && Boolean(event.data.isCritical)) {
      moments.push(extractMoment(event));
    }
  }
  return moments;
}

function findComponentFailures(events: readonly SimulationEvent[]): MatchMoment[] {
  const moments: MatchMoment[] = [];
  for (const event of events) {
    if (
      event.type === "component_disabled" ||
      event.type === "component_damaged" ||
      event.type === "component_damage_resisted"
    ) {
      moments.push(extractMoment(event));
    }
  }
  return moments;
}

function findOverturns(events: readonly SimulationEvent[]): MatchMoment[] {
  const moments: MatchMoment[] = [];
  for (const event of events) {
    if (event.type === "robot_overturned") {
      moments.push(extractMoment(event));
    }
  }
  return moments;
}

function computeFinalState(
  initialState: FighterState,
  events: readonly SimulationEvent[],
  fighterId: string,
): FighterState {
  const state: FighterState = {
    ...initialState,
    components: { ...initialState.components },
    comps: structuredClone(initialState.comps),
    conditions: [...initialState.conditions],
  };

  for (const event of events) {
    // integrity_damaged: targetId is the damaged fighter
    if (event.type === "integrity_damaged" && event.targetId === fighterId) {
      state.integrity = Number(event.data.remaining ?? state.integrity);
    }

    // component_damaged: targetId is the affected fighter
    if (event.type === "component_damaged" && event.targetId === fighterId) {
      const component = String(event.data.component ?? "");
      if (component === "mobility") state.comps.mobility.state = "damaged";
      if (component === "weapon") state.comps.weapon.state = "damaged";
      if (component === "utility") state.comps.utility.state = "damaged";
    }

    // component_disabled: targetId is the affected fighter
    if (event.type === "component_disabled" && event.targetId === fighterId) {
      const component = String(event.data.component ?? "");
      if (component === "mobility") {
        state.comps.mobility.state = "disabled";
        state.components.mobilityDisabled = true;
      }
      if (component === "weapon") {
        state.comps.weapon.state = "disabled";
        state.components.weaponDisabled = true;
      }
      if (component === "utility") {
        state.comps.utility.state = "disabled";
        state.components.utilityDisabled = true;
      }
    }

    // component_damage_resisted: guard consumed
    if (event.type === "component_damage_resisted" && event.targetId === fighterId) {
      if (
        state.comps.utility.reinforcedDriveGuard === "available" &&
        event.data.guardStateAfter === "spent"
      ) {
        state.comps.utility.reinforcedDriveGuard = "spent";
      }
    }

    // robot_overturned: targetId is the overturned fighter
    if (event.type === "robot_overturned" && event.targetId === fighterId) {
      if (!state.conditions.includes("overturned")) {
        state.conditions.push("overturned");
      }
    }

    // movement_resolved: for knockback, targetId moves; for normal, actorId moves
    if (event.type === "movement_resolved") {
      const action = String(event.data.action ?? "");
      const movedFighterId = action === "knockback" ? event.targetId : event.actorId;
      if (movedFighterId === fighterId) {
        state.zone = String(event.data.to ?? state.zone) as typeof state.zone;
        state.facing = String(event.data.facing ?? state.facing) as typeof state.facing;
      }
    }
  }

  // Sync legacy binary projection from authoritative state
  state.components = {
    mobilityDisabled: state.comps.mobility.state === "disabled",
    weaponDisabled: state.comps.weapon.state === "disabled",
    utilityDisabled: state.comps.utility.state === "disabled",
  };

  return state;
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
        computeFinalState(initialState.fighterA, events, "fighter_a"),
      ),
      fighterB: buildFighterStateSummary(
        computeFinalState(initialState.fighterB, events, "fighter_b"),
      ),
    },
  };
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
