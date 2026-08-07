import {
  runGridBetaMatchWithEnvironment,
  type GridBetaMatchDependencies,
  type GridBetaMatchEnvironment,
  type GridBetaMatchRequest,
  type GridBetaMatchResult,
} from "./grid-beta-match.js";

/**
 * Test-only harness for the grid beta match service (Milestone 0.2C Phase
 * 3G.1.1, Phase 1).
 *
 * Tests need temporary filesystem roots and execution observation without
 * ever touching real beta storage. This harness is structurally separate from
 * the production API: the production entry point `runGridBetaMatch` always
 * uses the frozen canonical roots and always enters the fixed
 * `executeGridBetaMatch` core, while this harness explicitly accepts
 * temporary roots and an optional execution-entry observer. No production
 * source imports this module; only test files use it.
 *
 * The observer (`onExecutionStart`) only counts entry into the fixed
 * `executeGridBetaMatch` core; it can never replace or modify the execution
 * or its result. There is no alternate result-producing simulator anywhere in
 * the production service.
 */
export interface GridBetaMatchTestEnvironmentOptions {
  readonly outputRoot: string;
  readonly fighterRoot: string;
  readonly governanceBundleDir: string;
  readonly suspensionMarkerPath: string;
  /** Optional execution-entry observer (counts entry into the fixed core). */
  readonly onExecutionStart?: () => void;
}

export async function runGridBetaMatchWithTestEnvironment(
  request: GridBetaMatchRequest,
  options: GridBetaMatchTestEnvironmentOptions,
  dependencies: GridBetaMatchDependencies = {},
): Promise<GridBetaMatchResult> {
  const environment: GridBetaMatchEnvironment = {
    outputRoot: options.outputRoot,
    fighterRoot: options.fighterRoot,
    governanceBundleDir: options.governanceBundleDir,
    suspensionMarkerPath: options.suspensionMarkerPath,
    onExecutionStart: options.onExecutionStart,
  };
  return runGridBetaMatchWithEnvironment(request, environment, dependencies);
}
