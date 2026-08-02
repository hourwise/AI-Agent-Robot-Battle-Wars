import { runGridMatch } from "../simulator/grid-runtime.js";
import { MAX_ROUNDS, RULESET_VERSION } from "../simulator/constants.js";
import { CATALOGUE_V1 } from "../catalogue/catalogue.v1.js";
import { matchResultToRecord } from "../persistence/match-converter.js";
import { buildGridFactualReport } from "../reports/factual-match-report.js";
import { bindGridFactualReportToMatchRecord } from "../reports/grid-factual-report-binding.js";
import { renderTextReplay } from "../replay/text-replay-renderer.js";
import { renderAsciiReplay } from "../replay/ascii/ascii-replay-renderer.js";
import { buildReviewUserPrompt } from "../prompts/review-prompt.v1.js";
import { POSITIONING_MODEL_GRID } from "../schemas/positioning.schema.js";
import {
  isV3Record,
  serializeMatchRecord,
  validateMatchRecord,
  type MatchRecordV3,
} from "../schemas/match-record.schema.js";
import {
  serializeFactualMatchReport,
  validateFactualMatchReport,
  type FactualMatchReportV2,
} from "../schemas/factual-report.schema.js";
import { serializeMatchReview, type MatchReview } from "../schemas/review.schema.js";
import type { ActionPolicy, GridMatchResult, MatchConfig } from "../simulator/types.js";
import { isGridZone } from "../simulator/arena-grid.js";
import {
  assertGridCanaryFinalAgreement,
  verifyGridCanaryDeterminism,
} from "./grid-match-canary-evidence.js";
import { buildDeterministicFallbackReview } from "./grid-canary-fallback-review.js";
import {
  createGridSeriesCanaryScenario,
  GRID_SERIES_CANARY_MAXIMUM_MATCHES,
  gridSeriesCanaryInitialPolicy,
} from "./grid-series-canary-scenario.js";
import { createGridSeriesCanarySeedPlan } from "./grid-series-canary-seed-plan.js";
import {
  adaptGridCanaryPolicy,
  type GridSeriesCanaryAdaptation,
} from "./grid-series-canary-adaptation.js";
import {
  serializeGridSeriesCanaryAdaptationTrace,
  type GridSeriesCanaryAdaptationTraceV1,
} from "../schemas/grid-series-canary-adaptation-trace.schema.js";

/**
 * Pure grid adaptive-series canary execution core (Milestone 0.2C Phase
 * 3D2B).
 *
 * Runs exactly three deterministic grid matches from the frozen seed plan with
 * fresh scenario values every match, converts each to a match-record v3 (with
 * explicitly injected match identities), builds the factual-report v2, binds
 * it to the record, renders text/ASCII replay, produces the grid-aware review
 * prompt and the deterministic fallback review, verifies determinism,
 * canonical zones, termination within the round cap and replay/report/final
 * agreement, and applies the frozen policy adaptation after matches 1 and 2.
 *
 * The core is deliberately pure: it never generates UUIDs, never reads the
 * clock, never touches the filesystem, never calls a provider, `runSeries` or
 * benchmark code, and never mutates its inputs. Identities and the series
 * UUID are injected; the service layer owns UUID/timestamp generation.
 */
export interface GridSeriesCanaryMatchIdentity {
  matchId: string;
  createdAt: string;
}

export interface GridSeriesCanaryExecutedMatch {
  matchNumber: 1 | 2 | 3;
  seed: number;
  matchId: string;
  record: MatchRecordV3;
  report: FactualMatchReportV2;
  fallbackReview: MatchReview;
  textReplay: string;
  asciiReplay: string;
  reviewPrompt: string;
  serializedRecord: string;
  serializedReport: string;
  serializedFallbackReview: string;
  policyBefore: ActionPolicy;
  nextPolicy: ActionPolicy | null;
  rounds: number;
  winner: string | null;
  resultMethod: string;
  eventCount: number;
}

