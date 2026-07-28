import type { SimulationEvent } from "../../simulator/types.js";
import type { HighlightMoment } from "./ascii.types.js";

const PRIORITY_CRIT = 100;
const PRIORITY_COMPONENT_DISABLE = 90;
const PRIORITY_COMPONENT_DAMAGED = 85;
const PRIORITY_COMPONENT_RESIST = 80;
const PRIORITY_KNOCKBACK = 80;
const PRIORITY_FIRST_HIT = 75;
const PRIORITY_REAR_ATTACK = 70;
const PRIORITY_OVERTURN = 65;
const PRIORITY_REGULAR_HIT = 40;

export function isKnockbackMovement(event: SimulationEvent): boolean {
  return event.type === "movement_resolved" && event.data.action === "knockback";
}

export function isRearAttack(event: SimulationEvent): boolean {
  return event.type === "attack_hit" && event.data.hitZone === "rear";
}

export function isFirstDamagingHit(
  event: SimulationEvent,
  allEvents: readonly SimulationEvent[],
): boolean {
  if (event.type !== "attack_hit") return false;
  const idx = allEvents.indexOf(event);
  for (let i = 0; i < idx; i++) {
    if (allEvents[i]!.type === "attack_hit") return false;
  }
  return true;
}

export function isCriticalHit(event: SimulationEvent): boolean {
  return event.type === "attack_hit" && event.data.isCritical === true;
}

export function isComponentDisable(event: SimulationEvent): boolean {
  return event.type === "component_disabled";
}

export function isComponentDamaged(event: SimulationEvent): boolean {
  return event.type === "component_damaged";
}

export function isComponentDamageResisted(event: SimulationEvent): boolean {
  return event.type === "component_damage_resisted";
}

export function isFinishingAction(
  event: SimulationEvent,
  result: { winner: string | null },
): boolean {
  if (!result.winner) return false;
  if (event.type === "integrity_damaged" && event.data.remaining === 0) return true;
  if (event.type === "component_disabled" && event.data.component === "mobility")
    return true;
  return false;
}

function getEventPriority(
  event: SimulationEvent,
  allEvents: readonly SimulationEvent[],
  _result: { winner: string | null },
): number {
  if (isCriticalHit(event)) return PRIORITY_CRIT;
  if (isComponentDisable(event)) return PRIORITY_COMPONENT_DISABLE;
  if (isComponentDamaged(event)) return PRIORITY_COMPONENT_DAMAGED;
  if (isComponentDamageResisted(event)) return PRIORITY_COMPONENT_RESIST;
  if (isKnockbackMovement(event)) return PRIORITY_KNOCKBACK;
  if (isFirstDamagingHit(event, allEvents)) return PRIORITY_FIRST_HIT;
  if (isRearAttack(event)) return PRIORITY_REAR_ATTACK;
  if (event.type === "robot_overturned") return PRIORITY_OVERTURN;
  if (event.type === "integrity_damaged" && event.data.remaining !== undefined) {
    const remaining = event.data.remaining as number;
    const maxIntegrity = getMaxIntegrity(event, allEvents);
    if (remaining <= maxIntegrity * 0.2) return PRIORITY_REGULAR_HIT + 15;
  }
  if (event.type === "attack_hit") return PRIORITY_REGULAR_HIT;
  return 0;
}

function getMaxIntegrity(
  event: SimulationEvent,
  allEvents: readonly SimulationEvent[],
): number {
  for (const e of allEvents) {
    if (e.type === "competition_started") {
      const fighterData =
        event.actorId === "fighter_a"
          ? (e.data.fighterA as { build: { chassisId: string } } | undefined)
          : (e.data.fighterB as { build: { chassisId: string } } | undefined);
      if (fighterData?.build?.chassisId === "heavy") return 150;
      if (fighterData?.build?.chassisId === "medium") return 100;
      return 60;
    }
  }
  return 100;
}

