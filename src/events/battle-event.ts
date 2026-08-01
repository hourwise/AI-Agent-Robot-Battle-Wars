import type { SimulationEvent } from "../simulator/types.js";

export type CompetitionStartedData = {
  seed: number;
  rulesetVersion: string;
  catalogueVersion: string;
  simulatorVersion: string;
  componentQualificationId?: string;
  componentQualification?: {
    id: string;
    configChecksum: string;
    model: string;
  };
  fighterA: { id: string; build: unknown };
  fighterB: { id: string; build: unknown };
};

export type RoundStartedData = Record<string, never>;

export type MovementResolvedData = {
  from: string;
  to: string;
  facing: string;
  action: string;
};

export type AttackAttemptedData = {
  weapon: string;
  momentum: number;
};

export type AttackMissedData = {
  weapon: string;
};

export type AttackHitData = {
  weapon: string;
  hitZone: string;
  rawDamage: number;
  effectiveDamage: number;
  integrityEffectiveDamage?: number;
  isCritical: boolean;
  armourAtHitZone?: number;
  componentImpact?: number;
  componentQualificationId?: string;
  componentQualificationConfigChecksum?: string;
  componentQualificationChecksum?: string;
  componentQualificationModel?: string;
  componentArmourFactor?: number;
  componentMinimumImpact?: number;
  criticalComponentImpactThreshold?: number;
  highComponentImpactThreshold?: number;
  componentArmourBandId?: string;
  componentArmourBandMinInclusive?: number;
  componentArmourBandMaxInclusive?: number | null;
  qualificationReason?: string | null;
};

export type IntegrityDamagedData = {
  damage: number;
  remaining: number;
};

export type ComponentTransitionData = {
  component: string;
  previousState: string;
  newState: string;
  sourceAttack: { weapon: string; isCritical: boolean };
  rawDamage: number;
  armourAtHitZone: number;
  integrityEffectiveDamage: number;
  componentImpact: number;
  componentQualificationId: string;
  componentQualificationConfigChecksum: string;
  componentQualificationChecksum?: string;
  componentQualificationModel: string;
  componentArmourFactor: number;
  componentMinimumImpact: number;
  criticalComponentImpactThreshold: number;
  highComponentImpactThreshold: number;
  componentArmourBandId?: string;
  componentArmourBandMinInclusive?: number;
  componentArmourBandMaxInclusive?: number | null;
  qualificationReason: string | null;
  hitZone: string;
  reason: string;
  guardStateBefore?: string;
  guardStateAfter?: string;
  utilityRuntimeChange?: Record<string, string>;
};

export type ComponentDisabledData = ComponentTransitionData;

export type RobotOverturnedData = Record<string, never>;

export type PolicyTriggeredData = {
  action: {
    movement: string;
    combat: string;
  };
};

export type RoundEndedData = {
  fighterA: {
    integrity: number;
    energy: number;
    heat: number;
    zone: string;
    conditions: string[];
  };
  fighterB: {
    integrity: number;
    energy: number;
    heat: number;
    zone: string;
    conditions: string[];
  };
};

export type CompetitionEndedData = {
  winner: string | null;
  loser: string | null;
  method: string;
  rounds: number;
};

export function isCompetitionStarted(
  event: SimulationEvent,
): event is SimulationEvent & { data: CompetitionStartedData } {
  return event.type === "competition_started";
}

export function isRoundStarted(
  event: SimulationEvent,
): event is SimulationEvent & { data: RoundStartedData } {
  return event.type === "round_started";
}

export function isMovementResolved(
  event: SimulationEvent,
): event is SimulationEvent & { data: MovementResolvedData } {
  return event.type === "movement_resolved";
}

/**
 * Canonical movement-event subject (Milestone 0.2C Phase 3D1).
 *
 * The fighter whose zone a `movement_resolved` event applies to, frozen for all
 * movement reconstruction (factual reporting, replay, statistics):
 *
 *   action = knockback → targetId
 *   action = grapple  → targetId
 *   all normal movement actions → actorId
 *
 * Normal movement includes `advance`, `retreat`, `circle_left`, `circle_right`,
 * and `hold` (where an event exists because facing changed). Returns `null`
 * when the required subject id is absent so a malformed or unknown movement
 * event can never silently move the wrong fighter.
 */
export function getMovementEventSubjectId(event: SimulationEvent): string | null {
  if (event.type !== "movement_resolved") return null;
  const action = event.data?.action;
  if (action === "knockback" || action === "grapple") {
    return event.targetId ?? null;
  }
  return event.actorId ?? null;
}

export function isAttackAttempted(
  event: SimulationEvent,
): event is SimulationEvent & { data: AttackAttemptedData } {
  return event.type === "attack_attempted";
}

export function isAttackMissed(
  event: SimulationEvent,
): event is SimulationEvent & { data: AttackMissedData } {
  return event.type === "attack_missed";
}

export function isAttackHit(
  event: SimulationEvent,
): event is SimulationEvent & { data: AttackHitData } {
  return event.type === "attack_hit";
}

export function isIntegrityDamaged(
  event: SimulationEvent,
): event is SimulationEvent & { data: IntegrityDamagedData } {
  return event.type === "integrity_damaged";
}

export function isComponentDisabled(
  event: SimulationEvent,
): event is SimulationEvent & { data: ComponentDisabledData } {
  return event.type === "component_disabled";
}

export function isRobotOverturned(
  event: SimulationEvent,
): event is SimulationEvent & { data: RobotOverturnedData } {
  return event.type === "robot_overturned";
}

export function isPolicyTriggered(
  event: SimulationEvent,
): event is SimulationEvent & { data: PolicyTriggeredData } {
  return event.type === "policy_triggered";
}

export function isRoundEnded(
  event: SimulationEvent,
): event is SimulationEvent & { data: RoundEndedData } {
  return event.type === "round_ended";
}

export function isCompetitionEnded(
  event: SimulationEvent,
): event is SimulationEvent & { data: CompetitionEndedData } {
  return event.type === "competition_ended";
}
