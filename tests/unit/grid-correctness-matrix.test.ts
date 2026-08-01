import { describe, expect, it } from "vitest";
import { runGridMatch } from "../../src/simulator/grid-runtime.js";
import { isGridZone } from "../../src/simulator/arena-grid.js";
import {
  getPlanarExposedArmourZones,
  getRelativeBearing,
} from "../../src/simulator/arena-grid.js";
import { matchResultToRecord } from "../../src/persistence/match-converter.js";
import { validateMatchRecord } from "../../src/schemas/match-record.schema.js";
import { getStateAfterEvents } from "../../src/replay/ascii/state-reconstructor.js";
import { validateBuild } from "../../src/validation/build-validator.js";
import { CATALOGUE_V1 } from "../../src/catalogue/catalogue.v1.js";
import { BULWARK_POLICY } from "../../src/agents/scripted/bulwark-agent.js";
import type { ValidatedBuild } from "../../src/validation/validation.types.js";
import type { GridMatchResult } from "../../src/simulator/types.js";
import type { ActionPolicy } from "../../src/simulator/types.js";

const GRID_MODEL = "grid-3x3-v1" as const;

const WEAPONS = ["ram", "hammer", "horizontal_spinner", "grappler", "flipper"] as const;
const CHASSIS = ["light", "medium", "heavy"] as const;
const MOBILITY = ["wheels", "tracks", "legs"] as const;
const UTILITIES = ["none", "reinforced_drive"] as const;

type WeaponId = (typeof WEAPONS)[number];
type ChassisId = (typeof CHASSIS)[number];
type MobilityId = (typeof MOBILITY)[number];
type UtilityId = (typeof UTILITIES)[number];

function makeArmourForBudget(remainingBudget: number) {
  // Armour costs 1 budget unit per 10 points; the catalogue caps total armour
  // at 120 points and 60 points per zone.
  const points = Math.min(remainingBudget * 10, 120);
  return {
    front: Math.min(Math.floor(points * 0.4), 60),
    left: Math.min(Math.floor(points * 0.2), 60),
    right: Math.min(Math.floor(points * 0.2), 60),
    rear: Math.min(Math.floor(points * 0.1), 60),
    top: Math.min(Math.floor(points * 0.1), 60),
  };
}

function makeBuild(
  label: string,
  weapon: WeaponId,
  chassis: ChassisId,
  mobility: MobilityId,
  utility: UtilityId,
): ValidatedBuild {
  const baseCost: Record<ChassisId, number> = { light: 15, medium: 25, heavy: 40 };
  const mobilityCost: Record<MobilityId, number> = {
    wheels: 12,
    tracks: 20,
    legs: 25,
  };
  const weaponCost: Record<WeaponId, number> = {
    ram: 10,
    hammer: 20,
    horizontal_spinner: 30,
    grappler: 20,
    flipper: 25,
  };
  const utilityCost: Record<UtilityId, number> = { none: 0, reinforced_drive: 15 };
  const remaining =
    100 -
    (baseCost[chassis] +
      mobilityCost[mobility] +
      weaponCost[weapon] +
      utilityCost[utility]);

  const validated = validateBuild(
    {
      machineName: label,
      chassisId: chassis,
      mobilityId: mobility,
      weaponId: weapon,
      utilityId: utility,
      armour: makeArmourForBudget(Math.max(remaining, 1)),
      designSummary: "grid correctness matrix",
      designRationale: "grid correctness matrix",
    },
    CATALOGUE_V1,
  );
  if (!validated.ok) {
    throw new Error(
      `matrix build ${label} invalid: ${validated.errors.map((e) => e.message).join(", ")}`,
    );
  }
  return validated.build;
}

interface Profile {
  label: string;
  weapon: WeaponId;
  chassis: ChassisId;
  mobility: MobilityId;
  utility: UtilityId;
  build: ValidatedBuild;
}

function buildMatrixProfiles(): Profile[] {
  const profiles: Profile[] = [];
  for (const weapon of WEAPONS) {
    for (const chassis of CHASSIS) {
      // Unguarded (none) with wheels; guarded (reinforced_drive) with a
      // mobility that keeps the build inside the catalogue budget.
      const unguarded: Profile = {
        label: `${weapon}-${chassis}-none-wheels`,
        weapon,
        chassis,
        mobility: "wheels",
        utility: "none",
        build: makeBuild(
          `${weapon}-${chassis}-none-wheels`,
          weapon,
          chassis,
          "wheels",
          "none",
        ),
      };
      const guardedMobility: MobilityId =
        chassis === "light" ? "legs" : chassis === "medium" ? "tracks" : "wheels";
      const guarded: Profile = {
        label: `${weapon}-${chassis}-reinforced-${guardedMobility}`,
        weapon,
        chassis,
        mobility: guardedMobility,
        utility: "reinforced_drive",
        build: makeBuild(
          `${weapon}-${chassis}-reinforced-${guardedMobility}`,
          weapon,
          chassis,
          guardedMobility,
          "reinforced_drive",
        ),
      };
      profiles.push(unguarded, guarded);
    }
  }
  return profiles;
}

