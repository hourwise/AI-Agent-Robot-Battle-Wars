import type {
  FighterState,
  ComponentKind,
  ComponentStatus,
  ComponentStates,
  UtilityRuntimeState,
} from "./types.js";
import {
  DAMAGED_MOBILITY_SPEED_PENALTY,
  DAMAGED_WEAPON_MULTIPLIER,
  DAMAGED_COOLING_BONUS,
  COOLING_BONUS,
  CRITICAL_COMPONENT_DAMAGE_THRESHOLD,
  HIGH_DAMAGE_COMPONENT_THRESHOLD,
} from "./constants.js";
import type { SeededRandom } from "./seeded-random.js";

// ── Effective-stat helpers ──

export function getEffectiveSpeed(fighter: FighterState): number {
  const baseSpeed = getBaseSpeed(fighter);
  if (fighter.comps.mobility.state === "damaged") {
    return Math.max(1, baseSpeed - DAMAGED_MOBILITY_SPEED_PENALTY);
  }
  return baseSpeed;
}

export function getEffectiveWeaponDamage(
  fighter: FighterState,
  baseDamage: number,
): number {
  if (fighter.comps.weapon.state === "damaged") {
    return Math.round(baseDamage * DAMAGED_WEAPON_MULTIPLIER);
  }
  return baseDamage;
}

export function getEffectiveCoolingBonus(fighter: FighterState): number {
  if (!fighter.comps.utility.installed) return 0;
  if (fighter.comps.utility.state === "disabled") return 0;
  if (fighter.comps.utility.state === "damaged") return DAMAGED_COOLING_BONUS;
  return COOLING_BONUS;
}

// ── Predicates ──

export function isComponentDamaged(comps: ComponentStates, kind: ComponentKind): boolean {
  return comps[kind].state === "damaged";
}

export function isComponentDisabled(
  comps: ComponentStates,
  kind: ComponentKind,
): boolean {
  return comps[kind].state === "disabled";
}

export function isUtilityInstalled(comps: ComponentStates): boolean {
  return comps.utility.installed;
}

/** Derive legacy binary projection from authoritative state. */
export function deriveBinaryComponents(comps: ComponentStates): {
  mobilityDisabled: boolean;
  weaponDisabled: boolean;
  utilityDisabled: boolean;
} {
  return {
    mobilityDisabled: comps.mobility.state === "disabled",
    weaponDisabled: comps.weapon.state === "disabled",
    utilityDisabled: comps.utility.state === "disabled",
  };
}

// ── Initial state factory ──

export function createInitialComponentStates(utilityId: string): ComponentStates {
  return {
    mobility: { state: "healthy" },
    weapon: { state: "healthy" },
    utility: createInitialUtilityState(utilityId),
  };
}

export function createInitialUtilityState(utilityId: string): UtilityRuntimeState {
  const installed = utilityId !== "none";
  const guard = utilityId === "reinforced_drive" ? ("available" as const) : undefined;
  return { state: "healthy", installed, reinforcedDriveGuard: guard };
}

// ── Qualification ──

export interface QualificationResult {
  qualifies: boolean;
  reason: "critical_effective_damage" | "high_effective_damage" | null;
}

export function checkComponentQualification(
  isCritical: boolean,
  effectiveDamage: number,
): QualificationResult {
  if (isCritical && effectiveDamage >= CRITICAL_COMPONENT_DAMAGE_THRESHOLD) {
    return { qualifies: true, reason: "critical_effective_damage" };
  }
  if (effectiveDamage >= HIGH_DAMAGE_COMPONENT_THRESHOLD) {
    return { qualifies: true, reason: "high_effective_damage" };
  }
  return { qualifies: false, reason: null };
}

// ── Component selection ──

const ZONE_WEIGHTS: Record<string, Record<ComponentKind, number>> = {
  front: { mobility: 50, weapon: 50, utility: 0 },
  rear: { mobility: 70, weapon: 0, utility: 30 },
  left: { mobility: 40, weapon: 20, utility: 40 },
  right: { mobility: 40, weapon: 20, utility: 40 },
  top: { mobility: 30, weapon: 30, utility: 40 },
};

export function selectComponentForTransition(
  comps: ComponentStates,
  hitZone: string,
  rng: SeededRandom,
): ComponentKind | null {
  const eligible: ComponentKind[] = [];

  for (const kind of ["mobility", "weapon", "utility"] as const) {
    if (kind === "utility" && !comps.utility.installed) continue;
    if (comps[kind].state === "disabled") continue;
    eligible.push(kind);
  }

  if (eligible.length === 0) return null;

  const weights = ZONE_WEIGHTS[hitZone] ?? ZONE_WEIGHTS.front!;
  const entryWeights = eligible.map((k) => weights[k] ?? 0);
  const total = entryWeights.reduce((a, b) => a + b, 0);
  if (total <= 0) return eligible[0]!;

  return rng.weightedPick(eligible, entryWeights);
}

