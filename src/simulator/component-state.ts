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
} from "./constants.js";
import {
  getComponentQualificationConfigChecksum,
  getDefaultComponentQualificationConfig,
  resolveArmourBand,
  type ComponentQualificationId,
  type ComponentQualificationConfig,
} from "./component-qualification-registry.js";
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

export interface ComponentImpactInput {
  readonly rawDamage: number;
  readonly armourAtHitZone: number;
}

export interface ComponentImpactResult {
  readonly rawDamage: number;
  readonly armourAtHitZone: number;
  readonly qualificationId: ComponentQualificationId;
  readonly qualificationConfigChecksum: string;
  readonly qualificationModel: ComponentQualificationConfig["model"];
  readonly armourFactor: number;
  readonly minimumImpact: number;
  readonly componentImpact: number;
  readonly bandId?: string;
  readonly bandMinArmourInclusive?: number;
  readonly bandMaxArmourInclusive?: number | null;
  readonly criticalThreshold: number;
  readonly highImpactThreshold: number;
}

export interface QualificationResult {
  readonly qualifies: boolean;
  readonly qualificationId: ComponentQualificationId;
  readonly qualificationConfigChecksum: string;
  readonly qualificationModel: ComponentQualificationConfig["model"];
  readonly componentImpact: number;
  readonly criticalThreshold: number;
  readonly highImpactThreshold: number;
  readonly reason: "critical_component_impact" | "high_component_impact" | null;
  readonly bandId?: string;
  readonly bandMinArmourInclusive?: number;
  readonly bandMaxArmourInclusive?: number | null;
}

export function calculateComponentImpact(
  input: ComponentImpactInput,
  config: ComponentQualificationConfig = getDefaultComponentQualificationConfig(),
): ComponentImpactResult {
  if (!Number.isFinite(input.rawDamage) || input.rawDamage < 0) {
    throw new Error("rawDamage must be a finite non-negative number");
  }
  if (!Number.isInteger(input.armourAtHitZone) || input.armourAtHitZone < 0) {
    throw new Error("armourAtHitZone must be a finite non-negative integer");
  }
  const band =
    config.model === "armour-band-component-impact"
      ? resolveArmourBand(config, Math.trunc(input.armourAtHitZone))
      : undefined;
  const criticalThreshold =
    band?.criticalThreshold ??
    (config.model === "linear-component-impact" ? config.criticalThreshold : 0);
  const highImpactThreshold =
    band?.highImpactThreshold ??
    (config.model === "linear-component-impact" ? config.highImpactThreshold : 0);
  return {
    rawDamage: Math.trunc(input.rawDamage),
    armourAtHitZone: Math.trunc(input.armourAtHitZone),
    qualificationId: config.id,
    qualificationConfigChecksum: getComponentQualificationConfigChecksum(config),
    qualificationModel: config.model,
    armourFactor: config.armourFactor,
    minimumImpact: config.minimumImpact,
    ...(band
      ? {
          bandId: band.id,
          bandMinArmourInclusive: band.minArmourInclusive,
          bandMaxArmourInclusive: band.maxArmourInclusive,
          criticalThreshold,
          highImpactThreshold,
        }
      : {
          criticalThreshold,
          highImpactThreshold,
        }),
    componentImpact: Math.max(
      config.minimumImpact,
      Math.round(
        Math.trunc(input.rawDamage) -
          Math.trunc(input.armourAtHitZone) * config.armourFactor,
      ),
    ),
  };
}

export function checkComponentQualification(
  isCritical: boolean,
  componentImpact: number,
  config: ComponentQualificationConfig = getDefaultComponentQualificationConfig(),
  band?: {
    readonly id: string;
    readonly minArmourInclusive: number;
    readonly maxArmourInclusive: number | null;
    readonly criticalThreshold: number;
    readonly highImpactThreshold: number;
  },
): QualificationResult {
  const configChecksum = getComponentQualificationConfigChecksum(config);
  const thresholdBand =
    config.model === "armour-band-component-impact"
      ? band
      : undefined;
  if (!thresholdBand && config.model === "armour-band-component-impact") {
    throw new Error("Armour-band qualification requires a resolved band");
  }
  const criticalThreshold =
    thresholdBand?.criticalThreshold ??
    (config.model === "linear-component-impact" ? config.criticalThreshold : 0);
  const highImpactThreshold =
    thresholdBand?.highImpactThreshold ??
    (config.model === "linear-component-impact" ? config.highImpactThreshold : 0);
  if (!Number.isFinite(componentImpact) || componentImpact < config.minimumImpact) {
    return {
      qualifies: false,
      qualificationId: config.id,
      qualificationConfigChecksum: configChecksum,
      qualificationModel: config.model,
      componentImpact: config.minimumImpact,
      criticalThreshold,
      highImpactThreshold,
      reason: null,
      ...(thresholdBand
        ? {
            bandId: thresholdBand.id,
            bandMinArmourInclusive: thresholdBand.minArmourInclusive,
            bandMaxArmourInclusive: thresholdBand.maxArmourInclusive,
          }
        : {}),
    };
  }
  const criticalQualifies = isCritical && componentImpact >= criticalThreshold;
  const highImpactQualifies = componentImpact >= highImpactThreshold;
  return {
    qualifies: criticalQualifies || highImpactQualifies,
    qualificationId: config.id,
    qualificationConfigChecksum: configChecksum,
    qualificationModel: config.model,
    componentImpact,
    criticalThreshold,
    highImpactThreshold,
    reason: criticalQualifies
      ? "critical_component_impact"
      : highImpactQualifies
        ? "high_component_impact"
        : null,
    ...(thresholdBand
      ? {
          bandId: thresholdBand.id,
          bandMinArmourInclusive: thresholdBand.minArmourInclusive,
          bandMaxArmourInclusive: thresholdBand.maxArmourInclusive,
        }
      : {}),
  };
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

  const weights = ZONE_WEIGHTS[hitZone];
  if (!weights) return null;
  const entryWeights = eligible.map((k) => weights[k] ?? 0);
  const total = entryWeights.reduce((a, b) => a + b, 0);
  if (total <= 0) return eligible[0]!;

  return rng.weightedPick(eligible, entryWeights);
}

export function selectQualifiedComponentForTransition(
  qualification: QualificationResult,
  comps: ComponentStates,
  hitZone: string,
  rng: SeededRandom,
): ComponentKind | null {
  if (!qualification.qualifies) return null;
  return selectComponentForTransition(comps, hitZone, rng);
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
  qualificationOrCritical: QualificationResult | boolean,
  impactOrLegacyDamage: number = 0,
): TransitionResult {
  const qual =
    typeof qualificationOrCritical === "boolean"
      ? checkComponentQualification(qualificationOrCritical, impactOrLegacyDamage)
      : qualificationOrCritical;
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
    if (component === "utility" && comps.utility.reinforcedDriveGuard === "available") {
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
    if (component === "utility" && comps.utility.reinforcedDriveGuard === "available") {
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
