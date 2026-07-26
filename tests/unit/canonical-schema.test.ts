import { describe, it, expect } from "vitest";
import { actionPolicySchema as canonicalPolicySchema } from "../../src/schemas/policy.schema.js";
import { MatchRecordSchema } from "../../src/schemas/match-record.schema.js";

describe("canonical policy schema", () => {
  const validPolicy = {
    opening: "flank",
    preferredRange: "close",
    aggression: 70,
    primaryTarget: "rear",
    secondaryTarget: "left",
    retreatThreshold: 30,
    heatThreshold: 80,
    fallback: "retreat",
  };

  it("canonical policy schema validates a valid policy", () => {
    const result = canonicalPolicySchema.safeParse(validPolicy);
    expect(result.success).toBe(true);
  });

  it("MatchRecord policy field uses identical validation", () => {
    const matchRecord = {
      schemaVersion: "1",
      matchId: "550e8400-e29b-41d4-a716-446655440000",
      createdAt: "2026-07-26T12:00:00.000Z",
      rulesetVersion: "1",
      catalogueVersion: "1",
      simulatorVersion: "0.1.0",
      seed: 42,
      config: {
        seed: 42,
        rulesetVersion: "1",
        catalogueVersion: "1",
        fighterA: {
          build: {
            proposal: {
              machineName: "Test",
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
          policy: validPolicy,
        },
        fighterB: {
          build: {
            proposal: {
              machineName: "Opponent",
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
          policy: validPolicy,
        },
      },
      initialState: {
        fighterA: {
          fighterId: "fighter_a",
          build: {
            proposal: {
              machineName: "Test",
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
          zone: "south_edge",
          facing: "north",
          weaponCooldown: 0,
          utilityCooldown: 0,
          armour: { front: 10, left: 5, right: 5, rear: 0, top: 0 },
          components: {
            mobilityDisabled: false,
            weaponDisabled: false,
            utilityDisabled: false,
          },
          conditions: [],
        },
        fighterB: {
          fighterId: "fighter_b",
          build: {
            proposal: {
              machineName: "Opponent",
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
          zone: "north_edge",
          facing: "south",
          weaponCooldown: 0,
          utilityCooldown: 0,
          armour: { front: 10, left: 5, right: 5, rear: 0, top: 0 },
          components: {
            mobilityDisabled: false,
            weaponDisabled: false,
            utilityDisabled: false,
          },
          conditions: [],
        },
      },
      events: [],
      result: { winner: null, loser: null, method: "draw" },
      rounds: 0,
    };

    const result = MatchRecordSchema.safeParse(matchRecord);
    expect(result.success).toBe(true);
  });

  it("rejects invalid aggression in canonical schema", () => {
    const result = canonicalPolicySchema.safeParse({
      ...validPolicy,
      aggression: 150,
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid aggression via MatchRecord", () => {
    const matchRecord = {
      schemaVersion: "1",
      matchId: "550e8400-e29b-41d4-a716-446655440000",
      createdAt: "2026-07-26T12:00:00.000Z",
      rulesetVersion: "1",
      catalogueVersion: "1",
      simulatorVersion: "0.1.0",
      seed: 42,
      config: {
        seed: 42,
        rulesetVersion: "1",
        catalogueVersion: "1",
        fighterA: {
          build: {
            proposal: {
              machineName: "Test",
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
          policy: { ...validPolicy, aggression: 150 },
        },
        fighterB: {
          build: {
            proposal: {
              machineName: "Opponent",
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
          policy: validPolicy,
        },
      },
      initialState: {
        fighterA: {
          fighterId: "fighter_a",
          build: {
            proposal: {
              machineName: "Test",
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
          zone: "south_edge",
          facing: "north",
          weaponCooldown: 0,
          utilityCooldown: 0,
          armour: { front: 10, left: 5, right: 5, rear: 0, top: 0 },
          components: {
            mobilityDisabled: false,
            weaponDisabled: false,
            utilityDisabled: false,
          },
          conditions: [],
        },
        fighterB: {
          fighterId: "fighter_b",
          build: {
            proposal: {
              machineName: "Opponent",
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
          zone: "north_edge",
          facing: "south",
          weaponCooldown: 0,
          utilityCooldown: 0,
          armour: { front: 10, left: 5, right: 5, rear: 0, top: 0 },
          components: {
            mobilityDisabled: false,
            weaponDisabled: false,
            utilityDisabled: false,
          },
          conditions: [],
        },
      },
      events: [],
      result: { winner: null, loser: null, method: "draw" },
      rounds: 0,
    };

    const result = MatchRecordSchema.safeParse(matchRecord);
    expect(result.success).toBe(false);
  });
});
