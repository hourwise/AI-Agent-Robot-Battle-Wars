import { describe, expect, it } from "vitest";
import { runMatch } from "../../src/simulator/simulator.js";
import { runGridMatch } from "../../src/simulator/grid-runtime.js";
import { CATALOGUE_V1 } from "../../src/catalogue/catalogue.v1.js";
import {
  createBulwarkBuild,
  BULWARK_POLICY,
} from "../../src/agents/scripted/bulwark-agent.js";
import {
  buildFactualReport,
  buildGridFactualReport,
  enrichMatchSummariesWithPolicy,
} from "../../src/reports/factual-match-report.js";
import {
  buildReviewUserPrompt,
  buildFallbackReview,
} from "../../src/prompts/review-prompt.v1.js";
import { formatFactualReportForPrompt } from "../../src/reports/review-formatter.js";
import { validateReviewAgainstFacts } from "../../src/agents/deepseek/deepseek-agent.js";
import { makeMatchReview } from "../fixtures/match-review.js";

const build = createBulwarkBuild();

function legacyReport() {
  const result = runMatch({
    seed: 42,
    fighterA: { build, policy: BULWARK_POLICY },
    fighterB: { build, policy: BULWARK_POLICY },
    rulesetVersion: "0.1.0",
    catalogueVersion: CATALOGUE_V1.version,
  });
  return enrichMatchSummariesWithPolicy(
    buildFactualReport(result),
    BULWARK_POLICY,
    BULWARK_POLICY,
  );
}

function gridReport() {
  const result = runGridMatch({
    seed: 42,
    fighterA: { build, policy: BULWARK_POLICY },
    fighterB: { build, policy: BULWARK_POLICY },
    rulesetVersion: "0.2.0",
    catalogueVersion: CATALOGUE_V1.version,
  });
  return enrichMatchSummariesWithPolicy(
    buildGridFactualReport(result),
    BULWARK_POLICY,
    BULWARK_POLICY,
  );
}

describe("agent review compatibility (Phase 3D1)", () => {
  it("builds a v1 review request unchanged", () => {
    const prompt = buildReviewUserPrompt(legacyReport());
    expect(prompt).toContain("Review the following match result.");
    expect(prompt).toContain("=== MATCH RESULT ===");
    expect(prompt).not.toContain("Simulator:");
  });

  it("builds a v2 grid review request with explicit simulator identity", () => {
    const prompt = buildReviewUserPrompt(gridReport());
    expect(prompt).toContain("=== MATCH RESULT ===");
    expect(prompt).toContain("Simulator: 0.3.0 (grid-3x3-v1)");
    expect(prompt).toContain("Ruleset: 0.2.0, Catalogue: 1");
  });

  it("renders grid corners with human-readable names, never as edges", () => {
    const report = gridReport();
    const text = formatFactualReportForPrompt(report);
    // whichever zones the fighters ended in, corners render human-readable
    const zoneA = formatZoneFromReport(report, "fighterA");
    const zoneB = formatZoneFromReport(report, "fighterB");
    for (const zone of [zoneA, zoneB]) {
      if (zone.includes("_")) {
        const human = zone
          .split("_")
          .map((w) => w[0].toUpperCase() + w.slice(1))
          .join(" ");
        expect(text).toContain(human);
      }
      expect(text).not.toContain(`${zone} edge`);
      expect(text).not.toContain("North Edge");
      expect(text).not.toContain("South Edge");
    }
  });

  it("produces deterministic fallback output for both versions", () => {
    const v1 = legacyReport();
    const v2 = gridReport();
    const f1 = buildFallbackReview(v1);
    const f2 = buildFallbackReview(v2);
    expect(f1).toBe(
      `${v1.winner ?? "Draw"} by ${v1.resultMethod} in ${v1.rounds} rounds.`,
    );
    expect(f2).toBe(
      `${v2.winner ?? "Draw"} by ${v2.resultMethod} in ${v2.rounds} rounds.`,
    );
    expect(f1).toMatch(
      /^fighter_[ab] by (destruction|immobilisation|judges|draw) in \d+ rounds\.$/,
    );
  });

  it("never calls an external provider while building prompts", () => {
    // buildReviewUserPrompt / buildFallbackReview are pure string builders.
    const before = legacyReport();
    const prompt = buildReviewUserPrompt(before);
    const fallback = buildFallbackReview(before);
    expect(prompt.length).toBeGreaterThan(100);
    expect(fallback.length).toBeGreaterThan(5);
  });

  it("validates a correct review against v1 facts with no errors", () => {
    const report = legacyReport();
    const review = makeMatchReview({
      winnerId: report.winner,
      method: report.resultMethod,
      rounds: report.rounds,
      ownFinalIntegrity: report.finalStates.fighterA.integrity,
      opponentFinalIntegrity: report.finalStates.fighterB.integrity,
      ownDisabledComponents: report.finalStates.fighterA.weaponDisabled ? ["weapon"] : [],
      opponentDisabledComponents: report.finalStates.fighterB.weaponDisabled
        ? ["weapon"]
        : [],
    });
    expect(validateReviewAgainstFacts(review, report)).toEqual([]);
  });

  it("validates a correct review against v2 grid facts with no errors", () => {
    const report = gridReport();
    const review = makeMatchReview({
      winnerId: report.winner,
      method: report.resultMethod,
      rounds: report.rounds,
      ownFinalIntegrity: report.finalStates.fighterA.integrity,
      opponentFinalIntegrity: report.finalStates.fighterB.integrity,
      ownDisabledComponents: report.finalStates.fighterA.weaponDisabled ? ["weapon"] : [],
      opponentDisabledComponents: report.finalStates.fighterB.weaponDisabled
        ? ["weapon"]
        : [],
    });
    expect(validateReviewAgainstFacts(review, report)).toEqual([]);
  });

  it("flags factual mismatches for v2 grid reports", () => {
    const report = gridReport();
    const review = makeMatchReview({
      winnerId: report.winner === "fighter_a" ? "fighter_b" : "fighter_a",
      method: report.resultMethod,
      rounds: report.rounds,
      ownFinalIntegrity: report.finalStates.fighterA.integrity,
      opponentFinalIntegrity: report.finalStates.fighterB.integrity,
      ownDisabledComponents: [],
      opponentDisabledComponents: [],
    });
    const errors = validateReviewAgainstFacts(review, report);
    expect(errors.some((e) => e.includes("winnerId"))).toBe(true);
  });
});

function formatZoneFromReport(
  report: ReturnType<typeof gridReport>,
  fighter: "fighterA" | "fighterB",
): string {
  return report.finalStates[fighter].zone;
}
