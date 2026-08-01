import { describe, expect, it } from "vitest";
import { runGridMatch } from "../../src/simulator/grid-runtime.js";
import { RULESET_VERSION } from "../../src/simulator/constants.js";
import { CATALOGUE_V1 } from "../../src/catalogue/catalogue.v1.js";
import { createGridCanaryScenario } from "../../src/canary/grid-canary-scenario.js";
import {
  GridCanaryEvidenceError,
  assertGridCanaryFinalAgreement,
  inspectGridCanaryEvidence,
  verifyGridCanaryDeterminism,
} from "../../src/canary/grid-match-canary-evidence.js";
import { buildGridFactualReport } from "../../src/reports/factual-match-report.js";
import {
  getPlanarExposedArmourZones,
  getRelativeBearing,
} from "../../src/simulator/arena-grid.js";
import type {
  Direction,
  GridMatchResult,
  GridZone,
  SimulationEvent,
} from "../../src/simulator/types.js";

function runCanaryMatch(seed: number): GridMatchResult {
  const scenario = createGridCanaryScenario();
  return runGridMatch({
    seed,
    fighterA: scenario.fighterA,
    fighterB: scenario.fighterB,
    rulesetVersion: RULESET_VERSION,
    catalogueVersion: CATALOGUE_V1.version,
  });
}

function runEvidence(seed: number) {
  const result = runCanaryMatch(seed);
  const evidence = inspectGridCanaryEvidence(result);
  return { result, evidence };
}

function movementEvent(
  round: number,
  sequence: number,
  actorId: string,
  from: GridZone,
  to: GridZone,
  facing: Direction,
  action: string,
): SimulationEvent {
  return {
    schemaVersion: "1",
    sequence,
    round,
    timestampMs: round * 1000,
    type: "movement_resolved",
    actorId,
    data: { from, to, facing, action },
  };
}

function roundEndEvent(
  round: number,
  sequence: number,
  zoneA: GridZone,
  zoneB: GridZone,
): SimulationEvent {
  return {
    schemaVersion: "1",
    sequence,
    round,
    timestampMs: round * 1000,
    type: "round_ended",
    data: {
      fighterA: { zone: zoneA, integrity: 100, energy: 100, heat: 0, conditions: [] },
      fighterB: { zone: zoneB, integrity: 100, energy: 100, heat: 0, conditions: [] },
    },
  };
}

/** Synthetic grid result with fighter B held at `center` facing south. */
function syntheticCenterSouthResult(events: readonly SimulationEvent[]): GridMatchResult {
  const base = runCanaryMatch(1);
  return {
    ...base,
    initialState: {
      fighterA: { ...base.initialState.fighterA, zone: "south", facing: "north" },
      fighterB: { ...base.initialState.fighterB, zone: "center", facing: "south" },
    },
    events: [...events],
  };
}

