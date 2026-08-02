import { describe, expect, it } from "vitest";
import {
  adaptGridCanaryPolicy,
  GRID_SERIES_CANARY_ADAPTATION_RULE_VERSION,
  type GridSeriesCanaryAdaptationInput,
} from "../../src/canary/grid-series-canary-adaptation.js";
import type { ActionPolicy } from "../../src/simulator/types.js";

const CURRENT: ActionPolicy = {
  opening: "flank",
  preferredRange: "medium",
  aggression: 100,
  primaryTarget: "rear",
  secondaryTarget: "rear",
  retreatThreshold: 20,
  heatThreshold: 80,
  fallback: "defend",
};

function report(overrides: {
  own: number;
  opponent: number;
  winner: string | null;
  method?: string;
  rounds?: number;
  ownMobilityDisabled?: boolean;
  ownConditions?: string[];
}) {
  return {
    winner: overrides.winner,
    resultMethod: overrides.method ?? "judges",
    rounds: overrides.rounds ?? 20,
    finalStates: {
      fighterA: {
        integrity: overrides.own,
        mobilityDisabled: overrides.ownMobilityDisabled ?? false,
        conditions: overrides.ownConditions ?? [],
      },
      fighterB: { integrity: overrides.opponent },
    },
  } as never;
}

function review(overrides: {
  own: number;
  opponent: number;
  winner: string | null;
  method?: string;
  rounds?: number;
}) {
  return {
    observedOutcome: {
      winnerId: overrides.winner,
      method: overrides.method ?? "judges",
      rounds: overrides.rounds ?? 20,
      ownFinalIntegrity: overrides.own,
      opponentFinalIntegrity: overrides.opponent,
    },
  } as never;
}

function input(overrides: {
  matchNumber: 1 | 2;
  own: number;
  opponent: number;
  winner: string | null;
  ownMobilityDisabled?: boolean;
  ownConditions?: string[];
}): GridSeriesCanaryAdaptationInput {
  const factualReport = report({
    own: overrides.own,
    opponent: overrides.opponent,
    winner: overrides.winner,
    ownMobilityDisabled: overrides.ownMobilityDisabled,
    ownConditions: overrides.ownConditions,
  });
  return {
    matchNumber: overrides.matchNumber,
    sourceMatchId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    sourceSeed: 3,
    currentPolicy: { ...CURRENT },
    factualReport,
    fallbackReview: review({
      own: overrides.own,
      opponent: overrides.opponent,
      winner: overrides.winner,
    }),
  };
}

