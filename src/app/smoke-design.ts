import { loadDeepSeekConfig } from "../agents/deepseek/deepseek-config.js";
import { DeepSeekArenaAgent } from "../agents/deepseek/deepseek-agent.js";

async function main() {
  let config;
  try {
    config = loadDeepSeekConfig();
  } catch (e) {
    console.error("Configuration error:", e instanceof Error ? e.message : String(e));
    console.error(
      "\nSet DEEPSEEK_API_KEY in your .env file or environment to run the live smoke test.",
    );
    process.exit(1);
  }

  console.log("DeepSeek design smoke test");
  console.log(`Model: ${config.model}`);
  console.log(`Base URL: ${config.baseUrl}`);
  console.log("---");

  const agent = new DeepSeekArenaAgent(config);

  try {
    console.log("Requesting robot design from DeepSeek...");
    const result = await agent.designMachine({});

    console.log("\nDesign returned in", result.latencyMs, "ms");
    console.log("Attempts:", result.attempts);
    console.log("Tokens:", result.inputTokens, "in /", result.outputTokens, "out");
    console.log("---");
    console.log("Machine name:", result.value.machineName);
    console.log("Chassis:", result.value.chassisId);
    console.log("Mobility:", result.value.mobilityId);
    console.log("Weapon:", result.value.weaponId);
    console.log("Utility:", result.value.utilityId);
    console.log("Armour:", JSON.stringify(result.value.armour));
    console.log("Design summary:", result.value.designSummary);
    console.log("---");

    console.log("Smoke test passed.");
  } catch (e) {
    console.error("\nSmoke test failed:", e instanceof Error ? e.message : String(e));
    process.exit(1);
  }
}

main();
