import { join } from "node:path";
import {
  GRID_OPT_IN_BETA_CONTRACT_CHECKSUM,
  GRID_OPT_IN_BETA_CONTRACT_ID,
} from "../readiness/grid-opt-in-beta-contract.js";
import {
  GRID_OPT_IN_BETA_OFFICIAL_GOVERNANCE_DECISION_ID,
  GRID_OPT_IN_BETA_OFFICIAL_GOVERNANCE_IDENTITY,
} from "../readiness/grid-opt-in-beta-official-identity.js";
import { DEFAULT_COMPONENT_QUALIFICATION_ID } from "../simulator/component-qualification-registry.js";

/**
 * Bounded grid beta implementation identity (Milestone 0.2C Phase 3G,
 * Phase 2).
 *
 * A frozen identity for the explicitly selected, internal/development,
 * local-scripted, single-match grid-beta surface. It binds the implementation
 * to the authoritative Phase 3F governance decision, the bounded-beta policy
 * contract and the complete frozen grid runtime identity. It authorises no
 * default activation, no public/ranked/tournament scope and no balance claim.
 */

export const GRID_OPT_IN_BETA_MATCH_IMPLEMENTATION_ID =
  "grid-opt-in-beta-match-v1" as const;

export const GRID_OPT_IN_BETA_MATCH_COMMAND = "match:grid:beta" as const;
export const GRID_OPT_IN_BETA_REPLAY_COMMAND = "replay:grid:beta" as const;

/** Fixed CLI input root for local fighter specifications. */
export const GRID_OPT_IN_BETA_FIGHTER_ROOT = join(
  process.cwd(),
  "data",
  "beta",
  "grid-fighters",
);

/** Fixed output root for immutable beta match bundles. */
export const GRID_OPT_IN_BETA_MATCH_OUTPUT_ROOT = join(
  process.cwd(),
  "data",
  "beta",
  "grid-matches",
);

/** The one immediate deterministic suspension marker path. */
export const GRID_OPT_IN_BETA_SUSPENSION_MARKER_PATH = join(
  process.cwd(),
  "data",
  "beta",
  "GRID_BETA_SUSPENDED",
);

export const GRID_OPT_IN_BETA_BANNER =
  "FORGE ARENA — GRID 3×3 BETA\nOPT-IN / EXPERIMENTAL / NOT BALANCE-QUALIFIED\nLEGACY REMAINS THE DEFAULT";

export const GRID_OPT_IN_BETA_DISCLAIMER =
  "This is an explicitly selected internal grid beta match. It does not change the default runtime, qualify combat balance, authorise ranked or public play, or permit the result to be treated as an adaptation or held-out evaluation.";

/** Complete frozen grid runtime identity carried by every beta record. */
export const GRID_OPT_IN_BETA_RUNTIME_IDENTITY: Readonly<{
  simulatorVersion: "0.3.0";
  positioningModel: "grid-3x3-v1";
  rulesetVersion: "0.2.0";
  catalogueVersion: "1";
}> = Object.freeze({
  simulatorVersion: "0.3.0",
  positioningModel: "grid-3x3-v1",
  rulesetVersion: "0.2.0",
  catalogueVersion: "1",
});

/** The explicit component-qualification identity used by the beta (C2). */
export const GRID_OPT_IN_BETA_COMPONENT_QUALIFICATION_ID =
  DEFAULT_COMPONENT_QUALIFICATION_ID;

/** The authoritative Phase 3F governance decision outcome. */
export const GRID_OPT_IN_BETA_GOVERNANCE_OUTCOME =
  "approved_for_bounded_opt_in_beta_implementation" as const;

/** All seven frozen official governance artifact hashes (exact persisted bytes). */
export const GRID_OPT_IN_BETA_GOVERNANCE_ARTIFACT_HASHES = Object.freeze({
  ...GRID_OPT_IN_BETA_OFFICIAL_GOVERNANCE_IDENTITY.artifactHashes,
}) as Readonly<Record<string, string>>;

export const GRID_OPT_IN_BETA_GOVERNANCE_DECISION_ID =
  GRID_OPT_IN_BETA_OFFICIAL_GOVERNANCE_DECISION_ID;

export const GRID_OPT_IN_BETA_CONTRACT_ID_VALUE = GRID_OPT_IN_BETA_CONTRACT_ID;
export const GRID_OPT_IN_BETA_CONTRACT_CHECKSUM_VALUE =
  GRID_OPT_IN_BETA_CONTRACT_CHECKSUM;
