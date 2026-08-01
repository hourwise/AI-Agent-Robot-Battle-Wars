/**
 * Pure positioning-aware final-state projection (Milestone 0.2C Phase 3D1).
 *
 * Reconstructs an authoritative final fighter state from the initial state and
 * the event stream without re-running combat. The positioning model is
 * explicit: legacy reconstruction accepts only legacy five-zone values and grid
 * reconstruction accepts only canonical grid zones (mixed values are rejected
 * in grid mode). Movement-event subjects use the canonical shared helper, so
 * knockback/grapple reposition the target while advance/retreat/circle/hold
 * reposition the actor. Latest authoritative `round_ended` facts override
 * integrity, energy, heat, zone and conditions; component states and guard
 * state follow the authoritative component events.
 *
 * Hardened (Milestone 0.2C Phase 3D1.1):
 *
 * - unknown, missing, non-string or malformed movement actions have no subject
 *   and therefore never move either fighter;
 * - a present but invalid movement `facing` is rejected; the current facing is
 *   preserved only when the facing field is genuinely absent;
 * - `round_ended.conditions` must be an array of canonical conditions and is
 *   copied, never referenced, preserving deterministic ordering;
 * - the returned state shares no mutable nested state with the initial state,
 *   any event data object, any `round_ended` fighter object or any event-owned
 *   conditions array (build, comps, armour, components and conditions are all
 *   cloned/copied);
 * - no input state or event is mutated and no fact absent from the event
 *   stream is invented.
 */
import type {
  ArenaZone,
  ComponentStates,
  Condition,
  Direction,
  GridZone,
  SimulationEvent,
  ZoneFighterState,
} from "../simulator/types.js";
import { isGridZone } from "../simulator/arena-grid.js";
import { LEGACY_ARENA_ZONES } from "../schemas/positioning.schema.js";
import { getMovementEventSubjectId } from "../events/battle-event.js";

export type ReportPositioningModel = "legacy-five-zone-v1" | "grid-3x3-v1";

const LEGACY_ZONE_SET = new Set<string>(LEGACY_ARENA_ZONES);

const CARDINAL_DIRECTIONS: ReadonlySet<string> = new Set<string>([
  "north",
  "east",
  "south",
  "west",
]);

const CANONICAL_CONDITIONS: ReadonlySet<string> = new Set<string>([
  "overturned",
  "immobilised",
  "overheated",
  "stunned",
]);

function isCardinalDirection(value: unknown): value is Direction {
  return typeof value === "string" && CARDINAL_DIRECTIONS.has(value);
}

function assertZoneForModel(
  zone: unknown,
  model: ReportPositioningModel,
  context: string,
): void {
  if (model === "grid-3x3-v1") {
    if (!isGridZone(zone)) {
      throw new Error(
        `Grid final-state projection rejects non-grid zone in ${context}: ${String(zone)}`,
      );
    }
    return;
  }
  if (typeof zone !== "string" || !LEGACY_ZONE_SET.has(zone)) {
    throw new Error(
      `Legacy final-state projection rejects non-legacy zone in ${context}: ${String(zone)}`,
    );
  }
}

interface RoundEndFighterFacts {
  integrity?: unknown;
  energy?: unknown;
  heat?: unknown;
  zone?: unknown;
  conditions?: unknown;
}

function applyComponentTransition(
  state: { comps: ComponentStates },
  component: string,
  newState: "damaged" | "disabled",
  fighterId: string,
): Condition[] {
  const extraConditions: Condition[] = [];
  if (component === "mobility") {
    state.comps.mobility.state = newState;
  } else if (component === "weapon") {
    state.comps.weapon.state = newState;
  } else if (component === "utility") {
    state.comps.utility.state = newState;
  }
  if (component === "mobility" && newState === "disabled") {
    extraConditions.push("immobilised");
  }
  void fighterId;
  return extraConditions;
}

/**
 * Validate and copy an authoritative `round_ended.conditions` value. Requires
 * an array whose every value is a canonical condition; unknown or malformed
 * conditions are rejected (never silently reinterpreted, inferred or added).
 * Deterministic array ordering is preserved.
 */
function parseRoundEndConditions(value: unknown, fighterId: string): Condition[] {
  if (!Array.isArray(value)) {
    throw new Error(
      `Final-state projection rejects non-array round_ended conditions for ${fighterId}`,
    );
  }
  const conditions: Condition[] = [];
  for (const item of value) {
    if (typeof item !== "string" || !CANONICAL_CONDITIONS.has(item)) {
      throw new Error(
        `Final-state projection rejects non-canonical round_ended condition for ${fighterId}: ${String(item)}`,
      );
    }
    conditions.push(item as Condition);
  }
  return conditions;
}

