import type { MatchRecordV3 } from "../../src/schemas/match-record.schema.js";
import type { GridZone, GridDirection } from "../../src/simulator/arena-grid.js";
import type { SimulationEvent } from "../../src/simulator/types.js";
import type { ActionPolicy } from "../../src/simulator/types.js";
import type { ValidatedBuild } from "../../src/validation/validation.types.js";

export const V3_FIXTURE_BUILD: ValidatedBuild = {
  proposal: {
    machineName: "Grid Bot A",
    chassisId: "medium",
    mobilityId: "wheels",
    weaponId: "ram",
    utilityId: "none",
    armour: { front: 10, left: 5, right: 5, rear: 0, top: 0 },
    designSummary: "synthetic v3 fixture",
    designRationale: "synthetic v3 fixture",
  },
  totalCost: 52,
  armourCost: 2,
  totalArmourPoints: 20,
  catalogueVersion: "1",
};

export const V3_FIXTURE_POLICY: ActionPolicy = {
  opening: "rush",
  preferredRange: "close",
  aggression: 80,
  primaryTarget: "front",
  secondaryTarget: "front",
  retreatThreshold: 20,
  heatThreshold: 80,
  fallback: "defend",
};

export function makeV3Fighter(
  fighterId: string,
  zone: GridZone,
  facing: GridDirection,
): MatchRecordV3["initialState"]["fighterA"] {
  return {
    fighterId,
    build: V3_FIXTURE_BUILD,
    integrity: 100,
    maxIntegrity: 100,
    energy: 100,
    heat: 0,
    zone,
    facing,
    weaponCooldown: 0,
    utilityCooldown: 0,
    armour: { front: 10, left: 5, right: 5, rear: 0, top: 0 },
    components: {
      mobilityDisabled: false,
      weaponDisabled: false,
      utilityDisabled: false,
    },
    comps: {
      mobility: { state: "healthy" },
      weapon: { state: "healthy" },
      utility: { state: "healthy", installed: false },
    },
    conditions: [],
  };
}

export interface V3RecordOptions {
  readonly initialZoneA?: GridZone;
  readonly initialZoneB?: GridZone;
  readonly events?: readonly SimulationEvent[];
  readonly simulatorVersion?: string;
  readonly rulesetVersion?: string;
}

export function makeV3Record(options: V3RecordOptions = {}): MatchRecordV3 {
  const events = options.events ?? [
    {
      schemaVersion: "1",
      sequence: 0,
      round: 0,
      timestampMs: 0,
      type: "competition_started",
      data: { seed: 7 },
    },
  ];

  return {
    schemaVersion: "3",
    positioningModel: "grid-3x3-v1",
    matchId: "550e8400-e29b-41d4-a716-446655440111",
    createdAt: "2026-07-31T12:00:00.000Z",
    rulesetVersion: options.rulesetVersion ?? "0.3.0",
    catalogueVersion: "1",
    simulatorVersion: options.simulatorVersion ?? "0.3.0",
    seed: 7,
    config: {
      seed: 7,
      rulesetVersion: options.rulesetVersion ?? "0.3.0",
      catalogueVersion: "1",
      fighterA: { build: V3_FIXTURE_BUILD, policy: V3_FIXTURE_POLICY },
      fighterB: { build: V3_FIXTURE_BUILD, policy: V3_FIXTURE_POLICY },
    },
    initialState: {
      fighterA: makeV3Fighter("fighter_a", options.initialZoneA ?? "south", "north"),
      fighterB: makeV3Fighter("fighter_b", options.initialZoneB ?? "north", "south"),
    },
    events: [...events],
    result: { winner: null, loser: null, method: "draw" },
    rounds: 1,
  };
}
