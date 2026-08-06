import { describe, expect, it } from "vitest";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runMatch } from "../../src/simulator/simulator.js";
import { runGridMatch } from "../../src/simulator/grid-runtime.js";
import { getGridMovementMomentum } from "../../src/simulator/grid-runtime.js";
import { SIMULATOR_VERSION, RULESET_VERSION } from "../../src/simulator/constants.js";
import { CATALOGUE_V1 } from "../../src/catalogue/catalogue.v1.js";
import {
  createBulwarkBuild,
  BULWARK_POLICY,
} from "../../src/agents/scripted/bulwark-agent.js";
import { matchResultToRecord } from "../../src/persistence/match-converter.js";
import {
  buildFactualReport,
  buildGridFactualReport,
} from "../../src/reports/factual-match-report.js";
import { createGridCanaryScenario } from "../../src/canary/grid-canary-scenario.js";
import { runGridMatchCanary } from "../../src/app/grid-match-canary.js";
import {
  DEFAULT_COMPONENT_QUALIFICATION_ID,
  getComponentQualificationConfig,
  getComponentQualificationConfigChecksum,
} from "../../src/simulator/component-qualification-registry.js";

const ROOT = process.cwd();

async function readSource(relative: string): Promise<string> {
  return readFile(join(ROOT, relative), "utf-8");
}

