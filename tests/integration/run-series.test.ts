import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { runSeries } from "../../src/app/run-series.js";
import { JsonSeriesRepository } from "../../src/persistence/series-repository.js";
import { DeterministicSeedSource } from "../../src/seed-source.js";
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
    primaryTarget: "rear",
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
  };
}

function createMockAgent(): ArenaAgent {
  return {
    id: "mock",
    displayName: "Mock Agent",
    provider: "mock",
    model: "mock-model",

    async designMachine(
      _request: DesignRequest,
    ): Promise<AgentResult<MachineBuildProposal>> {
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

describe("runSeries integration", () => {
  let tempDir: string;
  let repo: JsonSeriesRepository;
  let agent: ArenaAgent;
  let logs: string[];

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "forge-series-int-"));
    repo = new JsonSeriesRepository(tempDir);
    agent = createMockAgent();
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

  it("completes a 3-match series with a winner", async () => {
    const seedSource = new DeterministicSeedSource([101, 202, 303, 404, 505]);
    const record = await runSeries(
      {
        competitor: { id: "mock", displayName: "Mock AI", provider: "mock" },
        targetWins: 3,
        maximumMatches: 5,
      },
      { agent, seriesRepository: repo, seedSource, logger },
    );

    expect(record.status).toBe("completed");
    expect(record.winner).toBeDefined();
    expect(record.entries).toHaveLength(3);
    expect(record.score.aiWins + record.score.bulwarkWins).toBe(3);
  });

  it("saves series checkpoints after each match", async () => {
    const seedSource = new DeterministicSeedSource([101, 202, 303]);
    await runSeries(
      {
        competitor: { id: "mock", displayName: "Mock AI", provider: "mock" },
        targetWins: 3,
        maximumMatches: 5,
      },
      { agent, seriesRepository: repo, seedSource, logger },
    );

    const saved = await repo.getSeries(
      logs.find((l) => l.startsWith("Series "))?.split(" ")[1] ?? "",
    );
    expect(saved).not.toBeNull();
  });

  it("stops after maximumMatches even without winner", async () => {
    const seedSource = new DeterministicSeedSource([101, 202]);
    const record = await runSeries(
      {
        competitor: { id: "mock", displayName: "Mock AI", provider: "mock" },
        targetWins: 3,
        maximumMatches: 2,
      },
      { agent, seriesRepository: repo, seedSource, logger },
    );

    expect(record.status).toBe("completed");
    expect(record.entries).toHaveLength(2);
  });

  it("handles review failure gracefully (fallback)", async () => {
    const failingAgent: ArenaAgent = {
      ...createMockAgent(),
      async reviewMatch(): Promise<AgentResult<MatchReview>> {
        throw new Error("Review API down");
      },
    };

    const seedSource = new DeterministicSeedSource([101]);
    const record = await runSeries(
      {
        competitor: { id: "mock", displayName: "Mock AI", provider: "mock" },
        targetWins: 3,
        maximumMatches: 1,
      },
      { agent: failingAgent, seriesRepository: repo, seedSource, logger },
    );

    expect(record.entries).toHaveLength(1);
    expect(record.entries[0]!.review).toBeNull();
    expect(record.entries[0]!.reviewFailure).toBeDefined();
    expect(record.entries[0]!.reviewFailure!.category).toBe("error");
  });

  it("each entry has usage records", async () => {
    const seedSource = new DeterministicSeedSource([101, 202]);
    const record = await runSeries(
      {
        competitor: { id: "mock", displayName: "Mock AI", provider: "mock" },
        targetWins: 3,
        maximumMatches: 2,
      },
      { agent, seriesRepository: repo, seedSource, logger },
    );

    for (const entry of record.entries) {
      expect(entry.usage.length).toBeGreaterThanOrEqual(2);
      expect(entry.usage[0]!.phase).toBe("design");
      expect(entry.usage[1]!.phase).toBe("policy");
    }
  });

  it("totalUsage is correctly aggregated", async () => {
    const seedSource = new DeterministicSeedSource([101]);
    const record = await runSeries(
      {
        competitor: { id: "mock", displayName: "Mock AI", provider: "mock" },
        targetWins: 3,
        maximumMatches: 1,
      },
      { agent, seriesRepository: repo, seedSource, logger },
    );

    expect(record.totalUsage.recordCount).toBeGreaterThanOrEqual(2);
    expect(record.totalUsage.totalInputTokens).toBeGreaterThan(0);
  });

  it("captures design and policy in each entry", async () => {
    const seedSource = new DeterministicSeedSource([101]);
    const record = await runSeries(
      {
        competitor: { id: "mock", displayName: "Mock AI", provider: "mock" },
        targetWins: 3,
        maximumMatches: 1,
      },
      { agent, seriesRepository: repo, seedSource, logger },
    );

    const entry = record.entries[0]!;
    expect(entry.designBeforeMatch.machineName).toBe("TestBot");
    expect(entry.policyBeforeMatch.opening).toBe("flank");
  });
});
