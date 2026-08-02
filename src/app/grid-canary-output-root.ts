/**
 * Compatibility re-export (Milestone 0.2C Phase 3D2B).
 *
 * The kind-aware output-root isolation and physical-root guards now live in
 * `src/canary/canary-output-root.ts` and are shared with the grid
 * adaptive-series canary. This module keeps the historical import path
 * (`src/app/grid-canary-output-root.js`) working for the single-match canary,
 * defaulting the root kind to `"grid-match"`.
 */
export {
  GridCanaryOutputRootError,
  getCanaryProtectedOutputRoots,
  assertCanaryPhysicalRoot,
} from "../canary/canary-output-root.js";
export type { CanaryRootKind } from "../canary/canary-output-root.js";

import {
  getCanaryCanonicalOutputRoot as canonicalForKind,
  assertCanaryOutputRootIsolation as assertIsolationForKind,
  type CanaryRootKind,
} from "../canary/canary-output-root.js";

/** The canonical repository grid-match canary root (default kind). */
export function getCanaryCanonicalOutputRoot(
  kind: CanaryRootKind = "grid-match",
): string {
  return canonicalForKind(kind);
}

/** Sync lexical guard; defaults to the grid-match canary kind. */
export function assertCanaryOutputRootIsolation(
  outputRoot: string,
  kind: CanaryRootKind = "grid-match",
): void {
  assertIsolationForKind(outputRoot, kind);
}
