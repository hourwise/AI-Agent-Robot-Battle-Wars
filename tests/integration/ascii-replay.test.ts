import { describe, it, expect } from "vitest";
import { renderAsciiReplay } from "../../src/replay/ascii/ascii-replay-renderer.js";
import { runMatch } from "../../src/simulator/simulator.js";
import {
  createBulwarkBuild,
  BULWARK_POLICY,
} from "../../src/agents/scripted/bulwark-agent.js";
import { CATALOGUE_V1 } from "../../src/catalogue/catalogue.v1.js";
import { validateBuild } from "../../src/validation/build-validator.js";
import type { MatchResult } from "../../src/simulator/types.js";

function makeTestMatch(seed: number): MatchResult {
  const buildResult = validateBuild(
    {
      machineName: "Iron Cicada",
      chassisId: "light",
      mobilityId: "wheels",
      weaponId: "grappler",
      utilityId: "none",
      armour: { front: 5, left: 5, right: 5, rear: 5, top: 5 },
      designSummary: "A fast flanker.",
      designRationale: "Circle and attack the rear.",
    },
    CATALOGUE_V1,
  );

  if (!buildResult.ok) throw new Error("Invalid test build");

  return runMatch({
    seed,
    fighterA: {
      build: buildResult.build,
      policy: {
        opening: "flank",
        preferredRange: "close",
        aggression: 70,
        primaryTarget: "rear",
        secondaryTarget: "left",
        retreatThreshold: 20,
        heatThreshold: 80,
        fallback: "retreat",
      },
    },
    fighterB: { build: createBulwarkBuild(), policy: BULWARK_POLICY },
    rulesetVersion: "1",
    catalogueVersion: "1",
  });
}

describe("ASCII replay integration", () => {
  it("renders a complete match without crash", () => {
    const match = makeTestMatch(42);
    const output = renderAsciiReplay(match);
    expect(output.length).toBeGreaterThan(0);
    expect(output).toContain("FORGE ARENA");
    expect(output).toContain("FIGHTER PROFILES");
    expect(output).toContain("OPENING POSITIONS");
    expect(output).toContain("MATCH RESULT");
  });

  it("produces deterministic output", () => {
    const match = makeTestMatch(42);
    const output1 = renderAsciiReplay(match);
    const output2 = renderAsciiReplay(match);
    expect(output1).toBe(output2);
  });

  it("does not modify the original match result", () => {
    const match = makeTestMatch(42);
    const originalEvents = [...match.events];
    const originalResult = { ...match.result };
    renderAsciiReplay(match);
    expect(match.events).toEqual(originalEvents);
    expect(match.result).toEqual(originalResult);
  });

  it("renders within 80 column width", () => {
    const match = makeTestMatch(42);
    const output = renderAsciiReplay(match);
    const lines = output.split("\n");
    for (const line of lines) {
      expect(line.length).toBeLessThanOrEqual(80);
    }
  });

  it("includes fighter names", () => {
    const match = makeTestMatch(42);
    const output = renderAsciiReplay(match);
    expect(output).toContain("IRON CICADA");
    expect(output).toContain("THE BULWARK");
  });

  it("includes seed", () => {
    const match = makeTestMatch(42);
    const output = renderAsciiReplay(match);
    expect(output).toContain("Seed: 42");
  });

  it("renders different matches differently", () => {
    const match1 = makeTestMatch(42);
    const match2 = makeTestMatch(100);
    const output1 = renderAsciiReplay(match1);
    const output2 = renderAsciiReplay(match2);
    expect(output1).not.toBe(output2);
  });

  it("limits combat highlights", () => {
    const match = makeTestMatch(42);
    const output = renderAsciiReplay(match, { mode: "ascii", maxHighlights: 3 });
    const roundHeaders = output.match(/ROUND \d+ —/g) ?? [];
    expect(roundHeaders.length).toBeLessThanOrEqual(4);
  });
});