export interface GridSeriesCanaryCoreEvidence {
  matchCount: 3;
  allMatchesTerminated: true;
  allMatchRecordsV3: true;
  allFactualReportsV2: true;
  allReportsBoundToRecords: true;
  allFallbackReviewsValid: true;
  allReplayFinalStatesAgree: true;
  allMovementZonesCanonical: true;
  translatedGridMovementObserved: true;
  combatAttemptObserved: true;
  policyAdaptationCount: 2;
  adaptationFactsAgree: true;
}

export interface GridSeriesCanaryCoreOutcome {
  matches: readonly [
    GridSeriesCanaryExecutedMatch,
    GridSeriesCanaryExecutedMatch,
    GridSeriesCanaryExecutedMatch,
  ];
  adaptations: readonly [GridSeriesCanaryAdaptation, GridSeriesCanaryAdaptation];
  adaptationTrace: GridSeriesCanaryAdaptationTraceV1;
  serializedAdaptationTrace: string;
  evidence: GridSeriesCanaryCoreEvidence;
}

export interface ExecuteGridSeriesCanaryParams {
  baseSeed: number;
  seriesId: string;
  matchIdentities: readonly [
    GridSeriesCanaryMatchIdentity,
    GridSeriesCanaryMatchIdentity,
    GridSeriesCanaryMatchIdentity,
  ];
}

export class GridSeriesCanaryCoreError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GridSeriesCanaryCoreError";
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

/**
 * Per-match evidence: grid identity, canonical movement zones, termination
 * within the frozen round cap, translated grid movement and combat attempts.
 * Fails closed on any violation.
 */
function inspectSeriesMatchEvidence(
  result: GridMatchResult,
  matchNumber: number,
  seed: number,
): { translatedMovement: boolean; combatAttempt: boolean } {
  const label = `series match ${matchNumber} (seed ${seed})`;
  if (result.runtime.simulatorVersion !== "0.3.0") {
    throw new GridSeriesCanaryCoreError(
      `${label} must run simulator 0.3.0; received ${result.runtime.simulatorVersion}`,
    );
  }
  if (result.runtime.positioningModel !== "grid-3x3-v1") {
    throw new GridSeriesCanaryCoreError(
      `${label} must use positioning model grid-3x3-v1; received ${result.runtime.positioningModel}`,
    );
  }
  if (result.config.rulesetVersion !== "0.2.0") {
    throw new GridSeriesCanaryCoreError(
      `${label} must use ruleset 0.2.0; received ${result.config.rulesetVersion}`,
    );
  }
  if (result.config.catalogueVersion !== "1") {
    throw new GridSeriesCanaryCoreError(
      `${label} must use catalogue 1; received ${result.config.catalogueVersion}`,
    );
  }
  if (result.rounds < 0 || result.rounds > MAX_ROUNDS) {
    throw new GridSeriesCanaryCoreError(
      `${label} must terminate within the round cap ${MAX_ROUNDS}; received ${result.rounds} rounds`,
    );
  }

  let translatedMovement = false;
  let combatAttempt = false;

  for (const fighter of [result.initialState.fighterA, result.initialState.fighterB]) {
    if (!isGridZone(fighter.zone)) {
      throw new GridSeriesCanaryCoreError(
        `${label} initial zone is not canonical: ${String(fighter.zone)}`,
      );
    }
  }

  for (const event of result.events) {
    if (event.type === "movement_resolved") {
      const data = event.data as { from?: unknown; to?: unknown; action?: unknown };
      if (!isGridZone(data.from) || !isGridZone(data.to)) {
        throw new GridSeriesCanaryCoreError(
          `${label} movement_resolved from/to must be canonical grid zones; received ${String(data.from)} -> ${String(data.to)}`,
        );
      }
      if (data.from !== data.to) translatedMovement = true;
    } else if (event.type === "round_ended") {
      const data = event.data as {
        fighterA: { zone: string };
        fighterB: { zone: string };
      };
      if (!isGridZone(data.fighterA.zone) || !isGridZone(data.fighterB.zone)) {
        throw new GridSeriesCanaryCoreError(
          `${label} round_ended zones must be canonical grid zones; received ${String(data.fighterA.zone)} / ${String(data.fighterB.zone)}`,
        );
      }
    } else if (event.type === "attack_attempted") {
      combatAttempt = true;
    }
  }

  return { translatedMovement, combatAttempt };
}

