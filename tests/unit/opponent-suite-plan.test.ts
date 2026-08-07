import { describe, expect, it } from "vitest";
import {
  OPPONENT_SUITE_V1_LEGACY_PLAN,
  type OpponentSuitePlanEntryV1,
} from "../../src/opponents/opponent-suite-runner.js";
import {
  OPPONENT_SUITE_V1_INCOMPATIBLE_OPPONENT_IDS,
  OPPONENT_SUITE_V1_RUNNABLE_OPPONENT_IDS,
} from "../../src/opponents/opponent-suite-v1.js";

/**
 * Milestone 0.2D Phase 4 — exact legacy matchup plan v1.
 *
 * Four legacy-runnable fixtures; two legacy-incompatible fixtures visible
 * but never executed; exactly 12 ordered role-aware matchups per seed; no
 * self matches; every unordered pair occurs exactly twice with the second
 * occurrence being the reverse role assignment; no grid execution path.
 */

const EXPECTED_PLAN: ReadonlyArray<{ a: string; b: string }> = [
  { a: "bulwark", b: "crusher" },
  { a: "bulwark", b: "spinner" },
  { a: "bulwark", b: "generalist" },
  { a: "crusher", b: "bulwark" },
  { a: "crusher", b: "spinner" },
  { a: "crusher", b: "generalist" },
  { a: "spinner", b: "bulwark" },
  { a: "spinner", b: "crusher" },
  { a: "spinner", b: "generalist" },
  { a: "generalist", b: "bulwark" },
  { a: "generalist", b: "crusher" },
  { a: "generalist", b: "spinner" },
];

describe("opponent suite legacy matchup plan v1 (0.2D Phase 4)", () => {
  it("classifies exactly four runnable and two incompatible fixtures", () => {
    expect([...OPPONENT_SUITE_V1_RUNNABLE_OPPONENT_IDS]).toEqual([
      "bulwark",
      "crusher",
      "spinner",
      "generalist",
    ]);
    expect([...OPPONENT_SUITE_V1_INCOMPATIBLE_OPPONENT_IDS]).toEqual([
      "skirmisher",
      "controller",
    ]);
  });

  it("freezes the exact 12-entry ordered plan", () => {
    expect(OPPONENT_SUITE_V1_LEGACY_PLAN.length).toBe(12);
    const actual = OPPONENT_SUITE_V1_LEGACY_PLAN.map((e) => ({
      a: e.fighterA,
      b: e.fighterB,
    }));
    expect(actual).toEqual(EXPECTED_PLAN);
    for (let i = 0; i < OPPONENT_SUITE_V1_LEGACY_PLAN.length; i++) {
      expect(OPPONENT_SUITE_V1_LEGACY_PLAN[i]!.planIndex).toBe(i + 1);
    }
  });

  it("contains no self matches", () => {
    for (const entry of OPPONENT_SUITE_V1_LEGACY_PLAN) {
      expect(entry.fighterA).not.toBe(entry.fighterB);
    }
  });

  it("contains every unordered pair exactly twice with the reverse role assignment second", () => {
    const pairs = new Map<string, { a: string; b: string }[]>();
    for (const entry of OPPONENT_SUITE_V1_LEGACY_PLAN) {
      const key = [entry.fighterA, entry.fighterB].sort().join("|");
      const list = pairs.get(key) ?? [];
      list.push({ a: entry.fighterA, b: entry.fighterB });
      pairs.set(key, list);
    }
    expect(pairs.size).toBe(6); // C(4,2) = 6 unordered pairs
    for (const [key, list] of pairs) {
      expect(list.length, key).toBe(2);
      const [first, second] = list;
      expect(first!.a).not.toBe(first!.b);
      expect(second!.a).toBe(first!.b);
      expect(second!.b).toBe(first!.a);
    }
  });

  it("never executes the two incompatible fixtures (absent from every plan slot)", () => {
    for (const entry of OPPONENT_SUITE_V1_LEGACY_PLAN) {
      expect(OPPONENT_SUITE_V1_INCOMPATIBLE_OPPONENT_IDS).not.toContain(entry.fighterA);
      expect(OPPONENT_SUITE_V1_INCOMPATIBLE_OPPONENT_IDS).not.toContain(entry.fighterB);
    }
  });

  it("contains no grid execution path in the plan surface", () => {
    expect(Object.isFrozen(OPPONENT_SUITE_V1_LEGACY_PLAN)).toBe(true);
    for (const entry of OPPONENT_SUITE_V1_LEGACY_PLAN as readonly OpponentSuitePlanEntryV1[]) {
      expect(Object.isFrozen(entry)).toBe(true);
      expect(entry.fighterA).toMatch(/^[a-z0-9_-]+$/);
      expect(entry.fighterB).toMatch(/^[a-z0-9_-]+$/);
    }
  });
});
