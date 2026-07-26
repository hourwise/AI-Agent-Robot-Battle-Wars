import { randomUUID } from "node:crypto";
import type { ArenaAgent, OpponentSummary } from "../agents/arena-agent.js";
import type { MachineBuildProposal } from "../validation/validation.types.js";
import type { MatchResult } from "../simulator/types.js";
import type { AgentUsageRecord } from "../types/agent-usage.js";
import type {
  SeriesRecord,
  SeriesMatchEntry,
  AgentUsageRecordEntry,
} from "../schemas/series.schema.js";
import type { SeriesRepository } from "../persistence/series-repository.js";
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
import {
  createBulwarkBuild,
  BULWARK_POLICY,
  getBulwarkOpponentSummary,
} from "../agents/scripted/bulwark-agent.js";

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
  seedSource: SeedSource;
  logger: SeriesLogger;
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

function createMatchRecordSummary(result: MatchResult) {
  return {
    matchId: randomUUID(),
    createdAt: new Date().toISOString(),
    seed: result.config.seed,
    rounds: result.rounds,
    winner: result.result.winner,
    resultMethod: result.result.method,
  };
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

export async function runSeries(
  request: RunSeriesRequest,
  deps: RunSeriesDependencies,
): Promise<SeriesRecord> {
  const { agent, seriesRepository, seedSource, logger } = deps;
  const maximumMatches = request.maximumMatches ?? 5;
  const targetWins = request.targetWins ?? 3;

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
  const priorMatchSummaries: string[] = [];

  for (let matchNumber = 1; matchNumber <= maximumMatches; matchNumber++) {
    const seed = seedSource.nextSeed();
    logger.info(`--- Match ${matchNumber} of ${maximumMatches} (seed: ${seed}) ---`);

    const designRequest = {
      ...(currentDesign ? { priorBuild: currentDesign } : {}),
      ...(priorMatchSummaries.length > 0
        ? { context: `Previous matches: ${priorMatchSummaries.join("; ")}` }
        : {}),
    };

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
      priorMatchSummaries,
    });

    const policyUsage = agent.usageFromResult(policyResult, "policy");
    const currentPolicy = policyResult.value;

    logger.info(
      `Policy: ${currentPolicy.opening} opening, ${currentPolicy.aggression}% aggression`,
    );

    const matchResult = runMatch({
      seed,
      fighterA: { build: buildValidation.build, policy: currentPolicy },
      fighterB: { build: createBulwarkBuild(), policy: BULWARK_POLICY },
      rulesetVersion: RULESET_VERSION,
      catalogueVersion: CATALOGUE_V1.version,
    });

    const factualReport = buildFactualReport(matchResult);
    const enrichedReport = enrichMatchSummariesWithPolicy(
      factualReport,
      currentPolicy,
      BULWARK_POLICY,
    );

    const matchSummary = createMatchRecordSummary(matchResult);
    logger.info(
      `Result: ${matchSummary.winner ?? "Draw"} by ${matchSummary.resultMethod} in ${matchSummary.rounds} rounds`,
    );

    let reviewFailure: { category: string; message: string } | undefined;

    try {
      const reviewResult = await agent.reviewMatch({ factualReport: enrichedReport });
      const review = reviewResult.value;
      const reviewUsage = agent.usageFromResult(reviewResult, "review");

      if (reviewResult.fallbackUsed) {
        reviewFailure = {
          category: "fallback",
          message: "AI review unavailable, using deterministic fallback",
        };
      }

      logger.info(`Review: ${review.summary}`);

      const allUsage: AgentUsageRecordEntry[] = [
        usageToEntry(designUsage),
        usageToEntry(policyUsage),
        usageToEntry(reviewUsage),
      ];

      const entry: SeriesMatchEntry = {
        matchNumber,
        seed,
        match: matchSummary,
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
    } catch (e) {
      reviewFailure = {
        category: "error",
        message: e instanceof Error ? e.message : String(e),
      };
      logger.warn(`Review failed: ${reviewFailure.message}`);

      const allUsage: AgentUsageRecordEntry[] = [
        usageToEntry(designUsage),
        usageToEntry(policyUsage),
      ];

      const entry: SeriesMatchEntry = {
        matchNumber,
        seed,
        match: matchSummary,
        factualReport: enrichedReport,
        review: null,
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
    }

    if (matchSummary.winner === request.competitor.id) {
      record = { ...record, score: { ...record.score, aiWins: record.score.aiWins + 1 } };
    } else if (matchSummary.winner !== null) {
      record = {
        ...record,
        score: { ...record.score, bulwarkWins: record.score.bulwarkWins + 1 },
      };
    } else {
      record = { ...record, score: { ...record.score, draws: record.score.draws + 1 } };
    }

    priorMatchSummaries.push(
      `${matchSummary.winner ?? "Draw"} by ${matchSummary.resultMethod} in ${matchSummary.rounds} rounds (seed ${seed})`,
    );

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