/**
 * Pure execution core. Requires exactly three unique match identities (UUIDs)
 * and one series UUID, and throws on any evidence or schema violation.
 */
export function executeGridSeriesCanary(
  params: ExecuteGridSeriesCanaryParams,
): GridSeriesCanaryCoreOutcome {
  const plan = createGridSeriesCanarySeedPlan(params.baseSeed);

  if (!isUuid(params.seriesId)) {
    throw new GridSeriesCanaryCoreError(
      `Series ID must be a valid UUID; received ${String(params.seriesId)}`,
    );
  }

  const seen = new Set<string>([params.seriesId]);
  for (const identity of params.matchIdentities) {
    if (!isUuid(identity.matchId)) {
      throw new GridSeriesCanaryCoreError(
        `Match ID must be a valid UUID; received ${String(identity.matchId)}`,
      );
    }
    if (seen.has(identity.matchId)) {
      throw new GridSeriesCanaryCoreError(
        `Match IDs must be unique and distinct from the series ID; duplicate ${identity.matchId}`,
      );
    }
    seen.add(identity.matchId);
  }

  const matches: GridSeriesCanaryExecutedMatch[] = [];
  const adaptations: GridSeriesCanaryAdaptation[] = [];
  let currentPolicy: ActionPolicy = gridSeriesCanaryInitialPolicy();

  let translatedGridMovementObserved = false;
  let combatAttemptObserved = false;

  for (let index = 0; index < GRID_SERIES_CANARY_MAXIMUM_MATCHES; index++) {
    const matchNumber = (index + 1) as 1 | 2 | 3;
    const seed = plan.seeds[index]!;
    const identity = params.matchIdentities[index]!;
    const scenario = createGridSeriesCanaryScenario();

    // The policy actually used for this match, captured before any adaptation
    // for this match can update currentPolicy.
    const policyBeforeMatch: ActionPolicy = { ...currentPolicy };

    const config: MatchConfig = {
      seed,
      fighterA: { build: scenario.fighterA.build, policy: policyBeforeMatch },
      fighterB: scenario.fighterB,
      rulesetVersion: RULESET_VERSION,
      catalogueVersion: CATALOGUE_V1.version,
    };
    const result = runGridMatch(config);

    // Determinism: re-execute the same seed and scenario and compare.
    verifyGridCanaryDeterminism(config, result);

    const evidence = inspectSeriesMatchEvidence(result, matchNumber, seed);
    translatedGridMovementObserved =
      translatedGridMovementObserved || evidence.translatedMovement;
    combatAttemptObserved = combatAttemptObserved || evidence.combatAttempt;

    // Convert with the injected identity (never the converter's random UUIDs).
    const converted = matchResultToRecord(result, [], {
      matchId: identity.matchId,
      createdAt: identity.createdAt,
    });
    if (!isV3Record(converted)) {
      throw new GridSeriesCanaryCoreError(
        `Series match ${matchNumber} record must be schema v3`,
      );
    }
    const record: MatchRecordV3 = converted;

    const report = bindGridFactualReportToMatchRecord(
      buildGridFactualReport(result),
      record,
    );

    const recordValidation = validateMatchRecord(record);
    if (!recordValidation.ok) {
      throw new GridSeriesCanaryCoreError(
        `Series match ${matchNumber} record failed validation: ${recordValidation.errors}`,
      );
    }
    const reportValidation = validateFactualMatchReport(report);
    if (!reportValidation.ok) {
      throw new GridSeriesCanaryCoreError(
        `Series match ${matchNumber} factual report failed validation: ${reportValidation.errors}`,
      );
    }

    // Replay/report/final-round agreement.
    assertGridCanaryFinalAgreement(result, report);

    const textReplay = renderTextReplay(result);
    const asciiReplay = renderAsciiReplay(
      result,
      { mode: "ascii" },
      POSITIONING_MODEL_GRID,
    );
    const reviewPrompt = buildReviewUserPrompt(report);
    const fallbackReview = buildDeterministicFallbackReview(report);

    const serializedRecord = serializeMatchRecord(record);
    const serializedReport = serializeFactualMatchReport(report);
    const serializedFallbackReview = serializeMatchReview(fallbackReview);

    let nextPolicy: ActionPolicy | null = null;
    if (matchNumber === 1 || matchNumber === 2) {
      const adaptation = adaptGridCanaryPolicy({
        matchNumber,
        sourceMatchId: identity.matchId,
        sourceSeed: seed,
        currentPolicy: policyBeforeMatch,
        factualReport: report,
        fallbackReview,
      });
      adaptations.push(adaptation);
      nextPolicy = adaptation.policyAfter;
      currentPolicy = adaptation.policyAfter;
    }

    matches.push({
      matchNumber,
      seed,
      matchId: identity.matchId,
      record,
      report,
      fallbackReview,
      textReplay,
      asciiReplay,
      reviewPrompt,
      serializedRecord,
      serializedReport,
      serializedFallbackReview,
      policyBefore: policyBeforeMatch,
      nextPolicy,
      rounds: result.rounds,
      winner: result.result.winner,
      resultMethod: result.result.method,
      eventCount: result.events.length,
    });
  }

  if (matches.length !== 3) {
    throw new GridSeriesCanaryCoreError(
      `Series canary must execute exactly 3 matches; produced ${matches.length}`,
    );
  }
  if (adaptations.length !== 2) {
    throw new GridSeriesCanaryCoreError(
      `Series canary must apply exactly 2 adaptations; produced ${adaptations.length}`,
    );
  }
  if (!translatedGridMovementObserved) {
    throw new GridSeriesCanaryCoreError(
      "Series canary requires at least one translated grid movement across the three matches",
    );
  }
  if (!combatAttemptObserved) {
    throw new GridSeriesCanaryCoreError(
      "Series canary requires at least one attack_attempted event across the three matches",
    );
  }

  const adaptationTrace: GridSeriesCanaryAdaptationTraceV1 = {
    schemaVersion: "1",
    scenarioVersion: "grid-series-canary-adaptive-v1",
    adaptationRuleVersion: "grid-canary-policy-adaptation-v1",
    seriesId: params.seriesId,
    baseSeed: params.baseSeed,
    transitions: [
      {
        sourceMatchNumber: adaptations[0]!.sourceMatchNumber,
        sourceMatchId: adaptations[0]!.sourceMatchId,
        sourceSeed: adaptations[0]!.sourceSeed,
        policyBefore: { ...adaptations[0]!.policyBefore },
        policyAfter: { ...adaptations[0]!.policyAfter },
        authoritativeFacts: { ...adaptations[0]!.authoritativeFacts },
        decision: { ...adaptations[0]!.decision },
      },
      {
        sourceMatchNumber: adaptations[1]!.sourceMatchNumber,
        sourceMatchId: adaptations[1]!.sourceMatchId,
        sourceSeed: adaptations[1]!.sourceSeed,
        policyBefore: { ...adaptations[1]!.policyBefore },
        policyAfter: { ...adaptations[1]!.policyAfter },
        authoritativeFacts: { ...adaptations[1]!.authoritativeFacts },
        decision: { ...adaptations[1]!.decision },
      },
    ],
  };

  const evidence: GridSeriesCanaryCoreEvidence = {
    matchCount: 3,
    allMatchesTerminated: true,
    allMatchRecordsV3: true,
    allFactualReportsV2: true,
    allReportsBoundToRecords: true,
    allFallbackReviewsValid: true,
    allReplayFinalStatesAgree: true,
    allMovementZonesCanonical: true,
    translatedGridMovementObserved,
    combatAttemptObserved,
    policyAdaptationCount: 2,
    adaptationFactsAgree: true,
  };

  return {
    matches: matches as [
      GridSeriesCanaryExecutedMatch,
      GridSeriesCanaryExecutedMatch,
      GridSeriesCanaryExecutedMatch,
    ],
    adaptations: adaptations as [GridSeriesCanaryAdaptation, GridSeriesCanaryAdaptation],
    adaptationTrace,
    serializedAdaptationTrace: serializeGridSeriesCanaryAdaptationTrace(adaptationTrace),
    evidence,
  };
}
