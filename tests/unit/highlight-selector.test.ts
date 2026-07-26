import { describe, it, expect } from "vitest";
import {
  selectHighlights,
  isKnockbackMovement,
  isRearAttack,
  isCriticalHit,
  isComponentDisable,
} from "../../src/replay/ascii/highlight-selector.js";
import type { SimulationEvent } from "../../src/simulator/types.js";

function makeEvent(
  type: string,
  overrides: Partial<SimulationEvent> = {},
): SimulationEvent {
  return {
    schemaVersion: "1",
    sequence: 0,
    round: 1,
    timestampMs: 0,
    type,
    data: {},
    ...overrides,
  };
}

describe("isKnockbackMovement", () => {
  it("identifies knockback movement", () => {
    const event = makeEvent("movement_resolved", {
      data: { action: "knockback", from: "center", to: "south_edge", facing: "north" },
    });
    expect(isKnockbackMovement(event)).toBe(true);
  });

  it("rejects normal movement", () => {
    const event = makeEvent("movement_resolved", {
      data: { action: "advance", from: "center", to: "north_edge", facing: "north" },
    });
    expect(isKnockbackMovement(event)).toBe(false);
  });
});

describe("isRearAttack", () => {
  it("identifies rear attacks", () => {
    const event = makeEvent("attack_hit", { data: { hitZone: "rear" } });
    expect(isRearAttack(event)).toBe(true);
  });

  it("rejects non-rear attacks", () => {
    const event = makeEvent("attack_hit", { data: { hitZone: "front" } });
    expect(isRearAttack(event)).toBe(false);
  });
});

describe("isCriticalHit", () => {
  it("identifies critical hits", () => {
    const event = makeEvent("attack_hit", { data: { isCritical: true } });
    expect(isCriticalHit(event)).toBe(true);
  });

  it("rejects non-critical hits", () => {
    const event = makeEvent("attack_hit", { data: { isCritical: false } });
    expect(isCriticalHit(event)).toBe(false);
  });
});

describe("isComponentDisable", () => {
  it("identifies component disabled events", () => {
    const event = makeEvent("component_disabled", { data: { component: "mobility" } });
    expect(isComponentDisable(event)).toBe(true);
  });

  it("rejects other events", () => {
    const event = makeEvent("attack_hit", { data: {} });
    expect(isComponentDisable(event)).toBe(false);
  });
});

describe("selectHighlights", () => {
  it("returns empty array for no events", () => {
    const result = selectHighlights([], { winner: null }, 5);
    expect(result).toEqual([]);
  });

  it("selects critical hits", () => {
    const events = [
      makeEvent("attack_hit", {
        sequence: 1,
        data: { isCritical: true, hitZone: "front", weapon: "ram", effectiveDamage: 10 },
      }),
    ];
    const result = selectHighlights(events, { winner: "fighter_a" }, 5);
    expect(result.length).toBeGreaterThan(0);
    expect(result[0]!.title).toContain("Ram");
  });

  it("selects component disables", () => {
    const events = [
      makeEvent("component_disabled", { sequence: 1, data: { component: "mobility" } }),
    ];
    const result = selectHighlights(events, { winner: "fighter_a" }, 5);
    expect(result.length).toBeGreaterThan(0);
    expect(result[0]!.title).toContain("Mobility");
  });

  it("selects rear attacks", () => {
    const events = [
      makeEvent("attack_hit", {
        sequence: 1,
        data: {
          hitZone: "rear",
          weapon: "grappler",
          effectiveDamage: 5,
          isCritical: false,
        },
      }),
    ];
    const result = selectHighlights(events, { winner: "fighter_a" }, 5);
    expect(result.length).toBeGreaterThan(0);
    expect(result[0]!.title).toContain("REAR");
  });

  it("selects overturn events", () => {
    const events = [makeEvent("robot_overturned", { sequence: 1 })];
    const result = selectHighlights(events, { winner: "fighter_a" }, 5);
    expect(result.length).toBeGreaterThan(0);
    expect(result[0]!.title).toContain("OVERTURNED");
  });

  it("selects knockback events", () => {
    const events = [
      makeEvent("movement_resolved", {
        sequence: 1,
        data: { action: "knockback", from: "center", to: "south_edge", facing: "north" },
      }),
    ];
    const result = selectHighlights(events, { winner: "fighter_a" }, 5);
    expect(result.length).toBeGreaterThan(0);
    expect(result[0]!.title).toContain("KNOCKBACK");
  });

  it("respects maximum limit", () => {
    const events = Array.from({ length: 20 }, (_, i) =>
      makeEvent("attack_hit", {
        sequence: i,
        data: { isCritical: true, hitZone: "front", weapon: "ram", effectiveDamage: 10 },
      }),
    );
    const result = selectHighlights(events, { winner: "fighter_a" }, 3);
    expect(result.length).toBeLessThanOrEqual(3);
  });

  it("sorts by priority then stable order", () => {
    const events = [
      makeEvent("attack_hit", {
        sequence: 1,
        data: { hitZone: "front", weapon: "ram", effectiveDamage: 5, isCritical: false },
      }),
      makeEvent("component_disabled", { sequence: 2, data: { component: "mobility" } }),
      makeEvent("attack_hit", {
        sequence: 3,
        data: {
          hitZone: "rear",
          weapon: "grappler",
          effectiveDamage: 5,
          isCritical: false,
        },
      }),
    ];
    const result = selectHighlights(events, { winner: "fighter_a" }, 5);
    expect(result.length).toBeGreaterThanOrEqual(1);
    const firstMoment = result[0]!;
    expect(firstMoment.events.some((e) => e.type === "component_disabled")).toBe(true);
  });
});
