import { describe, expect, it } from "vitest";
import { resolve } from "node:path";
import {
  assertCanaryOutputRootIsolation,
  getCanaryCanonicalOutputRoot,
  GridCanaryOutputRootError,
} from "../../src/canary/canary-output-root.js";

const CWD = resolve(process.cwd());

function inRepo(path: string): string {
  return resolve(CWD, path);
}

describe("grid grapple coverage supplement output-root guard (Phase 3E2 Phase 12)", () => {
  it("maps the grid-readiness-supplement kind to data/readiness/grid-supplements", () => {
    expect(getCanaryCanonicalOutputRoot("grid-readiness-supplement")).toBe(
      inRepo("data/readiness/grid-supplements"),
    );
  });

  it("rejects normal match and series storage as supplement roots", () => {
    expect(() =>
      assertCanaryOutputRootIsolation(
        inRepo("data/matches"),
        "grid-readiness-supplement",
      ),
    ).toThrow(GridCanaryOutputRootError);
    expect(() =>
      assertCanaryOutputRootIsolation(inRepo("data/series"), "grid-readiness-supplement"),
    ).toThrow(GridCanaryOutputRootError);
    expect(() =>
      assertCanaryOutputRootIsolation(
        inRepo("data/matches/sub"),
        "grid-readiness-supplement",
      ),
    ).toThrow(GridCanaryOutputRootError);
  });

  it("rejects both existing canary roots for the supplement service", () => {
    expect(() =>
      assertCanaryOutputRootIsolation(
        inRepo("data/canary/grid-match"),
        "grid-readiness-supplement",
      ),
    ).toThrow(GridCanaryOutputRootError);
    expect(() =>
      assertCanaryOutputRootIsolation(
        inRepo("data/canary/grid-series"),
        "grid-readiness-supplement",
      ),
    ).toThrow(GridCanaryOutputRootError);
    expect(() =>
      assertCanaryOutputRootIsolation(inRepo("data/canary"), "grid-readiness-supplement"),
    ).toThrow(GridCanaryOutputRootError);
  });

  it("rejects the official readiness root and its descendants for the supplement service", () => {
    expect(() =>
      assertCanaryOutputRootIsolation(
        inRepo("data/readiness/grid"),
        "grid-readiness-supplement",
      ),
    ).toThrow(GridCanaryOutputRootError);
    expect(() =>
      assertCanaryOutputRootIsolation(
        inRepo("data/readiness/grid/sub"),
        "grid-readiness-supplement",
      ),
    ).toThrow(GridCanaryOutputRootError);
    expect(() =>
      assertCanaryOutputRootIsolation(
        inRepo("data/readiness/grid/0d8487a8-939d-4f9a-a16a-544b71eaa869"),
        "grid-readiness-supplement",
      ),
    ).toThrow(GridCanaryOutputRootError);
  });

  it("rejects every other in-repository data root and descendants of the supplement root", () => {
    expect(() =>
      assertCanaryOutputRootIsolation(inRepo("data"), "grid-readiness-supplement"),
    ).toThrow(GridCanaryOutputRootError);
    expect(() =>
      assertCanaryOutputRootIsolation(
        inRepo("data/readiness"),
        "grid-readiness-supplement",
      ),
    ).toThrow(GridCanaryOutputRootError);
    expect(() =>
      assertCanaryOutputRootIsolation(
        inRepo("data/readiness/grid-supplements/sub"),
        "grid-readiness-supplement",
      ),
    ).toThrow(GridCanaryOutputRootError);
    expect(() =>
      assertCanaryOutputRootIsolation(
        inRepo("data/canary/grid-match/x"),
        "grid-readiness-supplement",
      ),
    ).toThrow(GridCanaryOutputRootError);
  });

  it("accepts only the exact canonical supplement root within the repository", () => {
    expect(() =>
      assertCanaryOutputRootIsolation(
        inRepo("data/readiness/grid-supplements"),
        "grid-readiness-supplement",
      ),
    ).not.toThrow();
  });
});
