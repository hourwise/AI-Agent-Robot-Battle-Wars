import type { MovementAction, SimulationEvent } from "../simulator/types.js";

/**
 * Canonical runtime movement-event action set (Milestone 0.2C Phase 3D1.1).
 * Exactly the five normal movement actions plus the two target-repositioning
 * actions. Unknown, missing, non-string or malformed actions are NOT movement
 * actions: reporting and replay must never treat an arbitrary string as a
 * movement action, so a malformed persisted event moves nothing.
 */
export type MovementEventAction = MovementAction | "knockback" | "grapple";

const MOVEMENT_EVENT_ACTIONS: ReadonlySet<string> = new Set<string>([
  "advance",
  "retreat",
  "circle_left",
  "circle_right",
  "hold",
  "knockback",
  "grapple",
]);

/** Runtime guard: is `value` one of the canonical movement-event actions? */
export function isMovementEventAction(value: unknown): value is MovementEventAction {
  return typeof value === "string" && MOVEMENT_EVENT_ACTIONS.has(value);
}

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
  action: MovementEventAction;
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
 *   advance, retreat, circle_left, circle_right, hold → actorId
 *
 * Hardened (Milestone 0.2C Phase 3D1.1): this is an explicit exhaustive switch
 * over the canonical `MovementEventAction` set. There is no catch-all "any
 * other action is actor movement" branch — an unknown, missing, non-string or
 * malformed action returns `null`, even when a valid `actorId` or `targetId`
 * is present, so a malformed persisted event can never silently move the wrong
 * fighter. A known normal action without `actorId`, or knockback/grapple
 * without `targetId`, also returns `null`. Non-movement events return `null`.
 * Source events are never mutated.
 */
export function getMovementEventSubjectId(event: SimulationEvent): string | null {
  if (event.type !== "movement_resolved") return null;
  const action = event.data?.action;
  switch (action) {
    case "knockback":
    case "grapple":
      return event.targetId ?? null;
    case "advance":
    case "retreat":
    case "circle_left":
    case "circle_right":
    case "hold":
      return event.actorId ?? null;
    default:
      // Unknown, missing or non-string action: no subject. Never a catch-all.
      return null;
  }
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
