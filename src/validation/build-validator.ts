import type { Catalogue, ArmourDistribution } from "../catalogue/catalogue.types.js";
import type {
  MachineBuildProposal,
  CostBreakdown,
  ValidatedBuild,
  BuildValidationResult,
  ValidationError,
} from "./validation.types.js";

export function calculateCost(
  proposal: MachineBuildProposal,
  catalogue: Catalogue,
): CostBreakdown {
  const chassisSpec = catalogue.chassis.find((c) => c.id === proposal.chassisId);
  const mobilitySpec = catalogue.mobility.find((m) => m.id === proposal.mobilityId);
  const weaponSpec = catalogue.weapons.find((w) => w.id === proposal.weaponId);
  const utilitySpec = catalogue.utilities.find((u) => u.id === proposal.utilityId);

  const chassisCost = chassisSpec?.cost ?? 0;
  const mobilityCost = mobilitySpec?.cost ?? 0;
  const weaponCost = weaponSpec?.cost ?? 0;
  const utilityCost = utilitySpec?.cost ?? 0;

  const totalArmourPoints = sumArmour(proposal.armour);
  const armourCost =
    Math.ceil(totalArmourPoints / 10) * catalogue.armour.costPerTenPoints;

  const totalCost = chassisCost + mobilityCost + weaponCost + utilityCost + armourCost;

  return {
    chassisCost,
    mobilityCost,
    weaponCost,
    utilityCost,
    armourCost,
    totalCost,
    withinBudget: totalCost <= catalogue.budget,
  };
}

export function sumArmour(armour: ArmourDistribution): number {
  return armour.front + armour.left + armour.right + armour.rear + armour.top;
}

export function validateBuild(
  proposal: MachineBuildProposal,
  catalogue: Catalogue,
): BuildValidationResult {
  const errors: ValidationError[] = [];

  const chassisSpec = catalogue.chassis.find((c) => c.id === proposal.chassisId);
  if (!chassisSpec) {
    errors.push({
      field: "chassisId",
      message: `Unknown chassis: ${proposal.chassisId}`,
      constraint: `Must be one of: ${catalogue.chassis.map((c) => c.id).join(", ")}`,
    });
  }

  const mobilitySpec = catalogue.mobility.find((m) => m.id === proposal.mobilityId);
  if (!mobilitySpec) {
    errors.push({
      field: "mobilityId",
      message: `Unknown mobility: ${proposal.mobilityId}`,
      constraint: `Must be one of: ${catalogue.mobility.map((m) => m.id).join(", ")}`,
    });
  }

  const weaponSpec = catalogue.weapons.find((w) => w.id === proposal.weaponId);
  if (!weaponSpec) {
    errors.push({
      field: "weaponId",
      message: `Unknown weapon: ${proposal.weaponId}`,
      constraint: `Must be one of: ${catalogue.weapons.map((w) => w.id).join(", ")}`,
    });
  }

  const utilitySpec = catalogue.utilities.find((u) => u.id === proposal.utilityId);
  if (!utilitySpec) {
    errors.push({
      field: "utilityId",
      message: `Unknown utility: ${proposal.utilityId}`,
      constraint: `Must be one of: ${catalogue.utilities.map((u) => u.id).join(", ")}`,
    });
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  const armour = proposal.armour;
  const zones: Array<[string, number]> = [
    ["armour.front", armour.front],
    ["armour.left", armour.left],
    ["armour.right", armour.right],
    ["armour.rear", armour.rear],
    ["armour.top", armour.top],
  ];

  for (const [field, value] of zones) {
    if (value > catalogue.armour.maxPerZone) {
      errors.push({
        field,
        message: `Armour value ${value} exceeds maximum ${catalogue.armour.maxPerZone}`,
        constraint: `Maximum per zone: ${catalogue.armour.maxPerZone}`,
      });
    }
  }

  const totalArmour = sumArmour(armour);
  if (totalArmour > catalogue.armour.maxTotal) {
    errors.push({
      field: "armour",
      message: `Total armour ${totalArmour} exceeds maximum ${catalogue.armour.maxTotal}`,
      constraint: `Total armour must be at most ${catalogue.armour.maxTotal}`,
    });
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  const breakdown = calculateCost(proposal, catalogue);

  if (!breakdown.withinBudget) {
    errors.push({
      field: "budget",
      message: `Build costs ${breakdown.totalCost} but budget is ${catalogue.budget}`,
      constraint: `Total cost must be at most ${catalogue.budget}`,
    });
    return { ok: false, errors };
  }

  const build: ValidatedBuild = {
    proposal,
    totalCost: breakdown.totalCost,
    armourCost: breakdown.armourCost,
    totalArmourPoints: totalArmour,
    catalogueVersion: catalogue.version,
  };

  return { ok: true, build };
}
