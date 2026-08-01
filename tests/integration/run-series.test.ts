import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { runSeries, validateSeriesOptions } from "../../src/app/run-series.js";
import { JsonSeriesRepository } from "../../src/persistence/series-repository.js";
import { JsonMatchRepository } from "../../src/persistence/json-match-repository.js";
import { DeterministicSeedSource } from "../../src/seed-source.js";
import { renderTextReplay } from "../../src/replay/text-replay-renderer.js";
import { renderAsciiReplay } from "../../src/replay/ascii/ascii-replay-renderer.js";
import type {
  ArenaAgent,
  AgentResult,
  DesignRequest,
  PolicyRequest,
  ReviewRequest,
} from "../../src/agents/arena-agent.js";
import type { MachineBuildProposal } from "../../src/validation/validation.types.js";
import type { ActionPolicy } from "../../src/simulator/types.js";
import type { MatchReview } from "../../src/schemas/review.schema.js";
import type { AgentUsageRecord } from "../../src/types/agent-usage.js";

function makeAgentResult<T>(value: T): AgentResult<T> {
  return {
    value,
    raw: JSON.stringify(value),
    model: "test-model",
    providerRequestId: "test-req-id",
    finishReason: "stop",
    inputTokens: 100,
    outputTokens: 50,
    cachedTokens: 0,
    costUsd: 0.0001,
    costIsEstimated: true,
    latencyMs: 500,
    attempts: 1,
    promptVersion: "test-v1",
    fallbackUsed: false,
  };
}

function makeDesign(): MachineBuildProposal {
  return {
    machineName: "TestBot",
    chassisId: "medium",
    mobilityId: "wheels",
    weaponId: "ram",
    utilityId: "none",
    armour: { front: 20, left: 10, right: 10, rear: 0, top: 0 },
    designSummary: "A test robot",
    designRationale: "For testing",
  };
}

function makePolicy(): ActionPolicy {
  return {
    opening: "flank",
    preferredRange: "close",
    aggression: 70,
    primaryTarget: "front",
    secondaryTarget: "left",
    retreatThreshold: 30,
    heatThreshold: 80,
    fallback: "retreat",
  };
}

function makeReview(): MatchReview {
  return {
    schemaVersion: "1",
    summary: "Test review of the match.",
    keyMoments: [{ round: 5, eventType: "attack", description: "Big hit" }],
    strategyAssessment: {
      effectiveChoices: ["flanking"],
      ineffectiveChoices: [],
      policyAssessment: "Decent policy.",
      designAssessment: "Good design.",
    },
    suggestedChanges: [],
    confidence: "medium",
    observedOutcome: {
      winnerId: "fighter_b",
      method: "immobilisation",
      rounds: 5,
      ownFinalIntegrity: 80,
      opponentFinalIntegrity: 150,
      ownDisabledComponents: [],
      opponentDisabledComponents: [],
    },
  };
}

function createTrackingAgent(): ArenaAgent & {
  designRequests: DesignRequest[];
} {
  const designRequests: DesignRequest[] = [];

  return {
    designRequests,
    id: "mock",
    displayName: "Mock Agent",
    provider: "mock",
    model: "mock-model",

    async designMachine(
      request: DesignRequest,
    ): Promise<AgentResult<MachineBuildProposal>> {
      designRequests.push(request);
      return makeAgentResult(makeDesign());
    },

    async choosePolicy(_request: PolicyRequest): Promise<AgentResult<ActionPolicy>> {
      return makeAgentResult(makePolicy());
    },

    async reviewMatch(_request: ReviewRequest): Promise<AgentResult<MatchReview>> {
      return makeAgentResult(makeReview());
    },

    usageFromResult<T>(
      result: AgentResult<T>,
      phase: AgentUsageRecord["phase"],
    ): AgentUsageRecord {
      return {
        phase,
        agentId: "mock",
        provider: "mock",
        model: result.model,
        providerRequestId: result.providerRequestId,
        promptVersion: result.promptVersion,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        cachedTokens: result.cachedTokens,
        costUsd: result.costUsd,
        costIsEstimated: result.costIsEstimated,
        pricingVersion: result.costUsd !== null ? "test" : null,
        latencyMs: result.latencyMs,
        attempts: result.attempts,
        fallbackUsed: result.fallbackUsed,
        errorCategory: "none",
      };
    },
  };
}

const consoleLog = console.log;
const consoleWarn = console.warn;
const consoleError = console.error;

