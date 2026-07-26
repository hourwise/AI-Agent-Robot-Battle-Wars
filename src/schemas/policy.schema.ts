import { z } from "zod";

export const actionPolicySchema = z.object({
  opening: z.enum(["rush", "cautious", "flank", "hold"]),
  preferredRange: z.enum(["close", "medium", "far"]),
  aggression: z.number().int().min(0).max(100),
  primaryTarget: z.enum(["front", "rear", "left", "right", "top"]),
  secondaryTarget: z.enum(["front", "rear", "left", "right", "top"]),
  retreatThreshold: z.number().int().min(0).max(100),
  heatThreshold: z.number().int().min(0).max(100),
  fallback: z.enum(["retreat", "defend", "desperate_attack"]),
});

export type ActionPolicyInput = z.infer<typeof actionPolicySchema>;

export function parseActionPolicy(raw: unknown) {
  return actionPolicySchema.safeParse(raw);
}