/**
 * Project the final state of one fighter from its initial state and the full
 * event stream, for the given explicit positioning model.
 */
export function projectFinalFighterState<Z extends ArenaZone | GridZone>(
  initialState: ZoneFighterState<Z>,
  events: readonly SimulationEvent[],
  fighterId: string,
  positioningModel: ReportPositioningModel,
): ZoneFighterState<Z> {
  // Full isolation: the returned state shares no mutable nested state with the
  // initial state. Build, comps, armour, components and conditions are all
  // cloned/copied so later mutation of either side cannot leak across.
  const state: ZoneFighterState<Z> = {
    ...initialState,
    build: structuredClone(initialState.build),
    comps: structuredClone(initialState.comps),
    components: { ...initialState.components },
    armour: { ...initialState.armour },
    conditions: [...initialState.conditions],
  };

  let lastRoundEnd: SimulationEvent | null = null;

  for (const event of events) {
    if (event.type === "round_ended") {
      lastRoundEnd = event;
      continue;
    }

    if (event.type === "integrity_damaged" && event.targetId === fighterId) {
      const remaining = Number(event.data.remaining);
      if (Number.isFinite(remaining)) state.integrity = remaining;
      continue;
    }

    if (event.type === "movement_resolved") {
      const subject = getMovementEventSubjectId(event);
      if (subject !== fighterId) continue;
      const to = event.data?.to;
      const from = event.data?.from;
      assertZoneForModel(from, positioningModel, "movement_resolved.from");
      assertZoneForModel(to, positioningModel, "movement_resolved.to");
      state.zone = to as Z;
      const facing = event.data?.facing;
      if (facing !== undefined) {
        // A present but invalid facing is rejected; the current facing is
        // preserved only when the facing field is genuinely absent.
        if (!isCardinalDirection(facing)) {
          throw new Error(
            `Final-state projection rejects invalid movement facing for ${fighterId}: ${String(facing)}`,
          );
        }
        state.facing = facing;
      }
      continue;
    }

    if (event.type === "component_damaged" && event.targetId === fighterId) {
      const component = String(event.data?.component ?? "");
      state.conditions.push(
        ...applyComponentTransition(state, component, "damaged", fighterId),
      );
      continue;
    }

    if (event.type === "component_disabled" && event.targetId === fighterId) {
      const component = String(event.data?.component ?? "");
      state.conditions.push(
        ...applyComponentTransition(state, component, "disabled", fighterId),
      );
      continue;
    }

    if (event.type === "component_damage_resisted" && event.targetId === fighterId) {
      if (
        state.comps.utility.reinforcedDriveGuard === "available" &&
        event.data?.guardStateAfter === "spent"
      ) {
        state.comps.utility.reinforcedDriveGuard = "spent";
      }
      continue;
    }

    if (event.type === "robot_overturned" && event.targetId === fighterId) {
      if (!state.conditions.includes("overturned")) {
        state.conditions.push("overturned");
      }
      continue;
    }

    if (event.type === "robot_overheated" && event.actorId === fighterId) {
      if (!state.conditions.includes("overheated")) {
        state.conditions.push("overheated");
      }
      continue;
    }

    if (event.type === "robot_recovered" && event.actorId === fighterId) {
      state.conditions = state.conditions.filter((c) => c !== "overheated");
      const heatAfter = Number(event.data?.heatAfterRecovery);
      if (Number.isFinite(heatAfter)) state.heat = heatAfter;
      continue;
    }
  }

  if (lastRoundEnd) {
    const data = lastRoundEnd.data as {
      fighterA?: RoundEndFighterFacts;
      fighterB?: RoundEndFighterFacts;
    };
    const facts = fighterId === "fighter_a" ? data.fighterA : data.fighterB;
    if (facts && typeof facts === "object") {
      assertZoneForModel(facts.zone, positioningModel, "round_ended zone");
      if (Number.isFinite(facts.integrity)) state.integrity = facts.integrity as number;
      if (Number.isFinite(facts.energy)) state.energy = facts.energy as number;
      if (Number.isFinite(facts.heat)) state.heat = facts.heat as number;
      if (facts.zone !== undefined) state.zone = facts.zone as Z;
      if (facts.conditions !== undefined) {
        // Copy, never reference: the returned state must not share the
        // event-owned conditions array. Unknown conditions are rejected.
        state.conditions = parseRoundEndConditions(facts.conditions, fighterId);
      }
    }
  }

  state.components = {
    mobilityDisabled: state.comps.mobility.state === "disabled",
    weaponDisabled: state.comps.weapon.state === "disabled",
    utilityDisabled: state.comps.utility.state === "disabled",
  };

  return state;
}
