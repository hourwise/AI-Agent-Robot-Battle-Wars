import type {
  FighterState,
  ArmourState,
  ArenaZone,
  PrimaryTarget,
  SecondaryTarget,
} from "./types.js";
import type { SeededRandom } from "./seeded-random.js";
import {
  DAMAGE_VARIANCE,
  ARMOUR_ABSORPTION_FACTOR,
  MINIMUM_DAMAGE,
  CRITICAL_HIT_THRESHOLD,
  RAM_MOMENTUM_DIVISOR,
  RAM_MAX_MULTIPLIER,
  HAMMER_TOP_DAMAGE_BONUS,
  SPINNER_KNOCKBACK_CHANCE,
  GRAPPLER_BASE_DAMAGE,
  FLIPPER_BASE_CHANCE,
  MAX_OVERTURN_CHANCE,
  OVERTURNED_DEFENCE_PENALTY,
  COMPONENT_DAMAGE_CHANCE,
} from "./constants.js";
import { getEffectiveWeaponDamage } from "./component-state.js";

export interface AttackResult {
  hit: boolean;
  hitZone: keyof ArmourState;
  rawDamage: number;
  effectiveDamage: number;
  isCritical: boolean;
  overturnSuccess: boolean;
  knockback: boolean;
  grappleReposition: boolean;
}

export function calculateAttack(
  attacker: FighterState,
  defender: FighterState,
  hitChance: number,
  movementMomentum: number,
  rng: SeededRandom,
  primaryTarget?: PrimaryTarget,
  secondaryTarget?: SecondaryTarget,
): AttackResult {
  const isOverturned = defender.conditions.includes("overturned");
  const adjustedHitChance = applyOverturnedEvasionPenalty(hitChance, isOverturned);
  const hit = rng.chance(adjustedHitChance);

  if (!hit) {
    return {
      hit: false,
      hitZone: "front",
      rawDamage: 0,
      effectiveDamage: 0,
      isCritical: false,
      overturnSuccess: false,
      knockback: false,
      grappleReposition: false,
    };
  }

  const weaponId = attacker.build.proposal.weaponId;
  const hitZone = determineHitZone(
    attacker,
    defender,
    weaponId,
    rng,
    primaryTarget,
    secondaryTarget,
  );

  const baseDamage =
    weaponId === "grappler" ? GRAPPLER_BASE_DAMAGE : getWeaponBaseDamage(weaponId);

  const effectiveBaseDamage = getEffectiveWeaponDamage(attacker, baseDamage);

  const variance = rng.range(-DAMAGE_VARIANCE, DAMAGE_VARIANCE);
  let rawDamage = effectiveBaseDamage * (1 + variance);

  if (weaponId === "ram" && movementMomentum > 0) {
    const multiplier = Math.min(
      RAM_MAX_MULTIPLIER,
      1 + movementMomentum / RAM_MOMENTUM_DIVISOR,
    );
    rawDamage *= multiplier;
  }

  if (weaponId === "hammer" && (hitZone === "top" || isOverturned)) {
    rawDamage *= 1 + HAMMER_TOP_DAMAGE_BONUS;
  }

  const armourValue = getArmourValue(defender.armour, hitZone);
  const absorbed = armourValue * ARMOUR_ABSORPTION_FACTOR;
  const effectiveDamage = Math.max(MINIMUM_DAMAGE, Math.round(rawDamage - absorbed));

  const isCritical = rng.chance(CRITICAL_HIT_THRESHOLD);
  const overturnSuccess =
    weaponId === "flipper" ? checkOverturn(rng, attacker, defender) : false;
  const knockback =
    weaponId === "horizontal_spinner" && rng.chance(SPINNER_KNOCKBACK_CHANCE);
  const grappleReposition = weaponId === "grappler" && rng.chance(0.5);

  return {
    hit: true,
    hitZone,
    rawDamage: Math.round(rawDamage),
    effectiveDamage,
    isCritical,
    overturnSuccess,
    knockback,
    grappleReposition,
  };
}

export function applyOverturnedEvasionPenalty(
  hitChance: number,
  isOverturned: boolean,
): number {
  if (!isOverturned) return hitChance;
  return Math.min(1, hitChance * (1 + OVERTURNED_DEFENCE_PENALTY));
}

function getWeaponBaseDamage(weaponId: string): number {
  switch (weaponId) {
    case "ram":
      return 20;
    case "hammer":
      return 35;
    case "horizontal_spinner":
      return 50;
    case "grappler":
      return GRAPPLER_BASE_DAMAGE;
    case "flipper":
      return 25;
    default:
      return 10;
  }
}

export function determineHitZone(
  attacker: FighterState,
  defender: FighterState,
  weaponId: string,
  _rng: SeededRandom,
  primaryTarget?: PrimaryTarget,
  secondaryTarget?: SecondaryTarget,
): keyof ArmourState {
  const exposed = getExposedZones(attacker, defender, weaponId);
  const primary: keyof ArmourState =
    primaryTarget ?? (weaponId === "hammer" ? "top" : "front");
  const secondary: keyof ArmourState = secondaryTarget ?? "front";

  if (exposed.includes(primary)) return primary;
  if (exposed.includes(secondary)) return secondary;
  // Per RULESET.md: if neither primary nor secondary is exposed, default to front.
  return "front";
}

