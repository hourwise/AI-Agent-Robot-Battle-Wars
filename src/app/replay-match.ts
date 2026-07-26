import { join } from "node:path";
import { JsonMatchRepository } from "../persistence/json-match-repository.js";
import { renderTextReplay } from "../replay/text-replay-renderer.js";
import { renderAsciiReplay } from "../replay/ascii/ascii-replay-renderer.js";
import type { MatchRecord } from "../schemas/match-record.schema.js";

const DATA_DIR = join(process.cwd(), "data", "matches");

function parseArgs(): { matchId: string; ascii: boolean; stats: boolean } {
  const args = process.argv.slice(2);
  let matchId = "";
  let ascii = false;
  let stats = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--match" && args[i + 1]) {
      matchId = args[i + 1]!;
      i++;
    } else if (args[i] === "--ascii") {
      ascii = true;
    } else if (args[i] === "--stats") {
      stats = true;
    }
  }

  if (!matchId) {
    console.error("Usage: npm run replay -- --match <match-id>");
    console.error("Flags:");
    console.error("  --match <id>   Match ID to replay");
    console.error("  --ascii        Show ASCII visual replay");
    console.error("  --stats        Show match statistics");
    process.exit(1);
  }

  return { matchId, ascii, stats };
}

async function loadMatch(matchId: string): Promise<MatchRecord> {
  const repository = new JsonMatchRepository(DATA_DIR);
  const record = await repository.getMatch(matchId);
  if (!record) {
    console.error(`Match not found: ${matchId}`);
    console.error(`Searched in: ${DATA_DIR}`);
    process.exit(1);
  }
  return record;
}

function printMatchInfo(record: MatchRecord): void {
  console.log("=".repeat(50));
  console.log("FORGE ARENA — Match Replay");
  console.log("=".repeat(50));
  console.log(`Match ID:    ${record.matchId}`);
  console.log(`Created:     ${record.createdAt}`);
  console.log(`Ruleset:     ${record.rulesetVersion}`);
  console.log(`Catalogue:   ${record.catalogueVersion}`);
  console.log(`Seed:        ${record.seed}`);
  console.log("");

  const fighterAName = record.config.fighterA.build.proposal.machineName;
  const fighterBName = record.config.fighterB.build.proposal.machineName;
  console.log(`Fighter A: ${fighterAName}`);
  console.log(`Fighter B: ${fighterBName}`);
  console.log("");

  if (record.agentUsage.length > 0) {
    console.log("API Usage:");
    const phases = new Map<string, number>();
    for (const usage of record.agentUsage) {
      phases.set(usage.phase, (phases.get(usage.phase) ?? 0) + 1);
    }
    for (const [phase, count] of phases) {
      console.log(`  ${phase}: ${count} call(s)`);
    }
    const totalIn = record.agentUsage.reduce((s, u) => s + u.inputTokens, 0);
    const totalOut = record.agentUsage.reduce((s, u) => s + u.outputTokens, 0);
    console.log(`  Total: ${totalIn} in / ${totalOut} out`);
    console.log("");
  }
}

function printResult(record: MatchRecord): void {
  const result = record.result;
  console.log("-".repeat(50));
  console.log("RESULT");
  console.log("-".repeat(50));

  if (result.winner) {
    const winnerName =
      result.winner === "fighter_a"
        ? record.config.fighterA.build.proposal.machineName
        : record.config.fighterB.build.proposal.machineName;
    console.log(`Winner: ${winnerName}`);
  } else {
    console.log("Winner: Draw");
  }

  console.log(`Method: ${result.method}`);
  console.log(`Rounds: ${record.rounds}`);
  console.log("");
}

async function main() {
  const { matchId, ascii, stats } = parseArgs();
  const record = await loadMatch(matchId);

  printMatchInfo(record);

  const matchResult = {
    config: record.config,
    initialState: record.initialState,
    events: record.events,
    result: record.result,
    rounds: record.rounds,
  } as import("../simulator/types.js").MatchResult;

  const textReplay = renderTextReplay(matchResult);
  console.log(textReplay);

  if (ascii) {
    console.log("\n" + "=".repeat(50));
    console.log("ASCII VISUAL REPLAY");
    console.log("=".repeat(50) + "\n");
    const asciiReplay = renderAsciiReplay(matchResult);
    console.log(asciiReplay);
  }

  if (stats) {
    console.log("\n" + "=".repeat(50));
    console.log("MATCH STATISTICS");
    console.log("=".repeat(50) + "\n");

    const events = record.events;
    const attacks = events.filter(
      (e) => e.type === "attack_hit" || e.type === "attack_missed",
    );
    const hits = events.filter((e) => e.type === "attack_hit");
    const crits = events.filter(
      (e) => e.type === "component_damaged" || e.type === "component_disabled",
    );
    const movements = events.filter((e) => e.type === "movement_resolved");

    console.log(`Total attacks: ${attacks.length}`);
    console.log(`Hits: ${hits.length}`);
    console.log(
      `Accuracy: ${attacks.length > 0 ? Math.round((hits.length / attacks.length) * 100) : 0}%`,
    );
    console.log(`Critical hits: ${crits.length}`);
    console.log(`Movements: ${movements.length}`);
    console.log("");
  }

  printResult(record);
}

main().catch((e) => {
  console.error("Fatal error:", e instanceof Error ? e.message : String(e));
  process.exit(1);
});
