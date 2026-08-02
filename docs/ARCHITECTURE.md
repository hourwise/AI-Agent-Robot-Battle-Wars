# Architecture

## Principles

### Authoritative deterministic engine

The simulator is the sole authority for build cost, build legality, mass and energy constraints, hit probability, damage, component failure, status effects, victory conditions, match termination and final result. No LLM-generated prose may alter these results.

### Provider-neutral agents

All AI providers are accessed through an `ArenaAgent` interface. Core game modules must not import any provider client directly. Future adapters must be possible for other providers, local models, scripted bots and MCP.

### Replay-first event architecture

Every meaningful state transition produces a typed event. The simulator never prints commentary directly.

```
Agent decisions
      |
Validated commands
      |
Deterministic simulator
      |
Authoritative event log
      |-- text replay
      |-- statistics
      |-- future browser animation
      |-- future 3D replay
```

### Bounded model use

Every model operation must have a timeout, a maximum response size, a finite retry count, schema validation, a clear fallback and token-usage capture where available. No unbounded agent loops.

### No secrets in source control

API keys are read from environment variables. `.env` is gitignored. Provider calls are server/local only. The full API key is never printed or stored in match records.

## Module boundaries

```
src/
  config/         Environment validation and configuration
  shared/         Shared utilities (text sanitisation)
  catalogue/      Versioned component catalogue
  schemas/        Zod schemas (build, policy, review, factual report, series, match record)
  validation/     Build and semantic validators
  simulator/      Deterministic combat engine (actions, damage, movement, victory, seeded random)
  events/         Event types and factory
  replay/         Text renderer and statistics
  replay/ascii/   Presentation-only ASCII rendering layer
  persistence/    Match and series repositories (atomic JSON)
  agents/         ArenaAgent interface and provider adapters
  agents/deepseek/  DeepSeek adapter (design, policy, review)
  agents/scripted/  Deterministic scripted opponents (Bulwark)
  prompts/        Versioned prompt templates (design, policy, review)
  reports/        Deterministic factual reports, review formatting, design diffs, series reports
  app/            CLI entry points (run-match, run-series, replay-match)
  types/          Shared types (agent usage)
```

Each layer depends only on layers below it. The simulator never imports agents, persistence or replay. Agents never import the simulator.

### 3×3 grid geometry (Milestone 0.2C Phase 1)

`src/simulator/arena-grid.ts` is a pure, deterministic 3×3 arena geometry
module accepted by ADR-001. It imports no engine, fighter state, seeded
random generator, damage, policy or replay code, and it is currently imported
only by tests (and non-runtime documentation tooling). It does **not** replace
the live five-zone `ArenaZone`; the authoritative simulator, movement, action,
damage, replay and ASCII runtime remain unchanged until the separately
authorised runtime-migration phase.

### Grid persistence and replay foundation (Milestone 0.2C Phase 2)

- `src/schemas/positioning.schema.ts` — canonical legacy/grid zone schemas and
  the explicit positioning identifier (`grid-3x3-v1`); grid values derive from
  `arena-grid.ts` so they cannot drift.
- `src/schemas/match-record.schema.ts` — supports schema v3 for grid records
  (`positioningModel: "grid-3x3-v1"`, grid initial zones, validated positioning
  facts in `movement_resolved`/`round_ended` events). v1/v2 records remain
  legacy and unchanged; current `0.2.0` matches still produce schema v2.
- `src/replay/positioning-model.ts` — replay positioning dispatch by record
  identity (v1/v2 → legacy-five-zone-v1; v3 → grid-3x3-v1).
- `src/replay/ascii/grid-arena-snapshot-renderer.ts` — deterministic 3×3 ASCII
  arena renderer (typed grid visual states).
- `src/replay/ascii/arena-renderer.ts` — version-aware arena renderer
  dispatcher (legacy five-zone vs 3×3 grid).
- `src/replay/ascii/state-reconstructor.ts` — accepts an explicit positioning
  model; grid mode reconstructs the nine grid zones and rejects legacy edges.
- `src/replay/zone-format.ts` — shared human-readable zone formatting for both
  legacy and grid zone names.

### Opt-in deterministic grid runtime (Milestone 0.2C Phase 3A)

- `src/simulator/types.ts` — `FighterCoreState` (position-independent),
  `ZoneFighterState<Z>`, `GridFighterState`, and the explicit `runtime`
  identity (`LegacyRuntimeIdentity` / `GridRuntimeIdentity`) carried by match
  results.
- `src/simulator/simulator.ts` — generic `runMatchForZone(config, adapter)`:
  the shared deterministic match loop over a `MatchRuntimeAdapter<Z>`
  (initial zones/facing, action derivation, round application,
  `competition_started` facts, event simulator version, runtime identity).
  `runMatch` remains the legacy five-zone wrapper.
- `src/simulator/reducer.ts` — generic `applyRoundForZone` over a
  `PositioningAdapter<Z>` (movement, distance, attack, knockback, grapple,
  momentum). `applyRound` remains the thin legacy wrapper; legacy behaviour is
  byte-for-byte identical.
- `src/simulator/grid-runtime.ts` — the **opt-in** `runGridMatch(config)`
  entry point with the `GRID_POSITIONING_ADAPTER` and `GRID_MATCH_ADAPTER`
  (deterministic grid movement, proximity-based actions, planar exposure,
  knockback/grapple repositioning). It is never wired into normal CLI, series,
  battle or application commands.
- `src/persistence/match-converter.ts` — `matchResultToRecord` routes by the
  explicit runtime identity: legacy → schema v2 (unchanged production path);
  grid → schema v3 (`positioningModel: "grid-3x3-v1"`). Invalid identity
  combinations are rejected; `mapLegacyZoneToGridZone` is never used during
  persistence.
- `src/replay/positioning-model.ts` — raw-result dispatch reads
  `result.runtime.positioningModel`; the model is never inferred from zone
  values.
- `src/replay/text-replay-renderer.ts` and `src/replay/ascii/ascii-replay-renderer.ts`
  — accept `AnyMatchResult` and thread the positioning model through
  reconstruction and rendering.

The default application path is unchanged: `runMatch` (legacy `0.2.0`),
schema v2 persistence, v1/v2 replay. `SIMULATOR_VERSION` / `RULESET_VERSION`
remain `0.2.0`, catalogue `1`.

### Grid runtime hardening (Milestone 0.2C Phase 3B)

- `src/simulator/runtime-identity.ts` — canonical **frozen** runtime identities
  (`LEGACY_RUNTIME_IDENTITY` `0.2.0`/`legacy-five-zone-v1`; `GRID_RUNTIME_IDENTITY`
  `0.3.0`/`grid-3x3-v1`), `Object.freeze`d at runtime. Adapters and match
  results share these immutable constants; an identity can never be modified
  through a returned result, so an attempted mutation of one match cannot
  affect later matches.
