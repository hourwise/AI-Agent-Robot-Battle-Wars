import { describe, it, expect } from "vitest";
import { computeDistance } from "../../src/simulator/actions.js";

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
