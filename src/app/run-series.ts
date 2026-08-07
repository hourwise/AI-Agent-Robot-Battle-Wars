import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import type {
  ArenaAgent,
  OpponentSummary,
  RebuildContext,
} from "../agents/arena-agent.js";
import type { MachineBuildProposal } from "../validation/validation.types.js";
import type { AgentUsageRecord } from "../types/agent-usage.js";
import type {
  SeriesRecord,
  SeriesMatchEntry,
  AgentUsageRecordEntry,
} from "../schemas/series.schema.js";
import type { FactualMatchReport } from "../schemas/factual-report.schema.js";
import type { MatchReview } from "../schemas/review.schema.js";
import type { SeriesRepository } from "../persistence/series-repository.js";
import type { MatchRepository } from "../persistence/json-match-repository.js";
import type { SeedSource } from "../seed-source.js";
import { runMatch } from "../simulator/simulator.js";
import { CATALOGUE_V1 } from "../catalogue/catalogue.v1.js";
import { RULESET_VERSION } from "../simulator/constants.js";
import { validateBuild } from "../validation/build-validator.js";
import {
  buildFactualReport,
  enrichMatchSummariesWithPolicy,
} from "../reports/factual-match-report.js";
import { buildUsageSummary } from "../schemas/series.schema.js";
import { matchResultToRecord } from "../persistence/match-converter.js";
import { getBulwarkOpponentSummary } from "../agents/scripted/bulwark-agent.js";
import { loadLegacyBulwark } from "../opponents/legacy-bulwark.js";
import { RandomSeedSource } from "../seed-source.js";
import { JsonSeriesRepository } from "../persistence/series-repository.js";
import { JsonMatchRepository } from "../persistence/json-match-repository.js";
import { renderSeriesReport } from "../reports/series-report.js";
import { buildComparativeReportModel } from "../reports/series-report.js";

export interface SeriesLogger {
  info(message: string): void;
  warn(message: string): void;
  error(message: string): void;
}

export interface RunSeriesRequest {
  competitor: { id: string; displayName: string; provider: string };
  maximumMatches?: number;
  targetWins?: number;
}

export interface RunSeriesDependencies {
  agent: ArenaAgent;
  seriesRepository: SeriesRepository;
  matchRepository: MatchRepository;
  seedSource: SeedSource;
  logger: SeriesLogger;
}

export interface SeriesValidationError {
  field: string;
  message: string;
}

export function validateSeriesOptions(
  targetWins: number,
  maximumMatches: number,
): SeriesValidationError[] {
  const errors: SeriesValidationError[] = [];

  if (!Number.isInteger(targetWins) || targetWins < 1) {
    errors.push({ field: "targetWins", message: "targetWins must be an integer >= 1" });
  }

  if (!Number.isInteger(maximumMatches) || maximumMatches < 1) {
    errors.push({
      field: "maximumMatches",
      message: "maximumMatches must be an integer >= 1",
    });
  }

  if (Number.isInteger(targetWins) && Number.isInteger(maximumMatches)) {
    if (targetWins > maximumMatches) {
      errors.push({
        field: "targetWins",
        message: `targetWins (${targetWins}) cannot exceed maximumMatches (${maximumMatches}) — no one can reach ${targetWins} wins before the cap`,
      });
    }
  }

  return errors;
}

function buildOpponentSummary(): OpponentSummary {
  return getBulwarkOpponentSummary();
}

function validateLegalBuild(proposal: MachineBuildProposal):
  | {
      ok: true;
      build: import("../validation/validation.types.js").ValidatedBuild;
    }
  | { ok: false; errors: string[] } {
  const result = validateBuild(proposal, CATALOGUE_V1);
  if (result.ok) {
    return { ok: true, build: result.build };
  }
  return { ok: false, errors: result.errors.map((e) => `${e.field}: ${e.message}`) };
}

function usageToEntry(record: AgentUsageRecord): AgentUsageRecordEntry {
  return {
    phase: record.phase,
    agentId: record.agentId,
    provider: record.provider,
    model: record.model,
    providerRequestId: record.providerRequestId,
    promptVersion: record.promptVersion,
    inputTokens: record.inputTokens,
    outputTokens: record.outputTokens,
    cachedTokens: record.cachedTokens,
    costUsd: record.costUsd,
    costIsEstimated: record.costIsEstimated,
    pricingVersion: record.pricingVersion,
    latencyMs: record.latencyMs,
    attempts: record.attempts,
    fallbackUsed: record.fallbackUsed,
    errorCategory: record.errorCategory,
  };
}

function collectAllUsage(entries: readonly SeriesMatchEntry[]): AgentUsageRecordEntry[] {
  const all: AgentUsageRecordEntry[] = [];
  for (const entry of entries) {
    all.push(...entry.usage);
  }
  return all;
}