- `src/simulator/types.ts` — the discriminated runtime profile
  (`LegacyZoneProfile` / `GridZoneProfile` / `ZoneRuntimeProfile`) and
  `RuntimeIdentityFor<Z>` pair each zone type with its only permitted identity.
  `MatchRuntimeAdapter<Z>` and `ZoneMatchResult<Z>` use the derived identity,
  so legacy initial zones cannot be supplied to a grid profile, grid-only
  corners cannot be supplied to a legacy profile, and an adapter's zone type
  and runtime identity can never be paired independently through normal typed
  use.
- `src/simulator/grid-runtime.ts` — `runGridMatch` enforces the frozen grid
  version contract (`0.3.0` / `grid-3x3-v1` / `ruleset 0.2.0` / `catalogue 1`):
  configurations with any other `rulesetVersion` or `catalogueVersion` are
  rejected before simulation.
- `src/schemas/match-record.schema.ts` — v3-only cross-field contract:
  `simulatorVersion` must be `0.3.0`, `positioningModel` must be
  `grid-3x3-v1`, and top-level vs embedded-config `rulesetVersion`,
  `catalogueVersion` and `seed` must agree. v1/v2 keep their historical
  validation.
- `src/persistence/match-converter.ts` — `matchResultToRecord` validates each
  constructed v2/v3 record with its authoritative schema and throws a clear
  error at the converter boundary (before repository access) if construction
  produced an invalid record.
- `src/simulator/reducer.ts` — simultaneous positional-effect planning. Both
  fighters' knockback/grapple destinations are planned from the common
  post-movement snapshot (`PlannedReposition<Z>`), then applied with stable
  fighter-A-then-B event ordering. The `planFromSharedSnapshot` adapter flag
  keeps the legacy runtime's historical sequential-origin behaviour
  byte-for-byte identical (grid `true`, legacy `false`).

### Grid movement momentum (Milestone 0.2C Phase 3B.1)

`getGridMovementMomentum(action, translated)` in `src/simulator/grid-runtime.ts`
freezes the grid charge-momentum invariant: ram charge momentum is granted only
when an `advance` action actually translates the robot to another cell. A
translated `retreat`, `circle_left`, `circle_right`, `hold`, or any future
lateral action never receives charge momentum. The grid positioning adapter
uses this function via `momentumFor`; the legacy adapter keeps its historical
momentum rule unchanged.

### Grid lateral movement and flank policy (Milestone 0.2C Phase 3C)

- `src/simulator/grid-lateral.ts` — the single canonical pure module for
  translated lateral movement and flank intent. It imports only grid geometry,
  grid fighter/policy types and cardinal rotation helpers. It provides
  `resolveGridCircleMovement`, `chooseGridCircleCandidate` (frozen tangent
  vectors `circle_left (-dy, dx)` / `circle_right (dy, -dx)`, opponent-cell
  exclusion, deterministic ranking by Chebyshev-distance change → tangent dot →
  NESW order), `getFacingTowardGridZone`, `chooseGridFlankMovement`,
  `resolveDesiredFlankTarget` and `scoreGridFlankPosition`.
- `src/simulator/grid-runtime.ts` — `resolveGridMovement` delegates
  `circle_left`/`circle_right` to the canonical lateral resolver (translated
  one-orthogonal-step circling, facing toward the opponent; blocked/same-cell
  circles rotate in place). Both fighters still resolve from the same
  start-of-round snapshot.
- `src/simulator/actions.ts` — `deriveGridAction` routes `opening: "flank"`
  through the pure `chooseGridFlankMovement` after early-state rules; movement
  selection consumes no RNG and the existing cooldown/aggression/seeded combat
  roll is unchanged. Non-flank policies keep their existing decision ordering.

Translated lateral movement exists only in the opt-in grid runtime; legacy
circling remains turn-in-place. No new movement-action values or policy fields
were added, and the grid runtime remains opt-in through `runGridMatch`.

The grid runtime remains opt-in through `runGridMatch`; the default
application path, schema v2 persistence, and the frozen constants
(`SIMULATOR_VERSION`/`RULESET_VERSION` `0.2.0`, catalogue `1`) are unchanged.

### Version-aware reporting and series compatibility (Milestone 0.2C Phase 3D1)

- `src/schemas/factual-report.schema.ts` — factual match report schemas.
  `FactualMatchReportV1Schema` is the frozen legacy contract (schema v1,
  legacy five-zone states, persisted cooldowns, grid corners rejected);
  `FactualMatchReportV2Schema` represents an opt-in grid match only (schema v2
  with frozen identity `0.3.0`/`grid-3x3-v1`/`ruleset 0.2.0`/`catalogue 1`,
  nine grid zones, no cooldown fields). `FactualMatchReportSchema` /
  `FactualMatchReport` remain deprecated aliases of v1. Version-aware
  validate/serialize/deserialize dispatch on `schemaVersion`; unsupported
  versions are rejected and v1 is never upgraded.
- `src/events/battle-event.ts` — `getMovementEventSubjectId(event)`: the single
  canonical rule for which fighter a `movement_resolved` event repositions
  (`knockback`/`grapple` → `targetId`; ordinary movement → `actorId`; `null`
  for malformed events so nothing silently moves the wrong fighter). Shared by
  reporting and replay reconstruction.
- `src/reports/final-state-projection.ts` — pure, positioning-aware
  `projectFinalFighterState` shared by the v1 and v2 builders: it applies the
  event stream (damage, movement via the canonical subject rule with zone
  assertions, component damaged/disabled incl. immobilisation, guard
  consumption, overturns, overheat/recovery) then the latest authoritative
  `round_ended` facts (integrity/energy/heat/zone/conditions) and syncs binary
  component flags. It never invents facts and rejects zones outside the active
  model.
- `src/reports/factual-match-report.ts` — `buildFactualReport` (v1, unchanged
  shape), `buildGridFactualReport` (v2) and `buildFactualReportForResult`
  (dispatch on the explicit runtime identity — never zone strings).
  `enrichMatchSummariesWithPolicy` is generic over the report version.
- `src/prompts/review-prompt.v1.ts`, `src/reports/review-formatter.ts`,
  `src/agents/arena-agent.ts`, `src/agents/deepseek/deepseek-agent.ts` —
  review/rebuild contracts and prompt/fallback/validation accept
  `AnyFactualMatchReport`. v1 prompt rendering is byte-identical; v2 adds the
  simulator identity line and human-readable grid zone names (corners are
  never called "edges").
- `src/schemas/series.schema.ts` — `SeriesRecordV1Schema` is the unchanged
  legacy contract (the only record `runSeries` produces); `SeriesRecordV2Schema`
  is a reserved single-runtime grid contract (one immutable runtime identity
  per series, match-record schema v3, factual-report schema v2, cross-field
  seed/matchId/runtime/uniqueness/score validation). Deprecated aliases keep
  legacy callers compiling.
- `src/persistence/series-repository.ts`, `src/reports/series-report.ts` —
  repository and comparative report / renderer accept either series version;
  v2 reports render a `Runtime: simulator 0.3.0 (grid-3x3-v1)` line and v1
  renders exactly as before.

Grid reporting and grid series remain opt-in: no normal `runMatch`/`runSeries`
path produces them, and the default application path, schema v2 persistence,
and the frozen constants (`SIMULATOR_VERSION`/`RULESET_VERSION` `0.2.0`,
catalogue `1`) are unchanged.

