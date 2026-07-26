import { describe, it, expect } from "vitest";
import { renderTextReplay } from "../../src/replay/text-replay-renderer.js";
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

describe("renderTextReplay", () => {
  it("renders a complete replay", () => {
    const match = makeTestMatch(42);
    const replay = renderTextReplay(match);
    expect(replay).toContain("IRON CICADA");
    expect(replay).toContain("THE BULWARK");
    expect(replay).toContain("Seed: 42");
    expect(replay).toContain("MATCH COMPLETE");
  });

  it("includes round headings", () => {
    const match = makeTestMatch(42);
    const replay = renderTextReplay(match);
    expect(replay).toContain("Round 1");
  });

  it("includes attack descriptions", () => {
    const match = makeTestMatch(42);
    const replay = renderTextReplay(match);
    expect(replay).toContain("attacks");
  });

  it("includes result", () => {
    const match = makeTestMatch(42);
    const replay = renderTextReplay(match);
    expect(replay).toContain("wins by");
  });

  it("produces deterministic output", () => {
    const match = makeTestMatch(42);
    const replay1 = renderTextReplay(match);
    const replay2 = renderTextReplay(match);
    expect(replay1).toBe(replay2);
  });

  it("does not modify the original match result", () => {
    const match = makeTestMatch(42);
    const originalEvents = [...match.events];
    renderTextReplay(match);
    expect(match.events).toEqual(originalEvents);
  });
});
