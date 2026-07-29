import { readFileSync } from "node:fs";
import { z } from "zod";
import { CATALOGUE_V1 } from "../catalogue/catalogue.v1.js";
import { createBulwarkBuild, BULWARK_POLICY } from "../agents/scripted/bulwark-agent.js";
import { machineBuildProposalSchema } from "../schemas/build.schema.js";
import { actionPolicySchema } from "../schemas/policy.schema.js";
import {
  COMPONENT_QUALIFICATION_ID,
  RULESET_VERSION,
  SIMULATOR_VERSION,
} from "../simulator/constants.js";
import { validateBuild } from "../validation/build-validator.js";
import type {
  LifecycleFixtureSuiteDefinition,
  ResolvedLifecycleCompetitor,
  ResolvedLifecycleFixtureSuite,
} from "./lifecycle-suite.types.js";

export const LIFECYCLE_SUITE_PATH =
  "data/bench-fixtures/component-lifecycle-v1/suite.json";

const competitorSchema = z
  .object({
    competitorId: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    source: z.enum([
      "canonical-bulwark",
      "benchmark-only",
      "benchmark-v2-transition-test",
    ]),
    build: machineBuildProposalSchema.strict(),
    policy: actionPolicySchema.strict(),
  })
  .strict();

const purposeSchema = z.enum([
  "high-armour plus reinforced-drive stress test",
  "high-armour lifecycle progression without guard interference",
  "low-armour over-aggression and transition-density test",
  "armour differentiation and role-swapped behaviour",
]);

const fixtureSchema = z
  .object({
    fixtureId: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    benchmarkId: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    purpose: purposeSchema,
    fighterXCompetitorId: z.string().min(1),
    fighterYCompetitorId: z.string().min(1),
    roleSwapped: z.boolean(),
    seedPartition: z.literal("development"),
    classification: z.enum(["hard", "diagnostic"]),
  })
  .strict();

export const lifecycleFixtureSuiteSchema = z
  .object({
    schemaVersion: z.literal("1"),
    suiteId: z.literal("component-lifecycle-v1"),
    componentQualificationId: z.literal("component-impact-c1"),
    simulatorVersion: z.literal("0.2.0"),
    rulesetVersion: z.literal("0.2.0"),
    catalogueVersion: z.literal("1"),
    seedPartition: z.literal("development"),
    competitors: z.array(competitorSchema).min(1),
    fixtures: z.array(fixtureSchema).min(1),
  })
  .strict();

function assertUnique(values: readonly string[], label: string): void {
  if (new Set(values).size !== values.length) {
    throw new Error(`${label} must be unique`);
  }
}

function assertOnlyUtilityDiffers(
  guarded: ResolvedLifecycleCompetitor,
  unguarded: ResolvedLifecycleCompetitor,
): void {
  const guardedProposal = {
    ...guarded.build.proposal,
    utilityId: "none" as const,
  };
  if (JSON.stringify(guardedProposal) !== JSON.stringify(unguarded.build.proposal)) {
    throw new Error(
      "Unguarded Bulwark must differ from canonical Bulwark only in utility",
    );
  }
  if (JSON.stringify(guarded.policy) !== JSON.stringify(unguarded.policy)) {
    throw new Error("Unguarded Bulwark policy must match canonical Bulwark policy");
  }
}

export function parseLifecycleFixtureSuite(
  input: unknown,
): ResolvedLifecycleFixtureSuite {
  const parsed = lifecycleFixtureSuiteSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(`Invalid lifecycle fixture suite: ${parsed.error.message}`);
  }

  const definition = parsed.data as LifecycleFixtureSuiteDefinition;
  if (definition.componentQualificationId !== COMPONENT_QUALIFICATION_ID) {
    throw new Error("Fixture suite component qualification identity does not match C1");
  }
  if (definition.simulatorVersion !== SIMULATOR_VERSION) {
    throw new Error("Fixture suite simulator version does not match the simulator");
  }
  if (definition.rulesetVersion !== RULESET_VERSION) {
    throw new Error("Fixture suite ruleset version does not match the ruleset");
  }
  if (definition.catalogueVersion !== CATALOGUE_V1.version) {
    throw new Error("Fixture suite catalogue version does not match catalogue v1");
  }

  assertUnique(
    definition.competitors.map((competitor) => competitor.competitorId),
    "Competitor IDs",
  );
  assertUnique(
    definition.fixtures.map((fixture) => fixture.fixtureId),
    "Fixture IDs",
  );

  const competitors: ResolvedLifecycleCompetitor[] = definition.competitors.map(
    (competitor) => {
      const result = validateBuild(competitor.build, CATALOGUE_V1);
      if (!result.ok) {
        throw new Error(
          `Invalid build for ${competitor.competitorId}: ${result.errors
            .map((error) => error.message)
            .join(", ")}`,
        );
      }
      return { ...competitor, build: result.build };
    },
  );

  const byId = new Map(
    competitors.map((competitor) => [competitor.competitorId, competitor]),
  );
  const fixtures = definition.fixtures.map((fixture) => {
    const fighterX = byId.get(fixture.fighterXCompetitorId);
    const fighterY = byId.get(fixture.fighterYCompetitorId);
    if (!fighterX || !fighterY) {
      throw new Error(`Fixture ${fixture.fixtureId} references an unknown competitor`);
    }
    return { ...fixture, fighterX, fighterY };
  });

  const guarded = byId.get("bulwark-guarded");
  const unguarded = byId.get("bulwark-unguarded");
  if (!guarded || !unguarded) {
    throw new Error("Lifecycle suite requires guarded and unguarded Bulwark competitors");
  }

  const canonical = createBulwarkBuild();
  if (
    JSON.stringify(guarded.build.proposal) !== JSON.stringify(canonical.proposal) ||
    JSON.stringify(guarded.policy) !== JSON.stringify(BULWARK_POLICY)
  ) {
    throw new Error("Guarded Bulwark fixture must match the canonical Bulwark");
  }
  assertOnlyUtilityDiffers(guarded, unguarded);

  return { ...definition, competitors, fixtures };
}

export function loadLifecycleFixtureSuite(
  path = LIFECYCLE_SUITE_PATH,
): ResolvedLifecycleFixtureSuite {
  return parseLifecycleFixtureSuite(JSON.parse(readFileSync(path, "utf8")));
}
