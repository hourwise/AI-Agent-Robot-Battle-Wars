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

describe("grid opt-in beta governance output-root guard (Phase 3F Phase 6)", () => {
  it("maps the grid-readiness-governance kind to data/readiness/grid-governance", () => {
    expect(getCanaryCanonicalOutputRoot("grid-readiness-governance")).toBe(
      inRepo("data/readiness/grid-governance"),
    );
  });

  it("rejects normal match and series storage as governance roots", () => {
    expect(() =>
      assertCanaryOutputRootIsolation(
        inRepo("data/matches"),
        "grid-readiness-governance",
      ),
    ).toThrow(GridCanaryOutputRootError);
    expect(() =>
      assertCanaryOutputRootIsolation(inRepo("data/series"), "grid-readiness-governance"),
    ).toThrow(GridCanaryOutputRootError);
    expect(() =>
      assertCanaryOutputRootIsolation(
        inRepo("data/matches/sub"),
        "grid-readiness-governance",
      ),
    ).toThrow(GridCanaryOutputRootError);
  });

  it("rejects both existing canary roots for the governance service", () => {
    expect(() =>
      assertCanaryOutputRootIsolation(
        inRepo("data/canary/grid-match"),
        "grid-readiness-governance",
      ),
    ).toThrow(GridCanaryOutputRootError);
    expect(() =>
      assertCanaryOutputRootIsolation(
        inRepo("data/canary/grid-series"),
        "grid-readiness-governance",
      ),
    ).toThrow(GridCanaryOutputRootError);
    expect(() =>
      assertCanaryOutputRootIsolation(inRepo("data/canary"), "grid-readiness-governance"),
    ).toThrow(GridCanaryOutputRootError);
  });

  it("rejects the official readiness and supplement roots and their descendants", () => {
    expect(() =>
      assertCanaryOutputRootIsolation(
        inRepo("data/readiness/grid"),
        "grid-readiness-governance",
      ),
    ).toThrow(GridCanaryOutputRootError);
    expect(() =>
      assertCanaryOutputRootIsolation(
        inRepo("data/readiness/grid-supplements"),
        "grid-readiness-governance",
      ),
    ).toThrow(GridCanaryOutputRootError);
    expect(() =>
      assertCanaryOutputRootIsolation(
        inRepo("data/readiness/grid/0d8487a8-939d-4f9a-a16a-544b71eaa869"),
        "grid-readiness-governance",
      ),
    ).toThrow(GridCanaryOutputRootError);
    expect(() =>
      assertCanaryOutputRootIsolation(
        inRepo("data/readiness/grid-supplements/4eca43e2-cc3d-41ee-bfad-73e18238ff61"),
        "grid-readiness-governance",
      ),
    ).toThrow(GridCanaryOutputRootError);
    expect(() =>
      assertCanaryOutputRootIsolation(
        inRepo("data/readiness/grid/governance-sub"),
        "grid-readiness-governance",
      ),
    ).toThrow(GridCanaryOutputRootError);
  });

  it("rejects every other in-repository data root and descendants of the governance root", () => {
    expect(() =>
      assertCanaryOutputRootIsolation(inRepo("data"), "grid-readiness-governance"),
    ).toThrow(GridCanaryOutputRootError);
    expect(() =>
      assertCanaryOutputRootIsolation(
        inRepo("data/readiness"),
        "grid-readiness-governance",
      ),
    ).toThrow(GridCanaryOutputRootError);
    expect(() =>
      assertCanaryOutputRootIsolation(
        inRepo("data/readiness/grid-governance/sub"),
        "grid-readiness-governance",
      ),
    ).toThrow(GridCanaryOutputRootError);
    expect(() =>
      assertCanaryOutputRootIsolation(
        inRepo("data/canary/grid-match/x"),
        "grid-readiness-governance",
      ),
    ).toThrow(GridCanaryOutputRootError);
  });

  it("accepts only the exact canonical governance root within the repository", () => {
    expect(() =>
      assertCanaryOutputRootIsolation(
        inRepo("data/readiness/grid-governance"),
        "grid-readiness-governance",
      ),
    ).not.toThrow();
  });
});
