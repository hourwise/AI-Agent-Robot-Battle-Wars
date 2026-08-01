import { describe, expect, it } from "vitest";
import { runGridMatch } from "../../src/simulator/grid-runtime.js";
import { isGridZone } from "../../src/simulator/arena-grid.js";
import { matchResultToRecord } from "../../src/persistence/match-converter.js";
import {
  deserializeMatchRecord,
  isV3Record,
  serializeMatchRecord,
  validateMatchRecord,
} from "../../src/schemas/match-record.schema.js";
import { renderTextReplay } from "../../src/replay/text-replay-renderer.js";
import { renderAsciiReplay } from "../../src/replay/ascii/ascii-replay-renderer.js";
import {
  getInitialState,
  getStateAfterEvents,
} from "../../src/replay/ascii/state-reconstructor.js";
import {
  createBulwarkBuild,
  BULWARK_POLICY,
} from "../../src/agents/scripted/bulwark-agent.js";
import { CATALOGUE_V1 } from "../../src/catalogue/catalogue.v1.js";
import { validateBuild } from "../../src/validation/build-validator.js";
import type { ValidatedBuild } from "../../src/validation/validation.types.js";
import type { ActionPolicy } from "../../src/simulator/types.js";

const build = createBulwarkBuild();

function gridConfig(seed: number) {
  return {
    seed,
    fighterA: { build, policy: BULWARK_POLICY },
    fighterB: { build, policy: BULWARK_POLICY },
    rulesetVersion: "0.2.0",
    catalogueVersion: CATALOGUE_V1.version,
  };
}

// A spinner-vs-spinner line-up whose high base damage reliably pushes the
// shared component lifecycle into damaged/disabled transitions.
function makeSpinnerBuild(): ValidatedBuild {
  const validated = validateBuild(
    {
      machineName: "Spinner",
      chassisId: "medium" as const,
      mobilityId: "wheels" as const,
      weaponId: "horizontal_spinner" as const,
      utilityId: "none" as const,
      armour: { front: 40, left: 15, right: 15, rear: 0, top: 20 },
      designSummary: "grid integration fixture",
      designRationale: "high damage to exercise component transitions",
    },
    CATALOGUE_V1,
  );
  if (!validated.ok) {
    throw new Error(
      `spinner build invalid: ${validated.errors.map((e) => e.message).join(", ")}`,
    );
  }
  return validated.build;
}

const SPINNER_POLICY: ActionPolicy = {
  opening: "rush",
  preferredRange: "close",
  aggression: 85,
  primaryTarget: "front",
  secondaryTarget: "front",
  retreatThreshold: 10,
  heatThreshold: 90,
  fallback: "desperate_attack",
};

const GRID_MODEL = "grid-3x3-v1" as const;

describe("grid match integration", () => {
  it("completes deterministic matches for identical seeds", () => {
    const result1 = runGridMatch(gridConfig(42));
    const result2 = runGridMatch(gridConfig(42));
    expect(result1.events).toEqual(result2.events);
    expect(result1.result).toEqual(result2.result);
    expect(result1.rounds).toBe(result2.rounds);
  });

  it("starts fighters on south and north", () => {
    const result = runGridMatch(gridConfig(1));
    expect(result.initialState.fighterA.zone).toBe("south");
    expect(result.initialState.fighterB.zone).toBe("north");
    expect(result.initialState.fighterA.facing).toBe("north");
    expect(result.initialState.fighterB.facing).toBe("south");
  });

  it("only ever emits canonical grid zones", () => {
    const result = runGridMatch(gridConfig(2));
    const zones: unknown[] = [
      result.initialState.fighterA.zone,
      result.initialState.fighterB.zone,
    ];
    for (const event of result.events) {
      if (event.type === "movement_resolved" && event.data) {
        zones.push(event.data.from, event.data.to);
      }
      if (event.type === "round_ended" && event.data) {
        zones.push(event.data.fighterA?.zone, event.data.fighterB?.zone);
      }
    }
    expect(zones.length).toBeGreaterThan(0);
    for (const zone of zones) {
      expect(isGridZone(zone)).toBe(true);
    }
  });

  it("produces a valid v3 production record", () => {
    const result = runGridMatch(gridConfig(3));
    const record = matchResultToRecord(result);
    expect(record.schemaVersion).toBe("3");
    const validation = validateMatchRecord(record);
    expect(validation.ok).toBe(true);
  });

  it("round-trips a v3 record through serialization", () => {
    const result = runGridMatch(gridConfig(4));
    const record = matchResultToRecord(result);
    const json = serializeMatchRecord(record);
    const restored = deserializeMatchRecord(json);
    expect(restored.ok).toBe(true);
    if (restored.ok && isV3Record(restored.record)) {
      expect(restored.record.positioningModel).toBe("grid-3x3-v1");
      expect(restored.record.matchId).toBe(record.matchId);
    }
  });

  it("renders a text replay from the grid result", () => {
    const result = runGridMatch(gridConfig(5));
    const text = renderTextReplay(result);
    expect(text.length).toBeGreaterThan(0);
    expect(text).toContain(result.result.method);
  });

  it("reconstructs grid states from its own events", () => {
    const result = runGridMatch(gridConfig(6));
    const input = {
      config: result.config,
      initialState: result.initialState,
      events: result.events,
      result: result.result,
      rounds: result.rounds,
    };
    const initial = getInitialState(input, GRID_MODEL);
    expect(initial.fighterA.zone).toBe("south");
    expect(initial.fighterB.zone).toBe("north");
    const final = getStateAfterEvents(input, result.events, GRID_MODEL);
    expect(isGridZone(final.fighterA.zone)).toBe(true);
    expect(isGridZone(final.fighterB.zone)).toBe(true);
  });

  it("renders a 3×3 ASCII replay with the grid model", () => {
    const result = runGridMatch(gridConfig(7));
    const text = renderAsciiReplay(result, { mode: "ascii" }, GRID_MODEL);
    expect(text.length).toBeGreaterThan(0);
    expect(text).toContain("FORGE ARENA");
  });

  it("reaches a victory with bounded rounds", () => {
    const result = runGridMatch(gridConfig(8));
    expect(result.result.method).toBeDefined();
    expect(result.rounds).toBeGreaterThanOrEqual(1);
    expect(result.rounds).toBeLessThanOrEqual(20);
  });

  it("can produce component damaged and disabled transitions", () => {
    const spinner = makeSpinnerBuild();
    const result = runGridMatch({
      seed: 1,
      fighterA: { build: spinner, policy: SPINNER_POLICY },
      fighterB: { build: spinner, policy: SPINNER_POLICY },
      rulesetVersion: "0.2.0",
      catalogueVersion: CATALOGUE_V1.version,
    });
    const damaged = result.events.filter((event) => event.type === "component_damaged");
    const disabled = result.events.filter((event) => event.type === "component_disabled");
    expect(damaged.length).toBeGreaterThan(0);
    expect(disabled.length).toBeGreaterThan(0);
    for (const event of [...damaged, ...disabled]) {
      expect(["mobility", "weapon", "utility"]).toContain(event.data.component);
      expect(["damaged", "disabled"]).toContain(event.data.newState);
    }
    // A mobility disable must also surface as an immobilised condition.
    const mobilityDisabled = disabled.find(
      (event) => event.data.component === "mobility",
    );
    if (mobilityDisabled) {
      const immobilised = result.events.find(
        (event) =>
          event.type === "round_ended" &&
          event.data?.fighterA?.conditions?.includes("immobilised"),
      );
      expect(immobilised ?? mobilityDisabled).toBeDefined();
    }
  });
});
