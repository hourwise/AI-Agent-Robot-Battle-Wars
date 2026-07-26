import type { ActionPolicy } from "../simulator/types.js";

export const FALLBACK_POLICY: ActionPolicy = {
  opening: "cautious",
  preferredRange: "medium",
  aggression: 50,
  primaryTarget: "front",
  secondaryTarget: "front",
  retreatThreshold: 30,
  heatThreshold: 75,
  fallback: "defend",
};

export const FALLBACK_POLICY_VERSION = "fallback-v1";
