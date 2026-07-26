import type {
  FighterState,
  ActionPolicy,
  RoundAction,
  DistanceBand,
  ArenaZone,
} from "./types.js";
import type { SeededRandom } from "./seeded-random.js";

export function deriveAction(
  state: FighterState,
  policy: ActionPolicy,
  opponent: FighterState,
  rng: SeededRandom,
): RoundAction {
  const integrityPercent = (state.integrity / state.maxIntegrity) * 100;
  const heatPercent = (state.heat / 100) * 100;

  if (state.conditions.includes("overturned")) {
    return { movement: "hold", combat: "idle" };
  }

  if (state.conditions.includes("overheated")) {
    return { movement: "hold", combat: "defend" };
  }

  if (state.components.mobilityDisabled) {
    return {
      movement: "hold",
      combat: state.components.weaponDisabled ? "idle" : "attack",
    };
  }

  if (integrityPercent <= policy.retreatThreshold) {
    return deriveFallback(policy.fallback, state);
  }

  if (heatPercent >= policy.heatThreshold) {
    return { movement: "hold", combat: "defend" };
  }

  if (state.weaponCooldown > 0) {
    return deriveCooldownAction(state, opponent, policy, rng);
  }

  return deriveEngagementAction(state, opponent, policy, rng);
}

function deriveFallback(
  fallback: ActionPolicy["fallback"],
  state: FighterState,
): RoundAction {
  switch (fallback) {
    case "retreat":
      return { movement: "retreat", combat: "defend" };
    case "defend":
      return { movement: "hold", combat: "defend" };
    case "desperate_attack":
      return state.components.weaponDisabled
        ? { movement: "hold", combat: "idle" }
        : { movement: "hold", combat: "attack" };
  }
}

function deriveCooldownAction(
  state: FighterState,
  opponent: FighterState,
  policy: ActionPolicy,
  rng: SeededRandom,
): RoundAction {
  const distance = computeDistance(state.zone, opponent.zone);
  const movement = deriveMovement(distance, policy, rng);
  return { movement, combat: "defend" };
}

function deriveEngagementAction(
  state: FighterState,
  opponent: FighterState,
  policy: ActionPolicy,
  rng: SeededRandom,
): RoundAction {
  const distance = computeDistance(state.zone, opponent.zone);
  const movement = deriveMovement(distance, policy, rng);
  const combat =
    policy.aggression > 50 || rng.chance(policy.aggression / 100) ? "attack" : "defend";
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
