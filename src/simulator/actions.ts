import type {
  FighterState,
  GridFighterState,
  FighterCoreState,
  ActionPolicy,
  RoundAction,
  DistanceBand,
  ArenaZone,
} from "./types.js";
import type { SeededRandom } from "./seeded-random.js";
import { isComponentDisabled } from "./component-state.js";
import { getCombatProximity } from "./arena-grid.js";

export function deriveAction(
  state: FighterState,
  policy: ActionPolicy,
  opponent: FighterState,
  rng: SeededRandom,
): RoundAction {
  const early = deriveEarlyAction(state, policy);
  if (early) return early;
  const distance = computeDistance(state.zone, opponent.zone);
  return derivePositionedAction(policy, rng, distance, state.weaponCooldown > 0);
}

/**
 * Grid action path: identical policy fields, thresholds and decision ordering
 * to the legacy path, replacing only the positioning calculation with the grid
 * combat proximity band.
 */
export function deriveGridAction(
  state: GridFighterState,
  policy: ActionPolicy,
  opponent: GridFighterState,
  rng: SeededRandom,
): RoundAction {
  const early = deriveEarlyAction(state, policy);
  if (early) return early;
  const distance = getCombatProximity(state.zone, opponent.zone);
  return derivePositionedAction(policy, rng, distance, state.weaponCooldown > 0);
}

function deriveEarlyAction(
  state: FighterCoreState,
  policy: ActionPolicy,
): RoundAction | null {
  const integrityPercent = (state.integrity / state.maxIntegrity) * 100;
  const heatPercent = (state.heat / 100) * 100;

  if (state.conditions.includes("overturned")) {
    return { movement: "hold", combat: "idle" };
  }

  if (state.conditions.includes("overheated")) {
    return { movement: "hold", combat: "defend" };
  }

  if (isComponentDisabled(state.comps, "mobility")) {
    return {
      movement: "hold",
      combat: isComponentDisabled(state.comps, "weapon") ? "idle" : "attack",
    };
  }

  if (integrityPercent <= policy.retreatThreshold) {
    return deriveFallback(policy.fallback, state);
  }

  if (heatPercent >= policy.heatThreshold) {
    return { movement: "hold", combat: "defend" };
  }

  return null;
}

function deriveFallback(
  fallback: ActionPolicy["fallback"],
  state: FighterCoreState,
): RoundAction {
  switch (fallback) {
    case "retreat":
      return { movement: "retreat", combat: "defend" };
    case "defend":
      return { movement: "hold", combat: "defend" };
    case "desperate_attack":
      return isComponentDisabled(state.comps, "weapon")
        ? { movement: "hold", combat: "idle" }
        : { movement: "hold", combat: "attack" };
  }
}

/**
 * Shared positioned action core. Preserves the legacy RNG order exactly:
 * `deriveMovement` consumes RNG first, then (for engagement) the aggression
 * combat roll. Cooldown rounds always defend without an extra roll.
 */
function derivePositionedAction(
  policy: ActionPolicy,
  rng: SeededRandom,
  distance: DistanceBand,
  isCooldown: boolean,
): RoundAction {
  const movement = deriveMovement(distance, policy, rng);
  const combat = isCooldown
    ? "defend"
    : policy.aggression > 50 || rng.chance(policy.aggression / 100)
      ? "attack"
      : "defend";
  return { movement, combat };
}

function deriveMovement(
  distance: DistanceBand,
  policy: ActionPolicy,
  rng: SeededRandom,
): RoundAction["movement"] {
  if (policy.opening === "rush" && distance !== "close") {
    return "advance";
  }

  if (policy.opening === "hold") {
    return "hold";
  }

  if (distance === "close") {
    return rng.chance(0.5) ? "hold" : rng.pick(["circle_left", "circle_right"] as const);
  }

  if (distance === "far") {
    return "advance";
  }

  if (policy.preferredRange === "close" && distance === "medium") {
    return "advance";
  }

  if (policy.preferredRange === "far" && distance === "medium") {
    return "retreat";
  }

  if (policy.aggression > 70) {
    return "advance";
  }

  if (policy.aggression < 30) {
    return "retreat";
  }

  return rng.pick(["hold", "circle_left", "circle_right"] as const);
}

export function computeDistance(zoneA: ArenaZone, zoneB: ArenaZone): DistanceBand {
  if (zoneA === zoneB) return "close";

  if (zoneA === "center" || zoneB === "center") return "medium";

  const opposingEdges: Array<[ArenaZone, ArenaZone]> = [
    ["north_edge", "south_edge"],
    ["south_edge", "north_edge"],
    ["east_edge", "west_edge"],
    ["west_edge", "east_edge"],
  ];

  for (const [a, b] of opposingEdges) {
    if (zoneA === a && zoneB === b) return "far";
  }

  return "medium";
}
