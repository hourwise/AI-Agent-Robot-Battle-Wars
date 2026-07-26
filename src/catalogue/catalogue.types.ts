export type ChassisId = "light" | "medium" | "heavy";

export type MobilityId = "wheels" | "tracks" | "legs";

export type WeaponId = "ram" | "hammer" | "horizontal_spinner" | "grappler" | "flipper";

export type UtilityId = "none" | "cooling" | "traction_boost" | "reinforced_drive";

export type ArmourZone = "front" | "left" | "right" | "rear" | "top";

export interface ArmourDistribution {
  readonly front: number;
  readonly left: number;
  readonly right: number;
  readonly rear: number;
  readonly top: number;
}

export interface ChassisSpec {
  readonly id: ChassisId;
  readonly name: string;
  readonly cost: number;
  readonly integrity: number;
  readonly baseMass: number;
  readonly agility: number;
  readonly stability: number;
}

export interface MobilitySpec {
  readonly id: MobilityId;
  readonly name: string;
  readonly cost: number;
  readonly speed: number;
  readonly traction: number;
  readonly turning: number;
  readonly stabilityModifier: number;
}

export interface WeaponSpec {
  readonly id: WeaponId;
  readonly name: string;
  readonly cost: number;
  readonly baseDamage: number;
  readonly accuracy: number;
  readonly cooldown: number;
  readonly trait: string;
}

export interface UtilitySpec {
  readonly id: UtilityId;
  readonly name: string;
  readonly cost: number;
  readonly effect: string;
}

export interface ArmourRules {
  readonly costPerTenPoints: number;
  readonly maxPerZone: number;
  readonly maxTotal: number;
}

export interface Catalogue {
  readonly version: string;
  readonly budget: number;
  readonly chassis: ReadonlyArray<ChassisSpec>;
  readonly mobility: ReadonlyArray<MobilitySpec>;
  readonly weapons: ReadonlyArray<WeaponSpec>;
  readonly utilities: ReadonlyArray<UtilitySpec>;
  readonly armour: ArmourRules;
}