describe("grid canary evidence — direct match (Phase 3D2A.1)", () => {
  it("is deterministic for multiple ordinary development seeds", () => {
    for (const seed of [1, 2, 3, 42, 100, 2026]) {
      const first = runCanaryMatch(seed);
      const second = runCanaryMatch(seed);
      expect(JSON.stringify(first.events)).toBe(JSON.stringify(second.events));
      expect(first.rounds).toBe(second.rounds);
      expect(JSON.stringify(first.result)).toBe(JSON.stringify(second.result));
    }
  });

  it("reaches the frozen round cap and resolves by judges as a draw", () => {
    for (const seed of [1, 2, 3, 42, 100]) {
      const { result } = runEvidence(seed);
      expect(result.rounds).toBe(20);
      expect(result.result.winner).toBeNull();
      expect(result.result.method).toBe("judges");
    }
  });

  it("produces the expected no-combat scenario for every seed", () => {
    for (const seed of [1, 2, 3, 42, 100]) {
      const { result, evidence } = runEvidence(seed);
      const combatTypes = [
        "attack_attempted",
        "attack_missed",
        "attack_hit",
        "integrity_damaged",
        "component_damaged",
        "component_damage_resisted",
        "component_disabled",
        "robot_overturned",
      ];
      const combats = result.events.filter((e) => combatTypes.includes(e.type));
      expect(combats).toEqual([]);
      expect(evidence.combatEvents).toEqual([]);
    }
  });

  it("observes translated circle events (advance then lateral circling)", () => {
    for (const seed of [1, 2, 3, 42, 100]) {
      const { evidence } = runEvidence(seed);
      expect(evidence.translatedCircleEvents).toBeGreaterThan(0);
    }
  });

  it("observes at least one canonical corner zone", () => {
    for (const seed of [1, 2, 3, 42, 100]) {
      const { evidence } = runEvidence(seed);
      expect(evidence.cornerZonesVisited).toBeGreaterThan(0);
      for (const zone of evidence.cornerZones) {
        expect(["north_west", "north_east", "south_west", "south_east"]).toContain(zone);
      }
    }
  });

  it("observes a canonical lateral flank for the frozen scenario", () => {
    for (const seed of [1, 2, 3, 42, 100]) {
      const { evidence } = runEvidence(seed);
      expect(evidence.lateralFlankObserved).toBe(true);
      expect(evidence.observedFlankBearings.length).toBeGreaterThan(0);
    }
  });

  it("reports the actual canonical flank bearing (right) for the frozen scenario", () => {
    for (const seed of [1, 2, 3, 42, 100]) {
      const { evidence } = runEvidence(seed);
      expect(evidence.observedFlankBearings).toContain("right");
      expect(
        evidence.observedFlankBearings.every((b) =>
          ["left", "right", "rear_left", "rear_right", "rear"].includes(b),
        ),
      ).toBe(true);
    }
  });

  it("reports strict rear exposure truthfully (false for the frozen scenario)", () => {
    for (const seed of [1, 2, 3, 42, 100]) {
      const { evidence } = runEvidence(seed);
      expect(evidence.strictRearExposureObserved).toBe(false);
    }
  });

  it("verifies the frozen-scenario role invariants", () => {
    for (const seed of [1, 2, 3, 42, 100]) {
      const { evidence } = runEvidence(seed);
      expect(evidence.fighterATranslated).toBe(true);
      expect(evidence.fighterBStationary).toBe(true);
      expect(evidence.fighterBFacingSouth).toBe(true);
      expect(evidence.stationaryFighterCellUnchanged).toBe(true);
      expect(evidence.allMovementZonesCanonical).toBe(true);
    }
  });

  it("verifies every initial, movement and round-end zone is canonical", () => {
    for (const seed of [1, 2, 3, 42, 100]) {
      const { evidence } = runEvidence(seed);
      expect(evidence.allMovementZonesCanonical).toBe(true);
    }
  });

  it("confirms runtime identity and grid config", () => {
    const { result, evidence } = runEvidence(1);
    expect(result.runtime.simulatorVersion).toBe("0.3.0");
    expect(result.runtime.positioningModel).toBe("grid-3x3-v1");
    expect(result.config.rulesetVersion).toBe("0.2.0");
    expect(result.config.catalogueVersion).toBe("1");
    expect(evidence.finalZoneA).toBe("west");
    expect(evidence.finalZoneB).toBe("north");
  });

  it("confirms determinism for re-execution of the same seed and scenario", () => {
    const scenario = createGridCanaryScenario();
    const config = {
      seed: 9,
      fighterA: scenario.fighterA,
      fighterB: scenario.fighterB,
      rulesetVersion: RULESET_VERSION,
      catalogueVersion: CATALOGUE_V1.version,
    };
    const result = runGridMatch(config);
    expect(() => verifyGridCanaryDeterminism(config, result)).not.toThrow();
  });

  it("does not mutate the result or its events", () => {
    const { result } = runEvidence(1);
    const before = JSON.stringify({ events: result.events, result: result.result });
    const evidence = inspectGridCanaryEvidence(result);
    expect(evidence.translatedCircleEvents).toBeGreaterThan(0);
    const after = JSON.stringify({ events: result.events, result: result.result });
    expect(after).toBe(before);
  });

  it("accepts deep-frozen events without mutation", () => {
    const { result } = runEvidence(1);
    for (const event of result.events) {
      Object.freeze(event.data);
      Object.freeze(event);
    }
    const evidence = inspectGridCanaryEvidence(result);
    expect(evidence.allMovementZonesCanonical).toBe(true);
  });
});

