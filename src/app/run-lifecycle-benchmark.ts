import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { loadSeedBank } from "../bench/seed-bank.js";
import { loadLifecycleFixtureSuite } from "../bench/lifecycle-fixture-schema.js";
import { runBenchmarkSuite } from "../bench/run-lifecycle-suite.js";
import { renderLifecycleSuiteReport } from "../bench/lifecycle-report-renderer.js";
import {
  DEFAULT_COMPONENT_QUALIFICATION_ID,
  getComponentQualificationConfig,
  getComponentQualificationConfigChecksum,
  listComponentQualificationConfigs,
  type ComponentQualificationId,
} from "../simulator/component-qualification-registry.js";

interface CliOptions {
  readonly partition: string;
  readonly fixtureId?: string;
  readonly output?: string;
  readonly json: boolean;
  readonly force: boolean;
  readonly qualificationId?: ComponentQualificationId;
  readonly listQualifications: boolean;
}

export function parseLifecycleBenchmarkArgs(args: readonly string[]): CliOptions {
  let partition = "development";
  let fixtureId: string | undefined;
  let output: string | undefined;
  let json = false;
  let force = false;
  let qualificationId: ComponentQualificationId | undefined;
  let listQualifications = false;

  for (let index = 0; index < args.length; index++) {
    const argument = args[index];
    if (argument === "--partition" && args[index + 1]) {
      partition = args[++index]!;
    } else if (argument === "--fixture" && args[index + 1]) {
      fixtureId = args[++index]!;
    } else if (argument === "--output" && args[index + 1]) {
      output = args[++index]!;
    } else if (argument === "--json") {
      json = true;
    } else if (argument === "--force") {
      force = true;
    } else if (argument === "--qualification" && args[index + 1]) {
      qualificationId = getComponentQualificationConfig(args[++index]!).id;
    } else if (argument === "--list-qualifications") {
      listQualifications = true;
    } else {
      throw new Error(`Unknown or incomplete argument: ${String(argument)}`);
    }
  }
  return {
    partition,
    fixtureId,
    output,
    json,
    force,
    qualificationId,
    listQualifications,
  };
}

export function runLifecycleBenchmarkCli(args = process.argv.slice(2)): string {
  const options = parseLifecycleBenchmarkArgs(args);
  if (options.listQualifications) {
    return listComponentQualificationConfigs()
      .map(
        (config) =>
          `${config.id}${config.id === DEFAULT_COMPONENT_QUALIFICATION_ID ? " (default)" : ""}: ${config.model}, checksum ${getComponentQualificationConfigChecksum(config)}, armour ${config.armourFactor}, min ${config.minimumImpact}, critical ${config.criticalThreshold}, high ${config.highImpactThreshold}`,
      )
      .join("\n");
  }
  if (options.partition !== "development") {
    throw new Error(
      `Lifecycle benchmark partition "${options.partition}" is prohibited. Only "development" is authorised.`,
    );
  }

  const bank = loadSeedBank(
    JSON.parse(readFileSync("data/seeds/benchmark-100-v1.json", "utf8")),
  );
  const suite = loadLifecycleFixtureSuite();
  const report = runBenchmarkSuite({
    suite,
    seedBank: bank,
    partition: "development",
    fixtureId: options.fixtureId,
    componentQualificationId: options.qualificationId,
  });
  const rendered = options.json
    ? JSON.stringify(report, null, 2)
    : renderLifecycleSuiteReport(report);

  if (options.output) {
    const outputPath = resolve(options.output);
    if (existsSync(outputPath) && !options.force) {
      throw new Error(`Output file exists: ${outputPath}. Use --force to overwrite.`);
    }
    mkdirSync(dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, `${rendered}\n`);
  }
  return rendered;
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : "";
if (import.meta.url === invokedPath) {
  try {
    console.log(runLifecycleBenchmarkCli());
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
