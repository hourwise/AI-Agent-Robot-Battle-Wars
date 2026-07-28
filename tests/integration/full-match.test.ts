import { describe, it, expect } from "vitest";
import { runMatch } from "../../src/simulator/simulator.js";
import { CATALOGUE_V1 } from "../../src/catalogue/catalogue.v1.js";
import {
  createBulwarkBuild,
  BULWARK_POLICY,
} from "../../src/agents/scripted/bulwark-agent.js";
import { matchResultToRecord } from "../../src/persistence/match-converter.js";
import { renderTextReplay } from "../../src/replay/text-replay-renderer.js";

describe("full match (Bulwark vs Bulwark)", () => {
  const build = createBulwarkBuild();

  it("completes a match with deterministic results", () => {
    const result = runMatch({
      seed: 42,
      fighterA: { build, policy: BULWARK_POLICY },
      fighterB: { build, policy: BULWARK_POLICY },
      rulesetVersion: "0.1.0",
      catalogueVersion: CATALOGUE_V1.version,
    });

    expect(result.events.length).toBeGreaterThan(0);
    expect(result.rounds).toBeGreaterThanOrEqual(1);
    expect(result.rounds).toBeLessThanOrEqual(20);
    expect(result.result.method).toBeDefined();
  });

  it("produces identical results for the same seed", () => {
    const result1 = runMatch({
      seed: 123,
      fighterA: { build, policy: BULWARK_POLICY },
      fighterB: { build, policy: BULWARK_POLICY },
      rulesetVersion: "0.1.0",
      catalogueVersion: CATALOGUE_V1.version,
    });

    const result2 = runMatch({
      seed: 123,
      fighterA: { build, policy: BULWARK_POLICY },
      fighterB: { build, policy: BULWARK_POLICY },
      rulesetVersion: "0.1.0",
      catalogueVersion: CATALOGUE_V1.version,
    });

    expect(result1.events.length).toBe(result2.events.length);
    expect(result1.result).toEqual(result2.result);
    expect(result1.rounds).toBe(result2.rounds);
  });

  it("produces different results for different seeds", () => {
    const result1 = runMatch({
      seed: 1,
      fighterA: { build, policy: BULWARK_POLICY },
      fighterB: { build, policy: BULWARK_POLICY },
      rulesetVersion: "0.1.0",
      catalogueVersion: CATALOGUE_V1.version,
    });

    const result2 = runMatch({
      seed: 99999,
      fighterA: { build, policy: BULWARK_POLICY },
      fighterB: { build, policy: BULWARK_POLICY },
      rulesetVersion: "0.1.0",
      catalogueVersion: CATALOGUE_V1.version,
    });

    // Different seeds should produce at least one observable difference
    const sameWinner = result1.result.winner === result2.result.winner;
    const sameRounds = result1.rounds === result2.rounds;
    const sameMethod = result1.result.method === result2.result.method;
    const allSame = sameWinner && sameRounds && sameMethod;
    expect(allSame).toBe(false);
  });

  it("converts to a valid match record", () => {
    const result = runMatch({
      seed: 42,
      fighterA: { build, policy: BULWARK_POLICY },
      fighterB: { build, policy: BULWARK_POLICY },
      rulesetVersion: "0.1.0",
      catalogueVersion: CATALOGUE_V1.version,
    });

    const record = matchResultToRecord(result);

    expect(record.schemaVersion).toBe("1");
    expect(record.matchId).toBeDefined();
    expect(record.seed).toBe(42);
    expect(record.events).toEqual(result.events);
    expect(record.result).toEqual(result.result);
    expect(record.config.fighterA.build).toEqual(build);
    expect(record.config.fighterA.policy).toEqual(BULWARK_POLICY);
  });

  it("renders a text replay without errors", () => {
    const result = runMatch({
      seed: 42,
      fighterA: { build, policy: BULWARK_POLICY },
      fighterB: { build, policy: BULWARK_POLICY },
      rulesetVersion: "0.1.0",
      catalogueVersion: CATALOGUE_V1.version,
    });

    const replay = renderTextReplay(result);

    expect(replay).toContain("THE BULWARK");
    expect(replay).toContain("MATCH COMPLETE");
    expect(replay).toContain("Seed: 42");
  });
});