### Reporting boundary and series traceability hardening (Milestone 0.2C Phase 3D1.1)

- `src/events/battle-event.ts` — the canonical `MovementEventAction` type
  (exactly `advance`, `retreat`, `circle_left`, `circle_right`, `hold`,
  `knockback`, `grapple`) with the runtime guard `isMovementEventAction`;
  `MovementResolvedData.action` is typed as that canonical set.
  `getMovementEventSubjectId` is an explicit exhaustive switch with no
  catch-all: knockback/grapple → `targetId`; the five normal actions →
  `actorId`; unknown, missing, non-string or malformed action, and any
  non-movement event → `null`. Reporting and replay share it, so malformed
  movement events never move either fighter and are never reinterpreted as
  `hold`.
- `src/reports/final-state-projection.ts` — `projectFinalFighterState` returns
  a state sharing no mutable nested state with the initial state or any event
  (build, comps, armour, component flags and conditions all cloned/copied;
  round-end conditions validated and copied, never referenced). A present but
  invalid movement facing is rejected; the current facing is preserved only
  when facing is genuinely absent. `round_ended.conditions` must be an array
  of canonical conditions; unknown values are rejected, ordering preserved,
  and no condition is inferred or added.
- `src/reports/factual-match-report.ts` — both builders validate the
  constructed report against its authoritative schema before returning and
  return the parsed valid report (`buildFactualReport` → `FactualMatchReportV1Schema`;
  `buildGridFactualReport` → `FactualMatchReportV2Schema`). A clear
  construction-boundary error identifies the report version, the schema
  failure and the boundary, catching malformed reconstructed zones, facing,
  conditions, component/lifecycle facts and fixed grid identity fields before
  review formatting, fallback review, series construction or persistence.
- `src/schemas/series.schema.ts` — the series-v2 contract now requires
  `entry.matchId = entry.match.matchId = entry.factualReport.matchId` (the
  same persisted match UUID; `"pending"`, empty or malformed report IDs are
  rejected — the standalone builders may still use `"pending"` before
  persistence) and agreement between the match summary and factual report on
  `rounds`, `winner` and `resultMethod`, alongside the existing seed, runtime
  and positioning agreements. These stricter cross-field rules are series-v2
  only; series v1 is untouched.

Grid reporting and grid series remain opt-in: no normal `runMatch`/`runSeries`
path produces them, and the default application path, schema v2 persistence,
and the frozen constants (`SIMULATOR_VERSION`/`RULESET_VERSION` `0.2.0`,
catalogue `1`) are unchanged.

### Isolated deterministic grid match canary (Milestone 0.2C Phase 3D2A / 3D2A.1 / 3D2A.2)

The first executable application-level grid path: a separate, local-only,
deterministic single-match canary that proves the complete grid pipeline
operationally without changing either existing default application command.
Phase 3D2A.1 hardened its evidence and artifact verification; Phase 3D2A.2
hardened publication immutability and exclusivity.

- `src/canary/grid-canary-scenario.ts` — the frozen built-in no-combat flank
  scenario `grid-canary-flank-v1` (Fighter A `opening: flank`, rear targets,
  `aggression: 0`; Fighter B `opening: hold`, front targets, `aggression: 0`;
  both Bulwark builds, both always defend). `createGridCanaryScenario()`
  returns fresh build and policy values per call; the stable
  `GRID_CANARY_SCENARIO_VERSION` constant is shared by the manifest schema.
- `src/reports/grid-factual-report-binding.ts` — `bindGridFactualReportToMatchRecord`
  is the pure report-to-record binding helper: it requires authoritative
  factual-report v2 and match-record v3 with identical grid identity, seed,
  rounds, winner and result-method agreement, requires the report `matchId` to
  be `"pending"` or already the record UUID, replaces `"pending"` with the
  real persisted match UUID, re-validates the completed report and never
  mutates its inputs. Designed for later reuse by a grid-series canary.
- `src/canary/grid-match-canary-evidence.ts` — pure evidence inspection of the
  direct `GridMatchResult`, failing closed on missing evidence (grid identity,
  config contract, canonical zones, translated circles, corner visit, canonical
  lateral flank, scenario role invariants, no combat events). All exposure is
  derived only through `getRelativeBearing` / `getPlanarExposedArmourZones`;
  the corner-adjacency proxy was removed. The evidence result reports
  `lateralFlankObserved` / `observedFlankBearings` /
  `strictRearExposureObserved` (both booleans derived, never hard-coded) and
  verifies fighter A translates, fighter B never changes cell, fighter B faces
  south and at least one translated circle occurs.
  `assertGridCanaryFinalAgreement` checks the final `round_ended` event,
  factual-report final states and replay reconstruction agreement;
  `verifyGridCanaryDeterminism` re-executes the same seed and scenario.
- `src/canary/grid-canary-digest.ts` — `sha256Hex` computes SHA-256 digests of
  exact artifact strings using the Node standard cryptography library (no
  dependency).
- `src/canary/grid-match-canary-bundle.ts` — the pure bundle cross-agreement
  validator `validateGridMatchCanaryBundle`: identity agreement (matchId
  across manifest/record/report, seed, simulator/positioning/ruleset/catalogue
  and schema identities), result agreement (rounds, winner, resultMethod,
  eventCount = record.events.length), fallback-review agreement (winner,
  method, rounds, both final integrity values, both disabled-component lists),
  text-artifact contracts (non-empty, no NUL, valid UTF-8, renderer markers)
  and every SHA-256 digest. Never mutates inputs; throws a clear
  canary-bundle boundary error.
- `src/schemas/grid-match-canary.schema.ts` — manifest v2
  (`GridMatchCanaryManifestV2`) is the only current passing contract: it
  requires `lateralFlankObserved: true`, a non-empty unique
  `observedFlankBearings` array, a derived `strictRearExposureObserved`
  boolean, `stationaryFighterCellUnchanged: true`, `allArtifactsReadBack:
true`, `bundleCrossAgreementPassed: true` and a SHA-256 digest block for
  every non-manifest artifact; it never contains `rearExposureObserved`.
  Manifest-v1 types are retained for historical inspection with
  `isGridMatchCanaryManifestV1`/`isGridMatchCanaryManifestV2`; version-aware
  deserialization may read both, but current bundle validation requires v2.
- `src/app/grid-canary-output-root.ts` — `assertCanaryOutputRootIsolation` is
  a pure guard rejecting `data/matches`, `data/series` and descendants, the
  repository `data` root and every non-canary in-repo root; inside repository
  `data` the service-level output root must resolve to **exactly**
  `data/canary/grid-match` (descendants — published canary directories, custom
  paths and `.tmp-*` locations — are rejected as service roots). External
  temporary roots remain allowed. Handles path traversal and Windows
  case-insensitive comparisons; runs before UUID creation, any directory
  creation or any match execution.
