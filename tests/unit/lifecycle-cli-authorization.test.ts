import { describe, expect, it } from "vitest";
import {
  parseLifecycleBenchmarkArgs,
  runLifecycleBenchmarkCli,
} from "../../src/app/run-lifecycle-benchmark.js";

describe("held-out lifecycle confirmation authorization", () => {
  it("accepts only the explicit AB2 held-out command shape", () => {
    expect(
      parseLifecycleBenchmarkArgs([
        "--partition",
        "held-out",
        "--qualification",
        "component-impact-ab2",
        "--confirm-held-out",
      ]),
    ).toMatchObject({
      partition: "held-out",
      qualificationId: "component-impact-ab2",
      confirmHeldOut: true,
    });
  });

  it("rejects held-out without explicit confirmation", () => {
    expect(() =>
      parseLifecycleBenchmarkArgs([
        "--partition",
        "held-out",
        "--qualification",
        "component-impact-ab2",
      ]),
    ).toThrow("--confirm-held-out");
  });

  it("rejects omitted, historical, or unknown held-out qualifications", () => {
    expect(() =>
      parseLifecycleBenchmarkArgs(["--partition", "held-out", "--confirm-held-out"]),
    ).toThrow("explicit --qualification component-impact-ab2");
    expect(() =>
      parseLifecycleBenchmarkArgs([
        "--partition",
        "held-out",
        "--qualification",
        "component-impact-c2",
        "--confirm-held-out",
      ]),
    ).toThrow("only for component-impact-ab2");
  });

  it("rejects held-out fixture filtering and JSON per-match output", () => {
    expect(() =>
      parseLifecycleBenchmarkArgs([
        "--partition",
        "held-out",
        "--qualification",
        "component-impact-ab2",
        "--confirm-held-out",
        "--fixture",
        "glass-cannon-mirror",
      ]),
    ).toThrow("does not allow --fixture");
    expect(() =>
      parseLifecycleBenchmarkArgs([
        "--partition",
        "held-out",
        "--qualification",
        "component-impact-ab2",
        "--confirm-held-out",
        "--json",
      ]),
    ).toThrow("does not allow --json");
  });

  it("continues rejecting all and confirmation on development", () => {
    expect(() => runLifecycleBenchmarkCli(["--partition", "all"])).toThrow(
      'partition "all" is prohibited',
    );
    expect(() => parseLifecycleBenchmarkArgs(["--confirm-held-out"])).toThrow(
      "valid only with --partition held-out",
    );
  });
});
