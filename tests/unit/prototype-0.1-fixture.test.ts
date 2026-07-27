import { describe, it, expect } from "vitest";
import fixture from "../fixtures/prototype-0.1-canonical-series-summary.json";

describe("Prototype 0.1 canonical series fixture", () => {
  it("has the correct series ID", () => {
    expect(fixture.seriesId).toBe("16eae0af-9ca5-4c63-acb1-aee54f41ee58");
  });

  it("records the correct score: AI 3, Bulwark 1", () => {
    expect(fixture.score.aiWins).toBe(3);
    expect(fixture.score.bulwarkWins).toBe(1);
    expect(fixture.score.draws).toBe(0);
    expect(fixture.winner).toBe("ai");
  });

  it("has exactly 4 match entries", () => {
    expect(fixture.entries).toHaveLength(4);
  });

  it("records the authoritative seeds", () => {
    expect(fixture.entries[0]!.seed).toBe(299736961);
    expect(fixture.entries[1]!.seed).toBe(386253148);
    expect(fixture.entries[2]!.seed).toBe(856602425);
    expect(fixture.entries[3]!.seed).toBe(337707035);
  });

  it("records correct match outcomes", () => {
    // Match 1: Bulwark wins by immobilisation, round 4
    expect(fixture.entries[0]!.winner).toBe("fighter_b");
    expect(fixture.entries[0]!.method).toBe("immobilisation");
    expect(fixture.entries[0]!.rounds).toBe(4);
    expect(fixture.entries[0]!.finalIntegrity.ai).toBe(96);
    expect(fixture.entries[0]!.finalIntegrity.bulwark).toBe(150);

    // Match 2: AI wins by immobilisation, round 1
    expect(fixture.entries[1]!.winner).toBe("fighter_a");
    expect(fixture.entries[1]!.method).toBe("immobilisation");
    expect(fixture.entries[1]!.rounds).toBe(1);
    expect(fixture.entries[1]!.finalIntegrity.ai).toBe(100);
    expect(fixture.entries[1]!.finalIntegrity.bulwark).toBe(107);

    // Match 3: AI wins by immobilisation, round 7
    expect(fixture.entries[2]!.winner).toBe("fighter_a");
    expect(fixture.entries[2]!.method).toBe("immobilisation");
    expect(fixture.entries[2]!.rounds).toBe(7);
    expect(fixture.entries[2]!.finalIntegrity.ai).toBe(147);
    expect(fixture.entries[2]!.finalIntegrity.bulwark).toBe(116);

    // Match 4: AI wins by immobilisation, round 13
    expect(fixture.entries[3]!.winner).toBe("fighter_a");
    expect(fixture.entries[3]!.method).toBe("immobilisation");
    expect(fixture.entries[3]!.rounds).toBe(13);
    expect(fixture.entries[3]!.finalIntegrity.ai).toBe(144);
    expect(fixture.entries[3]!.finalIntegrity.bulwark).toBe(35);
  });

  it("records the adaptation sequence correctly", () => {
    // Match 1 → 2: front armour 30→40, secondary right→left
    expect(fixture.entries[0]!.design.armour.front).toBe(30);
    expect(fixture.entries[1]!.design.armour.front).toBe(40);
    expect(fixture.entries[0]!.policy.secondaryTarget).toBe("right");
    expect(fixture.entries[1]!.policy.secondaryTarget).toBe("left");

    // Match 2 → 3: medium→heavy, cooling→none, rear 10→20, top 10→0, heat 70→80
    expect(fixture.entries[1]!.design.chassisId).toBe("medium");
    expect(fixture.entries[2]!.design.chassisId).toBe("heavy");
    expect(fixture.entries[1]!.design.utilityId).toBe("cooling");
    expect(fixture.entries[2]!.design.utilityId).toBe("none");
    expect(fixture.entries[1]!.design.armour.rear).toBe(10);
    expect(fixture.entries[2]!.design.armour.rear).toBe(20);
    expect(fixture.entries[1]!.design.armour.top).toBe(10);
    expect(fixture.entries[2]!.design.armour.top).toBe(0);
    expect(fixture.entries[1]!.policy.heatThreshold).toBe(70);
    expect(fixture.entries[2]!.policy.heatThreshold).toBe(80);

    // Match 3 → 4: front armour 40→30
    expect(fixture.entries[2]!.design.armour.front).toBe(40);
    expect(fixture.entries[3]!.design.armour.front).toBe(30);
  });

  it("records design evolution names", () => {
    expect(fixture.entries[0]!.design.machineName).toBe("Backstabber");
    expect(fixture.entries[1]!.design.machineName).toBe("Backstabber v2");
    expect(fixture.entries[2]!.design.machineName).toBe("The Bulwark v2");
    expect(fixture.entries[3]!.design.machineName).toBe("The Bulwark v3");
  });

  it("records consistent API usage", () => {
    expect(fixture.totalApiCalls).toBe(12);
    expect(fixture.totalInputTokens).toBe(22626);
    expect(fixture.totalOutputTokens).toBe(7551);
    expect(fixture.estimatedCostUsd).toBeCloseTo(0.0082, 4);
  });

  it("records version baseline", () => {
    expect(fixture.simulatorVersion).toBe("0.1.2");
    expect(fixture.rulesetVersion).toBe("0.1.0");
    expect(fixture.catalogueVersion).toBe("1");
  });

  it("contains no sensitive provider metadata", () => {
    const json = JSON.stringify(fixture);
    expect(json).not.toContain("apiKey");
    expect(json).not.toContain("DEEPSEEK");
    expect(json).not.toContain("Authorization");
    expect(json).not.toContain("Bearer");
    expect(json).not.toContain("requestHeaders");
    expect(json).not.toContain("account");
  });

  it("records the source commit SHA", () => {
    expect(fixture.sourceCommitSha).toBe("9f9806562f45c994710821dae1e1b63a17d7ecc9");
  });
});
