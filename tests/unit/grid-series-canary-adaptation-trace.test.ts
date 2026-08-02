import { describe, expect, it } from "vitest";
import {
  GridSeriesCanaryAdaptationTraceV1Schema,
  deserializeGridSeriesCanaryAdaptationTrace,
  serializeGridSeriesCanaryAdaptationTrace,
} from "../../src/schemas/grid-series-canary-adaptation-trace.schema.js";
import { executeGridSeriesCanary } from "../../src/canary/grid-series-canary-core.js";

const IDS = [
  "11111111-1111-4111-8111-111111111111",
  "22222222-2222-4222-8222-222222222222",
  "33333333-3333-4333-8333-333333333333",
];
const SERIES_ID = "44444444-4444-4444-8444-444444444444";

function runTrace() {
  const outcome = executeGridSeriesCanary({
    baseSeed: 5,
    seriesId: SERIES_ID,
    matchIdentities: IDS.map((matchId) => ({
      matchId,
      createdAt: "2024-06-01T00:00:00.000Z",
    })),
  });
  return structuredClone(outcome.adaptationTrace);
}

function parse(trace: unknown) {
  const result = GridSeriesCanaryAdaptationTraceV1Schema.safeParse(trace);
  return result.success ? result.data : result.error;
}

describe("grid series canary adaptation trace schema v1 (Phase 3D2B)", () => {
  it("accepts a trace produced by the real core", () => {
    const trace = runTrace();
    const parsed = parse(trace);
    expect(parsed).not.toHaveProperty("issues");
    expect(parsed).toBeDefined();
  });

  it("round trips through serialization", () => {
    const trace = runTrace();
    const json = serializeGridSeriesCanaryAdaptationTrace(trace);
    const parsed = deserializeGridSeriesCanaryAdaptationTrace(json);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.trace.seriesId).toBe(SERIES_ID);
      expect(parsed.trace.baseSeed).toBe(5);
    }
  });

  it("requires transition 1 to source match 1 and transition 2 match 2", () => {
    const trace = runTrace();
    trace.transitions[0].sourceMatchNumber = 2;
    expect(parse(trace)).toHaveProperty("issues");
    const trace2 = runTrace();
    trace2.transitions[1].sourceMatchNumber = 1;
    expect(parse(trace2)).toHaveProperty("issues");
  });

  it("requires a real policy change", () => {
    const trace = runTrace();
    trace.transitions[0].policyAfter = { ...trace.transitions[0].policyBefore };
    expect(parse(trace)).toHaveProperty("issues");
  });

  it("rejects an aggression that violates the frozen rule", () => {
    const trace = runTrace();
    trace.transitions[0].policyAfter.aggression = 55;
    trace.transitions[0].decision.aggressionAfter = 55;
    expect(parse(trace)).toHaveProperty("issues");
  });

  it("rejects an opening that violates the frozen rule", () => {
    const trace = runTrace();
    trace.transitions[0].policyAfter.opening = "hold";
    expect(parse(trace)).toHaveProperty("issues");
  });

  it("rejects a modified untouched field", () => {
    const trace = runTrace();
    trace.transitions[0].policyAfter.retreatThreshold = 99;
    expect(parse(trace)).toHaveProperty("issues");
  });

  it("rejects a decision that disagrees with the policy", () => {
    const trace = runTrace();
    trace.transitions[0].decision.aggressionBefore = 1;
    expect(parse(trace)).toHaveProperty("issues");
  });

  it("rejects a wrong series id or base seed shape", () => {
    const trace = runTrace();
    trace.seriesId = "not-a-uuid";
    expect(parse(trace)).toHaveProperty("issues");
    const trace2 = runTrace();
    trace2.baseSeed = -1;
    expect(parse(trace2)).toHaveProperty("issues");
  });
});
