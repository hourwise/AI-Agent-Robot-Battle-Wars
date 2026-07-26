import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { JsonMatchRepository } from "../../src/persistence/json-match-repository.js";
import type { MatchRecord } from "../../src/schemas/match-record.schema.js";

function makeValidRecord(matchId: string): MatchRecord {
  return {
    schemaVersion: "1",
    matchId,
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
        policy: {
          opening: "rush",
          preferredRange: "close",
          aggression: 80,
          primaryTarget: "front",
          secondaryTarget: "front",
          retreatThreshold: 20,
          heatThreshold: 80,
          fallback: "defend",
        },
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
        policy: {
          opening: "rush",
          preferredRange: "close",
          aggression: 80,
          primaryTarget: "front",
          secondaryTarget: "front",
          retreatThreshold: 20,
          heatThreshold: 80,
          fallback: "defend",
        },
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
    result: {
      winner: "fighter_a",
      loser: "fighter_b",
      method: "destruction",
    },
    rounds: 5,
  };
}

describe("JsonMatchRepository", () => {
  let tempDir: string;
  let repo: JsonMatchRepository;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "forge-arena-test-"));
    repo = new JsonMatchRepository(tempDir);
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it("saves and retrieves a match", async () => {
    const record = makeValidRecord("550e8400-e29b-41d4-a716-446655440000");
    await repo.saveMatch(record);
    const retrieved = await repo.getMatch(record.matchId);
    expect(retrieved).not.toBeNull();
    expect(retrieved!.matchId).toBe(record.matchId);
  });

  it("returns null for non-existent match", async () => {
    const retrieved = await repo.getMatch("550e8400-e29b-41d4-a716-446655440000");
    expect(retrieved).toBeNull();
  });

  it("lists saved matches", async () => {
    const record1 = makeValidRecord("550e8400-e29b-41d4-a716-446655440001");
    const record2 = makeValidRecord("550e8400-e29b-41d4-a716-446655440002");
    await repo.saveMatch(record1);
    await repo.saveMatch(record2);
    const matches = await repo.listMatches();
    expect(matches.length).toBe(2);
    expect(matches.map((m) => m.matchId)).toContain(record1.matchId);
    expect(matches.map((m) => m.matchId)).toContain(record2.matchId);
  });

  it("does not overwrite existing match", async () => {
    const record = makeValidRecord("550e8400-e29b-41d4-a716-446655440000");
    await repo.saveMatch(record);
    const modified = { ...record, seed: 100 };
    await expect(repo.saveMatch(modified)).rejects.toThrow("already exists");
    const retrieved = await repo.getMatch(record.matchId);
    expect(retrieved!.seed).toBe(42);
  });

  it("rejects non-UUID match IDs", async () => {
    const record = makeValidRecord("not-a-valid-uuid");
    await expect(repo.saveMatch(record)).rejects.toThrow("Invalid match ID");
  });

  it("returns null for non-UUID getMatch", async () => {
    const result = await repo.getMatch("not-a-uuid");
    expect(result).toBeNull();
  });

  it("tracks corrupt entries", async () => {
    const validRecord = makeValidRecord("550e8400-e29b-41d4-a716-446655440001");
    await repo.saveMatch(validRecord);

    const { writeFile } = await import("node:fs/promises");
    await writeFile(join(tempDir, "corrupt.json"), "{invalid json}", "utf-8");
    await writeFile(join(tempDir, "bad-uuid.json"), "not json", "utf-8");

    const matches = await repo.listMatches();
    expect(matches.length).toBe(1);

    const corrupt = await repo.listCorruptEntries();
    expect(corrupt.length).toBeGreaterThanOrEqual(1);
  });

  it("skips temp files during listing", async () => {
    const { writeFile } = await import("node:fs/promises");
    await writeFile(join(tempDir, "test.tmp.123.json"), "{}", "utf-8");

    const matches = await repo.listMatches();
    expect(matches.length).toBe(0);
  });
});