interface ParticipantMapping {
  fighter_a: string;
  fighter_b: string;
}

function buildParticipantMapping(_competitorId: string): ParticipantMapping {
  // Canonical roles: fighter_a is always the AI competitor, fighter_b is Bulwark.
  return {
    fighter_a: "ai",
    fighter_b: "bulwark",
  };
}

function resolveWinner(
  simulatorWinner: string | null,
  mapping: ParticipantMapping,
): "ai" | "bulwark" | null {
  if (simulatorWinner === null) return null;
  if (simulatorWinner === "fighter_a") return mapping.fighter_a as "ai";
  if (simulatorWinner === "fighter_b") return mapping.fighter_b as "bulwark";
  return null;
}

export async function runSeries(
  request: RunSeriesRequest,
  deps: RunSeriesDependencies,
): Promise<SeriesRecord> {
  const { agent, seriesRepository, matchRepository, seedSource, logger } = deps;
  const maximumMatches = request.maximumMatches ?? 5;
  const targetWins = request.targetWins ?? 3;

  const validationErrors = validateSeriesOptions(targetWins, maximumMatches);
  if (validationErrors.length > 0) {
    const msg = validationErrors.map((e) => `${e.field}: ${e.message}`).join("; ");
    throw new Error(`Invalid series options: ${msg}`);
  }

  // Load the canonical legacy Bulwark exactly once per series invocation,
  // BEFORE any series record is created/persisted and BEFORE any
  // agent/provider request; a fixture failure fails closed with no partially
  // created series record and no provider work. The loaded immutable fixture
  // is reused across the complete series.
  const bulwark = await loadLegacyBulwark();

  const participantMapping = buildParticipantMapping(request.competitor.id);

  const seriesId = randomUUID();
  const now = new Date().toISOString();

  let record: SeriesRecord = {
    schemaVersion: "1",
    seriesId,
    createdAt: now,
    updatedAt: now,
    status: "in_progress",
    competitor: request.competitor,
    targetWins,
    maximumMatches,
    score: { aiWins: 0, bulwarkWins: 0, draws: 0 },
    entries: [],
    totalUsage: {
      totalCostUsd: null,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalCachedTokens: 0,
      costIsEstimated: false,
      recordCount: 0,
    },
    winner: null,
  };

  await seriesRepository.saveSeries(record);
  logger.info(`Series ${seriesId} created`);

  let currentDesign: MachineBuildProposal | null = null;
  let lastFactualReport: FactualMatchReport | null = null;
  let lastReview: MatchReview | null = null;
  let lastMatchNumber = 0;

  for (let matchNumber = 1; matchNumber <= maximumMatches; matchNumber++) {
    const seed = seedSource.nextSeed();
    logger.info(`--- Match ${matchNumber} of ${maximumMatches} (seed: ${seed}) ---`);

    const designRequest: import("../agents/arena-agent.js").DesignRequest = {};

    if (currentDesign) {
      (designRequest as { priorBuild: MachineBuildProposal }).priorBuild = currentDesign;
    }

    if (lastMatchNumber > 0 && lastFactualReport && lastReview) {
      (designRequest as { reviewContext: RebuildContext }).reviewContext = {
        matchNumber: lastMatchNumber,
        factualReport: lastFactualReport,
        review: lastReview,
      };
    }

    let designResult;
    try {
      designResult = await agent.designMachine(designRequest);
    } catch (e) {
      logger.error(`Design failed: ${e instanceof Error ? e.message : String(e)}`);
      record = {
        ...record,
        status: "aborted",
        updatedAt: new Date().toISOString(),
      };
      await seriesRepository.saveSeries(record);
      return record;
    }

    const designUsage = agent.usageFromResult(designResult, "design");
    currentDesign = designResult.value;

    const buildValidation = validateLegalBuild(currentDesign);
    if (!buildValidation.ok) {
      logger.error(`Illegal build: ${buildValidation.errors.join("; ")}`);
      record = {
        ...record,
        status: "aborted",
        updatedAt: new Date().toISOString(),
      };
      await seriesRepository.saveSeries(record);
      return record;
    }

    logger.info(
      `Design: ${currentDesign.machineName} (${currentDesign.chassisId}, ${currentDesign.weaponId})`,
    );

    const opponent = buildOpponentSummary();
    const policyResult = await agent.choosePolicy({
      build: currentDesign,
      opponent,
    });

    const policyUsage = agent.usageFromResult(policyResult, "policy");
    const currentPolicy = policyResult.value;

    logger.info(
      `Policy: ${currentPolicy.opening} opening, ${currentPolicy.aggression}% aggression`,
    );

    const matchResult = runMatch({
      seed,
      fighterA: { build: buildValidation.build, policy: currentPolicy },
      fighterB: { build: bulwark.validatedBuild, policy: bulwark.policy },
      rulesetVersion: RULESET_VERSION,
      catalogueVersion: CATALOGUE_V1.version,
    });

    const factualReport = buildFactualReport(matchResult);
    const enrichedReport = enrichMatchSummariesWithPolicy(
      factualReport,
      currentPolicy,
      bulwark.policy,
    );

    const resolvedWinner = resolveWinner(matchResult.result.winner, participantMapping);
    const resultMethod = matchResult.result.method;

    logger.info(
      `Result: ${resolvedWinner ?? "Draw"} by ${resultMethod} in ${matchResult.rounds} rounds`,
    );

    let review: MatchReview | null = null;
    let reviewFailure: { category: string; message: string } | undefined;
    const reviewUsageRecords: AgentUsageRecordEntry[] = [];

    try {
      const reviewResult = await agent.reviewMatch({ factualReport: enrichedReport });
      review = reviewResult.value;
      const reviewUsage = agent.usageFromResult(reviewResult, "review");
      reviewUsageRecords.push(usageToEntry(reviewUsage));

      if (reviewResult.fallbackUsed) {
        reviewFailure = {
          category: "fallback",
          message: "AI review unavailable, using deterministic fallback",
        };
      }

      logger.info(`Review: ${review.summary}`);
    } catch (e) {
      reviewFailure = {
        category: "error",
        message: e instanceof Error ? e.message : String(e),
      };
      logger.warn(`Review failed: ${reviewFailure.message}`);
    }

    const allUsage: AgentUsageRecordEntry[] = [
      usageToEntry(designUsage),
      usageToEntry(policyUsage),
      ...reviewUsageRecords,
    ];

    const matchRecord = matchResultToRecord(matchResult, [
      designUsage,
      policyUsage,
      ...reviewUsageRecords.map((u) => ({
        ...u,
        phase: u.phase as AgentUsageRecord["phase"],
      })),
    ]);

    try {
      await matchRepository.saveMatch(matchRecord);
      logger.info(`Match saved: ${matchRecord.matchId}`);
    } catch (e) {
      logger.error(`Failed to save match: ${e instanceof Error ? e.message : String(e)}`);
      record = {
        ...record,
        status: "aborted",
        updatedAt: new Date().toISOString(),
      };
      await seriesRepository.saveSeries(record);
      return record;
    }

    const entry: SeriesMatchEntry = {
      matchNumber,
      seed,
      matchId: matchRecord.matchId,
      match: {
        matchId: matchRecord.matchId,
        createdAt: matchRecord.createdAt,
        seed,
        rounds: matchResult.rounds,
        winner: matchResult.result.winner,
        resultMethod,
      },
      factualReport: enrichedReport,
      review,
      reviewFailure,
      designBeforeMatch: currentDesign,
      policyBeforeMatch: currentPolicy,
      usage: allUsage,
    };

    record = {
      ...record,
      entries: [...record.entries, entry],
      totalUsage: buildUsageSummary(collectAllUsage([...record.entries, entry])),
      updatedAt: new Date().toISOString(),
    };

    if (resolvedWinner === "ai") {
      record = { ...record, score: { ...record.score, aiWins: record.score.aiWins + 1 } };
    } else if (resolvedWinner === "bulwark") {
      record = {
        ...record,
        score: { ...record.score, bulwarkWins: record.score.bulwarkWins + 1 },
      };
    } else {
      record = { ...record, score: { ...record.score, draws: record.score.draws + 1 } };
    }

    lastFactualReport = enrichedReport;
    lastReview = review;
    lastMatchNumber = matchNumber;

    const aiWins = record.score.aiWins;
    const bulwarkWins = record.score.bulwarkWins;

    if (aiWins >= targetWins) {
      record = {
        ...record,
        status: "completed",
        winner: "ai",
        updatedAt: new Date().toISOString(),
      };
      await seriesRepository.saveSeries(record);
      logger.info(
        `Series complete: ${request.competitor.displayName} wins ${aiWins}-${bulwarkWins}`,
      );
      return record;
    }

    if (bulwarkWins >= targetWins) {
      record = {
        ...record,
        status: "completed",
        winner: "bulwark",
        updatedAt: new Date().toISOString(),
      };
      await seriesRepository.saveSeries(record);
      logger.info(`Series complete: The Bulwark wins ${bulwarkWins}-${aiWins}`);
      return record;
    }

    await seriesRepository.saveSeries(record);
  }

  let winner: "ai" | "bulwark" | null = null;
  if (record.score.aiWins > record.score.bulwarkWins) {
    winner = "ai";
  } else if (record.score.bulwarkWins > record.score.aiWins) {
    winner = "bulwark";
  }

  record = {
    ...record,
    status: "completed",
    winner,
    updatedAt: new Date().toISOString(),
  };

  await seriesRepository.saveSeries(record);
  logger.info(
    `Series complete: ${record.score.aiWins}-${record.score.bulwarkWins}-${record.score.draws}${winner ? ` (${winner} wins)` : " (draw)"}`,
  );

  return record;
}