- `src/app/grid-match-canary.ts` — `runGridMatchCanary(request, dependencies)`
  is the application service: output-root guard → validate seed → generate and
  validate the canary UUID → preflight the final/temporary publication paths
  via `lstat` → create scenario → direct `runGridMatch` → evidence inspection →
  `matchResultToRecord` (v3) → `buildGridFactualReport` (v2) → bind to the
  persisted UUID → validate record and report → render text/3×3 ASCII replay →
  review prompt → deterministic fallback review → serialization round trips →
  digest computation → manifest v2 → exclusive atomic bundle publication with
  exact inventories and full read-back → structured result. Injectable
  dependencies: UUID creation, current time, filesystem bundle writer (which
  exposes `mkdir`, `writeFile`, `readFile`, `readdir`, `lstat`, `rename` and
  `rm`; no alternate simulator). Never calls `runMatch`, `runSeries`, an
  `ArenaAgent`, a provider or benchmark code, and never accepts imported
  records or user-supplied event streams.
- `src/app/grid-canary-cli-args.ts` — pure, side-effect-free argument parser
  requiring `--seed <non-negative integer>` and rejecting missing, negative,
  non-integer or duplicate seeds, unknown arguments, `--ai`, `--review`,
  runtime-selection flags and provider arguments.
- `src/app/run-grid-canary-match.ts` — the explicit `match:grid:canary`
  command with the unmistakable banner `FORGE ARENA — GRID MATCH CANARY /
NON-DEFAULT / NON-BENCHMARK / LOCAL-ONLY`, printing the canary ID, scenario,
  seed, runtime identity, match ID, rounds/result, evidence counts (including
  truthful `Lateral flank observed`, `Observed flank bearings` and `Strict
rear exposure observed`), the artifact directory and the statement that
  normal match and series commands remain legacy; nonzero exit on every
  failure.
- `src/replay/ascii/ascii-replay-renderer.ts` — additionally exports
  `toAsciiReplayInput` so the canary reconstructs final state through the
  canonical replay reconstruction without duplicating the adapter.
- **Atomic, exclusive and immutable bundle publication**
  (`data/canary/grid-match/<canaryId>/`): `manifest.json`, `match.json`,
  `factual-report.json`, `text-replay.txt`, `ascii-replay.txt`,
  `review-prompt.txt`, `fallback-review.json`. The final and `.tmp-<canaryId>`
  paths are preflighted with `lstat` (empty directories, files and symbolic
  links all count as collisions; pre-existing entries are never modified or
  removed), the temporary directory is created **exclusively** with
  non-recursive `mkdir` (a raced-in entry fails with `EEXIST` and is never
  cleaned), `manifest.json` is written last, the temporary directory must
  contain exactly the seven canonical regular files (no extra/missing entries,
  no directories, no symlinks), then every file is read back and byte-compared
  with the written strings, the four JSON artifacts are deserialized and
  validated, the manifest must be v2, and the pure bundle cross-agreement
  validator (including every digest) must pass. Only then is the completed
  directory atomically renamed, after which the same exact inventory and full
  verification run at the final path. Cleanup applies only to invocation-owned
  paths (`tmpCreatedByThisInvocation`, `finalPublishedByThisInvocation`); the
  original operational or verification error is preserved if cleanup also
  fails. Never writes to `data/matches` or normal series storage;
  `data/canary/` is git-ignored.

The canary is not a benchmark and produces no balance conclusion; it is a
correctness and operational pipeline check. No grid adaptive-series runner,
runtime selector, default activation or provider integration was added.

### Shared canary infrastructure (Milestone 0.2C Phase 3D2B)

- `src/canary/immutable-canary-bundle.ts` — the shared atomic, exclusive and
  immutable bundle publisher: `CanaryFileSystem`, `CanaryFsEntry`,
  `defaultCanaryFs`, `isFsCode`, `fsEntryKind` (lstat-based entry
  classification), `assertExactBundleInventory` (declared regular-file
  inventory, no symlinks) and `publishImmutableBundle` (lstat collision
  preflight, exclusive temporary `mkdir`, manifest-last writing, full read-back
  with byte comparison, caller `verify` hook, atomic rename, invocation-owned
  cleanup, `afterRootCreated` hook). Used by both the grid match canary
  (byte-compatibly refactored) and the grid series canary.
- `src/canary/grid-canary-fallback-review.ts` — the shared deterministic
  fallback review (`buildDeterministicFallbackReview`), re-exported from
  `src/app/grid-match-canary.ts` for compatibility.
- `src/canary/canary-output-root.ts` — the kind-aware output-root guard:
  `CanaryRootKind` (`"grid-match"` / `"grid-series"`), canonical roots
  `data/canary/grid-match` / `data/canary/grid-series`,
  `assertCanaryOutputRootIsolation(outputRoot, kind)` (exact canonical per
  kind, cross-kind rejection, protected storage rejection) and the async
  `assertCanaryPhysicalRoot(outputRoot, kind, fs)` physical-root guard (lstat
  every existing ancestry component — real directories only, symbolic links,
  junctions, files and other entries rejected — create missing components
  normally, re-inspect the complete ancestry after recursive creation and
  again before any artifact write; external roots must be existing real
  directories and a symlink service root is never followed).
  `src/app/grid-canary-output-root.ts` is a compatibility re-export defaulting
  to the `grid-match` kind.

### Isolated deterministic grid adaptive-series canary (Milestone 0.2C Phase 3D2B)

The second executable application-level grid path: a separate, local-only,
deterministic **three-match adaptive-series canary** proving the complete grid
series pipeline operationally, including two deterministic policy adaptations,
series-record v2 construction, four JSON envelopes, an adaptation trace, a
series report and a validated atomic artifact bundle. Like the match canary, it
is a separate explicit command; no default command, runtime selector, provider
integration or activation was added.

- `src/canary/grid-series-canary-scenario.ts` — the frozen combat-observable
  scenario `grid-series-canary-adaptive-v1`: the deterministic local
  competitor (`grid-canary-competitor` / `deterministic-local`, initial policy
  `flank`/`medium`/aggression `100`/`rear`/`rear`/thresholds `20`/`80`/
  `defend`) against the canonical `BULWARK_POLICY`; both fighters use fresh
  deep-cloned Bulwark builds every match; `maximumMatches 3`, `targetWins 3`,
  no `nextDesign`. `createGridSeriesCanaryScenario()` returns fresh values per
  call.
- `src/canary/grid-series-canary-seed-plan.ts` — the frozen seed plan
  `[baseSeed, baseSeed + 1, baseSeed + 2]` with safe-integer bounds
  (`GRID_SERIES_CANARY_MAX_BASE_SEED = Number.MAX_SAFE_INTEGER - 2`).
