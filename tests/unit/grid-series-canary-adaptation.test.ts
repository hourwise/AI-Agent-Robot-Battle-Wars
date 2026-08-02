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

interface ReportOverrides {
  own: number;
  opponent: number;
  winner: string | null;
  method?: string;
  rounds?: number;
  ownMobilityDisabled?: boolean;
  ownWeaponDisabled?: boolean;
  ownUtilityDisabled?: boolean;
  opponentMobilityDisabled?: boolean;
  opponentWeaponDisabled?: boolean;
  opponentUtilityDisabled?: boolean;
  ownConditions?: string[];
}

function report(overrides: ReportOverrides) {
  return {
    winner: overrides.winner,
    resultMethod: overrides.method ?? "judges",
    rounds: overrides.rounds ?? 20,
    finalStates: {
      fighterA: {
        integrity: overrides.own,
        mobilityDisabled: overrides.ownMobilityDisabled ?? false,
        weaponDisabled: overrides.ownWeaponDisabled ?? false,
        utilityDisabled: overrides.ownUtilityDisabled ?? false,
        conditions: overrides.ownConditions ?? [],
      },
      fighterB: {
        integrity: overrides.opponent,
        mobilityDisabled: overrides.opponentMobilityDisabled ?? false,
        weaponDisabled: overrides.opponentWeaponDisabled ?? false,
        utilityDisabled: overrides.opponentUtilityDisabled ?? false,
      },
    },
  } as never;
}

/** Canonical disabled-component list: mobility, weapon, utility. */
function canonicalDisabled(m: boolean, w: boolean, u: boolean): string[] {
  const result: string[] = [];
  if (m) result.push("mobility");
  if (w) result.push("weapon");
  if (u) result.push("utility");
  return result;
}

/** Builds a review whose observed outcome agrees with the report. */
function reviewFrom(reportValue: ReturnType<typeof report>) {
  const fighterA = reportValue.finalStates.fighterA as {
    integrity: number;
    mobilityDisabled: boolean;
    weaponDisabled: boolean;
    utilityDisabled: boolean;
  };
  const fighterB = reportValue.finalStates.fighterB as {
    integrity: number;
    mobilityDisabled: boolean;
    weaponDisabled: boolean;
    utilityDisabled: boolean;
  };
  return {
    observedOutcome: {
      winnerId: reportValue.winner,
      method: reportValue.resultMethod,
      rounds: reportValue.rounds,
      ownFinalIntegrity: fighterA.integrity,
      opponentFinalIntegrity: fighterB.integrity,
      ownDisabledComponents: canonicalDisabled(
        fighterA.mobilityDisabled,
        fighterA.weaponDisabled,
        fighterA.utilityDisabled,
      ),
      opponentDisabledComponents: canonicalDisabled(
        fighterB.mobilityDisabled,
        fighterB.weaponDisabled,
        fighterB.utilityDisabled,
      ),
    },
  } as never;
}

function input(
  overrides: ReportOverrides & { matchNumber: 1 | 2 },
  fallbackReview?: ReturnType<typeof reviewFrom>,
): GridSeriesCanaryAdaptationInput {
  const factualReport = report(overrides);
  return {
    matchNumber: overrides.matchNumber,
    sourceMatchId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    sourceSeed: 3,
    currentPolicy: { ...CURRENT },
    factualReport,
    fallbackReview: fallbackReview ?? reviewFrom(factualReport),
  };
}