function groupContiguousEvents(events: readonly SimulationEvent[]): SimulationEvent[][] {
  const groups: SimulationEvent[][] = [];
  let currentGroup: SimulationEvent[] = [];
  let lastSequence = -1;

  for (const event of events) {
    if (
      event.type === "round_started" ||
      event.type === "round_ended" ||
      event.type === "competition_started" ||
      event.type === "competition_ended" ||
      event.type === "policy_triggered"
    ) {
      if (currentGroup.length > 0) {
        groups.push(currentGroup);
        currentGroup = [];
      }
      continue;
    }

    if (lastSequence >= 0 && event.sequence !== lastSequence + 1) {
      if (currentGroup.length > 0) {
        groups.push(currentGroup);
        currentGroup = [];
      }
    }

    currentGroup.push(event);
    lastSequence = event.sequence;
  }

  if (currentGroup.length > 0) {
    groups.push(currentGroup);
  }

  return groups;
}

function getGroupTitle(group: SimulationEvent[]): string {
  for (const event of group) {
    if (event.type === "component_disabled") {
      const component = event.data.component as string;
      return `${formatComponentName(component)} DISABLED`;
    }
    if (event.type === "component_damaged") {
      const component = event.data.component as string;
      return `${formatComponentName(component)} DAMAGED`;
    }
    if (event.type === "component_damage_resisted") {
      return "GUARD ABSORBED";
    }
    if (event.type === "robot_overturned") return "OVERTURNED";
    if (isKnockbackMovement(event)) return "KNOCKBACK";
  }

  for (const event of group) {
    if (event.type === "attack_hit") {
      const hitZone = event.data.hitZone as string;
      const weapon = event.data.weapon as string;
      if (hitZone === "rear") return "REAR STRIKE";
      return `${formatWeaponName(weapon)} STRIKE`;
    }
  }

  for (const event of group) {
    if (event.type === "integrity_damaged") {
      const damage = event.data.damage as number;
      return `HIT (${damage} damage)`;
    }
  }

  return "ACTION";
}

function formatComponentName(component: string): string {
  return component.charAt(0).toUpperCase() + component.slice(1);
}

function formatWeaponName(weapon: string): string {
  return weapon
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function selectHighlights(
  events: readonly SimulationEvent[],
  result: { winner: string | null },
  maxCombatHighlights = 5,
): HighlightMoment[] {
  const candidateEvents: Array<{
    event: SimulationEvent;
    priority: number;
    stableOrder: number;
  }> = [];

  for (let i = 0; i < events.length; i++) {
    const event = events[i]!;
    const priority = getEventPriority(event, events, result);
    if (priority > 0) {
      candidateEvents.push({ event, priority, stableOrder: i });
    }
  }

  candidateEvents.sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority;
    return a.stableOrder - b.stableOrder;
  });

  const selected = candidateEvents.slice(0, maxCombatHighlights);
  selected.sort((a, b) => a.stableOrder - b.stableOrder);

  const combatEvents = new Set(selected.map((s) => s.event));
  const groups = groupContiguousEvents(
    events.filter(
      (e) =>
        combatEvents.has(e) ||
        e.type === "attack_attempted" ||
        e.type === "attack_hit" ||
        e.type === "attack_missed" ||
        e.type === "integrity_damaged" ||
        e.type === "component_disabled" ||
        e.type === "robot_overturned" ||
        isKnockbackMovement(e),
    ),
  );

  const moments: HighlightMoment[] = [];
  let stableOrder = 0;

  for (const group of groups) {
    const hasSelected = group.some((e) => combatEvents.has(e));
    if (!hasSelected) continue;

    const lastEvent = group[group.length - 1]!;
    const round = lastEvent.round;
    const title = getGroupTitle(group);

    moments.push({
      round,
      title,
      events: group,
      stateAfter: undefined as unknown as import("./ascii.types.js").CompetitionState,
      priority: Math.max(...group.map((e) => getEventPriority(e, events, result))),
      stableOrder: stableOrder++,
    });
  }

  return moments.slice(0, maxCombatHighlights);
}