function gridConfig(seed: number, a: ValidatedBuild, b: ValidatedBuild) {
  const policy: ActionPolicy = BULWARK_POLICY;
  return {
    seed,
    fighterA: { build: a, policy },
    fighterB: { build: b, policy },
    rulesetVersion: "0.2.0",
    catalogueVersion: CATALOGUE_V1.version,
  };
}

function assertCanonicalZones(result: GridMatchResult): void {
  expect(isGridZone(result.initialState.fighterA.zone)).toBe(true);
  expect(isGridZone(result.initialState.fighterB.zone)).toBe(true);
  for (const event of result.events) {
    if (event.type === "movement_resolved" && event.data) {
      expect(isGridZone(event.data.from)).toBe(true);
      expect(isGridZone(event.data.to)).toBe(true);
    }
    if (event.type === "round_ended" && event.data) {
      expect(isGridZone(event.data.fighterA?.zone)).toBe(true);
      expect(isGridZone(event.data.fighterB?.zone)).toBe(true);
    }
    if (event.type === "attack_hit" && event.data) {
      expect(["front", "left", "right", "rear", "top"]).toContain(event.data.hitZone);
    }
  }
}

function assertValidV3Record(result: GridMatchResult): void {
  const record = matchResultToRecord(result);
  expect(record.schemaVersion).toBe("3");
  const validation = validateMatchRecord(record);
  expect(validation.ok).toBe(true);
}

function assertReplayReconstructsFinalPositioning(result: GridMatchResult): void {
  const input = {
    config: result.config,
    initialState: result.initialState,
    events: result.events,
    result: result.result,
    rounds: result.rounds,
  };
  const final = getStateAfterEvents(input, result.events, GRID_MODEL);
  expect(isGridZone(final.fighterA.zone)).toBe(true);
  expect(isGridZone(final.fighterB.zone)).toBe(true);
  const lastRoundEnd = [...result.events].reverse().find((e) => e.type === "round_ended");
  expect(final.fighterA.zone).toBe(lastRoundEnd?.data?.fighterA?.zone);
  expect(final.fighterB.zone).toBe(lastRoundEnd?.data?.fighterB?.zone);
}

const PROFILES = buildMatrixProfiles();