describe("grid canary evidence — fail-closed checks (Phase 3D2A)", () => {
  it("fails closed when runtime identity is not grid 0.3.0", () => {
    const result = runCanaryMatch(1);
    const tampered: GridMatchResult = {
      ...result,
      runtime: { ...result.runtime, simulatorVersion: "0.2.0" },
    };
    expect(() => inspectGridCanaryEvidence(tampered)).toThrow(GridCanaryEvidenceError);
    expect(() => inspectGridCanaryEvidence(tampered)).toThrow(/grid simulator 0\.3\.0/);
  });

  it("fails closed when the config uses the wrong ruleset or catalogue", () => {
    const result = runCanaryMatch(1);
    const wrongRuleset: GridMatchResult = {
      ...result,
      config: { ...result.config, rulesetVersion: "0.3.0" },
    };
    expect(() => inspectGridCanaryEvidence(wrongRuleset)).toThrow(/ruleset 0\.2\.0/);

    const wrongCatalogue: GridMatchResult = {
      ...result,
      config: { ...result.config, catalogueVersion: "2" },
    };
    expect(() => inspectGridCanaryEvidence(wrongCatalogue)).toThrow(/catalogue 1/);
  });

  it("fails closed when a combat event appears in the no-combat scenario", () => {
    const result = runCanaryMatch(1);
    const tampered: GridMatchResult = {
      ...result,
      events: [
        ...result.events,
        {
          schemaVersion: "1",
          sequence: result.events.length + 1,
          round: 1,
          timestampMs: 0,
          type: "attack_attempted",
          actorId: "fighter_a",
          targetId: "fighter_b",
          data: { weapon: "ram" },
        },
      ],
    };
    expect(() => inspectGridCanaryEvidence(tampered)).toThrow(/no-combat scenario/);
  });

  it("fails closed when no translated circle event exists", () => {
    const result = runCanaryMatch(1);
    const tampered: GridMatchResult = {
      ...result,
      events: result.events.map((event) =>
        event.type === "movement_resolved" &&
        (event.data.action === "circle_left" || event.data.action === "circle_right")
          ? { ...event, data: { ...event.data, action: "advance" } }
          : event,
      ),
    };
    expect(() => inspectGridCanaryEvidence(tampered)).toThrow(/translated circle/);
  });

  it("fails closed when no canonical corner zone is visited", () => {
    const result = runCanaryMatch(1);
    const tampered: GridMatchResult = {
      ...result,
      events: result.events.map((event) =>
        event.type === "movement_resolved" && event.data.to === "north_west"
          ? { ...event, data: { ...event.data, to: "west" } }
          : event,
      ),
    };
    expect(() => inspectGridCanaryEvidence(tampered)).toThrow(/corner zone/);
  });

  it("fails closed when no canonical flank bearing is observed", () => {
    const result = runCanaryMatch(1);
    // Route the moving fighter entirely into a corner far from the stationary
    // north fighter (south_west): the defender-relative bearing is
    // `front_right` — not a canonical flank bearing.
    const tampered: GridMatchResult = {
      ...result,
      events: result.events.map((event) => {
        if (event.type === "movement_resolved") {
          return { ...event, data: { ...event.data, from: "south", to: "south_west" } };
        }
        if (event.type === "round_ended") {
          return {
            ...event,
            data: {
              ...event.data,
              fighterA: {
                ...(event.data as { fighterA: { zone: string } }).fighterA,
                zone: "south_west",
              },
            },
          };
        }
        return event;
      }),
    };
    expect(() => inspectGridCanaryEvidence(tampered)).toThrow(/canonical flank bearing/);
  });

  it("fails closed when fighter A produces no translated movement", () => {
    const result = runCanaryMatch(1);
    // Pin fighter A to its starting cell in both movement and round-end facts.
    const tampered: GridMatchResult = {
      ...result,
      events: result.events.map((event) => {
        if (event.type === "movement_resolved") {
          return { ...event, data: { ...event.data, from: "south", to: "south" } };
        }
        if (event.type === "round_ended") {
          return {
            ...event,
            data: {
              ...event.data,
              fighterA: {
                ...(event.data as { fighterA: { zone: string } }).fighterA,
                zone: "south",
              },
            },
          };
        }
        return event;
      }),
    };
    expect(() => inspectGridCanaryEvidence(tampered)).toThrow(
      /fighter A produced no translated movement/,
    );
  });

  it("fails closed when fighter B changes cells", () => {
    const result = runCanaryMatch(1);
    const tampered: GridMatchResult = {
      ...result,
      events: [
        ...result.events,
        movementEvent(
          result.rounds + 1,
          result.events.length + 1,
          "fighter_b",
          "north",
          "center",
          "south",
          "advance",
        ),
      ],
    };
    expect(() => inspectGridCanaryEvidence(tampered)).toThrow(/fighter B changed cells/);
  });

  it("fails closed when fighter B facing is not south", () => {
    const result = runCanaryMatch(1);
    const tampered: GridMatchResult = {
      ...result,
      initialState: {
        ...result.initialState,
        fighterB: { ...result.initialState.fighterB, facing: "north" },
      },
    };
    expect(() => inspectGridCanaryEvidence(tampered)).toThrow(
      /fighter B facing is not south/,
    );
  });

  it("fails closed when a movement zone is not canonical", () => {
    const result = runCanaryMatch(1);
    const tampered: GridMatchResult = {
      ...result,
      events: result.events.map((event) =>
        event.type === "movement_resolved"
          ? { ...event, data: { ...event.data, to: "north_edge" } }
          : event,
      ),
    };
    expect(() => inspectGridCanaryEvidence(tampered)).toThrow(/canonical grid zones/);
  });

  it("verifies final-position agreement between round_ended, report and replay", () => {
    for (const seed of [1, 2, 3, 42]) {
      const result = runCanaryMatch(seed);
      const report = buildGridFactualReport(result);
      expect(() => assertGridCanaryFinalAgreement(result, report)).not.toThrow();
    }
  });

  it("fails closed when the report final zone disagrees with replay", () => {
    const result = runCanaryMatch(1);
    const report = buildGridFactualReport(result);
    const tamperedReport = {
      ...report,
      finalStates: {
        ...report.finalStates,
        fighterA: { ...report.finalStates.fighterA, zone: "north_east" },
      },
    };
    expect(() => assertGridCanaryFinalAgreement(result, tamperedReport)).toThrow(
      /final-positioning agreement failed/,
    );
  });
});