describe("grid match canary — legacy and contract regression (Phase 3D2A)", () => {
  it("keeps the match and series package scripts unchanged and adds only the canary scripts", async () => {
    const pkg = JSON.parse(await readSource("package.json"));
    expect(pkg.scripts.match).toBe("tsx src/app/run-match.ts");
    expect(pkg.scripts.series).toBe("tsx src/app/run-series.ts");
    expect(pkg.scripts["match:grid:canary"]).toBe("tsx src/app/run-grid-canary-match.ts");
    expect(pkg.scripts["series:grid:canary"]).toBe(
      "tsx src/app/run-grid-series-canary.ts",
    );
    // The explicit grid beta command is the only additional match-family
    // script beyond the legacy and canary commands.
    const scriptNames = Object.keys(pkg.scripts);
    for (const name of scriptNames) {
      if (name.startsWith("match") || name.startsWith("series")) {
        expect([
          "match",
          "series",
          "match:grid:canary",
          "series:grid:canary",
          "match:grid:beta",
        ]).toContain(name);
      }
    }
  });

  it("keeps run-match.ts calling the legacy runMatch entry point", async () => {
    const source = await readSource("src/app/run-match.ts");
    expect(source).toContain("runMatch");
    expect(source).not.toContain("runGridMatch");
  });

  it("keeps run-series.ts calling the legacy runMatch entry point", async () => {
    const source = await readSource("src/app/run-series.ts");
    expect(source).toContain('import { runMatch } from "../simulator/simulator.js"');
    expect(source).not.toContain("runGridMatch");
  });

  it("keeps legacy match persistence as schema v2 and legacy reports as v1", () => {
    const result = runMatch({
      seed: 1,
      fighterA: { build: createBulwarkBuild(), policy: BULWARK_POLICY },
      fighterB: { build: createBulwarkBuild(), policy: BULWARK_POLICY },
      rulesetVersion: RULESET_VERSION,
      catalogueVersion: CATALOGUE_V1.version,
    });
    const record = matchResultToRecord(result, []);
    expect(record.schemaVersion).toBe("2");
    expect(record.simulatorVersion).toBe("0.2.0");

    const report = buildFactualReport(result);
    expect(report.schemaVersion).toBe("1");
    expect(report.matchId).toBe("pending");
  });

  it("keeps grid match persistence as schema v3 and grid reports as v2", () => {
    const scenario = createGridCanaryScenario();
    const result = runGridMatch({
      seed: 1,
      fighterA: scenario.fighterA,
      fighterB: scenario.fighterB,
      rulesetVersion: RULESET_VERSION,
      catalogueVersion: CATALOGUE_V1.version,
    });
    const record = matchResultToRecord(result, []);
    expect(record.schemaVersion).toBe("3");
    expect(record.simulatorVersion).toBe("0.3.0");

    const report = buildGridFactualReport(result);
    expect(report.schemaVersion).toBe("2");
    expect(report.matchId).toBe("pending");
  });

  it("keeps legacy series as schema v1 with no application path producing series v2", async () => {
    const seriesSource = await readSource("src/app/run-series.ts");
    expect(seriesSource).toContain('schemaVersion: "1"');
    expect(seriesSource).not.toContain('schemaVersion: "2"');
    expect(seriesSource).not.toContain("validateSeriesV2Contract");
    expect(seriesSource).not.toContain("SeriesV2");

    const canarySource = await readSource("src/app/grid-match-canary.ts");
    expect(canarySource).not.toContain("series.schema");
    expect(canarySource).not.toContain("series-repository");
    expect(canarySource).not.toContain("runSeries(");
  });

  it("keeps the C1/C2/AB2 checksums unchanged and C2 as the default", () => {
    const c1 = getComponentQualificationConfig("component-impact-c1");
    const c2 = getComponentQualificationConfig("component-impact-c2");
    const ab2 = getComponentQualificationConfig("component-impact-ab2");
    expect(getComponentQualificationConfigChecksum(c1)).toBe("2a40a56f97062ca3");
    expect(getComponentQualificationConfigChecksum(c2)).toBe("13548462df34a183");
    expect(getComponentQualificationConfigChecksum(ab2)).toBe("6b9f70450d3f10b8");
    expect(DEFAULT_COMPONENT_QUALIFICATION_ID).toBe("component-impact-c2");
  });

  it("keeps the global simulator/ruleset constants and catalogue unchanged", () => {
    expect(SIMULATOR_VERSION).toBe("0.2.0");
    expect(RULESET_VERSION).toBe("0.2.0");
    expect(CATALOGUE_V1.version).toBe("1");
  });

  it("keeps the translated advance/circle/retreat momentum contract unchanged", () => {
    expect(getGridMovementMomentum("advance", true)).toBe(1);
    expect(getGridMovementMomentum("advance", false)).toBe(0);
    expect(getGridMovementMomentum("retreat", true)).toBe(0);
    expect(getGridMovementMomentum("circle_left", true)).toBe(0);
    expect(getGridMovementMomentum("circle_right", true)).toBe(0);
    expect(getGridMovementMomentum("hold", true)).toBe(0);
    expect(getGridMovementMomentum("hold", false)).toBe(0);
  });

  it("does not activate grid as the default runtime", async () => {
    const indexSource = await readSource("src/index.ts");
    expect(indexSource).not.toContain("runGridMatch");
  });

  it("keeps the frozen canary simulator event stream unchanged", () => {
    const scenario = createGridCanaryScenario();
    const result = runGridMatch({
      seed: 5,
      fighterA: scenario.fighterA,
      fighterB: scenario.fighterB,
      rulesetVersion: RULESET_VERSION,
      catalogueVersion: CATALOGUE_V1.version,
    });
    const movement = result.events.filter((e) => e.type === "movement_resolved");
    expect(movement).toHaveLength(20);
    // Fighter A: translated advance then translated circles; fighter B: none.
    const actorA = movement.filter((e) => e.actorId === "fighter_a");
    expect(actorA).toHaveLength(20);
    expect(movement.some((e) => e.actorId === "fighter_b")).toBe(false);
    expect(actorA[0]!.data).toMatchObject({
      from: "south",
      to: "center",
      action: "advance",
    });
    const circles = actorA.slice(1);
    for (const event of circles) {
      expect(["circle_left", "circle_right"]).toContain(event.data.action);
      expect(event.data.from).not.toBe(event.data.to);
    }
    const combatTypes = [
      "attack_attempted",
      "attack_missed",
      "attack_hit",
      "integrity_damaged",
      "component_damaged",
      "component_damage_resisted",
      "component_disabled",
      "robot_overturned",
    ];
    expect(result.events.filter((e) => combatTypes.includes(e.type))).toEqual([]);
    expect(result.rounds).toBe(20);
    expect(result.result.method).toBe("judges");
  });

  it("emits manifest v2 with truthful flank evidence and no false rear claim", async () => {
    const root = await mkdtemp(join(tmpdir(), "canary-regression-"));
    try {
      const outcome = await runGridMatchCanary({ seed: 5, outputRoot: root });
      expect(outcome.manifest.schemaVersion).toBe("2");
      expect(outcome.manifest.evidence.lateralFlankObserved).toBe(true);
      expect(outcome.manifest.evidence.observedFlankBearings).toEqual(["right"]);
      expect(outcome.manifest.evidence.strictRearExposureObserved).toBe(false);
      expect(JSON.stringify(outcome.manifest)).not.toContain("rearExposureObserved");
      expect(outcome.manifest.evidence.allArtifactsReadBack).toBe(true);
      expect(outcome.manifest.evidence.bundleCrossAgreementPassed).toBe(true);
      // All non-manifest artifacts are covered by SHA-256 digests.
      for (const digest of Object.values(outcome.manifest.digests)) {
        expect(digest).toMatch(/^[a-f0-9]{64}$/);
      }
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
