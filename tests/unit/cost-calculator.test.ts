import { describe, it, expect } from "vitest";
import { estimateCost, getPricingTier } from "../../src/agents/cost-calculator.js";

describe("cost calculator", () => {
  it("returns pricing tier for known model", () => {
    const tier = getPricingTier("deepseek-v4-flash");
    expect(tier).not.toBeNull();
    expect(tier!.inputPerToken).toBeGreaterThan(0);
    expect(tier!.outputPerToken).toBeGreaterThan(0);
    expect(tier!.cachedInputPerToken).toBeLessThan(tier!.inputPerToken);
  });

  it("returns null for unknown model", () => {
    expect(getPricingTier("unknown-model")).toBeNull();
  });

  it("calculates cost with no cached tokens", () => {
    const result = estimateCost("deepseek-v4-flash", 1000, 0, 500);
    expect(result.costUsd).toBeGreaterThan(0);
    expect(result.isEstimated).toBe(true);
    expect(result.pricingVersion).toBeDefined();
  });

  it("calculates cost with cached tokens", () => {
    const withCache = estimateCost("deepseek-v4-flash", 1000, 200, 500);
    const withoutCache = estimateCost("deepseek-v4-flash", 1000, 0, 500);
    expect(withCache.costUsd).toBeLessThan(withoutCache.costUsd);
  });

  it("returns zero cost for unknown model", () => {
    const result = estimateCost("unknown-model", 1000, 0, 500);
    expect(result.costUsd).toBe(0);
    expect(result.isEstimated).toBe(true);
  });

  it("handles zero tokens", () => {
    const result = estimateCost("deepseek-v4-flash", 0, 0, 0);
    expect(result.costUsd).toBe(0);
  });

  it("marks all costs as estimated", () => {
    const result = estimateCost("deepseek-v4-flash", 100, 0, 100);
    expect(result.isEstimated).toBe(true);
  });
});