describe("grid canary canonical flank bearings (Phase 3D2A.1)", () => {
  it("north_west relative to a south-facing fighter at north is right", () => {
    const bearing = getRelativeBearing("north_west", "north", "south");
    expect(bearing).toBe("right");
  });

  it("north_west exposes right, not rear", () => {
    const exposed = getPlanarExposedArmourZones(
      getRelativeBearing("north_west", "north", "south"),
    );
    expect(exposed).toContain("right");
    expect(exposed).not.toContain("rear");
  });

  it("corner adjacency alone cannot satisfy strict rear evidence", () => {
    // Fighter A visits the corner north_west, which is adjacent to fighter B at
    // north — but the defender-relative bearing is `right`, so strict rear
    // exposure must remain false.
    const { evidence } = runEvidence(1);
    expect(evidence.cornerZones).toContain("north_west");
    expect(evidence.lateralFlankObserved).toBe(true);
    expect(evidence.observedFlankBearings).toContain("right");
    expect(evidence.strictRearExposureObserved).toBe(false);
  });

  it("does not accept front-left or front-right as a successful flank", () => {
    // Fighter B held at center facing south; fighter A translates between the
    // south corners, whose defender-relative bearings are front_right /
    // front_left — never a canonical flank bearing.
    const result = syntheticCenterSouthResult([
      movementEvent(1, 1, "fighter_a", "south", "south_west", "north", "circle_left"),
      movementEvent(
        2,
        2,
        "fighter_a",
        "south_west",
        "south_east",
        "north",
        "circle_right",
      ),
      roundEndEvent(2, 3, "south_east", "center"),
    ]);
    expect(getRelativeBearing("south_west", "center", "south")).toBe("front_right");
    expect(getRelativeBearing("south_east", "center", "south")).toBe("front_left");
    expect(() => inspectGridCanaryEvidence(result)).toThrow(/no canonical flank bearing/);
  });
});