export function getExposedZones(
  attacker: FighterState,
  defender: FighterState,
  weaponId: string,
): Array<keyof ArmourState> {
  const facing = defender.facing;
  const zones: Array<keyof ArmourState> = [];

  // Top armour is only exposed to overhead attacks (hammer).
  if (weaponId === "hammer") {
    zones.push("top");
  }

  if (attacker.zone === defender.zone) {
    zones.push("front", "left", "right");
    return zones;
  }

  if (facing === "north" && isNorthOf(attacker.zone, defender.zone)) zones.push("front");
  if (facing === "south" && isSouthOf(attacker.zone, defender.zone)) zones.push("front");
  if (facing === "east" && isEastOf(attacker.zone, defender.zone)) zones.push("front");
  if (facing === "west" && isWestOf(attacker.zone, defender.zone)) zones.push("front");

  const isFlanking =
    (facing === "north" || facing === "south") &&
    (isEastOf(attacker.zone, defender.zone) || isWestOf(attacker.zone, defender.zone));
  const isFlanking2 =
    (facing === "east" || facing === "west") &&
    (isNorthOf(attacker.zone, defender.zone) || isSouthOf(attacker.zone, defender.zone));
  if (isFlanking || isFlanking2) {
    zones.push("left", "right");
  }

  if (facing === "north" && isSouthOf(attacker.zone, defender.zone)) zones.push("rear");
  if (facing === "south" && isNorthOf(attacker.zone, defender.zone)) zones.push("rear");
  if (facing === "east" && isWestOf(attacker.zone, defender.zone)) zones.push("rear");
  if (facing === "west" && isEastOf(attacker.zone, defender.zone)) zones.push("rear");

  return zones;
}

function isNorthOf(attacker: ArenaZone, defender: ArenaZone): boolean {
  if (attacker === "north_edge") return true;
  if (attacker === "center" && defender === "south_edge") return true;
  return false;
}

function isSouthOf(attacker: ArenaZone, defender: ArenaZone): boolean {
  if (attacker === "south_edge") return true;
  if (attacker === "center" && defender === "north_edge") return true;
  return false;
}

function isEastOf(attacker: ArenaZone, defender: ArenaZone): boolean {
  if (attacker === "east_edge") return true;
  if (attacker === "center" && defender === "west_edge") return true;
  return false;
}

function isWestOf(attacker: ArenaZone, defender: ArenaZone): boolean {
  if (attacker === "west_edge") return true;
  if (attacker === "center" && defender === "east_edge") return true;
  return false;
}

function getArmourValue(armour: ArmourState, zone: keyof ArmourState): number {
  return armour[zone];
}

function checkOverturn(
  rng: SeededRandom,
  attacker: FighterState,
  defender: FighterState,
): boolean {
  const attackerPower =
    attacker.build.proposal.chassisId === "heavy"
      ? 9
      : attacker.build.proposal.chassisId === "medium"
        ? 6
        : 3;

  const defenderStability = getStability(defender);
  const roll = rng.next();

  const chance = Math.min(
    MAX_OVERTURN_CHANCE,
    FLIPPER_BASE_CHANCE * (attackerPower / defenderStability),
  );

  return roll < chance;
}

function getStability(state: FighterState): number {
  const chassisStability =
    state.build.proposal.chassisId === "heavy"
      ? 9
      : state.build.proposal.chassisId === "medium"
        ? 6
        : 4;

  const mobilityModifier =
    state.build.proposal.mobilityId === "tracks"
      ? 2
      : state.build.proposal.mobilityId === "legs"
        ? 1
        : 0;

  return chassisStability + mobilityModifier;
}

export function isComponentDamageTriggered(rng: SeededRandom): boolean {
  return rng.chance(COMPONENT_DAMAGE_CHANCE);
}

export function selectDamagedComponent(
  hitZone: keyof ArmourState,
  components: FighterState["components"],
  rng: SeededRandom,
): "mobility" | "weapon" | "utility" | null {
  const weights = getComponentDamageWeights(hitZone);

  const available: Array<"mobility" | "weapon" | "utility"> = [];
  const w: number[] = [];

  if (!components.mobilityDisabled) {
    available.push("mobility");
    w.push(weights.mobility);
  }
  if (!components.weaponDisabled) {
    available.push("weapon");
    w.push(weights.weapon);
  }
  if (!components.utilityDisabled) {
    available.push("utility");
    w.push(weights.utility);
  }

  if (available.length === 0) return null;
  if (w.every((v) => v === 0)) return null;

  return rng.weightedPick(available, w);
}

function getComponentDamageWeights(hitZone: keyof ArmourState) {
  switch (hitZone) {
    case "front":
      return { mobility: 50, weapon: 50, utility: 0 };
    case "rear":
      return { mobility: 70, weapon: 0, utility: 30 };
    case "left":
    case "right":
      return { mobility: 40, weapon: 20, utility: 40 };
    case "top":
      return { mobility: 30, weapon: 30, utility: 40 };
    default:
      return { mobility: 33, weapon: 33, utility: 34 };
  }
}
