import type { ValidatedBuild } from "../../validation/validation.types.js";
import type { ActionPolicy } from "../../simulator/types.js";
import { CATALOGUE_V1 } from "../../catalogue/catalogue.v1.js";
import { validateBuild } from "../../validation/build-validator.js";

export const BULWARK_BUILD_PROPOSAL = {
  machineName: "The Bulwark",
  chassisId: "heavy" as const,
  mobilityId: "tracks" as const,
  weaponId: "ram" as const,
  utilityId: "reinforced_drive" as const,
  armour: {
    front: 60,
    left: 15,
    right: 15,
    rear: 0,
    top: 0,
  },
  designSummary: "An unstoppable forward assault machine with heavy frontal armour.",
  designRationale:
    "Maximise frontal protection and close-range ram damage. Accept rear vulnerability.",
};

export const BULWARK_POLICY: ActionPolicy = {
  opening: "rush",
  preferredRange: "close",
  aggression: 85,
  primaryTarget: "front",
  secondaryTarget: "front",
  retreatThreshold: 10,
  heatThreshold: 90,
  fallback: "desperate_attack",
};

export function createBulwarkBuild(): ValidatedBuild {
  const result = validateBuild(BULWARK_BUILD_PROPOSAL, CATALOGUE_V1);
  if (!result.ok) {
    throw new Error(
      `Bulwark build is invalid: ${result.errors.map((e) => e.message).join(", ")}`,
    );
  }
  return result.build;
}