describe("grid canary controlled strict-rear evidence (Phase 3D2A.1)", () => {
  it("sets strict rear evidence true for a genuine rear position", () => {
    // Fighter B held at center facing south; fighter A translates to north
    // (defender-relative `rear`).
    const result = syntheticCenterSouthResult([
      movementEvent(1, 1, "fighter_a", "south", "north_west", "east", "circle_left"),
      movementEvent(2, 2, "fighter_a", "north_west", "north", "east", "circle_right"),
      roundEndEvent(2, 3, "north", "center"),
    ]);
    expect(getRelativeBearing("north", "center", "south")).toBe("rear");
    const evidence = inspectGridCanaryEvidence(result);
    expect(evidence.strictRearExposureObserved).toBe(true);
    expect(evidence.observedFlankBearings).toContain("rear");
  });

  it("sets strict rear evidence true for a rear_left position", () => {
    const result = syntheticCenterSouthResult([
      movementEvent(1, 1, "fighter_a", "south", "north_east", "west", "circle_right"),
      roundEndEvent(1, 2, "north_east", "center"),
    ]);
    expect(getRelativeBearing("north_east", "center", "south")).toBe("rear_left");
    const evidence = inspectGridCanaryEvidence(result);
    expect(evidence.strictRearExposureObserved).toBe(true);
    expect(evidence.observedFlankBearings).toContain("rear_left");
  });

  it("sets strict rear evidence true for a rear_right position", () => {
    const result = syntheticCenterSouthResult([
      movementEvent(1, 1, "fighter_a", "south", "north_west", "east", "circle_left"),
      roundEndEvent(1, 2, "north_west", "center"),
    ]);
    expect(getRelativeBearing("north_west", "center", "south")).toBe("rear_right");
    const evidence = inspectGridCanaryEvidence(result);
    expect(evidence.strictRearExposureObserved).toBe(true);
    expect(evidence.observedFlankBearings).toContain("rear_right");
  });

  it("keeps strict rear evidence false when only a side flank is exposed", () => {
    // Fighter B held at center facing south; fighter A visits the south_west
    // corner (front_right — not a flank) then settles at west (defender-
    // relative `right` — a canonical side flank but not rear).
    const result = syntheticCenterSouthResult([
      movementEvent(1, 1, "fighter_a", "south", "south_west", "north", "circle_left"),
      movementEvent(2, 2, "fighter_a", "south_west", "west", "north", "circle_right"),
      roundEndEvent(2, 3, "west", "center"),
    ]);
    expect(getRelativeBearing("west", "center", "south")).toBe("right");
    const evidence = inspectGridCanaryEvidence(result);
    expect(evidence.lateralFlankObserved).toBe(true);
    expect(evidence.observedFlankBearings).toContain("right");
    expect(evidence.strictRearExposureObserved).toBe(false);
  });
});
