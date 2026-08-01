import type { GridRuntimeIdentity, LegacyRuntimeIdentity } from "./types.js";

/**
 * Canonical frozen runtime identities (Milestone 0.2C Phase 3B).
 *
 * The in-memory runtime identity carried by match results is frozen with
 * genuine runtime immutability, not only TypeScript `readonly`. A caller
 * cannot modify an identity through a returned result: any attempted
 * assignment throws in strict mode and can never mutate the canonical object,
 * so mutating one match result can never affect a later match. Adapters and
 * match results share these frozen constants; no mutable shared identity
 * state is exposed anywhere.
 *
 * Persistence and replay always read the explicit identity carried by a
 * result; the positioning model is never inferred from zone string values
 * (`center` exists in both models).
 */
export const LEGACY_RUNTIME_IDENTITY: Readonly<LegacyRuntimeIdentity> = Object.freeze({
  simulatorVersion: "0.2.0",
  positioningModel: "legacy-five-zone-v1",
});

export const GRID_RUNTIME_IDENTITY: Readonly<GridRuntimeIdentity> = Object.freeze({
  simulatorVersion: "0.3.0",
  positioningModel: "grid-3x3-v1",
});
