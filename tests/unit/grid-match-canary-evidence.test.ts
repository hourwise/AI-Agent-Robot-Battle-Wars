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
import type { GridMatchResult } from "../../src/simulator/types.js";

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

describe("grid canary evidence — direct match (Phase 3D2A)", () => {
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

  it("observes rear or rear-diagonal exposure relative to the stationary opponent", () => {
    for (const seed of [1, 2, 3, 42, 100]) {
      const { evidence } = runEvidence(seed);
      expect(evidence.rearExposureObserved).toBe(true);
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

  it("fails closed when rear or rear-diagonal exposure is absent", () => {
    const result = runCanaryMatch(1);
    // Route the moving fighter entirely into a corner far from the stationary
    // north fighter (south_west), which exposes no rear and is not adjacent.
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
    expect(() => inspectGridCanaryEvidence(tampered)).toThrow(/rear or rear-diagonal/);
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
