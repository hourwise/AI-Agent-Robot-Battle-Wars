import { describe, expect, it } from "vitest";
import {
  createGridSeriesCanarySeedPlan,
  GRID_SERIES_CANARY_MAX_BASE_SEED,
} from "../../src/canary/grid-series-canary-seed-plan.js";

const MAX_SAFE = Number.MAX_SAFE_INTEGER;

describe("grid series canary seed plan (Phase 3D2B)", () => {
  it("creates the frozen sequential three-seed plan", () => {
    const plan = createGridSeriesCanarySeedPlan(3);
    expect(plan.baseSeed).toBe(3);
    expect(plan.seeds).toEqual([3, 4, 5]);
  });

  it("accepts zero", () => {
    const plan = createGridSeriesCanarySeedPlan(0);
    expect(plan.seeds).toEqual([0, 1, 2]);
  });

  it("accepts the maximum safe base seed", () => {
    const plan = createGridSeriesCanarySeedPlan(MAX_SAFE - 2);
    expect(plan.seeds).toEqual([MAX_SAFE - 2, MAX_SAFE - 1, MAX_SAFE]);
    expect(plan.seeds[2]).toBe(Number.MAX_SAFE_INTEGER);
  });

  it("rejects a negative base seed", () => {
    expect(() => createGridSeriesCanarySeedPlan(-1)).toThrow(/non-negative/);
  });

  it("rejects a non-integer base seed", () => {
    expect(() => createGridSeriesCanarySeedPlan(1.5)).toThrow(/safe integer/);
    expect(() => createGridSeriesCanarySeedPlan(Number.NaN)).toThrow(/safe integer/);
  });

  it("rejects an unsafe base seed", () => {
    expect(() => createGridSeriesCanarySeedPlan(Number.MAX_SAFE_INTEGER + 1)).toThrow(
      /safe integer/,
    );
    expect(() => createGridSeriesCanarySeedPlan(Number.MAX_VALUE)).toThrow(
      /safe integer/,
    );
  });

  it("rejects an overflowing base seed", () => {
    expect(() => createGridSeriesCanarySeedPlan(MAX_SAFE - 1)).toThrow(/at most/);
    expect(() => createGridSeriesCanarySeedPlan(MAX_SAFE)).toThrow(/at most/);
  });

  it("exports the maximum base seed consistent with three matches", () => {
    expect(GRID_SERIES_CANARY_MAX_BASE_SEED).toBe(MAX_SAFE - 2);
    expect(() =>
      createGridSeriesCanarySeedPlan(GRID_SERIES_CANARY_MAX_BASE_SEED),
    ).not.toThrow();
  });
});

describe("grid series canary seed plan runtime immutability (Phase 3D2B.1)", () => {
  it("returns a frozen plan object", () => {
    const plan = createGridSeriesCanarySeedPlan(3);
    expect(Object.isFrozen(plan)).toBe(true);
  });

  it("returns a frozen seed tuple", () => {
    const plan = createGridSeriesCanarySeedPlan(3);
    expect(Object.isFrozen(plan.seeds)).toBe(true);
  });

  it("attempted mutation cannot alter any seed", () => {
    const plan = createGridSeriesCanarySeedPlan(3);
    const original = [...plan.seeds];
    try {
      // @ts-expect-error – intentional mutation attempt against a frozen tuple
      plan.seeds[0] = 999;
    } catch {
      // strict mode throws on frozen-object assignment; either way the value
      // must remain unchanged.
    }
    try {
      // @ts-expect-error – intentional mutation attempt against a frozen plan
      plan.baseSeed = 999;
    } catch {
      // same as above
    }
    expect([...plan.seeds]).toEqual(original);
    expect(plan.baseSeed).toBe(3);
  });

  it("separate calls return separate frozen values with no shared storage", () => {
    const a = createGridSeriesCanarySeedPlan(3);
    const b = createGridSeriesCanarySeedPlan(3);
    expect(a).not.toBe(b);
    expect(a.seeds).not.toBe(b.seeds);
    expect(Object.isFrozen(a.seeds)).toBe(true);
    expect(Object.isFrozen(b.seeds)).toBe(true);
    expect([...a.seeds]).toEqual([3, 4, 5]);
    expect([...b.seeds]).toEqual([3, 4, 5]);
  });
});
