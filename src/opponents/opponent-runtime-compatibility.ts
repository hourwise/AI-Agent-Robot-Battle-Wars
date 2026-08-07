import {
  GRID_RUNTIME_IDENTITY,
  LEGACY_RUNTIME_IDENTITY,
} from "../simulator/runtime-identity.js";
import type { OpponentFixtureV1 } from "./opponent-fixture.js";
import { loadOpponentFixture } from "./opponent-fixture-loader.js";

/**
 * Explicit opponent runtime compatibility gate (Milestone 0.2D Phase 3,
 * Commit M).
 *
 * Opponent fixtures are runtime-neutral data; execution is chosen
 * separately. This module binds a requested runtime to the canonical frozen
 * runtime identity and fails closed when the fixture does not declare that
 * runtime as `supported`. The runtime is ALWAYS explicitly supplied — there
 * is no ambient/default runtime inference and no fallback between runtimes.
 * Checking compatibility NEVER executes a match, NEVER activates grid and
 * NEVER changes the global default. Compatibility is data only.
 *
 * `"legacy"` maps only to `LEGACY_RUNTIME_IDENTITY`; `"grid"` maps only to
 * `GRID_RUNTIME_IDENTITY`. The fixture schema already binds the complete
 * simulator/positioning identities at parse time (no unrelated magic strings
 * are duplicated here); the identity re-check below uses the canonical frozen
 * constants as defence in depth.
 */

export type OpponentRuntime = "legacy" | "grid";

/** Fail-closed error for runtime incompatibility or invalid runtime keys. */
export class OpponentRuntimeCompatibilityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OpponentRuntimeCompatibilityError";
  }
}

/**
 * Pure, fail-closed assertion that `fixture` supports `runtime`. Throws
 * `OpponentRuntimeCompatibilityError` when the runtime key is unknown, when
 * the fixture's compatibility entry does not carry the canonical frozen
 * runtime identity, or when the entry's status is not `supported`. Never
 * mutates the fixture.
 */
export function assertOpponentFixtureSupportsRuntime(
  fixture: OpponentFixtureV1,
  runtime: OpponentRuntime,
): void {
  if (runtime !== "legacy" && runtime !== "grid") {
    throw new OpponentRuntimeCompatibilityError(
      `opponent runtime must be "legacy" or "grid"; received ${JSON.stringify(runtime)}`,
    );
  }

  const entry =
    runtime === "legacy"
      ? fixture.runtimeCompatibility.legacy
      : fixture.runtimeCompatibility.grid;
  const canonical =
    runtime === "legacy" ? LEGACY_RUNTIME_IDENTITY : GRID_RUNTIME_IDENTITY;

  if (
    entry.simulatorVersion !== canonical.simulatorVersion ||
    entry.positioningModel !== canonical.positioningModel
  ) {
    throw new OpponentRuntimeCompatibilityError(
      `opponent fixture ${fixture.opponentId} v${fixture.fixtureVersion} declares a non-canonical ${runtime} runtime identity`,
    );
  }

  if (entry.status !== "supported") {
    throw new OpponentRuntimeCompatibilityError(
      `opponent fixture ${fixture.opponentId} v${fixture.fixtureVersion} does not support runtime ${JSON.stringify(runtime)}`,
    );
  }
}

/**
 * Runtime-aware canonical loader. Calls the reviewed fixed-root
 * `loadOpponentFixture`, applies the explicit runtime compatibility gate, and
 * returns the same deeply frozen canonical fixture.
 *
 * Public inputs are ONLY `opponentId`, `fixtureVersion` and `runtime` — no
 * root/path/filesystem inputs are exposed through this production convenience
 * API. Loading a fixture never activates a runtime and never executes a
 * match.
 */
export async function loadOpponentFixtureForRuntime(
  opponentId: string,
  fixtureVersion: number,
  runtime: OpponentRuntime,
): Promise<OpponentFixtureV1> {
  const fixture = await loadOpponentFixture(opponentId, fixtureVersion);
  assertOpponentFixtureSupportsRuntime(fixture, runtime);
  return fixture;
}
