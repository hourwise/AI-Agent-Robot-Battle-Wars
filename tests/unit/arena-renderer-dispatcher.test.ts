import { describe, expect, it } from "vitest";
import { renderArenaForModel } from "../../src/replay/ascii/arena-renderer.js";
import { renderArenaSnapshot } from "../../src/replay/ascii/arena-snapshot-renderer.js";
import { renderGridArenaSnapshot } from "../../src/replay/ascii/grid-arena-snapshot-renderer.js";
import type { GridFighterVisualState } from "../../src/replay/ascii/grid-arena-snapshot-renderer.js";
import type { FighterVisualState } from "../../src/replay/ascii/ascii.types.js";

function makeLegacyFighter(zone: string): FighterVisualState {
  return {
    fighterId: "a",
    build: {
      proposal: {
        machineName: "Bot",
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
    zone,
    facing: "north",
    conditions: [],
    components: {
      mobilityDisabled: false,
      weaponDisabled: false,
      utilityDisabled: false,
      mobilityDamaged: false,
      weaponDamaged: false,
      utilityDamaged: false,
    },
    armour: { front: 10, left: 5, right: 5, rear: 0, top: 0 },
  };
}

function makeGridFighter(zone: "center"): GridFighterVisualState {
  return {
    fighterId: "a",
    zone,
    facing: "north",
    conditions: [],
    components: {
      mobilityDisabled: false,
      weaponDisabled: false,
      utilityDisabled: false,
      mobilityDamaged: false,
      weaponDamaged: false,
      utilityDamaged: false,
    },
  };
}

describe("version-aware arena rendering dispatcher", () => {
  it("uses the legacy five-zone renderer for legacy records", () => {
    const a = makeLegacyFighter("south_edge");
    const b = makeLegacyFighter("north_edge");
    const dispatched = renderArenaForModel("legacy-five-zone-v1", a, b);
    const direct = renderArenaSnapshot(a, b);
    expect(dispatched).toBe(direct);
    expect(dispatched).toContain("[NORTH]");
    expect(dispatched).toContain("[SOUTH]");
  });

  it("uses the 3×3 grid renderer for v3 grid records", () => {
    const a = makeGridFighter("center");
    const b = makeGridFighter("center");
    const dispatched = renderArenaForModel("grid-3x3-v1", a, b);
    const direct = renderGridArenaSnapshot(a, b);
    expect(dispatched).toBe(direct);
    expect(dispatched).toContain("NORTH WEST");
    expect(dispatched).toContain("SOUTH EAST");
  });

  it("keeps the legacy output byte-for-byte identical to the direct renderer", () => {
    const a = makeLegacyFighter("west_edge");
    const b = makeLegacyFighter("east_edge");
    expect(renderArenaForModel("legacy-five-zone-v1", a, b)).toBe(
      renderArenaSnapshot(a, b),
    );
  });
});
