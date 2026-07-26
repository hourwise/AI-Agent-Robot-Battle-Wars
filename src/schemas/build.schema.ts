import { z } from "zod";

export const armourDistributionSchema = z.object({
  front: z.number().int().nonnegative(),
  left: z.number().int().nonnegative(),
  right: z.number().int().nonnegative(),
  rear: z.number().int().nonnegative(),
  top: z.number().int().nonnegative(),
});

export type ArmourDistributionInput = z.infer<typeof armourDistributionSchema>;

export const machineBuildProposalSchema = z.object({
  machineName: z.string().min(1).max(60),
  chassisId: z.enum(["light", "medium", "heavy"]),
  mobilityId: z.enum(["wheels", "tracks", "legs"]),
  weaponId: z.enum(["ram", "hammer", "horizontal_spinner", "grappler", "flipper"]),
  utilityId: z.enum(["none", "cooling", "traction_boost", "reinforced_drive"]),
  armour: armourDistributionSchema,
  designSummary: z.string().min(1).max(500),
  designRationale: z.string().min(1).max(500),
});

export type MachineBuildProposalInput = z.infer<typeof machineBuildProposalSchema>;

export function parseBuildProposal(raw: unknown) {
  return machineBuildProposalSchema.safeParse(raw);
}
