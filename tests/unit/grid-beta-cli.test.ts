import { describe, expect, it } from "vitest";
import { parseGridBetaMatchArgs } from "../../src/app/run-grid-beta-match.js";
import { parseGridBetaReplayArgs } from "../../src/app/replay-grid-beta-match.js";

describe("grid beta match CLI (Phase 3G Phase 4)", () => {
  it("parses a valid explicit invocation", () => {
    const parsed = parseGridBetaMatchArgs([
      "--seed",
      "12345",
      "--fighter-a",
      "alpha",
      "--fighter-b",
      "beta",
      "--acknowledge-grid-beta",
    ]);
    expect(parsed).toEqual({
      seed: 12345,
      fighterA: "alpha",
      fighterB: "beta",
      acknowledgement: true,
    });
  });

  it("rejects a missing acknowledgement before any match activity", () => {
    expect(() =>
      parseGridBetaMatchArgs([
        "--seed",
        "1",
        "--fighter-a",
        "alpha",
        "--fighter-b",
        "beta",
      ]),
    ).toThrow(/acknowledge-grid-beta is required/);
  });

  it("rejects every missing required argument", () => {
    expect(() =>
      parseGridBetaMatchArgs([
        "--fighter-a",
        "alpha",
        "--fighter-b",
        "beta",
        "--acknowledge-grid-beta",
      ]),
    ).toThrow(/--seed is required/);
    expect(() =>
      parseGridBetaMatchArgs([
        "--seed",
        "1",
        "--fighter-b",
        "beta",
        "--acknowledge-grid-beta",
      ]),
    ).toThrow(/--fighter-a is required/);
    expect(() =>
      parseGridBetaMatchArgs([
        "--seed",
        "1",
        "--fighter-a",
        "alpha",
        "--acknowledge-grid-beta",
      ]),
    ).toThrow(/--fighter-b is required/);
  });

  it("has no --runtime argument and no provider/output/alternate arguments", () => {
    expect(() =>
      parseGridBetaMatchArgs([
        "--seed",
        "1",
        "--fighter-a",
        "a",
        "--fighter-b",
        "b",
        "--acknowledge-grid-beta",
        "--runtime",
        "grid",
      ]),
    ).toThrow(/no --runtime argument/);
    for (const arg of [
      "--provider",
      "deepseek",
      "--output",
      "/tmp/x",
      "--model",
      "x",
      "--force",
      "--partition",
      "all",
    ]) {
      expect(
        () =>
          parseGridBetaMatchArgs([
            "--seed",
            "1",
            "--fighter-a",
            "a",
            "--fighter-b",
            "b",
            "--acknowledge-grid-beta",
            arg,
          ]),
        arg,
      ).toThrow(/unknown argument/);
    }
  });

  it("rejects unknown and duplicate arguments", () => {
    expect(() =>
      parseGridBetaMatchArgs([
        "--seed",
        "1",
        "--fighter-a",
        "a",
        "--fighter-b",
        "b",
        "--acknowledge-grid-beta",
        "extra",
      ]),
    ).toThrow(/unknown argument/);
    expect(() =>
      parseGridBetaMatchArgs([
        "--seed",
        "1",
        "--seed",
        "2",
        "--fighter-a",
        "a",
        "--fighter-b",
        "b",
        "--acknowledge-grid-beta",
      ]),
    ).toThrow(/duplicate argument/);
    expect(() =>
      parseGridBetaMatchArgs([
        "--seed",
        "1",
        "--fighter-a",
        "a",
        "--fighter-b",
        "b",
        "--acknowledge-grid-beta",
        "--acknowledge-grid-beta",
      ]),
    ).toThrow(/duplicate argument/);
  });

  it("rejects an invalid or negative seed", () => {
    expect(() =>
      parseGridBetaMatchArgs([
        "--seed",
        "-1",
        "--fighter-a",
        "a",
        "--fighter-b",
        "b",
        "--acknowledge-grid-beta",
      ]),
    ).toThrow(/non-negative integer/);
    expect(() =>
      parseGridBetaMatchArgs([
        "--seed",
        "abc",
        "--fighter-a",
        "a",
        "--fighter-b",
        "b",
        "--acknowledge-grid-beta",
      ]),
    ).toThrow(/non-negative integer/);
  });
});

describe("grid beta replay CLI (Phase 3G Phase 11)", () => {
  it("parses text replay by default and an optional --ascii", () => {
    expect(
      parseGridBetaReplayArgs(["--match", "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"]),
    ).toEqual({ matchId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", ascii: false });
    expect(
      parseGridBetaReplayArgs([
        "--match",
        "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        "--ascii",
      ]),
    ).toEqual({ matchId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", ascii: true });
  });

  it("rejects a missing, malformed or duplicate match id and unknown arguments", () => {
    expect(() => parseGridBetaReplayArgs([])).toThrow(/no arguments/);
    expect(() => parseGridBetaReplayArgs(["--ascii"])).toThrow(/--match is required/);
    expect(() => parseGridBetaReplayArgs(["--match", "not-a-uuid"])).toThrow(
      /valid UUID/,
    );
    expect(() =>
      parseGridBetaReplayArgs([
        "--match",
        "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        "--match",
        "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      ]),
    ).toThrow(/duplicate argument/);
    expect(() =>
      parseGridBetaReplayArgs([
        "--match",
        "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        "--force",
      ]),
    ).toThrow(/unknown argument/);
  });
});
