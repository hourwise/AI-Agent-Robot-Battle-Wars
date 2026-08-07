import type { OpponentFixtureV1 } from "./opponent-fixture.js";
import { loadOpponentFixtureForRuntime } from "./opponent-runtime-compatibility.js";

/**
 * Canonical legacy Bulwark helper (Milestone 0.2D Phase 3, Commit M).
 *
 * Normal legacy application paths obtain Bulwark ONLY through this helper,
 * which loads the canonical `bulwark.v1` fixture via the runtime-aware
 * fixed-root loader for `runtime: "legacy"` and requires the exact frozen
 * v1 `fixtureChecksum`. It fails closed on any mismatch. The Bulwark build is
 * never reconstructed manually and `validateBuild` is never re-invoked by
 * normal application code — the fixture loader already performs the
 * authoritative validation. Historical constants are regression anchors, NOT
 * fallback combat input.
 */

export const LEGACY_BULWARK_OPPONENT_ID = "bulwark" as const;
export const LEGACY_BULWARK_FIXTURE_VERSION = 1 as const;
export const LEGACY_BULWARK_RUNTIME = "legacy" as const;

/** Exact frozen canonical bulwark.v1 fixtureChecksum (Phase 2 evidence anchor). */
export const LEGACY_BULWARK_EXPECTED_FIXTURE_CHECKSUM =
  "053e61e867d00015371e852dbe571af666cc8ac99a514b2364be323d54a8d987" as const;

/** Fail-closed error for canonical legacy Bulwark loading. */
export class LegacyBulwarkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LegacyBulwarkError";
  }
}

/**
 * Loads the canonical legacy Bulwark fixture (deeply frozen) and enforces the
 * exact frozen v1 `fixtureChecksum`. Throws `LegacyBulwarkError` on any
 * checksum mismatch. Never falls back to historical constants.
 */
export async function loadLegacyBulwark(): Promise<OpponentFixtureV1> {
  const fixture = await loadOpponentFixtureForRuntime(
    LEGACY_BULWARK_OPPONENT_ID,
    LEGACY_BULWARK_FIXTURE_VERSION,
    LEGACY_BULWARK_RUNTIME,
  );
  if (fixture.fixtureChecksum !== LEGACY_BULWARK_EXPECTED_FIXTURE_CHECKSUM) {
    throw new LegacyBulwarkError(
      `canonical bulwark fixture checksum mismatch: expected ${LEGACY_BULWARK_EXPECTED_FIXTURE_CHECKSUM}, received ${fixture.fixtureChecksum}`,
    );
  }
  return fixture;
}
