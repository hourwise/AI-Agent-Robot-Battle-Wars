import { describe, it, expect } from "vitest";
import { computeDistance, deriveAction } from "../../src/simulator/actions.js";
import { SeededRandom } from "../../src/simulator/seeded-random.js";
import type { FighterState, ActionPolicy } from "../../src/simulator/types.js";

function makeFighter(overrides: Partial<FighterState> = {}): FighterState {
  return {
    fighterId: "test",
    build: {
      proposal: {
        machineName: "Test",
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
    zone: "south_edge",
    facing: "north",
    weaponCooldown: 0,
    utilityCooldown: 0,
    armour: { front: 10, left: 5, right: 5, rear: 0, top: 0 },
    components: {
      mobilityDisabled: false,
      weaponDisabled: false,
      utilityDisabled: false,
    },
    conditions: [],
    ...overrides,
  };
}

describe("computeDistance", () => {
  it("same zone is close", () => {
    expect(computeDistance("center", "center")).toBe("close");
    expect(computeDistance("north_edge", "north_edge")).toBe("close");
  });

  it("center to edge is medium", () => {
    expect(computeDistance("center", "north_edge")).toBe("medium");
    expect(computeDistance("center", "south_edge")).toBe("medium");
    expect(computeDistance("north_edge", "center")).toBe("medium");
  });

  it("opposing edges are far", () => {
    expect(computeDistance("north_edge", "south_edge")).toBe("far");
    expect(computeDistance("south_edge", "north_edge")).toBe("far");
    expect(computeDistance("east_edge", "west_edge")).toBe("far");
    expect(computeDistance("west_edge", "east_edge")).toBe("far");
  });

  it("adjacent edges are medium", () => {
    expect(computeDistance("north_edge", "east_edge")).toBe("medium");
    expect(computeDistance("north_edge", "west_edge")).toBe("medium");
    expect(computeDistance("south_edge", "east_edge")).toBe("medium");
    expect(computeDistance("south_edge", "west_edge")).toBe("medium");
    expect(computeDistance("east_edge", "north_edge")).toBe("medium");
    expect(computeDistance("west_edge", "south_edge")).toBe("medium");
  });
});

describe("flank opening behaviour", () => {
  const flankPolicy: ActionPolicy = {
    opening: "flank",
    preferredRange: "close",
    aggression: 80,
    primaryTarget: "rear",
    secondaryTarget: "left",
    retreatThreshold: 30,
    heatThreshold: 70,
    fallback: "retreat",
  };

  it("advances from starting edge to center when opponent is at opposite edge (far distance)", () => {
    // Rear-Hunter at south_edge, Bulwark at north_edge → far
    const state = makeFighter({ zone: "south_edge", facing: "north" });
    const opponent = makeFighter({ zone: "north_edge", facing: "south" });
    const rng = new SeededRandom(42);

    const action = deriveAction(state, flankPolicy, opponent, rng);
    // Flank opening + far distance → advance to close the gap
    expect(action.movement).toBe("advance");
  });

  it("circles or holds when already at close range (both in center)", () => {
    const state = makeFighter({ zone: "center", facing: "north" });
    const opponent = makeFighter({ zone: "center", facing: "south" });

    let sawCircleOrHold = false;
    for (let seed = 0; seed < 20; seed++) {
      const action = deriveAction(state, flankPolicy, opponent, new SeededRandom(seed));
      if (
        action.movement === "circle_left" ||
        action.movement === "circle_right" ||
        action.movement === "hold"
      ) {
        sawCircleOrHold = true;
      }
    }
    expect(sawCircleOrHold).toBe(true);
  });

  it("a flank opener against a rushing central opponent produces center-then-circle pattern", () => {
    // Round 1: far → advance to center
    const rng1 = new SeededRandom(42);
    const state1 = makeFighter({ zone: "south_edge", facing: "north" });
    const opp1 = makeFighter({ zone: "north_edge", facing: "south" });
    expect(deriveAction(state1, flankPolicy, opp1, rng1).movement).toBe("advance");

    // Round 2+: close → hold or circle (no way to "flank around" edge)
    const rng2 = new SeededRandom(42);
    const state2 = makeFighter({ zone: "center", facing: "north" });
    const opp2 = makeFighter({ zone: "center", facing: "south" });
    const action2 = deriveAction(state2, flankPolicy, opp2, rng2);
    expect(["hold", "circle_left", "circle_right"]).toContain(action2.movement);

    // The flank policy is working as designed. The "move to center → turn → turn"
    // pattern is expected because:
    // 1. The arena only has advance/retreat (no lateral movement to flank edges)
    // 2. Once at center, the only options are hold or circle in place
    // 3. The robot CAN retreat but prefers "close" range
    // The arena is too coarse for true flanking manoeuvres.
  });
});