- `src/canary/grid-series-canary-adaptation.ts` — the frozen
  `grid-canary-policy-adaptation-v1` rule (`adaptGridCanaryPolicy`): after
  matches 1 and 2 only, the authoritative factual-report v2 and the
  deterministic fallback review must agree first; aggression `80`/`70` (match
  1. and `60`/`90` (match 2) by integrity comparison; opening `hold` when
     mobility-disabled or immobilised/overturned, `cautious` when behind,
     otherwise `flank`; untouched policy fields preserved; output validated
     against `actionPolicySchema`. No RNG, provider, clock or filesystem; never
     described as intelligent or AI-generated.
- `src/schemas/grid-series-canary-adaptation-trace.schema.ts` — the
  adaptation-trace v1 schema (`GridSeriesCanaryAdaptationTraceV1`): scenario
  and rule versions, series UUID, base seed and exactly two transitions with
  policies, authoritative facts and decisions; the super-refine re-derives
  every decision (source matches 1 and 2, real policy change, frozen
  aggression/opening rules, preserved untouched fields, decision/policy
  agreement).
- `src/canary/grid-series-canary-core.ts` — the pure three-match execution
  core (`executeGridSeriesCanary`): sequential seeds, fresh scenario values,
  injected match/series identities (never generated, never from the clock),
  direct `runGridMatch`, determinism re-execution, canonical-zone/round-cap/
  combat/translation evidence, match-record v3 with injected identity,
  bound factual-report v2, replay/report/final agreement, text/ASCII replay,
  review prompt, deterministic fallback review, two adaptations, evidence and
  the adaptation trace. No filesystem, provider, `runSeries` or benchmark.
- `src/canary/grid-series-canary-series.ts` — `buildGridSeriesCanarySeriesRecord`
  constructs the authoritative series-record v2 (grid runtime identity, status
  `completed`, target/max 3, three entries each with the bound report, the
  fallback review and the explicit intentional-local-fallback
  `reviewFailure` marker, the build proposal used, the policy used, the next
  policy for matches 1–2 and none for 3, no `nextDesign`, empty usage;
  all-zero `totalUsage`; score and winner derived from actual outcomes),
  validated against the series v2 cross-field contract.
- `src/canary/grid-series-canary-report.ts` — the deterministic series report
  (`buildGridSeriesCanaryReport`) stating canary/non-benchmark, identifying
  `simulator 0.3.0 (grid-3x3-v1)`, listing performance and policy adaptations,
  and reporting the raw three-match score with no win rates or percentages.
- `src/schemas/grid-series-canary-envelopes.schema.ts` — the four JSON
  envelope schemas (`matches.json`, `factual-reports.json`,
  `fallback-reviews.json`, `match-artifacts.json`) plus the frozen file-name
  constants; order (index = match number), uniqueness and series identity are
  enforced, report IDs are never `"pending"`, and text artifacts must be
  non-empty and NUL-free.
- `src/schemas/grid-series-canary-manifest.schema.ts` — the series canary
  manifest v1 (`GridSeriesCanaryManifestV1`): canary/series identities, three
  sequential seeds, grid runtime identity, sixteen evidence flags (including
  policy adaptation count 2, series and trace round trips, deterministic
  re-execution, full read-back and bundle cross-agreement) and seven SHA-256
  digests, with no win rates, percentages, promotion, balance or benchmark
  terminology.
- `src/canary/grid-series-canary-bundle.ts` — the pure series bundle
  cross-agreement validator `validateGridSeriesCanaryBundle`: identity and
  ordering (one series UUID across every artifact, sequential seeds, three
  ordered matches, unique match IDs, match number/ID/seed alignment),
  runtime/schema identity (series v2, records v3, reports v2, runtime
  agreement), result facts (rounds/winner/method/final integrity/disabled
  lists across record/report/entry/review), adaptation facts (two transitions
  sourcing matches 1–2, entry `nextPolicy` == trace `policyAfter`,
  next-entry `policyBeforeMatch` == prior `nextPolicy`, decisions recalculated,
  no build change), series facts (score == outcomes, winner rule, zero usage,
  completed, target/max 3), text-artifact markers and every digest. Never
  mutates inputs.
- `src/app/grid-series-canary.ts` — `runGridSeriesCanary(request,
dependencies)` is the application service: output-root guard (grid-series
  kind) → seed plan → physical-root guard → five distinct UUIDs (canary,
  series, three matches) → publication-path preflight → pure core with injected
  identities → series-record v2 → series report → four envelopes → exact
  serialization → series/trace/envelope round trips → deterministic
  re-execution comparison → seven digests → manifest v1 → shared atomic
  eight-file bundle publication with full read-back and bundle validation →
  structured result. Injectable dependencies: UUID creation, current time,
  filesystem bundle writer. Never calls the legacy `runSeries`/`runMatch`,
  repositories, an `ArenaAgent`, a provider or benchmark code.
- `src/app/grid-series-canary-cli-args.ts` — pure, side-effect-free argument
  parser requiring `--seed <non-negative safe base>` and rejecting missing,
  negative, non-integer, unsafe or overflowing seeds, duplicates, unknown
  arguments, target-wins/maximum-matches overrides, runtime selectors,
  `--ai`, `--review`, provider and API-key arguments.
- `src/app/run-grid-series-canary.ts` — the explicit `series:grid:canary`
  command with the banner `FORGE ARENA — GRID ADAPTIVE-SERIES CANARY /
NON-DEFAULT / NON-BENCHMARK / LOCAL-ONLY`, printing the canary ID, scenario,
  series ID, seed plan, runtime identity, per-match IDs and results, the final
  raw score, both adaptation summaries, the artifact directory and the
  statement that normal match and series commands remain legacy; nonzero exit
  on every failure.
- **Atomic, exclusive and immutable series bundle publication**
  (`data/canary/grid-series/<canaryId>/`): `manifest.json`, `series.json`,
  `matches.json`, `factual-reports.json`, `fallback-reviews.json`,
  `match-artifacts.json`, `adaptation-trace.json`, `series-report.txt` —
  exactly eight regular files via the shared publisher with the same lstat
  collision preflight, exclusive temporary creation, manifest-last order, full
  read-back, byte comparison, JSON revalidation, pure bundle validation and
  invocation-owned cleanup guarantees. Never writes to `data/matches` or
  normal series storage; `data/canary/` is git-ignored.

The series canary is not a benchmark and produces no balance conclusion; it is
a correctness and operational pipeline check. No default activation, runtime
selector or provider integration was added; activation-readiness was not
performed and Milestone 0.2C is not complete.

### Grid series canary provenance and immutability hardening (Milestone 0.2C Phase 3D2B.1)

The Phase 3D2B review gaps are closed before any activation-readiness
evaluation:

- `src/canary/grid-series-canary-seed-plan.ts` — the returned plan and seed
  tuple are now `Object.freeze`d at runtime (`Object.isFrozen` holds for both);
  attempted mutation cannot change any seed; separate calls return separate
  frozen values.
- `src/schemas/grid-series-canary-manifest.schema.ts` /
  `src/schemas/grid-series-canary-adaptation-trace.schema.ts` — safe-integer
  seed constraints: manifest `baseSeed`/seeds use `.safe()` with
  `baseSeed ≤ Number.MAX_SAFE_INTEGER - 2` and exact sequential seeds; the
  trace requires safe base/source seeds with transition 1 source = base and
  transition 2 source = base + 1.
- `src/canary/grid-canary-fallback-agreement.ts` — the single shared
  `gridFallbackReviewDisagreements` / `normaliseDisabledComponents` helper for
  complete report/review outcome agreement (winner, method, rounds, both final
  integrity values, both canonical disabled-component lists in the order
  `mobility`, `weapon`, `utility`). Used by the adaptation preflight, the
  deterministic fallback-review builder and both bundle validators; the
  single-match fallback-review validation is preserved unchanged.
- `src/canary/grid-series-canary-adaptation.ts` — complete report/review
  agreement (including disabled components) completes before any impairment
  fact is read for opening selection; conditions remain authoritative
  factual-report facts.
- `src/canary/grid-series-canary-bundle.ts` — `validateGridSeriesCanaryBundle`
  now requires: per-match provenance binding (entry match summary equals the
  record on every field; embedded factual report structurally equals the
  report-envelope item; embedded review non-null and structurally equal to the
  fallback-review-envelope item; fallback-envelope match number/ID alignment;
  frozen intentional local-fallback `reviewFailure` marker), build/policy
  execution binding (entry design/policy = record fighter A proposal/policy;
  fighter B = frozen Bulwark proposal/`BULWARK_POLICY`; competitor build
  identical across records; adaptation chain agrees with actual record
  policies), safe-integer seeds everywhere, complete fallback-review agreement,
  recomputed manifest evidence (`recomputeGridSeriesCanaryEvidence` must agree
  with the ten recomputable manifest flags), rendered per-match facts (text
  replay exact completion line/round/seed via the shared
  `formatCompetitionEndedLine`; review prompt exactly reproducible via
  `buildReviewUserPrompt`; ASCII seed/method/round), and the authoritative raw
  series score line + "3 matches completed" in the report. Operational-only
  evidence (round trips, deterministic re-execution, full read-back, bundle
  cross-agreement, replay final-state agreement) retains its service check.
- `src/canary/immutable-canary-bundle.ts` — `assertValidBundleDeclaration`
  validates the caller-supplied declaration (unique plain-filename entry names,
  manifest exactly once, unique artifacts, no manifest collisions, artifacts
  declared in `entryNames`, exactly one artifact per non-manifest entry;
  `/`, `\`, `..`, absolute and empty names rejected) before any filesystem
  activity; the seven-file match and eight-file series bundles remain
  byte-for-byte unchanged.

No simulator, scenario, policy, seed-derivation or adaptation-rule semantics
changed; no benchmark partition ran; seeds and fixtures unchanged; held-out
and `all` remain sealed; C1/C2/AB2 and qualification checksums remain frozen
with C2 default; constants remain `0.2.0 / 0.2.0` and catalogue `1`; normal
`match`/`series` remain legacy; no provider or external API call occurred; no
activation-readiness evaluation was performed; no default activation occurred;
Milestone 0.2C remains incomplete.

### Bounded development-only grid activation-readiness evaluation (Milestone 0.2C Phase 3E1)

One bounded, deterministic, development-only evaluation answers whether the
grid runtime is technically suitable for a separately authorised opt-in beta
decision. It never activates grid, never alters defaults, never tunes combat or
policies and never claims production readiness. It classifies the current
implementation as exactly one of `ready_for_opt_in_beta_review`,
`inconclusive` or `not_ready`; even `ready_for_opt_in_beta_review` is not
permission to activate grid.

- `config/readiness/grid-readiness-development-v1.json` —
  `src/readiness/seed-registry.ts` — the source-controlled development-only
  seed registry (`grid-readiness-development-v1`): exactly 24 frozen seeds in
  the reserved range `1703000000–1703099999`, runtime-frozen
  (`Object.isFrozen` registry and seed tuple), safe-integer enforced,
  distinct after the simulator's signed 32-bit seed conversion, with a
  deterministic canonical checksum. Separate loads return separate frozen
  values. The numeric range is reserved for grid-readiness development and
  must not be used by future benchmark or held-out registries; the registry
  is never read through a benchmark seed bank and the readiness command never
  opens any existing benchmark seed file. Since Phase 3E1.2
  `assertCanonicalGridReadinessSeedRegistry` anchors the exact canonical
  registry (metadata identity, exactly 24 seeds in the exact order, the exact
  reserved domain and the exact canonical checksum `54acf015...` as the
  single-source anchor).
- `src/readiness/scenario-registry.ts` — the frozen scenario registry
  (`grid-readiness-scenarios-v1`): seven families and thirteen assignments
  (one Bulwark-mirror assignment plus six role-swapped pairs — Flanker,
  Spinner, Grappler, Flipper, Runner, Sentinel versus the canonical Bulwark).
  Every build validates against catalogue v1 before evaluation;
  `createGridReadinessFighterConfig` returns fresh deep-cloned builds and
  policies; the registry is runtime-frozen with a deterministic canonical
  checksum. Since Phase 3E1.1 every nested fighter definition, build proposal,
  armour object and policy is a distinct deeply frozen clone (equal Bulwark
  definitions and the mirror X/Y never share references); deserialized
  registries reconstruct the same guarantees and the canonical checksum is
  unchanged. Since Phase 3E1.2
  `assertCanonicalGridReadinessScenarioRegistry` requires exact structural
  equality with a freshly created canonical registry and the exact canonical
  checksum `b0727017...`.
- `src/readiness/run-plan.ts` — the exact run-plan builder: 312 primary runs
  (24 seeds × 13 assignments) ordered scenario → assignment → seed with a
  unique `(scenarioId, assignmentId, seed)` tuple, no shuffling, frozen plan
  and entries, and a deterministic suite checksum that includes the suite ID,
  action-evidence model, provenance model (`canonical-registry-record-derived-decision-v1`),
  registry IDs and checksums, runtime identity and ordered runs.
- `src/readiness/execution-core.ts` — the pure execution core. Calls
  `runGridMatch` directly; requires the exact grid runtime identity
  `0.3.0 / grid-3x3-v1 / 0.2.0 / 1` and `1 ≤ rounds ≤ MAX_ROUNDS`; validates
  every initial/event zone, movement action, movement subject, facing and
  round-end condition; converts to match-record v3 with injected identities;
  builds and binds factual-report v2; validates every record/report; verifies
  replay/report/final-round agreement; renders text/ASCII replays and the
  grid-aware review prompt; produces canonical per-run evidence; and fails
  closed on input mutation. It is pure (no files, UUIDs, clock, provider,
  benchmark or legacy runtime). Since Phase 3E1.1 per-run evidence is derived
  by the shared record-evidence inspector (`src/readiness/record-evidence.ts`)
  from `policy_triggered` selected actions (stationary `hold` needs no
  `movement_resolved`; selected total = `2 × completed rounds`; knockback/
  grapple are target-subject and never selected actions), and render checksums
  are recomputed from the persisted record/report. Since Phase 3E1.2 the same
  inspector enforces the complete event chronology (`competition_started`
  first, one `round_started` + two `policy_triggered` + one `round_ended` per
  completed round, `competition_ended` last, monotonic rounds, strictly
  increasing unique sequences within each of the frozen runtime's two
  counters) and the ordinary-hold invariants (translated `hold` always zero;
  an emitted `hold` must be same-cell and same-facing). Since Phase 3E1.3
  round 0 is exclusively the `competition_started` event (every nonterminal
  event must carry an integer round in `1..record.rounds`), the start-event
  seed must agree with the record seed and the terminal `competition_ended`
  loser must agree with the record result; the dual sequence-counter
  validation is preserved. The live core and the
  read-back validator use the same inspector, so live and persisted evidence
  are identical. `verifyGridActivationReadinessDeterminism` requires
  byte-identical re-execution.
- `src/readiness/envelopes.schema.ts` — version-aware envelopes. Current v3:
  run-index v3 (312 ordered run entries including
  `selectedMovementActionCounts` / `selectedCombatActionCounts`), with
  match-records v1 and factual-reports v1 carrying the evaluation UUID and
  order/uniqueness/identity contracts. Historical v2 and v1 run-index
  artifacts parse but are rejected as current readiness evidence.
- `src/readiness/metrics.ts` — the pure metrics reducer: execution,
  movement (selected and translated actions, stationary holds, nine zone
  visits, relative bearings, exposed planar armour zones), combat (attempts,
  hits, misses, integrity damage, criticals, knockback, grapple reposition,
  overturns, component transitions, selected combat actions), results
  (judges/destruction/immobilisation/draws, round statistics, maximum
  no-progress streak), slot-order diagnostics (first-slot advantage,
  Bulwark-mirror slot imbalance, paired role-swap sensitivity) and timing
  percentiles. Slot-order diagnostics detect gross slot-order pathology only;
  timing is informational and never affects the decision. The persisted
  `metrics.json` is the v3 artifact (schemaVersion 3, suite id, selected
  combat counts); `recomputeGridActivationReadinessMetricsFromArtifacts`
  re-derives metrics exactly from the persisted records and reports, deriving
  the execution fields authoritatively (record counts, complete
  report/final-state agreement count, zero invalid events after inspection)
  plus the explicit operational attestations, and never copies non-timing
  execution fields from the persisted artifact. Since Phase 3E1.3 the
  recompute throws immediately on the first record/report final-state
  disagreement — it never silently counts a non-agreeing pair into
  `replayAgreeingMatches` and never downgrades a disagreement in the
  authoritative persisted-bundle path; H05 (`replayAgreeingMatches === 312`)
  is retained for live in-memory evaluation, and both paths share the single
  `assertGridReadinessRecordReportFinalAgreement` rule.
- `src/readiness/gates.ts` — the frozen gates: H01–H10 hard pass/fail,
  C01–C06 coverage pass/inconclusive, S01–S03 and P01–P02 gross-pathology
  pass/inconclusive/fail with frozen thresholds.
- `src/readiness/decision.ts` — `GridActivationReadinessDecisionV3` derives
  the classification (any hard/slot/progress failure → `not_ready`; else any
  inconclusive gate → `inconclusive`; else `ready_for_opt_in_beta_review`),
  carries every gate with its frozen threshold, observed value, evidence and
  blocking reason, and the mandatory non-activation disclaimer. No tuning
  recommendation is ever included. Historical v2 and v1 decisions parse but
  are rejected as current readiness evidence.
- `src/readiness/report.ts` — the deterministic human-readable development
  report (IDs, runtime identity, registry checksums, counts, determinism,
  contract/coverage/slot/progress/timing diagnostics, every gate, the final
  classification, blockers and the non-activation disclaimer). It never
  calls the suite a benchmark, never calls a result a balance pass, never
  claims production readiness and never states that grid is now default.
- `src/readiness/readiness-bundle.ts` — the immutable evaluation bundle:
  nine fixed regular files (`manifest.json`, `seed-registry.json`,
  `scenario-registry.json`, `run-index.json`, `match-records.json`,
  `factual-reports.json`, `metrics.json`, `decision.json`, `report.txt`) under
  `data/readiness/grid/<evaluationId>/`. Manifest v3 carries the evaluation
  UUID, creation time, suite/runtime identity, the action-evidence model and
  the provenance model (`canonical-registry-record-derived-decision-v1`),
  exact counts (24/7/13/312), the exact canonical registry checksums,
  registry/suite/outcome/report checksums, the decision, fixed artifact names
  and SHA-256 digests with the attestations
  `deterministicReexecutionPassed`, `inputsUnmodified`,
  `fullBundleReadBackPassed` and `legacyIsolationRegressionPassed`.
  `validateGridActivationReadinessCoreArtifacts` and
  `validateGridActivationReadinessBundle` require the exact canonical
  registries and cross-validate the persisted records/reports/run-index
  (including scenario assignment build/policy binding), recompute per-run
  evidence and render checksums from the persisted records, then metrics
  (with the corrected timing invariants), gates (H02/H07 from the manifest
  attestations, H06 from record inspection, H05 from complete
  report/final-state agreement), the decision and `report.txt` byte-for-byte;
  any disagreement fails the bundle. Since Phase 3E1.3 the core validator
  runs `assertGridReadinessRecordReportFinalAgreement` for every bound
  record/report pair and treats any final-state disagreement as a fatal core
  artifact-validation failure (with the run number and match ID), so a bundle
  containing a disagreement is rejected before any classification is
  returned — it can never validate under a `not_ready` classification or any
  other. Individual replay text is never included. Historical v1 and v2
  artifacts parse but are rejected as current readiness evidence.
- `src/canary/canary-output-root.ts` — the kind-aware root guard now includes
  `grid-readiness → data/readiness/grid`; the readiness service rejects normal
  match/series storage, both canary roots, every other in-repository data
  root, canonical-root descendants, symlink/junction ancestry and external
  symlink roots.
- `src/app/grid-activation-readiness.ts` — `runGridActivationReadiness`
  orchestrates the lexical/physical root guards, fixed registries, 312-run
  plan, injected evaluation/match UUIDs and timestamp, publication preflight,
  primary and repeat execution with determinism comparison, records/reports/
  run-index/metrics construction, round trips, in-memory and read-back
  cross-agreement, gates, decision, report, digests, manifest, shared
  immutable publish and structured result.
- `src/app/run-grid-activation-readiness.ts` — the `readiness:grid` command.
  Accepts no arguments (seed/scenario/partition/output/threshold/`--force`/
  runtime/provider/API-key arguments are all rejected) under the
  `FORGE ARENA — GRID ACTIVATION-READINESS EVALUATION /
DEVELOPMENT-ONLY / NON-BENCHMARK / NON-ACTIVATING` banner. A completed
  evaluation exits zero regardless of its decision; it exits nonzero only for
  an operational failure that prevents producing a validated decision bundle.

The readiness evaluation imports no benchmark module, reads no benchmark seed
file, uses no `--partition held-out`/`--partition all`, never calls
`runBenchmark`, either benchmark CLI, `runMatch`, legacy `runSeries`, a
provider or `ArenaAgent`, and never writes to `data/matches`, `data/series`,
either canary root or any other in-repository data root. No tuning follows the
official result; no opt-in activation decision is performed; no default
activation occurs; Milestone 0.2C remains incomplete.

The exactly-one official development run (`evaluationId
864991f7-d060-4669-beec-11e0d42b7e68`, bundle under
`data/readiness/grid/864991f7-d060-4669-beec-11e0d42b7e68/`) classified the
implementation as **`inconclusive`**: determinism passed, all hard gates
(H01–H10), all slot-order gates (S01–S03) and both progress gates (P01–P02)
passed, coverage gates C01/C03/C05/C06 passed, and coverage gates **C02**
(the canonical `hold` movement action was not observed) and **C04** (no
grapple reposition was observed) were inconclusive. Nothing was tuned after
the result; no opt-in activation decision and no default activation was
performed.

Phase 3E1.1 hardened the evaluation's evidence provenance (the v1 result
above is preserved as historical evidence). The exactly-one official v2 run
(`evaluationId d788284d-a795-4125-984c-9146261e271a`, bundle under
`data/readiness/grid/d788284d-a795-4125-984c-9146261e271a/`, suite checksum
`df9444101ca68f7b7ca9fef24adfe8575363ef744e9f37b4449b111e0bb29fd9`) classified
the implementation as **`inconclusive`**: determinism passed, all hard gates
(H01–H10), all slot-order gates (S01–S03), both progress gates (P01–P02) and
coverage gates C01/C02/C03/C05/C06 passed (C02 now passes because selected
actions are counted from `policy_triggered`, evidencing the Sentinel
stationary holds), and coverage gate **C04** (no grapple reposition was
observed) was inconclusive. No supplemental grapple scenario was added; no
tuning occurred; no opt-in activation decision and no default activation was
performed.

Phase 3E1.2 finalised the provenance chain and bound the suite to the exact
canonical registries (the v1 and v2 results above are preserved as historical
evidence). The current suite is `grid-activation-readiness-v3` with the
provenance model `canonical-registry-record-derived-decision-v1`.
`assertCanonicalGridReadinessSeedRegistry` / `assertCanonicalGridReadinessScenarioRegistry`
anchor the exact canonical seed (checksum `54acf015...`) and scenario
(checksum `b0727017...`) registries; the record-evidence inspector enforces
the complete event chronology and the ordinary-hold invariants;
`assertGridReadinessRecordReportFinalAgreement` enforces complete
report/final-state agreement; execution metrics are record-derived with
explicit operational attestations (H02/H07 from the manifest directly, H06
from record inspection, H05 from the complete agreement count); and timing
validation requires `mean ≈ totalElapsedMs / 312` and `p95 >= median` without
the invalid `median <= mean <= p95` assumption. Prettier is configured with
`endOfLine: crlf` and `format:check` passes repository-wide. The exactly-one
official v3 run (`evaluationId 0d8487a8-939d-4f9a-a16a-544b71eaa869`, bundle
under `data/readiness/grid/0d8487a8-939d-4f9a-a16a-544b71eaa869/`, suite
checksum `c3b8a16d407891d0a92966fb9d6ed20fe5e11776bf545624fb3dbcadb4e2503c`)
classified the implementation as **`inconclusive`**: determinism passed, all
hard gates (H01–H10), all slot-order gates (S01–S03), both progress gates
(P01–P02) and coverage gates C01/C02/C03/C05/C06 passed (selected `hold` =
4373, translated `hold` = 0), and coverage gate **C04** (no grapple
reposition was observed) was inconclusive. No supplemental grapple scenario
was added; no tuning occurred; no opt-in activation decision and no default
activation was performed.

Phase 3E1.3 hardened the verifier only (the v1, v2 and v3 results above are
preserved; the official v3 evaluation and its bundle are unchanged and still
validate under the stronger validator). Report/final-state disagreement is
now fatal to current readiness evidence: the core artifact validator runs
`assertGridReadinessRecordReportFinalAgreement` for every bound record/report
pair and rejects the bundle before any classification is returned, and the
metrics recompute throws immediately on the first disagreement instead of
silently counting a non-agreeing pair. A fully coherent false bundle (report
final state corrupted with `replayAgreeingMatches` = 311, H05 fail, a
`not_ready` decision, a regenerated `report.txt` and every manifest
digest/checksum plus the manifest classification coherently rewritten) is
rejected specifically because the factual report disagrees with its
authoritative record, never because a downstream artifact was left stale.
Round 0 is exclusively the `competition_started` event (every nonterminal
event must carry an integer round in `1..record.rounds`), the start-event
seed must agree with the record seed and the terminal `competition_ended`
loser must agree with the record result; the documented dual sequence-counter
validation required by the frozen runtime is preserved. No new official run
occurred; no replacement evaluation ID was created; no supplemental grapple
scenario or seed was added; no benchmark ran and no seed bank was opened;
held-out/all remain sealed; no provider call, tuning, opt-in beta decision or
default activation occurred; Phase 3E2 has not started and Milestone 0.2C
remains incomplete.

### Agent usage tracking

Every agent result (design, policy, review) produces an `AgentUsageRecord` capturing token usage, cost, latency and fallback status. The `AgentPhase` enum (`design` | `policy` | `review` | `design_correction`) tracks which stage each record belongs to.

### Cost calculation

`agents/cost-calculator.ts` provides `estimateCost()` and `getPricingTier()` for token usage estimation. Used for display purposes; actual billing comes from the provider.

### Fallback policy

`agents/fallback-policy.ts` provides a legal default `ActionPolicy` used when the AI fails to produce a valid policy. The policy version is tracked for reproducibility.

### Reports

- `reports/factual-match-report.ts` — builds a deterministic `FactualMatchReport` (v1) from `MatchResult` without AI involvement (D18), plus the grid v2 report and explicit-runtime dispatch (Phase 3D1)
- `reports/review-formatter.ts` — converts factual report data into prompt-safe text (v1 and v2)
- `reports/design-diff.ts` — structured comparison of two build proposals
- `reports/series-report.ts` — comparative report model across a series (v1 and v2)

### Seed source

`seed-source.ts` provides a `SeedSource` interface with two implementations:

- `DeterministicSeedSource` — returns pre-seeded values (for tests)
- `RandomSeedSource` — generates random seeds (for CLI)

### Shared utilities

The `shared/` directory contains cross-cutting utilities used by multiple modules. Currently:

- `text-sanitise.ts`: Terminal-safe text sanitisation (ANSI removal, control character filtering, name truncation). Used by ASCII replay, text replay, and statistics to prevent terminal injection.

### Persistence patterns

The JSON match repository uses:

- **Atomic writes**: Write to a temp file, then rename to final path. Prevents corruption on crash.
- **UUID validation**: Match IDs are validated as UUIDs before filesystem access.
- **Existing-ID rejection**: `saveMatch` throws if a match with the same ID already exists.
- **Corrupt entry tracking**: `listCorruptEntries()` reports files that failed validation.

### Presentation-only rendering boundary

The ASCII replay renderer is a presentation layer that consumes authoritative match records. It never influences:

- combat decisions
- action resolution
- damage calculations
- movement
- random rolls
- victory conditions
- event generation

The dependency direction is:

```
MatchRecord / authoritative events
              ↓
      replay presentation
              ↓
        ASCII output
```

Simulator packages must not import replay presentation modules. The ASCII layer receives only the specific data it needs through narrow interfaces.

## LLM non-authority

The language model submits proposals. The application validates them. The simulator resolves outcomes. The event log records what happened. The renderer describes it. At no point does model output bypass validation or override a deterministic result.
