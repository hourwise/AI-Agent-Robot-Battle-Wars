import { describe, expect, it } from "vitest";
import { getGridExposedZones, determineGridHitZone } from "../../src/simulator/damage.js";
import { createZoneFighterState } from "../../src/simulator/simulator.js";
import { V3_FIXTURE_BUILD } from "../fixtures/v3-match-record.js";
import type { GridFighterState, Direction } from "../../src/simulator/types.js";
import type { GridZone } from "../../src/simulator/arena-grid.js";
import type { RelativeBearing } from "../../src/simulator/arena-grid.js";
import type { PlanarArmourZone } from "../../src/simulator/arena-grid.js";

function makeFighter(zone: GridZone, facing: Direction): GridFighterState {
  return createZoneFighterState(V3_FIXTURE_BUILD, "fighter", zone, facing);
}

/** Frame offsets for each defender-relative bearing. */
const FRAME_OFFSETS: Record<RelativeBearing, { x: -1 | 0 | 1; y: -1 | 0 | 1 }> = {
  same: { x: 0, y: 0 },
  front: { x: 0, y: 1 },
  front_right: { x: 1, y: 1 },
  right: { x: 1, y: 0 },
  rear_right: { x: 1, y: -1 },
  rear: { x: 0, y: -1 },
  rear_left: { x: -1, y: -1 },
  left: { x: -1, y: 0 },
  front_left: { x: -1, y: 1 },
};

const ZONE_BY_OFFSET: Record<string, GridZone> = {
  "0,0": "center",
  "0,1": "north",
  "1,1": "north_east",
  "1,0": "east",
  "1,-1": "south_east",
  "0,-1": "south",
  "-1,-1": "south_west",
  "-1,0": "west",
  "-1,1": "north_west",
};

/** Attacker zone for a defender at center facing `facing`, at `bearing`. */
function attackerZoneFor(facing: Direction, bearing: RelativeBearing): GridZone {
  const frame = FRAME_OFFSETS[bearing];
  let x: number;
  let y: number;
  switch (facing) {
    case "north":
      x = frame.x;
      y = frame.y;
      break;
    case "east":
      x = frame.y;
      y = -frame.x;
      break;
    case "south":
      x = -frame.x;
      y = -frame.y;
      break;
    case "west":
      x = -frame.y;
      y = frame.x;
      break;
  }
  const zone = ZONE_BY_OFFSET[`${x},${y}`];
  if (!zone) throw new Error(`No grid zone for offset ${x},${y}`);
  return zone;
}

const FACINGS: readonly Direction[] = ["north", "east", "south", "west"];
const BEARINGS = Object.keys(FRAME_OFFSETS) as RelativeBearing[];

describe("grid planar armour exposure", () => {
  it("matches the frozen ADR-001 table for every facing and bearing", () => {
    const expected: Record<RelativeBearing, readonly PlanarArmourZone[]> = {
      front: ["front"],
      front_left: ["front", "left"],
      left: ["left"],
      rear_left: ["rear", "left"],
      rear: ["rear"],
      rear_right: ["rear", "right"],
      right: ["right"],
      front_right: ["front", "right"],
      same: ["front", "left", "right"],
    };
    for (const facing of FACINGS) {
      for (const bearing of BEARINGS) {
        const attacker = makeFighter(attackerZoneFor(facing, bearing), "north");
        const defender = makeFighter("center", facing);
        const exposed = getGridExposedZones(
          attacker.zone,
          defender.zone,
          defender.facing,
          "ram",
        );
        expect(exposed).toEqual([...expected[bearing]]);
      }
    }
  });

  it("exposes top only through the hammer overhead behaviour", () => {
    const attacker = makeFighter("north", "south");
    const defender = makeFighter("center", "south");
    const withRam = getGridExposedZones(
      attacker.zone,
      defender.zone,
      defender.facing,
      "ram",
    );
    expect(withRam).not.toContain("top");
    const withHammer = getGridExposedZones(
      attacker.zone,
      defender.zone,
      defender.facing,
      "hammer",
    );
    expect(withHammer[0]).toBe("top");
  });

  it("exposes strict rear only", () => {
    const attacker = makeFighter("south", "north");
    const defender = makeFighter("center", "north");
    const exposed = getGridExposedZones(
      attacker.zone,
      defender.zone,
      defender.facing,
      "ram",
    );
    expect(exposed).toEqual(["rear"]);
  });

  it("exposes one side only for strict side bearings", () => {
    const defender = makeFighter("center", "north");
    const left = getGridExposedZones(
      makeFighter("west", "east").zone,
      defender.zone,
      defender.facing,
      "ram",
    );
    expect(left).toEqual(["left"]);
    const right = getGridExposedZones(
      makeFighter("east", "west").zone,
      defender.zone,
      defender.facing,
      "ram",
    );
    expect(right).toEqual(["right"]);
  });

  it("selects primary, then secondary, then front fallback", () => {
    const attacker = makeFighter("south", "north");
    const defender = makeFighter("center", "north");
    // Attacker is strictly at the rear.
    expect(determineGridHitZone(attacker, defender, "ram", "rear", "left")).toBe("rear");
    expect(determineGridHitZone(attacker, defender, "ram", "left", "rear")).toBe("rear");
    expect(determineGridHitZone(attacker, defender, "ram", "front", "rear")).toBe("rear");
    expect(determineGridHitZone(attacker, defender, "ram", "front", "left")).toBe(
      "front",
    );
  });

  it("selects a requested exposed side over front fallback", () => {
    const attacker = makeFighter("west", "east");
    const defender = makeFighter("center", "north");
    // Attacker is on the defender's left.
    expect(determineGridHitZone(attacker, defender, "ram", "left", "front")).toBe("left");
    expect(determineGridHitZone(attacker, defender, "ram", "front", "left")).toBe("left");
  });

  it("exposes front/left/right for same-cell fighters", () => {
    const attacker = makeFighter("center", "north");
    const defender = makeFighter("center", "south");
    const exposed = getGridExposedZones(
      attacker.zone,
      defender.zone,
      defender.facing,
      "ram",
    );
    expect(exposed).toEqual(["front", "left", "right"]);
  });
});
