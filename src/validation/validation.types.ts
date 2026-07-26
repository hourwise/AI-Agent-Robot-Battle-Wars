import type {
  ChassisId,
  MobilityId,
  WeaponId,
  UtilityId,
  ArmourDistribution,
} from "../catalogue/catalogue.types.js";

export interface ValidationError {
  readonly field: string;
  readonly message: string;
  readonly constraint?: string;
}

export type BuildValidationResult =
  | { readonly ok: true; readonly build: ValidatedBuild }
  | { readonly ok: false; readonly errors: ReadonlyArray<ValidationError> };

export interface MachineBuildProposal {
  readonly machineName: string;
  readonly chassisId: ChassisId;
  readonly mobilityId: MobilityId;
  readonly weaponId: WeaponId;
  readonly utilityId: UtilityId;
  readonly armour: ArmourDistribution;
  readonly designSummary: string;
  readonly designRationale: string;
}

export interface CostBreakdown {
  readonly chassisCost: number;
  readonly mobilityCost: number;
  readonly weaponCost: number;
  readonly utilityCost: number;
  readonly armourCost: number;
  readonly totalCost: number;
  readonly withinBudget: boolean;
}

export interface ValidatedBuild {
  readonly proposal: MachineBuildProposal;
  readonly totalCost: number;
  readonly armourCost: number;
  readonly totalArmourPoints: number;
  readonly catalogueVersion: string;
}