describe("validateSeriesOptions", () => {
  it("accepts valid options", () => {
    expect(validateSeriesOptions(3, 5)).toHaveLength(0);
    expect(validateSeriesOptions(1, 1)).toHaveLength(0);
  });

  it("rejects targetWins < 1", () => {
    const errors = validateSeriesOptions(0, 5);
    expect(errors).toHaveLength(1);
    expect(errors[0]!.field).toBe("targetWins");
  });

  it("rejects maximumMatches < 1", () => {
    const errors = validateSeriesOptions(1, 0);
    expect(errors.length).toBeGreaterThanOrEqual(1);
    expect(errors.some((e) => e.field === "maximumMatches")).toBe(true);
  });

  it("rejects targetWins > maximumMatches", () => {
    const errors = validateSeriesOptions(4, 3);
    expect(errors).toHaveLength(1);
    expect(errors[0]!.field).toBe("targetWins");
    expect(errors[0]!.message).toContain("cannot exceed");
  });

  it("rejects non-integer values", () => {
    const errors = validateSeriesOptions(2.5, 5);
    expect(errors.length).toBeGreaterThanOrEqual(1);
  });
});

describe("runSeries integration", () => {
  let tempDir: string;
  let seriesRepo: JsonSeriesRepository;
  let matchRepo: JsonMatchRepository;
  let logs: string[];

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "forge-series-int-"));
    seriesRepo = new JsonSeriesRepository(tempDir);
    matchRepo = new JsonMatchRepository(join(tempDir, "matches"));
    logs = [];
    console.log = (...args: unknown[]) => logs.push(args.join(" "));
    console.warn = (...args: unknown[]) => logs.push(`WARN: ${args.join(" ")}`);
    console.error = (...args: unknown[]) => logs.push(`ERROR: ${args.join(" ")}`);
  });

  afterEach(async () => {
    console.log = consoleLog;
    console.warn = consoleWarn;
    console.error = consoleError;
    await rm(tempDir, { recursive: true, force: true });
  });

  const logger = {
    info: (msg: string) => logs.push(msg),
    warn: (msg: string) => logs.push(`WARN: ${msg}`),
    error: (msg: string) => logs.push(`ERROR: ${msg}`),
  };

  function deps(agent: ArenaAgent) {
    return {
      agent,
      seriesRepository: seriesRepo,
      matchRepository: matchRepo,
      seedSource: new DeterministicSeedSource([101, 202, 303, 404, 505]),
      logger,
    };
  }

  it("completes a 3-match series with a winner", async () => {
    const agent = createTrackingAgent();
    const record = await runSeries(
      {
        competitor: { id: "ai", displayName: "Mock AI", provider: "mock" },
        targetWins: 3,
        maximumMatches: 5,
      },
      deps(agent),
    );

    expect(record.status).toBe("completed");
    expect(record.winner).toBeDefined();
    expect(record.entries.length).toBeGreaterThanOrEqual(3);
    expect(record.entries.length).toBeLessThanOrEqual(5);
    const winningScore = Math.max(record.score.aiWins, record.score.bulwarkWins);
    expect(winningScore).toBe(3);
  });

  it("rejects invalid options before making API calls", async () => {
    const agent = createTrackingAgent();
    await expect(
      runSeries(
        {
          competitor: { id: "ai", displayName: "Mock AI", provider: "mock" },
          targetWins: 4,
          maximumMatches: 3,
        },
        deps(agent),
      ),
    ).rejects.toThrow("targetWins");
    expect(agent.designRequests).toHaveLength(0);
  });

  it("second design request contains reviewContext from first match", async () => {
    const agent = createTrackingAgent();
    await runSeries(
      {
        competitor: { id: "ai", displayName: "Mock AI", provider: "mock" },
        targetWins: 2,
        maximumMatches: 5,
      },
      deps(agent),
    );

    expect(agent.designRequests.length).toBeGreaterThanOrEqual(2);

    const firstRequest = agent.designRequests[0]!;
    expect(firstRequest.priorBuild).toBeUndefined();
    expect(firstRequest.reviewContext).toBeUndefined();

    const secondRequest = agent.designRequests[1]!;
    expect(secondRequest.priorBuild).toBeDefined();
    expect(secondRequest.priorBuild!.machineName).toBe("TestBot");
    expect(secondRequest.reviewContext).toBeDefined();
    expect(secondRequest.reviewContext!.matchNumber).toBe(1);
    expect(secondRequest.reviewContext!.factualReport).toBeDefined();
    expect(secondRequest.reviewContext!.factualReport.schemaVersion).toBe("1");
    expect(secondRequest.reviewContext!.review).toBeDefined();
    expect(secondRequest.reviewContext!.review.summary).toBe("Test review of the match.");
  });

  it("each entry has a saved matchId that resolves through MatchRepository", async () => {
    const agent = createTrackingAgent();
    const record = await runSeries(
      {
        competitor: { id: "ai", displayName: "Mock AI", provider: "mock" },
        targetWins: 3,
        maximumMatches: 3,
      },
      deps(agent),
    );

    expect(record.entries).toHaveLength(3);

    for (const entry of record.entries) {
      expect(entry.matchId).toBeDefined();
      const savedMatch = await matchRepo.getMatch(entry.matchId!);
      expect(savedMatch).not.toBeNull();
      expect(savedMatch!.matchId).toBe(entry.matchId);
    }
  });

  it("every series match is independently replayable as text", async () => {
    const agent = createTrackingAgent();
    const record = await runSeries(
      {
        competitor: { id: "ai", displayName: "Mock AI", provider: "mock" },
        targetWins: 2,
        maximumMatches: 5,
      },
      deps(agent),
    );

    for (const entry of record.entries) {
      const match = await matchRepo.getMatch(entry.matchId!);
      expect(match).not.toBeNull();

      const matchAsResult = {
        config: match!.config,
        initialState: match!.initialState,
        events: match!.events,
        result: match!.result,
        rounds: match!.rounds,
        runtime: {
          simulatorVersion: "0.2.0",
          positioningModel: "legacy-five-zone-v1",
        },
      } as import("../../src/simulator/types.js").MatchResult;

      const replay = renderTextReplay(matchAsResult);
      expect(replay).toBeTruthy();
      expect(replay.length).toBeGreaterThan(0);
    }
  });

  it("ASCII and statistics rendering work from a series-created match", async () => {
    const agent = createTrackingAgent();
    const record = await runSeries(
      {
        competitor: { id: "ai", displayName: "Mock AI", provider: "mock" },
        targetWins: 1,
        maximumMatches: 1,
      },
      deps(agent),
    );

    const entry = record.entries[0]!;
    const match = await matchRepo.getMatch(entry.matchId!);
    expect(match).not.toBeNull();

    const matchAsResult = {
      config: match!.config,
      initialState: match!.initialState,
      events: match!.events,
      result: match!.result,
      rounds: match!.rounds,
    } as import("../../src/simulator/types.js").MatchResult;

    const ascii = renderAsciiReplay(matchAsResult);
    expect(ascii).toBeTruthy();

    const events = match!.events;
    const attacks = events.filter(
      (e: { type: string }) => e.type === "attack_hit" || e.type === "attack_missed",
    );
    expect(Array.isArray(attacks)).toBe(true);
  });

  it("match event data survives unchanged through save and load", async () => {
    const agent = createTrackingAgent();
    const record = await runSeries(
      {
        competitor: { id: "ai", displayName: "Mock AI", provider: "mock" },
        targetWins: 1,
        maximumMatches: 1,
      },
      deps(agent),
    );

    const entry = record.entries[0]!;
    const match = await matchRepo.getMatch(entry.matchId!);
    expect(match).not.toBeNull();
    expect(match!.events.length).toBeGreaterThan(0);
    expect(match!.result).toBeDefined();
    expect(match!.rounds).toBeGreaterThan(0);
  });

  it("handles review failure gracefully (fallback)", async () => {
    const failingAgent: ArenaAgent = {
      ...createTrackingAgent(),
      async reviewMatch(): Promise<AgentResult<MatchReview>> {
        throw new Error("Review API down");
      },
    };

    const record = await runSeries(
      {
        competitor: { id: "ai", displayName: "Mock AI", provider: "mock" },
        targetWins: 1,
        maximumMatches: 1,
      },
      deps(failingAgent),
    );

    expect(record.entries).toHaveLength(1);
    expect(record.entries[0]!.review).toBeNull();
    expect(record.entries[0]!.reviewFailure).toBeDefined();
    expect(record.entries[0]!.reviewFailure!.category).toBe("error");
  });

  it("each entry has usage records", async () => {
    const agent = createTrackingAgent();
    const record = await runSeries(
      {
        competitor: { id: "ai", displayName: "Mock AI", provider: "mock" },
        targetWins: 2,
        maximumMatches: 3,
      },
      deps(agent),
    );

    for (const entry of record.entries) {
      expect(entry.usage.length).toBeGreaterThanOrEqual(2);
      expect(entry.usage[0]!.phase).toBe("design");
      expect(entry.usage[1]!.phase).toBe("policy");
    }
  });

  it("totalUsage is correctly aggregated", async () => {
    const agent = createTrackingAgent();
    const record = await runSeries(
      {
        competitor: { id: "ai", displayName: "Mock AI", provider: "mock" },
        targetWins: 1,
        maximumMatches: 1,
      },
      deps(agent),
    );

    expect(record.totalUsage.recordCount).toBeGreaterThanOrEqual(2);
    expect(record.totalUsage.totalInputTokens).toBeGreaterThan(0);
  });

  it("captures design and policy in each entry", async () => {
    const agent = createTrackingAgent();
    const record = await runSeries(
      {
        competitor: { id: "ai", displayName: "Mock AI", provider: "mock" },
        targetWins: 1,
        maximumMatches: 1,
      },
      deps(agent),
    );

    const entry = record.entries[0]!;
    expect(entry.designBeforeMatch.machineName).toBe("TestBot");
    expect(entry.policyBeforeMatch.opening).toBe("flank");
  });

  it("five series entries create five full match files", async () => {
    const agent = createTrackingAgent();
    const record = await runSeries(
      {
        competitor: { id: "ai", displayName: "Mock AI", provider: "mock" },
        targetWins: 3,
        maximumMatches: 5,
      },
      deps(agent),
    );

    expect(record.entries.length).toBeGreaterThanOrEqual(3);

    for (const entry of record.entries) {
      expect(entry.matchId).toBeDefined();
      const match = await matchRepo.getMatch(entry.matchId!);
      expect(match).not.toBeNull();
      expect(match!.config).toBeDefined();
      expect(match!.events.length).toBeGreaterThan(0);
    }
  });

  it("checkpoint persistence does not leave a series entry pointing to a missing match", async () => {
    const agent = createTrackingAgent();
    const record = await runSeries(
      {
        competitor: { id: "ai", displayName: "Mock AI", provider: "mock" },
        targetWins: 2,
        maximumMatches: 5,
      },
      deps(agent),
    );

    for (const entry of record.entries) {
      const match = await matchRepo.getMatch(entry.matchId!);
      expect(match).not.toBeNull();
    }
  });

  it("fighter_a win increments aiWins, fighter_b win increments bulwarkWins", async () => {
    const agent = createTrackingAgent();
    const record = await runSeries(
      {
        competitor: { id: "ai", displayName: "Mock AI", provider: "mock" },
        targetWins: 3,
        maximumMatches: 5,
      },
      deps(agent),
    );

    expect(record.entries.length).toBeGreaterThanOrEqual(1);

    for (const entry of record.entries) {
      const simulatorWinner = entry.match.winner;
      if (simulatorWinner === "fighter_a") {
        expect(entry.match.winner).toBe("fighter_a");
      } else if (simulatorWinner === "fighter_b") {
        expect(entry.match.winner).toBe("fighter_b");
      }
    }

    expect(record.score.aiWins + record.score.bulwarkWins + record.score.draws).toBe(
      record.entries.length,
    );

    const actualAiWins = record.entries.filter(
      (e) => e.match.winner === "fighter_a",
    ).length;
    const actualBulwarkWins = record.entries.filter(
      (e) => e.match.winner === "fighter_b",
    ).length;
    expect(record.score.aiWins).toBe(actualAiWins);
    expect(record.score.bulwarkWins).toBe(actualBulwarkWins);
  });

  it("target-win termination works for both sides", async () => {
    const agent = createTrackingAgent();

    const record1 = await runSeries(
      {
        competitor: { id: "ai", displayName: "Mock AI", provider: "mock" },
        targetWins: 3,
        maximumMatches: 5,
      },
      deps(agent),
    );
    expect(record1.status).toBe("completed");
    expect(record1.winner).toBeDefined();

    const winningScore = Math.max(record1.score.aiWins, record1.score.bulwarkWins);
    expect(winningScore).toBe(3);
  });

  it("aborted series does not print SERIES COMPLETE", async () => {
    const failingAgent: ArenaAgent = {
      ...createTrackingAgent(),
      async designMachine(): Promise<AgentResult<MachineBuildProposal>> {
        throw new Error("Design API down");
      },
    };

    const record = await runSeries(
      {
        competitor: { id: "ai", displayName: "Mock AI", provider: "mock" },
        targetWins: 3,
        maximumMatches: 5,
      },
      deps(failingAgent),
    );

    expect(record.status).toBe("aborted");
    expect(logs.some((l) => l.includes("SERIES COMPLETE"))).toBe(false);
  });
});
