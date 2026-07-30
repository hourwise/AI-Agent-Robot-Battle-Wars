import { describe, expect, it } from "vitest";
import {
  checkComponentQualification,
  makeTestComponentStates,
  selectQualifiedComponentForTransition,
} from "../../src/simulator/component-state.js";
import { SeededRandom } from "../../src/simulator/seeded-random.js";

describe("qualification-before-selection randomness", () => {
  it("does not consume a weighted-selection draw for a non-qualifying hit", () => {
    const rng = new SeededRandom(1);
    let calls = 0;
    rng.weightedPick = <T>(items: readonly T[]): T => {
      calls++;
      return items[0]!;
    };
    const selected = selectQualifiedComponentForTransition(
      checkComponentQualification(false, 0),
      makeTestComponentStates(),
      "front",
      rng,
    );
    expect(selected).toBeNull();
    expect(calls).toBe(0);
  });

  it("consumes one weighted-selection draw after qualification", () => {
    const rng = new SeededRandom(1);
    let calls = 0;
    rng.weightedPick = <T>(items: readonly T[]): T => {
      calls++;
      return items[0]!;
    };
    const selected = selectQualifiedComponentForTransition(
      checkComponentQualification(true, 13),
      makeTestComponentStates(),
      "front",
      rng,
    );
    expect(selected).toBe("mobility");
    expect(calls).toBe(1);
  });
});
