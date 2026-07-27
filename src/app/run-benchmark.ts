import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { createHash } from "node:crypto";
import { loadSeedBank } from "../bench/seed-bank.js";
import {
  runBenchmark,
  fingerprintBuild,
  fingerprintPolicy,
} from "../bench/run-benchmark.js";
import { computeMetrics } from "../bench/metrics.js";
import { renderTextReport } from "../bench/report-renderer.js";
import { createBulwarkBuild, BULWARK_POLICY } from "../agents/scripted/bulwark-agent.js";
import type { BenchmarkReport, SeedPartition } from "../bench/benchmark.types.js";

const SEED_BANK_PATH = join("data", "seeds", "benchmark-100-v1.json");

function parseArgs(): {
  partition: SeedPartition;
  output?: string;
  json: boolean;
  quiet: boolean;
  force: boolean;
} {
  const args = process.argv.slice(2);
  let partition: SeedPartition = "development";
  let output: string | undefined;
  let json = false;
  let quiet = false;
  let force = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--partition" && args[i + 1]) {
      const val = args[i + 1]!;
      if (val !== "development" && val !== "held-out" && val !== "all") {
        console.error(
          `Invalid partition: ${val}. Must be development, held-out, or all.`,
        );
        process.exit(1);
      }
      partition = val;
      i++;
    } else if (args[i] === "--output" && args[i + 1]) {
      output = args[i + 1]!;
      i++;
    } else if (args[i] === "--json") {
      json = true;
    } else if (args[i] === "--quiet") {
      quiet = true;
    } else if (args[i] === "--force") {
      force = true;
    } else {
      console.error(`Unknown argument: ${args[i]}`);
      process.exit(1);
    }
  }

  return { partition, output, json, quiet, force };
}

function main() {
  const { partition, output, json, quiet, force } = parseArgs();

  // Load seed bank
  let bankJson: unknown;
  try {
    bankJson = JSON.parse(readFileSync(SEED_BANK_PATH, "utf-8"));
  } catch {
    console.error(`Seed bank not found at ${SEED_BANK_PATH}`);
    process.exit(1);
  }
  const bank = loadSeedBank(bankJson);

  // Default pairing: Bulwark vs Bulwark (mirror, no role-swap needed)
  const buildA = createBulwarkBuild();
  const buildB = createBulwarkBuild();
  const policyA = BULWARK_POLICY;
  const policyB = BULWARK_POLICY;

  const results = runBenchmark({
    label: "Bulwark Mirror Baseline",
    seedBank: bank,
    partition,
    fighterA: { build: buildA, policy: policyA, machineName: "The Bulwark" },
    fighterB: { build: buildB, policy: policyB, machineName: "The Bulwark" },
    roleSwapped: false, // mirror match, no need to swap
  });

  const metrics = computeMetrics(results);

  // Sort per-match results for deterministic output
  const sortedResults = [...results].sort(
    (a, b) => a.seed - b.seed || (a.roleSwapped ? 1 : 0) - (b.roleSwapped ? 1 : 0),
  );

  // Deterministic checksum
  const canonical = JSON.stringify(sortedResults);
  const checksum = createHash("sha256").update(canonical).digest("hex").slice(0, 16);

  const report: BenchmarkReport = {
    schemaVersion: "1",
    benchmarkId: `bulwark-mirror-${partition}`,
    seedBankId: bank.bankId,
    partition,
    simulatorVersion: bank.simulatorVersion,
    rulesetVersion: bank.rulesetVersion,
    catalogueVersion: bank.catalogueVersion,
    fighterA: {
      machineName: "The Bulwark",
      buildFingerprint: fingerprintBuild(buildA),
      policyFingerprint: fingerprintPolicy(policyA),
    },
    fighterB: {
      machineName: "The Bulwark",
      buildFingerprint: fingerprintBuild(buildB),
      policyFingerprint: fingerprintPolicy(policyB),
    },
    roleSwapped: false,
    totalSimulations: results.length,
    perMatch: sortedResults,
    metrics,
    checksum,
  };

  if (output) {
    const outPath = resolve(output);
    const dir = outPath.substring(0, outPath.lastIndexOf("\\"));
    if (dir) mkdirSync(dir, { recursive: true });

    if (existsSync(outPath) && !force) {
      console.error(`Output file exists: ${outPath}. Use --force to overwrite.`);
      process.exit(1);
    }

    writeFileSync(outPath, JSON.stringify(report, null, 2));
    if (!quiet) console.log(`Report written to ${outPath}`);
  }

  if (json) {
    console.log(JSON.stringify(report, null, 2));
  } else if (!output || !quiet) {
    console.log(renderTextReport(report));
  }
}

main();