/** Builds a review with explicit disabled-component lists (for agreement failures). */
function reviewWithDisabled(overrides: {
  own: number;
  opponent: number;
  winner: string | null;
  ownDisabled?: string[];
  opponentDisabled?: string[];
}) {
  return {
    observedOutcome: {
      winnerId: overrides.winner,
      method: "judges",
      rounds: 20,
      ownFinalIntegrity: overrides.own,
      opponentFinalIntegrity: overrides.opponent,
      ownDisabledComponents: overrides.ownDisabled ?? [],
      opponentDisabledComponents: overrides.opponentDisabled ?? [],
    },
  } as never;
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
      fallbackReview: reviewFrom(report({ own: 90, opponent: 80, winner: "fighter_b" })),
    };
    expect(() => adaptGridCanaryPolicy(disagreeing)).toThrow(/does not completely agree/);
  });

  it("throws for a review method/rounds/integrity disagreement", () => {
    const bad = input({ matchNumber: 1, own: 90, opponent: 80, winner: "fighter_a" });
    expect(() =>
      adaptGridCanaryPolicy({
        ...bad,
        fallbackReview: reviewFrom(
          report({ own: 90, opponent: 80, winner: "fighter_a", method: "destruction" }),
        ),
      }),
    ).toThrow(/method/);
    expect(() =>
      adaptGridCanaryPolicy({
        ...bad,
        fallbackReview: reviewFrom(
          report({ own: 90, opponent: 80, winner: "fighter_a", rounds: 19 }),
        ),
      }),
    ).toThrow(/rounds/);
    expect(() =>
      adaptGridCanaryPolicy({
        ...bad,
        fallbackReview: reviewFrom(
          report({ own: 60, opponent: 80, winner: "fighter_a" }),
        ),
      }),
    ).toThrow(/integrity/);
  });

  it("rejects adaptation after match 3", () => {
    expect(() =>
      adaptGridCanaryPolicy(
        input({ matchNumber: 1, own: 90, opponent: 80, winner: "fighter_a" }),
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

describe("grid series canary adaptation disabled-component agreement (Phase 3D2B.1)", () => {
  it("rejects a review missing mobility while the report has mobility disabled", () => {
    const bad = input({
      matchNumber: 1,
      own: 90,
      opponent: 80,
      winner: "fighter_a",
      ownMobilityDisabled: true,
    });
    const missing = {
      ...bad,
      fallbackReview: reviewWithDisabled({
        own: 90,
        opponent: 80,
        winner: "fighter_a",
        ownDisabled: [],
      }),
    };
    expect(() => adaptGridCanaryPolicy(missing)).toThrow(/ownDisabledComponents/);
  });

  it("rejects a review adding a disabled component absent from the report", () => {
    const bad = input({ matchNumber: 1, own: 90, opponent: 80, winner: "fighter_a" });
    const extra = {
      ...bad,
      fallbackReview: reviewWithDisabled({
        own: 90,
        opponent: 80,
        winner: "fighter_a",
        ownDisabled: ["weapon"],
      }),
    };
    expect(() => adaptGridCanaryPolicy(extra)).toThrow(/ownDisabledComponents/);
  });

  it("rejects an opponent disabled-list disagreement", () => {
    const bad = input({
      matchNumber: 1,
      own: 90,
      opponent: 80,
      winner: "fighter_a",
      opponentMobilityDisabled: true,
    });
    const wrongOpponent = {
      ...bad,
      fallbackReview: reviewWithDisabled({
        own: 90,
        opponent: 80,
        winner: "fighter_a",
        opponentDisabled: [],
      }),
    };
    expect(() => adaptGridCanaryPolicy(wrongOpponent)).toThrow(
      /opponentDisabledComponents/,
    );
  });

  it("rejects a reordered canonical disabled list", () => {
    const bad = input({
      matchNumber: 1,
      own: 90,
      opponent: 80,
      winner: "fighter_a",
      ownMobilityDisabled: true,
      ownWeaponDisabled: true,
    });
    const reordered = {
      ...bad,
      fallbackReview: reviewWithDisabled({
        own: 90,
        opponent: 80,
        winner: "fighter_a",
        ownDisabled: ["weapon", "mobility"],
      }),
    };
    expect(() => adaptGridCanaryPolicy(reordered)).toThrow(/ownDisabledComponents/);
  });

  it("rejects a duplicate disabled component in the review", () => {
    const bad = input({
      matchNumber: 1,
      own: 90,
      opponent: 80,
      winner: "fighter_a",
      ownMobilityDisabled: true,
    });
    const duplicate = {
      ...bad,
      fallbackReview: reviewWithDisabled({
        own: 90,
        opponent: 80,
        winner: "fighter_a",
        ownDisabled: ["mobility", "mobility"],
      }),
    };
    expect(() => adaptGridCanaryPolicy(duplicate)).toThrow(/ownDisabledComponents/);
  });

  it("performs no policy decision after an agreement failure", () => {
    const bad = input({ matchNumber: 1, own: 90, opponent: 80, winner: "fighter_a" });
    const before = JSON.stringify(bad.currentPolicy);
    const disagreeing = {
      ...bad,
      fallbackReview: reviewWithDisabled({
        own: 90,
        opponent: 80,
        winner: "fighter_a",
        ownDisabled: ["weapon"],
      }),
    };
    expect(() => adaptGridCanaryPolicy(disagreeing)).toThrow();
    // The current policy is untouched and no decision was produced.
    expect(JSON.stringify(bad.currentPolicy)).toBe(before);
  });
});