describe("grid series canary policy adaptation (Phase 3D2B)", () => {
  it("freezes the adaptation rule version", () => {
    expect(GRID_SERIES_CANARY_ADAPTATION_RULE_VERSION).toBe(
      "grid-canary-policy-adaptation-v1",
    );
  });

  it("match 1 ahead: aggression 80, opening flank (stable)", () => {
    const adaptation = adaptGridCanaryPolicy(
      input({ matchNumber: 1, own: 90, opponent: 80, winner: "fighter_a" }),
    );
    expect(adaptation.policyAfter.aggression).toBe(80);
    expect(adaptation.policyAfter.opening).toBe("flank");
    expect(adaptation.decision.integrityComparison).toBe("ahead_or_equal");
    expect(adaptation.decision.openingReason).toBe("stable");
    expect(adaptation.decision.aggressionBefore).toBe(100);
    expect(adaptation.decision.aggressionAfter).toBe(80);
  });

  it("match 1 behind: aggression 70, opening cautious", () => {
    const adaptation = adaptGridCanaryPolicy(
      input({ matchNumber: 1, own: 70, opponent: 90, winner: "fighter_b" }),
    );
    expect(adaptation.policyAfter.aggression).toBe(70);
    expect(adaptation.policyAfter.opening).toBe("cautious");
    expect(adaptation.decision.integrityComparison).toBe("behind");
    expect(adaptation.decision.openingReason).toBe("behind");
  });

  it("match 2 ahead: aggression 60, opening flank", () => {
    const adaptation = adaptGridCanaryPolicy(
      input({ matchNumber: 2, own: 95, opponent: 60, winner: "fighter_a" }),
    );
    expect(adaptation.policyAfter.aggression).toBe(60);
    expect(adaptation.policyAfter.opening).toBe("flank");
  });

  it("match 2 behind: aggression 90, opening cautious", () => {
    const adaptation = adaptGridCanaryPolicy(
      input({ matchNumber: 2, own: 40, opponent: 100, winner: "fighter_b" }),
    );
    expect(adaptation.policyAfter.aggression).toBe(90);
    expect(adaptation.policyAfter.opening).toBe("cautious");
  });

  it("ahead with equal integrity counts as ahead_or_equal", () => {
    const adaptation = adaptGridCanaryPolicy(
      input({ matchNumber: 1, own: 80, opponent: 80, winner: null }),
    );
    expect(adaptation.decision.integrityComparison).toBe("ahead_or_equal");
    expect(adaptation.policyAfter.aggression).toBe(80);
    expect(adaptation.policyAfter.opening).toBe("flank");
  });

  it("impaired (mobility disabled) forces hold regardless of comparison", () => {
    const adaptation = adaptGridCanaryPolicy(
      input({
        matchNumber: 1,
        own: 95,
        opponent: 60,
        winner: "fighter_a",
        ownMobilityDisabled: true,
      }),
    );
    expect(adaptation.policyAfter.opening).toBe("hold");
    expect(adaptation.decision.openingReason).toBe("impaired");
    expect(adaptation.policyAfter.aggression).toBe(80);
  });

  it("impaired (immobilised/overturned condition) forces hold", () => {
    for (const condition of ["immobilised", "overturned"]) {
      const adaptation = adaptGridCanaryPolicy(
        input({
          matchNumber: 2,
          own: 95,
          opponent: 60,
          winner: "fighter_a",
          ownConditions: [condition],
        }),
      );
      expect(adaptation.policyAfter.opening).toBe("hold");
      expect(adaptation.decision.openingReason).toBe("impaired");
    }
  });

  it("preserves untouched policy fields", () => {
    const adaptation = adaptGridCanaryPolicy(
      input({ matchNumber: 2, own: 40, opponent: 100, winner: "fighter_b" }),
    );
    expect(adaptation.policyAfter.preferredRange).toBe("medium");
    expect(adaptation.policyAfter.primaryTarget).toBe("rear");
    expect(adaptation.policyAfter.secondaryTarget).toBe("rear");
    expect(adaptation.policyAfter.retreatThreshold).toBe(20);
    expect(adaptation.policyAfter.heatThreshold).toBe(80);
    expect(adaptation.policyAfter.fallback).toBe("defend");
  });

  it("never mutates the current policy", () => {
    const original = JSON.stringify(CURRENT);
    adaptGridCanaryPolicy(
      input({ matchNumber: 1, own: 90, opponent: 80, winner: "fighter_a" }),
    );
    expect(JSON.stringify(CURRENT)).toBe(original);
  });

  it("records authoritative facts and structured decision", () => {
    const adaptation = adaptGridCanaryPolicy(
      input({ matchNumber: 1, own: 70, opponent: 90, winner: "fighter_b" }),
    );
    expect(adaptation.sourceMatchNumber).toBe(1);
    expect(adaptation.sourceMatchId).toBe("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
    expect(adaptation.sourceSeed).toBe(3);
    expect(adaptation.authoritativeFacts).toEqual({
      winner: "fighter_b",
      resultMethod: "judges",
      rounds: 20,
      ownFinalIntegrity: 70,
      opponentFinalIntegrity: 90,
      ownMobilityDisabled: false,
      ownConditions: [],
    });
    expect(adaptation.decision.aggressionBefore).toBe(100);
  });

  it("throws when the fallback review disagrees with the report", () => {
    const bad = input({ matchNumber: 1, own: 90, opponent: 80, winner: "fighter_a" });
    const disagreeing = {
      ...bad,
      fallbackReview: review({ own: 90, opponent: 80, winner: "fighter_b" }),
    };
    expect(() => adaptGridCanaryPolicy(disagreeing)).toThrow(/does not agree/);
  });

  it("throws for a review method/rounds/integrity disagreement", () => {
    const bad = input({ matchNumber: 1, own: 90, opponent: 80, winner: "fighter_a" });
    expect(() =>
      adaptGridCanaryPolicy({
        ...bad,
        fallbackReview: review({
          own: 90,
          opponent: 80,
          winner: "fighter_a",
          method: "destruction",
        }),
      }),
    ).toThrow(/method/);
    expect(() =>
      adaptGridCanaryPolicy({
        ...bad,
        fallbackReview: review({
          own: 90,
          opponent: 80,
          winner: "fighter_a",
          rounds: 19,
        }),
      }),
    ).toThrow(/rounds/);
    expect(() =>
      adaptGridCanaryPolicy({
        ...bad,
        fallbackReview: review({ own: 60, opponent: 80, winner: "fighter_a" }),
      }),
    ).toThrow(/integrity/);
  });

  it("rejects adaptation after match 3", () => {
    expect(() =>
      adaptGridCanaryPolicy(
        input({ matchNumber: 1, own: 90, opponent: 80, winner: "fighter_a" }) as never,
      ),
    ).not.toThrow();
    expect(() =>
      adaptGridCanaryPolicy({
        ...input({ matchNumber: 1, own: 90, opponent: 80, winner: "fighter_a" }),
        matchNumber: 3,
      }),
    ).toThrow(/only runs after series matches 1 and 2/);
  });
});
