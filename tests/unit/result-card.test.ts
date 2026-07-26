import { describe, it, expect } from "vitest";
import { renderResultCard } from "../../src/replay/ascii/result-card-renderer.js";
import type { CompetitionState } from "../../src/replay/ascii/ascii.types.js";
import type { CompetitionResult, SimulationEvent } from "../../src/simulator/types.js";

function makeState(): CompetitionState {
  return {
    fighterA: {
      fighterId: "fighter_a",
      build: {
        proposal: {
          machineName: "Iron Cicada",
          chassisId: "medium",
          mobilityId: "wheels",
          weaponId: "ram",
          utilityId: "none",
          armour: { front: 10, left: 5, right: 5, rear: 0, top: 0 },
          designSummary: "test",
          designRationale: "test",
        },
        totalCost: 52,
        armourCost: 2,
        totalArmourPoints: 20,
        catalogueVersion: "1",
      },
      integrity: 100,
      maxIntegrity: 100,
      energy: 100,
      heat: 0,
      zone: "center",
      facing: "north",
      conditions: [],
      components: {
        mobilityDisabled: false,
        weaponDisabled: false,
        utilityDisabled: false,
      },
      armour: { front: 10, left: 5, right: 5, rear: 0, top: 0 },
    },
    fighterB: {
      fighterId: "fighter_b",
      build: {
        proposal: {
          machineName: "The Bulwark",
          chassisId: "heavy",
          mobilityId: "tracks",
          weaponId: "hammer",
          utilityId: "cooling",
          armour: { front: 40, left: 10, right: 10, rear: 0, top: 0 },
          designSummary: "test",
          designRationale: "test",
        },
        totalCost: 95,
        armourCost: 6,
        totalArmourPoints: 60,
        catalogueVersion: "1",
      },
      integrity: 0,
      maxIntegrity: 150,
      energy: 50,
      heat: 30,
      zone: "south_edge",
      facing: "north",
      conditions: [],
      components: {
        mobilityDisabled: true,
        weaponDisabled: false,
        utilityDisabled: false,
      },
      armour: { front: 40, left: 10, right: 10, rear: 0, top: 0 },
    },
  };
}

describe("renderResultCard", () => {
  it("renders knockout victory", () => {
    const state = makeState();
    const result: CompetitionResult = {
      winner: "fighter_a",
      loser: "fighter_b",
      method: "destruction",
    };
    const events: SimulationEvent[] = [
      {
        schemaVersion: "1",
        sequence: 10,
        round: 5,
        timestampMs: 5000,
        type: "integrity_damaged",
        actorId: "fighter_a",
        targetId: "fighter_b",
        data: { damage: 50, remaining: 0 },
      },
    ];

    const card = renderResultCard(result, state, events, 5, 42);
    expect(card).toContain("MATCH RESULT");
    expect(card).toContain("WINNER: IRON CICADA");
    expect(card).toContain("Defeated: THE BULWARK");
    expect(card).toContain("Method: Integrity Defeat");
    expect(card).toContain("Round: 5");
    expect(card).toContain("Seed: 42");
  });

  it("renders immobilisation victory", () => {
    const state = makeState();
    const result: CompetitionResult = {
      winner: "fighter_a",
      loser: "fighter_b",
      method: "immobilisation",
    };
    const events: SimulationEvent[] = [
      {
        schemaVersion: "1",
        sequence: 10,
        round: 7,
        timestampMs: 7000,
        type: "component_disabled",
        actorId: "fighter_a",
        targetId: "fighter_b",
        data: { component: "mobility" },
      },
    ];

    const card = renderResultCard(result, state, events, 7, 100);
    expect(card).toContain("Method: Immobilisation");
    expect(card).toContain("Decisive event: The Bulwark's mobility disabled");
  });

  it("renders draw", () => {
    const state = makeState();
    const result: CompetitionResult = {
      winner: null,
      loser: null,
      method: "draw",
    };

    const card = renderResultCard(result, state, [], 20, 100);
    expect(card).toContain("DRAW");
    expect(card).toContain("Rounds: 20");
  });

  it("renders judges' decision with scores", () => {
    const state = makeState();
    const result: CompetitionResult = {
      winner: "fighter_a",
      loser: "fighter_b",
      method: "judges",
      judgeScores: {
        fighterA: {
          damageInflicted: 80,
          mobilityRemaining: 90,
          weaponFunctional: true,
          aggression: 70,
          integrityRemaining: 100,
          normalised: {
            damage: 0.8,
            mobility: 0.9,
            weapon: 1.0,
            aggression: 0.7,
            integrity: 0.67,
            total: 0.82,
          },
        },
        fighterB: {
          damageInflicted: 40,
          mobilityRemaining: 30,
          weaponFunctional: true,
          aggression: 50,
          integrityRemaining: 50,
          normalised: {
            damage: 0.4,
            mobility: 0.3,
            weapon: 1.0,
            aggression: 0.5,
            integrity: 0.33,
            total: 0.52,
          },
        },
      },
    };

    const card = renderResultCard(result, state, [], 20, 200);
    expect(card).toContain("Method: Judges' Decision");
    expect(card).toContain("JUDGES' SCORES");
    expect(card).toContain("Damage");
    expect(card).toContain("Mobility");
    expect(card).toContain("Total");
  });

  it("shows no single finishing event when none found", () => {
    const state = makeState();
    const result: CompetitionResult = {
      winner: "fighter_a",
      loser: "fighter_b",
      method: "destruction",
    };

    const card = renderResultCard(result, state, [], 10, 50);
    expect(card).toContain("Decisive event: No single finishing event");
  });
});
