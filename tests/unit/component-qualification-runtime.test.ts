import { describe, expect, it } from "vitest";
import {
  BULWARK_POLICY,
  createBulwarkBuild,
} from "../../src/agents/scripted/bulwark-agent.js";
import { CATALOGUE_V1 } from "../../src/catalogue/catalogue.v1.js";
import { matchResultToRecord } from "../../src/persistence/match-converter.js";
import { validateMatchRecord } from "../../src/schemas/match-record.schema.js";
import { runMatch } from "../../src/simulator/simulator.js";
import type { MatchConfig } from "../../src/simulator/types.js";

function config(
  componentQualificationId?: MatchConfig["componentQualificationId"],
): MatchConfig {
  const build = createBulwarkBuild();
  return {
    seed: 42,
    fighterA: { build, policy: BULWARK_POLICY },
    fighterB: { build, policy: BULWARK_POLICY },
    rulesetVersion: "0.2.0",
    catalogueVersion: CATALOGUE_V1.version,
    componentQualificationId,
  };
}

describe("runtime component qualification selection", () => {
  it.each([
    ["component-impact-c1", "2a40a56f97062ca3", 11, 13],
    ["component-impact-c2", "13548462df34a183", 13, 15],
  ] as const)(
    "persists explicit %s metadata and factual thresholds",
    (id, checksum, criticalThreshold, highThreshold) => {
      const match = runMatch(config(id));
      expect(match.config.componentQualification).toEqual({
        id,
        configChecksum: checksum,
        model: "linear-component-impact",
      });
      const started = match.events.find((event) => event.type === "competition_started")!;
      expect(started.data.componentQualification).toEqual(
        match.config.componentQualification,
      );
      const hits = match.events.filter((event) => event.type === "attack_hit");
      expect(hits.length).toBeGreaterThan(0);
      expect(
        hits.every(
          (event) =>
            event.data.componentQualificationId === id &&
            event.data.componentQualificationConfigChecksum === checksum &&
            event.data.componentQualificationModel === "linear-component-impact" &&
            event.data.criticalComponentImpactThreshold === criticalThreshold &&
            event.data.highComponentImpactThreshold === highThreshold,
        ),
      ).toBe(true);
      expect(validateMatchRecord(matchResultToRecord(match)).ok).toBe(true);
    },
  );

  it("uses C2 when the request omits an ID", () => {
    expect(runMatch(config()).config.componentQualificationId).toBe(
      "component-impact-c2",
    );
  });

  it("rejects an unknown ID before creating a match", () => {
    expect(() =>
      runMatch({
        ...config(),
        componentQualificationId: "component-impact-unknown",
      } as unknown as MatchConfig),
    ).toThrow("Unknown component qualification ID");
  });
});