// ── Transition ──

export interface TransitionResult {
  transitionOccurred: boolean;
  component: ComponentKind | null;
  previousState: ComponentStatus | null;
  newState: ComponentStatus | null;
  reason: string | null;
  guardStateBefore?: "available" | "spent" | "lost";
  guardStateAfter?: "available" | "spent" | "lost";
  utilityRuntimeChange?: {
    reinforcedDriveGuardBefore: "available" | "spent" | "lost";
    reinforcedDriveGuardAfter: "available" | "spent" | "lost";
  };
}

export function transitionComponentState(
  comps: ComponentStates,
  component: ComponentKind,
  isCritical: boolean,
  effectiveDamage: number,
): TransitionResult {
  const qual = checkComponentQualification(isCritical, effectiveDamage);
  if (!qual.qualifies) {
    return {
      transitionOccurred: false,
      component: null,
      previousState: null,
      newState: null,
      reason: null,
    };
  }

  const current = comps[component].state;

  // Reinforced-drive guard check
  if (
    component === "mobility" &&
    current === "healthy" &&
    comps.utility.installed &&
    comps.utility.state === "healthy" &&
    comps.utility.reinforcedDriveGuard === "available"
  ) {
    // Consume guard
    return {
      transitionOccurred: true,
      component: "mobility",
      previousState: "healthy",
      newState: "healthy",
      reason: "reinforced_drive",
      guardStateBefore: "available",
      guardStateAfter: "spent",
      utilityRuntimeChange: {
        reinforcedDriveGuardBefore: "available",
        reinforcedDriveGuardAfter: "spent",
      },
    };
  }

  // Normal transitions
  if (current === "healthy") {
    const result: TransitionResult = {
      transitionOccurred: true,
      component,
      previousState: "healthy",
      newState: "damaged",
      reason: qual.reason!,
    };
    // Utility transition will lose an available reinforced-drive guard
    if (
      component === "utility" &&
      comps.utility.reinforcedDriveGuard === "available"
    ) {
      result.utilityRuntimeChange = {
        reinforcedDriveGuardBefore: "available",
        reinforcedDriveGuardAfter: "lost",
      };
    }
    return result;
  }

  if (current === "damaged") {
    const result: TransitionResult = {
      transitionOccurred: true,
      component,
      previousState: "damaged",
      newState: "disabled",
      reason: qual.reason!,
    };
    // Utility transition will lose an available reinforced-drive guard
    if (
      component === "utility" &&
      comps.utility.reinforcedDriveGuard === "available"
    ) {
      result.utilityRuntimeChange = {
        reinforcedDriveGuardBefore: "available",
        reinforcedDriveGuardAfter: "lost",
      };
    }
    return result;
  }

  // Disabled — no transition
  return {
    transitionOccurred: false,
    component: null,
    previousState: null,
    newState: null,
    reason: null,
  };
}

/** Apply a transition result to component states (mutates a clone). */
export function applyTransition(
  comps: ComponentStates,
  result: TransitionResult,
): ComponentStates {
  const next = structuredClone(comps);
  if (!result.transitionOccurred || !result.component) return next;

  if (result.reason === "reinforced_drive" && result.component === "mobility") {
    next.utility.reinforcedDriveGuard = "spent";
    return next;
  }

  const kind = result.component;
  if (result.newState) {
    if (kind === "utility") {
      next.utility = {
        ...next.utility,
        state: result.newState,
      };
    } else {
      next[kind] = { ...next[kind], state: result.newState };
    }
  }

  // Utility transition may lose an available guard
  if (
    kind === "utility" &&
    next.utility.reinforcedDriveGuard === "available" &&
    next.utility.state !== "healthy"
  ) {
    next.utility.reinforcedDriveGuard = "lost";
  }

  return next;
}

// ── Base speed lookup ──

function getBaseSpeed(fighter: FighterState): number {
  const mobilityId = fighter.build.proposal.mobilityId;
  switch (mobilityId) {
    case "wheels":
      return 9;
    case "tracks":
      return 5;
    case "legs":
      return 6;
    default:
      return 5;
  }
}

// ── Test helper ──

export function makeTestComponentStates(
  overrides: Partial<{
    mobilityState: ComponentStatus;
    weaponState: ComponentStatus;
    utilityState: ComponentStatus;
    utilityInstalled: boolean;
    reinforcedDriveGuard: "available" | "spent" | "lost" | undefined;
  }> = {},
): ComponentStates {
  return {
    mobility: { state: overrides.mobilityState ?? "healthy" },
    weapon: { state: overrides.weaponState ?? "healthy" },
    utility: {
      state: overrides.utilityState ?? "healthy",
      installed: overrides.utilityInstalled ?? true,
      reinforcedDriveGuard: overrides.reinforcedDriveGuard,
    },
  };
}
