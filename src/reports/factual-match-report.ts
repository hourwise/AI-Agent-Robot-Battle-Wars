import type {
  AnyMatchResult,
  GridFighterState,
  GridMatchResult,
  MatchResult,
  SimulationEvent,
  FighterState,
} from "../simulator/types.js";
import type {
  AnyFactualMatchReport,
  FactualMatchReportV1,
  FactualMatchReportV2,
  FighterMatchSummary,
  FighterStateSummary,
  FighterStateSummaryV2,
  MatchMoment,
} from "../schemas/factual-report.schema.js";
import { projectFinalFighterState } from "./final-state-projection.js";

function buildFighterMatchSummary(
  fighterId: string,
  state: FighterState | GridFighterState,
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

function buildFighterStateSummaryV1(state: FighterState): FighterStateSummary {
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

/** v2 state summary: grid zone, no cooldowns (not reconstructable). */
function buildFighterStateSummaryV2(state: GridFighterState): FighterStateSummaryV2 {
  return {
    fighterId: state.fighterId,
    machineName: state.build.proposal.machineName,
    integrity: state.integrity,
    maxIntegrity: state.maxIntegrity,
    energy: state.energy,
    heat: state.heat,
    zone: state.zone,
    facing: state.facing,
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

function finalStateV1(result: MatchResult, fighterId: string): FighterState {
  return projectFinalFighterState(
    result.initialState[fighterId === "fighter_a" ? "fighterA" : "fighterB"],
    result.events,
    fighterId,
    "legacy-five-zone-v1",
  );
}

function finalStateV2(result: GridMatchResult, fighterId: string): GridFighterState {
  return projectFinalFighterState(
    result.initialState[fighterId === "fighter_a" ? "fighterA" : "fighterB"],
    result.events,
    fighterId,
    "grid-3x3-v1",
  );
}

/**
 * Legacy factual-report builder. Produces a schema-v1 report from a legacy
 * `MatchResult`; the JSON shape is unchanged. Reconstructed final facts now
 * follow the authoritative event stream (latest `round_ended` integrity,
 * energy, heat, zone and conditions; component transitions; guard state;
 * mobility-disable immobilisation; grapple/knockback target repositioning via
 * the canonical movement-subject helper) — documented factual-correctness
 * fixes that do not alter the v1 JSON shape.
 */
export function buildFactualReport(result: MatchResult): FactualMatchReportV1 {
  const { config, events, result: competitionResult, rounds, initialState } = result;

  return {
    schemaVersion: "1",
    matchId: "pending",
    componentQualification: config.componentQualification,
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
      fighterA: buildFighterStateSummaryV1(finalStateV1(result, "fighter_a")),
      fighterB: buildFighterStateSummaryV1(finalStateV1(result, "fighter_b")),
    },
  };
}

/**
 * Grid factual-report builder. Produces a schema-v2 report from an opt-in grid
 * `GridMatchResult`, using the same event-driven projection with the explicit
 * grid positioning model.
 */
export function buildGridFactualReport(result: GridMatchResult): FactualMatchReportV2 {
  const { config, events, result: competitionResult, rounds, initialState } = result;

  return {
    schemaVersion: "2",
    simulatorVersion: "0.3.0",
    positioningModel: "grid-3x3-v1",
    rulesetVersion: "0.2.0",
    catalogueVersion: "1",
    matchId: "pending",
    componentQualification: config.componentQualification,
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
      fighterA: buildFighterStateSummaryV2(finalStateV2(result, "fighter_a")),
      fighterB: buildFighterStateSummaryV2(finalStateV2(result, "fighter_b")),
    },
  };
}

/**
 * Version-aware report builder that dispatches through the explicit immutable
 * runtime identity — never zone strings:
 *
 *   legacy identity (`0.2.0` / `legacy-five-zone-v1`) → factual-report v1
 *   grid identity (`0.3.0` / `grid-3x3-v1`) → factual-report v2
 *
 * Invalid runtime/model pairings are rejected.
 */
export function buildFactualReportForResult(
  result: AnyMatchResult,
): AnyFactualMatchReport {
  const { positioningModel, simulatorVersion } = result.runtime;
  if (positioningModel === "grid-3x3-v1") {
    if (simulatorVersion !== "0.3.0") {
      throw new Error(
        `Grid report requires simulatorVersion 0.3.0; received ${String(simulatorVersion)}`,
      );
    }
    return buildGridFactualReport(result as GridMatchResult);
  }
  if (positioningModel === "legacy-five-zone-v1") {
    if (simulatorVersion !== "0.2.0") {
      throw new Error(
        `Legacy report requires simulatorVersion 0.2.0; received ${String(simulatorVersion)}`,
      );
    }
    return buildFactualReport(result as MatchResult);
  }
  throw new Error(`Unknown positioning model: ${String(positioningModel)}`);
}

export function enrichMatchSummariesWithPolicy<R extends AnyFactualMatchReport>(
  report: R,
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
): R {
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
