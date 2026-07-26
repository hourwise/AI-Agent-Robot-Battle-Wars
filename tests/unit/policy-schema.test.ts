import { describe, it, expect } from "vitest";
import {
  actionPolicySchema,
  parseActionPolicy,
} from "../../src/schemas/policy.schema.js";
import type { ActionPolicy } from "../../src/simulator/types.js";

const VALID_POLICY: ActionPolicy = {
  opening: "flank",
  preferredRange: "close",
  aggression: 70,
  primaryTarget: "rear",
  secondaryTarget: "left",
  retreatThreshold: 30,
  heatThreshold: 80,
  fallback: "retreat",
};

describe("actionPolicySchema", () => {
  it("accepts a valid policy", () => {
    const result = actionPolicySchema.safeParse(VALID_POLICY);
    expect(result.success).toBe(true);
  });

  it("rejects invalid opening", () => {
    const result = actionPolicySchema.safeParse({
      ...VALID_POLICY,
      opening: "sprint",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid preferredRange", () => {
    const result = actionPolicySchema.safeParse({
      ...VALID_POLICY,
      preferredRange: "extreme",
    });
    expect(result.success).toBe(false);
  });

  it("rejects aggression out of range", () => {
    const result = actionPolicySchema.safeParse({
      ...VALID_POLICY,
      aggression: 150,
    });
    expect(result.success).toBe(false);
  });

  it("rejects negative aggression", () => {
    const result = actionPolicySchema.safeParse({
      ...VALID_POLICY,
      aggression: -10,
    });
    expect(result.success).toBe(false);
  });

  it("rejects non-integer aggression", () => {
    const result = actionPolicySchema.safeParse({
      ...VALID_POLICY,
      aggression: 50.5,
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid primaryTarget", () => {
    const result = actionPolicySchema.safeParse({
      ...VALID_POLICY,
      primaryTarget: "belly",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid fallback", () => {
    const result = actionPolicySchema.safeParse({
      ...VALID_POLICY,
      fallback: "flee",
    });
    expect(result.success).toBe(false);
  });

  it("rejects retreatThreshold out of range", () => {
    const result = actionPolicySchema.safeParse({
      ...VALID_POLICY,
      retreatThreshold: 200,
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing fields", () => {
    const result = actionPolicySchema.safeParse({
      opening: "rush",
    });
    expect(result.success).toBe(false);
  });

  it("accepts boundary values", () => {
    const result = actionPolicySchema.safeParse({
      opening: "hold",
      preferredRange: "far",
      aggression: 0,
      primaryTarget: "top",
      secondaryTarget: "top",
      retreatThreshold: 100,
      heatThreshold: 0,
      fallback: "desperate_attack",
    });
    expect(result.success).toBe(true);
  });
});

describe("parseActionPolicy", () => {
  it("returns success for valid input", () => {
    const result = parseActionPolicy(VALID_POLICY);
    expect(result.success).toBe(true);
  });

  it("returns error for invalid input", () => {
    const result = parseActionPolicy({ opening: "invalid" });
    expect(result.success).toBe(false);
  });
});
