import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { runMatch } from "../simulator/simulator.js";
import { RULESET_VERSION } from "../simulator/constants.js";
import { CATALOGUE_V1 } from "../catalogue/catalogue.v1.js";
import {
  createBulwarkBuild,
  BULWARK_POLICY,
  getBulwarkOpponentSummary,
} from "../agents/scripted/bulwark-agent.js";
import { matchResultToRecord } from "../persistence/match-converter.js";
import { JsonMatchRepository } from "../persistence/json-match-repository.js";
import { renderTextReplay } from "../replay/text-replay-renderer.js";
import type { ValidatedBuild } from "../validation/validation.types.js";
import type { ActionPolicy } from "../simulator/types.js";
import type { AgentUsageRecord } from "../types/agent-usage.js";
import type { ArenaAgent } from "../agents/arena-agent.js";

const DATA_DIR = join(process.cwd(), "data", "matches");

interface FighterConfig {
  build: ValidatedBuild;
  policy: ActionPolicy;
  source: "bulwark" | "ai";
}

function parseArgs(): { seed: number; useAi: boolean } {
  const args = process.argv.slice(2);
  let seed = Math.floor(Math.random() * 1_000_000);
  let useAi = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--seed" && args[i + 1]) {
      seed = parseInt(args[i + 1]!, 10);
      if (isNaN(seed)) {
        console.error("Invalid seed value");
        process.exit(1);
      }
      i++;
    } else if (args[i] === "--ai") {
      useAi = true;
    }
  }

  return { seed, useAi };
}

async function loadAiFighter(
  opponentSummary: ReturnType<typeof getBulwarkOpponentSummary>,
): Promise<{ config: FighterConfig; usage: AgentUsageRecord[] }> {
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
  const usage: AgentUsageRecord[] = [];

  console.log("Requesting robot design from DeepSeek...");
  const designResult = await agent.designMachine({});
  usage.push(agent.usageFromResult(designResult, "design"));
  console.log(
    `  Design: ${designResult.value.machineName} (${designResult.attempts} attempt(s))`,
  );
  console.log(
    `  Tokens: ${designResult.inputTokens} in / ${designResult.outputTokens} out`,
  );
  if (designResult.fallbackUsed) {
    console.log("  WARNING: Using fallback design");
  }

  const { validateBuild } = await import("../validation/build-validator.js");
  const buildResult = validateBuild(designResult.value, CATALOGUE_V1);
  if (!buildResult.ok) {
    console.error("AI build validation failed:", buildResult.errors);
    process.exit(1);
  }

  console.log("Requesting tactical policy from DeepSeek...");
  const policyResult = await agent.choosePolicy({
    build: designResult.value,
    opponent: opponentSummary,
  });
  usage.push(agent.usageFromResult(policyResult, "policy"));
  console.log(
    `  Policy: aggression ${policyResult.value.aggression}, opening ${policyResult.value.opening}`,
  );
  console.log(
    `  Tokens: ${policyResult.inputTokens} in / ${policyResult.outputTokens} out`,
  );
  if (policyResult.fallbackUsed) {
    console.log("  WARNING: Using fallback policy");
  }

  return {
    config: {
      build: buildResult.build,
      policy: policyResult.value,
      source: "ai",
    },
    usage,
  };
}

function loadBulwarkFighter(): FighterConfig {
  return {
    build: createBulwarkBuild(),
    policy: BULWARK_POLICY,
    source: "bulwark",
  };
}

async function main() {
  const { seed, useAi } = parseArgs();

  console.log("=".repeat(50));
  console.log("FORGE ARENA — Match Runner");
  console.log("=".repeat(50));
  console.log(`Seed: ${seed}`);
  console.log(`Mode: ${useAi ? "AI vs Bulwark" : "Bulwark vs Bulwark"}`);
  console.log("");

  let fighterA: FighterConfig;
  let fighterB: FighterConfig;
  const agentUsage: AgentUsageRecord[] = [];

  if (useAi) {
    const opponentSummary = getBulwarkOpponentSummary();
    const aiResult = await loadAiFighter(opponentSummary);
    fighterA = aiResult.config;
    agentUsage.push(...aiResult.usage);
    fighterB = loadBulwarkFighter();
  } else {
    fighterA = loadBulwarkFighter();
    fighterB = loadBulwarkFighter();
  }

  console.log("");
  console.log(`Fighter A: ${fighterA.build.proposal.machineName} (${fighterA.source})`);
  console.log(`Fighter B: ${fighterB.build.proposal.machineName} (${fighterB.source})`);
  console.log("");

  console.log("Running match...");
  const result = runMatch({
    seed,
    fighterA: { build: fighterA.build, policy: fighterA.policy },
    fighterB: { build: fighterB.build, policy: fighterB.policy },
    rulesetVersion: RULESET_VERSION,
    catalogueVersion: CATALOGUE_V1.version,
  });

  console.log(`Match completed in ${result.rounds} round(s).`);
  console.log(`Result: ${result.result.method}`);
  if (result.result.winner) {
    const winnerName =
      result.result.winner === "fighter_a"
        ? fighterA.build.proposal.machineName
        : fighterB.build.proposal.machineName;
    console.log(`Winner: ${winnerName}`);
  } else {
    console.log("Result: Draw");
  }
  console.log("");

  const replay = renderTextReplay(result);
  console.log(replay);

  await mkdir(DATA_DIR, { recursive: true });
  const repository = new JsonMatchRepository(DATA_DIR);
  const record = matchResultToRecord(result, agentUsage);

  try {
    await repository.saveMatch(record);
    console.log(`\nMatch saved: ${record.matchId}`);
    console.log(`Location: ${join(DATA_DIR, `${record.matchId}.json`)}`);
  } catch (e) {
    console.error("Failed to save match:", e instanceof Error ? e.message : String(e));
    process.exit(1);
  }
}

main().catch((e) => {
  console.error("Fatal error:", e instanceof Error ? e.message : String(e));
  process.exit(1);
});