describe("grid correctness matrix (Phase 3B)", () => {
  it("covers all five weapons, three chassis, three mobility and both utility guards", () => {
    expect(PROFILES.length).toBe(30);
    expect(new Set(PROFILES.map((p) => p.weapon))).toEqual(new Set(WEAPONS));
    expect(new Set(PROFILES.map((p) => p.chassis))).toEqual(new Set(CHASSIS));
    expect(new Set(PROFILES.map((p) => p.mobility))).toEqual(new Set(MOBILITY));
    expect(new Set(PROFILES.map((p) => p.utility))).toEqual(new Set(UTILITIES));
  });

  it("sweeps the matrix without exceptions and emits only canonical facts", () => {
    for (const profile of PROFILES) {
      const result = runGridMatch(gridConfig(1, profile.build, profile.build));
      assertCanonicalZones(result);
      assertValidV3Record(result);
      assertReplayReconstructsFinalPositioning(result);
      expect(result.rounds).toBeGreaterThanOrEqual(1);
      expect(result.rounds).toBeLessThanOrEqual(20);
    }
  });

  it("is deterministic across repeated executions", () => {
    const subset = PROFILES.filter((_, index) => index % 5 === 0);
    for (const profile of subset) {
      const first = runGridMatch(gridConfig(3, profile.build, profile.build));
      const second = runGridMatch(gridConfig(3, profile.build, profile.build));
      expect(second.events).toEqual(first.events);
      expect(second.result).toEqual(first.result);
      expect(second.rounds).toBe(first.rounds);
    }
  });

  it("covers normal movement, knockback and grapple repositioning", () => {
    const allActions = new Set<string>();
    let knockbacks = 0;
    let advances = 0;
    for (const profile of PROFILES) {
      const result = runGridMatch(gridConfig(1, profile.build, profile.build));
      for (const event of result.events) {
        if (event.type === "movement_resolved" && event.data) {
          const action = event.data.action as string;
          allActions.add(action);
          if (action === "knockback") knockbacks += 1;
          if (action === "advance") advances += 1;
        }
      }
    }
    expect([...allActions]).toEqual(expect.arrayContaining(["advance", "knockback"]));
    expect(advances).toBeGreaterThan(0);
    expect(knockbacks).toBeGreaterThan(0);

    // Grapple repositioning requires the fighters to be in different cells,
    // which mirror matches rarely reach (they converge and stay together). A
    // grappler-vs-spinner match at seed 12 reliably separates them via
    // spinner knockback, so the matrix covers grapple deterministically.
    const grappler = PROFILES.find((p) => p.weapon === "grappler")!;
    const spinner = PROFILES.find((p) => p.weapon === "horizontal_spinner")!;
    let grapples = 0;
    for (const role of [0, 1]) {
      const result = runGridMatch(
        gridConfig(
          12,
          role === 0 ? grappler.build : spinner.build,
          role === 0 ? spinner.build : grappler.build,
        ),
      );
      assertCanonicalZones(result);
      for (const event of result.events) {
        if (event.type === "movement_resolved" && event.data) {
          if (event.data.action === "grapple") grapples += 1;
        }
      }
    }
    expect(grapples).toBeGreaterThan(0);
  });

  it("covers damaged and disabled components", () => {
    const spinner = PROFILES.find((p) => p.weapon === "horizontal_spinner")!;
    const result = runGridMatch(gridConfig(1, spinner.build, spinner.build));
    const damaged = result.events.filter((e) => e.type === "component_damaged");
    const disabled = result.events.filter((e) => e.type === "component_disabled");
    expect(damaged.length).toBeGreaterThan(0);
    expect(disabled.length).toBeGreaterThan(0);
    for (const event of [...damaged, ...disabled]) {
      expect(["mobility", "weapon", "utility"]).toContain(event.data.component);
      expect(["damaged", "disabled"]).toContain(event.data.newState);
    }
  });

  it("covers front, side, rear, diagonal and same-cell planar exposure", () => {
    // front: defender faces north, attacker directly north.
    expect(getRelativeBearing("north", "center", "north")).toBe("front");
    expect(getPlanarExposedArmourZones("front")).toEqual(["front"]);
    // side (right): attacker east of a north-facing defender.
    expect(getRelativeBearing("east", "center", "north")).toBe("right");
    expect(getPlanarExposedArmourZones("right")).toEqual(["right"]);
    // rear: attacker south of a north-facing defender.
    expect(getRelativeBearing("south", "center", "north")).toBe("rear");
    expect(getPlanarExposedArmourZones("rear")).toEqual(["rear"]);
    // diagonal: attacker north_east of a north-facing defender.
    expect(getRelativeBearing("north_east", "center", "north")).toBe("front_right");
    expect(getPlanarExposedArmourZones("front_right")).toEqual(["front", "right"]);
    // same cell.
    expect(getRelativeBearing("center", "center", "north")).toBe("same");
    expect(getPlanarExposedArmourZones("same")).toEqual(["front", "left", "right"]);
  });

  it("never reports a diagonal or out-of-bounds zone in any event", () => {
    for (const profile of PROFILES) {
      const result = runGridMatch(gridConfig(2, profile.build, profile.build));
      for (const event of result.events) {
        if (event.type === "movement_resolved" && event.data) {
          const from = event.data.from as string;
          const to = event.data.to as string;
          const action = event.data.action as string;
          const deltaX = gridDelta(from, to, 0);
          const deltaY = gridDelta(from, to, 1);
          if (
            action === "circle_left" ||
            action === "circle_right" ||
            action === "hold"
          ) {
            // In-place facing changes never translate the fighter.
            expect(deltaX).toBe(0);
            expect(deltaY).toBe(0);
          } else {
            // Advance/retreat/knockback/grapple move exactly one orthogonal
            // step — never diagonally, and never out of bounds (neighbours
            // exclude OOB cells).
            expect(Math.abs(deltaX) + Math.abs(deltaY)).toBe(1);
          }
        }
      }
    }
  });
});

// Coordinate delta between two canonical grid zones for orthogonal-step checks.
function gridDelta(from: string, to: string, axis: 0 | 1): number {
  const coords: Record<string, [number, number]> = {
    north_west: [-1, 1],
    north: [0, 1],
    north_east: [1, 1],
    west: [-1, 0],
    center: [0, 0],
    east: [1, 0],
    south_west: [-1, -1],
    south: [0, -1],
    south_east: [1, -1],
  };
  return (coords[to]![axis] ?? 0) - (coords[from]![axis] ?? 0);
}
