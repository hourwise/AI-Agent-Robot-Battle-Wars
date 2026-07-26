import { describe, it, expect } from "vitest";
import {
  FALLBACK_POLICY,
  FALLBACK_POLICY_VERSION,
} from "../../src/agents/fallback-policy.js";
import { actionPolicySchema } from "../../src/schemas/policy.schema.js";

describe("fallback policy", () => {
  it("passes the canonical policy schema", () => {
    const result = actionPolicySchema.safeParse(FALLBACK_POLICY);
    expect(result.success).toBe(true);
  });

  it("has reasonable defaults", () => {
    expect(FALLBACK_POLICY.opening).toBe("cautious");
    expect(FALLBACK_POLICY.preferredRange).toBe("medium");
    expect(FALLBACK_POLICY.aggression).toBe(50);
    expect(FALLBACK_POLICY.retreatThreshold).toBe(30);
    expect(FALLBACK_POLICY.heatThreshold).toBe(75);
    expect(FALLBACK_POLICY.fallback).toBe("defend");
  });

  it("has a version string", () => {
    expect(FALLBACK_POLICY_VERSION).toBe("fallback-v1");
  });
});
