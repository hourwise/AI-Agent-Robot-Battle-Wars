import { describe, it, expect } from "vitest";
import {
  renderTextReplay,
  describeEvent,
} from "../../src/replay/text-replay-renderer.js";
import { runMatch } from "../../src/simulator/simulator.js";
import {
  createBulwarkBuild,
  BULWARK_POLICY,
} from "../../src/agents/scripted/bulwark-agent.js";
import { CATALOGUE_V1 } from "../../src/catalogue/catalogue.v1.js";
import { validateBuild } from "../../src/validation/build-validator.js";
import type { MatchResult, SimulationEvent } from "../../src/simulator/types.js";

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

// --- Narration tests for movement, turning, and knockback ---

function makeMinimalResult(
  machineNameA = "The Bulwark",
  machineNameB = "The Bulwark",
): MatchResult {
  const buildResult = validateBuild(
    {
      machineName: machineNameA,
      chassisId: "heavy",
      mobilityId: "tracks",
      weaponId: "ram",
      utilityId: "reinforced_drive",
      armour: { front: 60, left: 15, right: 15, rear: 0, top: 0 },
      designSummary: "test",
      designRationale: "test",
    },
    CATALOGUE_V1,
  );
  if (!buildResult.ok) throw new Error("Invalid test build");

  const buildB =
    machineNameA === machineNameB
      ? buildResult.build
      : (() => {
          const r = validateBuild(
            { ...buildResult.build.proposal, machineName: machineNameB },
            CATALOGUE_V1,
          );
          if (!r.ok) throw new Error("Invalid test build B");
          return r.build;
        })();

  return {
    config: {
      seed: 12345,
      fighterA: { build: buildResult.build, policy: BULWARK_POLICY },
      fighterB: { build: buildB, policy: BULWARK_POLICY },
      rulesetVersion: "1",
      catalogueVersion: "1",
    },
    initialState: {
      fighterA: {
        fighterId: "fighter_a",
        build: buildResult.build,
        integrity: 150,
        maxIntegrity: 150,
        energy: 100,
        heat: 0,
        zone: "south_edge",
        facing: "north",
        weaponCooldown: 0,
        utilityCooldown: 0,
        armour: { front: 60, left: 15, right: 15, rear: 0, top: 0 },
        components: {
          mobilityDisabled: false,
          weaponDisabled: false,
          utilityDisabled: false,
        },
        conditions: [],
      },
      fighterB: {
        fighterId: "fighter_b",
        build: buildB,
        integrity: 150,
        maxIntegrity: 150,
        energy: 100,
        heat: 0,
        zone: "north_edge",
        facing: "south",
        weaponCooldown: 0,
        utilityCooldown: 0,
        armour: { front: 60, left: 15, right: 15, rear: 0, top: 0 },
        components: {
          mobilityDisabled: false,
          weaponDisabled: false,
          utilityDisabled: false,
        },
        conditions: [],
      },
    },
    events: [],
    result: { winner: null, loser: null, method: "draw" },
    rounds: 1,
  };
}

function ev(overrides: Partial<SimulationEvent>): SimulationEvent {
  return {
    schemaVersion: "1",
    sequence: 0,
    round: 1,
    timestampMs: 0,
    type: "movement_resolved",
    data: {},
    ...overrides,
  };
}

describe("movement narration", () => {
  it("narrates edge-to-centre movement", () => {
    const result = makeMinimalResult();
    const event = ev({
      type: "movement_resolved",
      actorId: "fighter_a",
      data: { from: "south_edge", to: "center", facing: "north", action: "advance" },
    });
    const text = describeEvent(event, result);
    expect(text).toContain("moves to Center");
  });

  it("narrates facing-only turn in centre", () => {
    const result = makeMinimalResult();
    const event = ev({
      type: "movement_resolved",
      actorId: "fighter_a",
      data: { from: "center", to: "center", facing: "east", action: "circle_right" },
    });
    const text = describeEvent(event, result);
    expect(text).toContain("turns while holding Center");
    expect(text).not.toContain("moves to");
  });

  it("distinguishes duplicate-named fighters in turn narration", () => {
    const result = makeMinimalResult("The Bulwark", "The Bulwark");
    const event = ev({
      type: "movement_resolved",
      actorId: "fighter_b",
      data: { from: "center", to: "center", facing: "west", action: "circle_left" },
    });
    const text = describeEvent(event, result);
    expect(text).toContain("The Bulwark [B]");
    expect(text).toContain("turns while holding Center");
  });

  it("narrates knockback with attacker and defender names", () => {
    const result = makeMinimalResult("Iron Cicada", "The Bulwark");
    const event = ev({
      type: "movement_resolved",
      actorId: "fighter_a",
      targetId: "fighter_b",
      data: { from: "center", to: "south_edge", facing: "south", action: "knockback" },
    });
    const text = describeEvent(event, result);
    expect(text).toContain("Iron Cicada");
    expect(text).toContain("The Bulwark");
    expect(text).toContain("knocks");
    expect(text).toContain("South Edge");
  });

  it("narrates knockback with duplicate names using [A] and [B]", () => {
    const result = makeMinimalResult("The Bulwark", "The Bulwark");
    const event = ev({
      type: "movement_resolved",
      actorId: "fighter_a",
      targetId: "fighter_b",
      data: { from: "center", to: "north_edge", facing: "north", action: "knockback" },
    });
    const text = describeEvent(event, result);
    expect(text).toContain("The Bulwark [A]");
    expect(text).toContain("The Bulwark [B]");
  });
});