function parseArgs(): {
  targetWins: number;
  maximumMatches: number;
  verbose: boolean;
} {
  const args = process.argv.slice(2);
  let targetWins = 3;
  let maximumMatches = 5;
  let verbose = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--target-wins" && args[i + 1]) {
      targetWins = parseInt(args[i + 1]!, 10);
      i++;
    } else if (args[i] === "--maximum-matches" && args[i + 1]) {
      maximumMatches = parseInt(args[i + 1]!, 10);
      i++;
    } else if (args[i] === "--verbose") {
      verbose = true;
    }
  }

  return { targetWins, maximumMatches, verbose };
}

async function main() {
  const { targetWins, maximumMatches, verbose } = parseArgs();

  const validationErrors = validateSeriesOptions(targetWins, maximumMatches);
  if (validationErrors.length > 0) {
    console.error("Invalid series options:");
    for (const e of validationErrors) {
      console.error(`  ${e.field}: ${e.message}`);
    }
    process.exit(1);
  }

  const { loadDeepSeekConfig } = await import("../agents/deepseek/deepseek-config.js");
  const { DeepSeekArenaAgent } = await import("../agents/deepseek/deepseek-agent.js");

  let config;
  try {
    config = loadDeepSeekConfig();
  } catch {
    console.error(
      "DeepSeek configuration not found. Set DEEPSEEK_API_KEY in .env or environment.",
    );
    process.exit(1);
  }

  const agent: ArenaAgent = new DeepSeekArenaAgent(config);
  const seriesDir = join(process.cwd(), "data", "series");
  const matchesDir = join(process.cwd(), "data", "matches");
  await mkdir(seriesDir, { recursive: true });
  await mkdir(matchesDir, { recursive: true });
  const seriesRepository = new JsonSeriesRepository(seriesDir);
  const matchRepository = new JsonMatchRepository(matchesDir);
  const seedSource = new RandomSeedSource();

  const logger: SeriesLogger = {
    info: (msg) => console.log(msg),
    warn: (msg) => console.log(`WARN: ${msg}`),
    error: (msg) => console.error(`ERROR: ${msg}`),
  };

  console.log("=".repeat(50));
  console.log("FORGE ARENA — Best-of-Five Series");
  console.log("=".repeat(50));
  console.log(`Target wins: ${targetWins}`);
  console.log(`Maximum matches: ${maximumMatches}`);
  console.log("");

  const record = await runSeries(
    {
      competitor: { id: "ai", displayName: "DeepSeek AI", provider: "deepseek" },
      targetWins,
      maximumMatches,
    },
    { agent, seriesRepository, matchRepository, seedSource, logger },
  );

  console.log("");
  console.log("=".repeat(50));

  if (record.status === "aborted") {
    console.log("SERIES ABORTED");
  } else {
    console.log("SERIES COMPLETE");
  }

  console.log("=".repeat(50));
  console.log(
    `Score: AI ${record.score.aiWins} - ${record.score.bulwarkWins} Bulwark (${record.score.draws} draws)`,
  );
  console.log(`Winner: ${record.winner ?? "none (draw)"}`);
  console.log(`Series ID: ${record.seriesId}`);

  if (record.totalUsage.recordCount > 0) {
    console.log("");
    console.log("API Usage:");
    console.log(`  Total input tokens: ${record.totalUsage.totalInputTokens}`);
    console.log(`  Total output tokens: ${record.totalUsage.totalOutputTokens}`);
    if (record.totalUsage.totalCostUsd !== null) {
      console.log(`  Total cost: $${record.totalUsage.totalCostUsd.toFixed(4)}`);
    }
  }

  if (record.entries.length > 0) {
    const model = buildComparativeReportModel(record);
    const report = renderSeriesReport(model);
    if (verbose) {
      console.log("");
      console.log(report);
    }
  }

  console.log(`\nSeries saved: ${seriesDir}/${record.seriesId}.json`);

  if (record.status === "aborted") {
    process.exit(1);
  }
}

if (
  process.argv[1] &&
  (process.argv[1].endsWith("run-series.ts") || process.argv[1].endsWith("run-series.js"))
) {
  main().catch((e) => {
    console.error("Fatal error:", e instanceof Error ? e.message : String(e));
    process.exit(1);
  });
}
