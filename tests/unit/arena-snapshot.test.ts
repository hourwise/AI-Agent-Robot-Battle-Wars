import { describe, it, expect } from "vitest";
import { renderArenaSnapshot } from "../../src/replay/ascii/arena-snapshot-renderer.js";
import type { FighterVisualState } from "../../src/replay/ascii/ascii.types.js";

function makeFighter(overrides: Partial<FighterVisualState> = {}): FighterVisualState {
  return {
    fighterId: "test",
    build: {
      proposal: {
        machineName: "Test Bot",
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
    ...overrides,
  };
}

describe("renderArenaSnapshot", () => {
  it("shows fighters at starting positions", () => {
    const fighterA = makeFighter({ zone: "south_edge", facing: "north" });
    const fighterB = makeFighter({ zone: "north_edge", facing: "south" });

    const arena = renderArenaSnapshot(fighterA, fighterB);
    expect(arena).toContain("[NORTH]");
    expect(arena).toContain("[SOUTH]");
    expect(arena).toContain("[WEST]");
    expect(arena).toContain("[EAST]");
    expect(arena).toContain("Bv");
    expect(arena).toContain("A^");
  });

  it("shows both fighters in center", () => {
    const fighterA = makeFighter({ zone: "center", facing: "north" });
    const fighterB = makeFighter({ zone: "center", facing: "south" });

    const arena = renderArenaSnapshot(fighterA, fighterB);
    expect(arena).toContain("A");
    expect(arena).toContain("B");
  });

  it("shows immobilised marker", () => {
    const fighterA = makeFighter({
      zone: "center",
      facing: "north",
      components: {
        mobilityDisabled: true,
        weaponDisabled: false,
        utilityDisabled: false,
      },
    });

    const arena = renderArenaSnapshot(fighterA, makeFighter());
    expect(arena).toContain("AX");
  });

  it("shows overturned marker", () => {
    const fighterA = makeFighter({
      zone: "center",
      facing: "north",
      conditions: ["overturned"],
    });

    const arena = renderArenaSnapshot(fighterA, makeFighter());
    expect(arena).toContain("A!");
  });

  it("shows overheated marker", () => {
    const fighterA = makeFighter({
      zone: "center",
      facing: "north",
      conditions: ["overheated"],
    });

    const arena = renderArenaSnapshot(fighterA, makeFighter());
    expect(arena).toContain("A~");
  });

  it("handles all facing directions", () => {
    const directions = ["north", "south", "east", "west"];
    const arrows = ["^", "v", ">", "<"];

    for (let i = 0; i < directions.length; i++) {
      const fighter = makeFighter({ zone: "center", facing: directions[i] });
      const arena = renderArenaSnapshot(fighter, makeFighter({ zone: "north_edge" }));
      expect(arena).toContain(`A${arrows[i]}`);
    }
  });
});
