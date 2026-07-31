import { describe, expect, it } from "vitest";
import { formatZoneName } from "../../src/replay/zone-format.js";
import { GRID_ZONES } from "../../src/simulator/arena-grid.js";

describe("human-readable zone formatting", () => {
  it("formats every grid zone with its canonical display name", () => {
    const expected: Record<string, string> = {
      north_west: "North West",
      north: "North",
      north_east: "North East",
      west: "West",
      center: "Center",
      east: "East",
      south_west: "South West",
      south: "South",
      south_east: "South East",
    };
    expect(GRID_ZONES).toHaveLength(9);
    for (const zone of GRID_ZONES) {
      expect(formatZoneName(zone)).toBe(expected[zone]);
    }
  });

  it("keeps legacy zone formatting unchanged", () => {
    expect(formatZoneName("north_edge")).toBe("North Edge");
    expect(formatZoneName("south_edge")).toBe("South Edge");
    expect(formatZoneName("east_edge")).toBe("East Edge");
    expect(formatZoneName("west_edge")).toBe("West Edge");
    expect(formatZoneName("center")).toBe("Center");
  });
});
