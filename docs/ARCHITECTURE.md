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
  `grid-readiness → data/readiness/grid`, `grid-readiness-supplement →
data/readiness/grid-supplements` and `grid-readiness-governance →
data/readiness/grid-governance`; the readiness service rejects normal
  match/series storage, both canary roots, every other in-repository data
  root, canonical-root descendants, symlink/junction ancestry and external
  symlink roots, the supplement service additionally rejects the official
  readiness root, and the governance service additionally rejects both the
  official readiness root and the official supplement root.
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
- `src/readiness/grid-grapple-scenarios.ts` — the Phase 3E2 supplemental
  scenario registry (`grid-grapple-coverage-scenarios-v1`, checksum
  `1aba546d...`): one feature-exercising scenario (Grapple Coverage Attacker
  `x` versus Stationary Coverage Target `y`) and two role assignments, deeply
  frozen, catalogue-valid, exact role swapping, no shared references and
  fresh mutable configurations per execution.
- `src/readiness/grid-grapple-run-plan.ts` — the frozen supplemental run plan
  (`grid-grapple-coverage-supplement-v1`): exactly 48 runs (24 canonical
  seeds × 2 assignments), assignment → seed ordering, unique
  `(assignmentId, seed)` tuples, and a deterministic plan checksum
  (`e30dda08...`) over the supplement suite ID, anchored base v3 evaluation
  ID and suite checksum, both registry checksums, the runtime identity and
  the ordered runs.
- `src/readiness/grid-grapple-evidence.ts` — the authoritative grapple-event
  extractor (causally hardened in Phase 3E2.1). A per-round attack ledger
  requires every Grappler `attack_attempted` to resolve to exactly one
  `attack_hit`/`attack_missed` in the same round with canonical
  actor/target/weapon before `round_ended`; a valid grapple-reposition
  observation requires an authoritative Grappler `attack_hit`, a
  `movement_resolved` event with `action: "grapple"`, canonical actor/target
  semantics, `from !== to`, canonical facing, a valid in-match round and a
  destination exactly agreeing with `resolveGridGrapple`, and the grapple must
  consume an unmatched non-same-cell hit in the same round (a second grapple
  for one hit is malformed). Attempts, misses, knockback, same-cell hits,
  wrong-fighter events and malformed/resolver-disagreeing events are never
  counted as repositions; the 50% reposition roll is never inferred.
- `src/readiness/grid-grapple-execution-core.ts` — the pure 48-run execution
  core (direct `runGridMatch` only): v3 records, v2 reports, shared
  record-evidence inspector, complete report/final-state agreement,
  text/ASCII replays, review prompt, canonical run checksums and authoritative
  grapple evidence, with byte-identical deterministic repeat.
- `src/readiness/grid-grapple-metrics.ts` — the pure grapple metrics reducer
  (execution, grapple-feature and isolation diagnostics; timing informational
  only).
- `src/readiness/grid-grapple-decision.ts` — `GridGrappleCoverageDecisionV1`
  (`coverage_confirmed` / `inconclusive` / `not_ready`) and the combined
  readiness addendum (`GridActivationReadinessAddendumV1`) with the required
  additive non-activating disclaimer and the combined readiness
  classification derivation.
- `src/readiness/grid-grapple-report.ts` — the supplemental human-readable
  report (additive, non-benchmark, non-activating, never a balance pass).
- `src/readiness/grid-grapple-supplement-bundle.ts` — the immutable
  supplement bundle: base-v3 anchoring (strong validator, exact evaluation
  ID, suite checksum, canonical registry checksums, `inconclusive`
  classification, C04-only non-pass gate, base counts 36/8/0, and the frozen
  pinned base manifest/decision/metrics SHA-256), the ten-file inventory
  (`manifest.json`, `base-readiness-reference.json`, `seed-registry.json`,
  `scenario-registry.json`, `run-index.json`, `match-records.json`,
  `factual-reports.json`, `metrics.json`, `decision.json`, `report.txt`),
  manifest v1 with digests and the addendum, and
  `validateGridGrappleCoverageSupplementBundle` which cross-validates
  records/reports/run-index (canonical plan binding with the attacker slot
  derived from the plan, canonical scenario config binding, shared
  inspector, final-state agreement, recomputed checksums, causally
  strengthened grapple evidence, cross-envelope supplement-ID and timestamp
  agreement), recomputed metrics, a fully rebuilt decision and a fully
  rebuilt combined readiness addendum compared for equality, the recomputed
  combined classification and byte-for-byte report regeneration, plus
  `anchorOfficialGridGrappleCoverageSupplement` for the frozen official
  supplement identity.
- `src/app/grid-grapple-coverage-supplement.ts` —
  `runGridGrappleCoverageSupplement` orchestrates the root guards, base
  anchoring, fixed registries and 48-run plan, injected supplement/match
  UUIDs and timestamp, publication preflight, primary and repeat execution
  with determinism comparison, records/reports/run-index/metrics
  construction, hard checks, decision, addendum, report, digests, manifest,
  shared immutable publish and read-back. Phase 3E2.1 retains the exact
  start-of-run base bytes and runs `assertOfficialBaseUnchangedSinceStart`
  immediately before publication: any change in any of the nine base
  artifacts, or any drift from the pinned base hashes, is an operational
  failure that prevents publication.
- `src/app/run-grid-grapple-coverage-supplement.ts` — the
  `readiness:grid:grapple` command under the
  `FORGE ARENA — GRID GRAPPLE COVERAGE SUPPLEMENT /
DEVELOPMENT-ONLY / ADDITIVE / NON-ACTIVATING` banner. Accepts no arguments;
  a completed `coverage_confirmed`, `inconclusive` or `not_ready` result exits
  zero; it exits nonzero only for an operational failure that prevents
  producing a validated supplement bundle.
- `src/readiness/grid-opt-in-beta-contract.ts` — the versioned bounded-beta
  policy contract `grid-opt-in-beta-contract-v1` (purpose
  `internal-bounded-grid-beta-implementation`, deterministic checksum
  `5f345ce4...`): explicit selection, legacy default isolation, internal
  single-match beta scope, schema-v3 persistence with the complete frozen grid
  identity, user/operator clarity, one immediate deterministic kill switch,
  migration-free rollback, forbidden scopes and frozen suspension triggers,
  with `isGridOptInBetaContractComplete` as the authoritative completeness
  check.
- `src/readiness/grid-opt-in-beta-governance.ts` —
  `GridOptInBetaGovernanceDecisionV1` (`approved_for_bounded_opt_in_beta_implementation`
  / `deferred` / `rejected`), the frozen official evidence references,
  authorised/forbidden scope, required safeguards, rollback/suspension
  triggers, unresolved risks, the mandatory non-activating disclaimer, and the
  pure `deriveGridOptInBetaGovernanceOutcome` criteria function (rejection
  wins, then deferral, then approval — never hard-coded independently of the
  evidence facts).
- `src/readiness/grid-opt-in-beta-governance-bundle.ts` — the immutable
  governance bundle: the frozen official base and supplement evidence
  references, the seven-file inventory (`manifest.json`, `source-state.json`,
  `base-evidence-reference.json`, `supplement-evidence-reference.json`,
  `beta-contract.json`, `decision.json`, `report.txt`), the read-only static
  isolation preflight and source-state artifact bound to the exact authorised
  source commit, evidence-reference builders that validate and anchor the
  official directories, the manifest v1, and
  `validateGridOptInBetaGovernanceBundle` which cross-validates source-commit
  binding, manifest identity, the frozen contract and contract checksum,
  frozen evidence references, an independent complete decision rebuild equal
  to the persisted decision, byte-for-byte report regeneration and coherent
  digests.
- `src/readiness/grid-opt-in-beta-report.ts` — the governance human-readable
  report (evidence-based, non-activating, no simulation; byte-for-byte
  regenerable).
- `src/app/grid-opt-in-beta-governance.ts` —
  `runGridOptInBetaGovernanceDecision` orchestrates the root guards, the
  read/validate/anchor of both official evidence directories (never modified,
  with a pre-publication immutability re-check), the decision ID and
  timestamp, the static preflight, the pure criteria derivation, the decision,
  report, digests, manifest, shared immutable publish and read-back.
- `src/app/run-grid-opt-in-beta-governance.ts` — the
  `readiness:grid:governance` command under the
  `FORGE ARENA — GRID OPT-IN BETA GOVERNANCE /
EVIDENCE-BASED / NON-ACTIVATING / NO SIMULATION` banner. Accepts no
  arguments; a completed `approved_for_bounded_opt_in_beta_implementation`,
  `deferred` or `rejected` decision exits zero; it exits nonzero only for an
  operational failure that prevents creating a validated governance bundle.

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

Phase 3E2 added an isolated, additive supplemental grapple-coverage check (the
v1, v2 and v3 official results above remain unchanged and authoritative). The
official v3 suite observed no grapple reposition (C04 inconclusive; base
reposition observations knockback 36 / overturn 8 / grapple 0), so the
supplement collects ONLY that missing feature evidence through a separate
deterministic 48-match plan. `runGridGrappleCoverageSupplement` anchors the
official v3 bundle at `data/readiness/grid/0d8487a8-.../` before any match
(strong validator, exact evaluation ID, suite checksum, canonical registry
checksums, `inconclusive` classification, C04-only non-pass gate and base
counts 36/8/0) and fails without running matches or writing artifacts if the
base is absent or invalid. It reuses the canonical 24-seed registry unchanged
and the new feature-exercising scenario registry
(`grid-grapple-coverage-scenarios-v1`, checksum `1aba546d...`), runs 48
matches twice under fixed identities, derives the authoritative grapple
evidence from the frozen event contract, produces the
`GridGrappleCoverageDecisionV1` and the combined readiness addendum, and
publishes an immutable ten-file supplement bundle under
`data/readiness/grid-supplements/<supplementId>/` with complete read-back and
cross-artifact validation. The root guard now includes
`grid-readiness-supplement → data/readiness/grid-supplements` and rejects the
official readiness root, normal match/series storage, both canary roots, other
in-repository data roots, descendants, symlink/junction ancestry and external
symlink roots. The exactly-one official supplement (`supplementId
4eca43e2-cc3d-41ee-bfad-73e18238ff61`, directory
`data/readiness/grid-supplements/4eca43e2-cc3d-41ee-bfad-73e18238ff61/`)
classified the supplement as **`coverage_confirmed`**: 48/48 deterministic
matches, 480 Grappler attempts / 204 hits / 276 misses, 8 valid
grapple-reposition events (4 per fighter slot, 4 distinct seeds each), 186
same-cell hits without reposition, 0 wrong-fighter and 0
malformed/resolver-disagreeing events. The combined readiness classification
is **`ready_for_opt_in_beta_review`** — a separate opt-in beta decision may
now be considered, but it is not an activation decision. The official v3
evaluation was not rerun or modified; no benchmark ran and no seed bank was
opened; held-out/all remain sealed; C1/C2/AB2, constants and defaults
unchanged with C2 default; the 24 seeds, seven readiness scenarios, thirteen
assignments and 312-run plan unchanged; both canaries and legacy match/series
unchanged; no provider or external API call; no tuning after results; no
opt-in beta decision; no default activation; Milestone 0.2C remains
incomplete.

Phase 3E2.1 hardened the supplement's provenance (verifier-only; the official
v3 evaluation and the official Phase 3E2 supplement are unchanged and still
validate). A resolver-valid grapple movement is now causally required to
follow an unmatched non-same-cell Grappler hit in the same round — a grapple
without a hit, a second grapple for one hit, an outcome without an attempt, a
false `from`/facing or a destination disagreeing with the canonical resolver
is malformed and never counts as coverage. Persisted run-index entries and
records are bound to the canonical 48-run plan (attacker slot derived from the
plan, never from the persisted entry) and to the canonical supplemental
scenario configuration. The decision and the combined readiness addendum are
independently rebuilt from the recomputed metrics and must equal the persisted
payloads in full. The official base manifest/decision/metrics hashes are
pinned to frozen values (not self-declared) and re-checked byte-for-byte
immediately before publication. Nine fully coherent corruption scenarios
(alternate plan, alternate build, fake grapple without a hit, false origin,
second grapple for one hit, decision payload corruption, addendum corruption,
cross-envelope supplement-ID disagreement, and a base-mutation race) are
rejected by their intended provenance rule. The official supplement
(`4eca43e2-...`) passes the strengthened validator unchanged
(480/204/276; 8 valid repositions, 4 per slot from 4 distinct seeds each; 186
same-cell; 0 wrong-fighter; 0 malformed). No official rerun, benchmark, seed
bank, provider call, tuning, opt-in beta decision or default activation
occurred; held-out/all remain sealed; Milestone 0.2C remains incomplete.

Phase 3F performed the bounded opt-in beta governance decision (the official
v3 evaluation and the official Phase 3E2 supplement remain unchanged and
still validate). `runGridOptInBetaGovernanceDecision` reads the nine official
v3 artifacts and the ten official supplemental artifacts, validates and
anchors both with the production validators and anchors, snapshots all
nineteen files and requires no changes before publication. The versioned
policy contract `grid-opt-in-beta-contract-v1` binds any later implementation
to explicit beta-labelled selection, legacy default isolation, an
internal/development single-match scope, schema-v3 persistence with the
complete frozen grid identity, user/operator clarity, one immediate
deterministic kill switch, migration-free rollback and frozen suspension
triggers. The pure criteria function `deriveGridOptInBetaGovernanceOutcome`
rejects, defers or approves from explicit governance inputs over the frozen
evidence facts (approval is never hard-coded independently of those facts).
The read-only static isolation preflight proves legacy default `runMatch`,
grid entered only through explicit `runGridMatch`, no normal command importing
the governance service, global constants `0.2.0 / 0.2.0`, catalogue `1`,
frozen grid identity, schema-v3 converter/replay support, unchanged schema-v2
legacy persistence, unchanged canary checks and no benchmark/provider
dependency in the governance module. Each official decision publishes an
immutable seven-file bundle under `data/readiness/grid-governance/<decisionId>/`
with manifest-last publication, exact inventory, digests, source-commit
binding to `5173fd0f287465e1181969dbad2f37cee10fd47e`, frozen evidence
references, complete decision reconstruction and byte-for-byte report
regeneration. The official governance outcome was
**`approved_for_bounded_opt_in_beta_implementation`** — authorising at most
implementation of a bounded, explicitly selected, internal/development grid
beta in a later, separately reviewed phase. No runtime was enabled, legacy
remains default, C2 remains the experimental default, no beta implementation
started, no public rollout and no balance claim are authorised, no evaluation
was rerun, and Milestone 0.2C remains incomplete until a separately reviewed
bounded opt-in implementation is completed.

Phase 3F.1 bound that decision to the exact reviewed source snapshot. A commit
string alone was insufficient — `source-state.json` recorded only the
authorised commit string and static-preflight booleans. The provenance
tooling (`grid-source-commit-reader.ts`,
`grid-opt-in-beta-source-snapshot.ts`, `grid-opt-in-beta-source-facts.ts`,
`grid-opt-in-beta-source-state-provenance.ts`,
`grid-opt-in-beta-official-identity.ts`) reads the exact reviewed file bytes
from the Git commit object `5173fd0f…` (`git rev-parse`/`git cat-file`,
argument-array process API only, never the working tree), requires the exact
commit locally, rejects shallow/missing objects and a different commit, never
modifies the repository and never accesses the network. The reviewed source
snapshot `grid-opt-in-beta-reviewed-source-v1` (checksum `1f984801…`) freezes
26 reviewed file identities (blob SHA + content SHA-256).
`deriveGridOptInBetaReviewedSourceFacts` reconstructs
`GridOptInBetaReviewedSourceFactsV1` from the exact committed bytes; the
canary source-isolation booleans are derived from the frozen canary file
hashes (no longer hard-coded to `true`).
`assertCanonicalGridOptInBetaGovernanceSourceState` requires a persisted
`source-state.json` to equal the canonical reviewed source state (repository,
source commit, identities, contract, preflight, canary, governance inputs and
exact shape), so coherent rewrites of source-state booleans no longer
validate. `anchorOfficialGridOptInBetaGovernanceDecision` requires both the
unchanged official seven-file bundle (frozen hashes `0f143dde…`/`5721585d…`/
`972d99b9…`/`0cc07da6…`/`5f345ce4…`/`da377b33…`/`63259937…`) and the exact
reviewed Git source snapshot; the official Phase 3F decision was not rerun and
passes the strengthened anchor with outcome
`approved_for_bounded_opt_in_beta_implementation`.

Phase 3G implemented the bounded explicit grid beta
(`grid-opt-in-beta-match-v1`). `match:grid:beta` is the only beta match
command (required `--seed`, `--fighter-a`, `--fighter-b`,
`--acknowledge-grid-beta`; no `--runtime`/output/provider argument; missing
acknowledgement fails before any match activity). Fighters are
`GridBetaFighterSpecV1` documents loaded by identifier from
`data/beta/grid-fighters/` (strict schema, catalogue-v1 build validation,
authoritative policy schema, deterministic checksum, traversal/symlink/size
protection; input errors never suspend). One deterministic suspension marker
at `data/beta/GRID_BETA_SUSPENDED` stops only new grid-beta matches on any of
the twelve frozen trigger codes; it is created atomically and never
overwritten. Before every beta match the service anchors the official
governance bundle (`anchorOfficialGridOptInBetaGovernanceDecision`: exact
seven files, frozen hashes, exact reviewed Git source snapshot) and
re-checks the governance bytes immediately before simulation and before
publication. A read-only protected legacy-source preflight runs against the
current checkout (frozen reviewed-source identities, CRLF-normalised) and a
pure `executeGridBetaMatch` core calls only `runGridMatch` twice, requiring
deterministic equality of all simulator facts. The primary result is persisted
as schema v3 with empty agent usage; the factual-report v2 is bound and
validated; record/report final-state agreement and replay reconstruction
agreement are required. Each match publishes an immutable ten-file bundle
under `data/beta/grid-matches/<matchId>/` (manifest last) validated by the
complete cross-agreement `validateGridBetaMatchBundle`; the output-root guard
rejects normal match/series, both canaries, readiness/supplement/governance,
the fighter-input root and the suspension-marker path. `replay:grid:beta`
validates and displays stored bundles read-only (no simulation; ignores the
suspension marker). No official beta match was executed during
implementation; legacy remains default; no default/public/ranked/tournament
activation and no balance conclusion; the beta is implemented but not yet
independently reviewed.

Phase 3G.1 hardened the beta safety and provenance without running a beta
match or altering official artifacts. The pre-simulation sequence is ordered
so no async preflight occurs after the final governance and suspension
checks (load fighters → collision-free identity → canonical protected-source
preflight → governance bytes unchanged → marker absent → synchronous
`runGridMatch`). The shared immutable publisher gained an optional
`beforeAtomicPublish` hook (runs after temporary-bundle validation,
immediately before the atomic rename) that the beta uses to re-run the
complete protected-source preflight, require governance bytes unchanged,
require the marker absent and recheck the physical output root; a typed
`GridBetaSafetyError` retains the original trigger and the publisher cleans
up the temporary directory. Suspension-marker creation is genuinely
exclusive (`CanaryFileSystem.writeFileExclusive`, `wx` semantics): the final
path is created directly, never replacing any existing entry, with secure
marker-parent creation and complete filesystem-root ancestry inspection
before and after. All beta-owned machine schemas are strict; fighter
artifacts are parsed through the authoritative `parseGridBetaFighterSpec`
path with canonical byte serialization; the complete validated build and
policies are bound field-for-field across the record config and initial
states; the complete canonical C2 metadata (`component-impact-c2`,
`linear-component-impact`, `13548462df34a183`) is bound across the selection,
record and record config; the persisted preflight must be the exact canonical
pass; the execution attestation primary checksum is bound to the persisted
record reconstruction and `manifest.createdAt` must equal `record.createdAt`;
repeat executions use independent fresh input graphs with mutation
detection; governance inventory reading lists every entry including dotfiles
with exact sorted equality; fighter input ancestry is inspected from the
filesystem root via `lstat` with a post-read recheck; and the physical replay
bundle is inventory-validated (exactly ten regular files, no symlinks/hidden/
nested entries) before any content is read. No real beta match or marker was
created; the beta is implemented but not yet authorised for its first real
execution.

Phase 3G.1.1 closed the final beta trust-boundary gaps without running a beta
match or creating a marker. The production beta service is unbypassable: the
public match request contains only `seed`, `fighterA`, `fighterB` and
`acknowledgement` (no `outputRoot`/`fighterRoot`/`governanceBundleDir`/
`suspensionMarkerPath` overrides) and the production dependency contract has
no `execute?` seam, so every production invocation enters the fixed imported
`executeGridBetaMatch` (which hard-codes `runGridMatch`) and always uses
exactly `data/beta/grid-fighters`, `data/beta/grid-matches`,
`data/readiness/grid-governance/58e8cd87-504e-4b5f-9bac-f6b81d82377b` and
`data/beta/GRID_BETA_SUSPENDED`. Suspension-marker parent creation never
follows an ancestor: the complete
ancestry is walked from the filesystem root with `lstat` before any `mkdir`,
every existing component must be a real directory (symbolic links, junctions,
files and other entries reject), and missing directories are created
incrementally with one non-recursive `mkdir` at a time beneath the last
verified real directory, with the complete ancestry re-inspected before and
after the exclusive (`wx`) marker creation. Replay validates physical
regular-file identity with `lstat` before and after every read plus a final
exact ten-entry inventory check before semantic validation, so a
regular-file-to-symlink substitution during reading rejects through the
physical rule even when the read returns valid bytes. The suspension-marker
schema is now strict (cleanup only). No real beta match or marker was created
during Phase 3G.1.1; the hardening remains in force and unchanged through the
authorised GRID-BETA-001 smoke run.

Phase 3G.1.2 sealed the production API boundary. The exported
`runGridBetaMatchWithEnvironment` runner and the `GridBetaMatchEnvironment`
type were removed from `src/app/grid-beta-match.ts`; the module now exposes
only `runGridBetaMatch(request, dependencies?)` with a four-field request and
no exported function or interface that accepts alternate
`outputRoot`/`fighterRoot`/`governanceBundleDir`/`suspensionMarkerPath`. The
production entry point directly assigns the four frozen canonical roots and
always enters the fixed `executeGridBetaMatch`. The source-level test harness
was deleted; all temporary path remapping now lives entirely in test code — a
test-only `CanaryFileSystem` wrapper in `tests/helpers/`
(`grid-beta-mapped-fs.ts`) transparently redirects the canonical beta logical
paths onto an external temporary directory (fighter root, match output,
governance bundle and suspension marker, with the marker parent `data/beta`
redirected to the temp root so no real `data/beta` tree is created) while
ordinary repository/source-file reads used by the protected-source preflight
still access the genuine checkout. The general dependency contract keeps the
injectable filesystem, source-commit reader, UUID, clock and a
non-result-producing `onExecutionStart` observer invoked immediately before
the fixed `executeGridBetaMatch(...)` call (it receives no match data and
cannot cancel, replace or mutate execution). Static API-boundary regressions
prove the request exposes only the four fields, no root selection and no
`execute?` seam exist, `runGridBetaMatch` directly supplies the four
canonical constants, and no alternate-root beta runner exists anywhere in
production source. Runtime regressions execute the complete beta path through
`runGridBetaMatch` itself with the mapped filesystem, proving logical
production paths are requested and a valid ten-file temporary bundle results
while real `data/beta` stays absent. No real beta match or marker was created
during implementation; Phase 3G.1.2 passed independent review at
`8b96161…`, and Milestone 0.2C is **COMPLETE**.

GRID-BETA-001 (2026-08-07) executed the completed 0.2C beta surface once as a
controlled internal operational smoke test: seed `20260807`, `beta-smoke-01`
vs `beta-smoke-01` mirror, match `19c41607-21d0-48e1-a419-23d4721e4be4`,
winner `fighter_b` by judges in 20 rounds, primary/repeat result checksums
identical (`867b2df6…`). The immutable ten-file bundle passed the complete
production bundle validator; the text replay and the ASCII replay each
validated the full physical bundle before display; the suspension marker
remained absent after completion; and all seven official governance hashes
stayed unchanged. Run 001 is an operational smoke test only — not balance,
readiness or adaptation evidence, not held-out evaluation, does not authorise
grid as the default, does not authorise public/ranked/tournament/monetised
play, and does not begin Milestone 0.2D.

Bounded beta observation window A (D59, 2026-08-07) ran four further
controlled mirror matches before any Milestone 0.2D decision: GRID-BETA-002
seed `20260808` draw `f668f59c-…`, GRID-BETA-003 seed `20260809` fighter_a
`dc7459b6-…`, GRID-BETA-004 seed `20260810` fighter_a `64eb89f3-…`,
GRID-BETA-005 seed `20260811` draw `e835a904-…`, all by judges in 20 rounds.
Every run produced exactly ten immutable files with identical mirror fighter
bytes at the frozen checksum `e168c618…`, equal primary/repeat result
checksums, canonical protected-source preflight pass, empty agent usage, exact
C2 metadata, a complete bundle-validator pass, text and ASCII replay passes,
and no suspension marker afterward. Post-window integrity: all seven
governance hashes unchanged, GRID-BETA-001's ten hashes unchanged, C1/C2/AB2
and the C2 default unchanged, legacy normal paths unchanged, and no
benchmark/provider/seed-bank/held-out/`all` access occurred. The window is
factual operational observation only — no balance, slot/fairness or tuning
conclusion is drawn, and outcomes are explicitly deferred.

**Governed source-evolution bridge (D66, 2026-08-07).** The bounded grid-beta
authorisation is bound to an immutable reviewed-source baseline. The legacy
isolation preflight (`src/beta/grid-beta-legacy-preflight.ts`) protects
`GRID_BETA_LEGACY_ISOLATION_PROTECTED_PATHS` (which includes
`src/app/run-match.ts` and `src/app/run-series.ts`) by comparing current
checkout bytes against `GRID_OPT_IN_BETA_REVIEWED_SOURCE_FILES`
(snapshot `grid-opt-in-beta-reviewed-source-v1`, source commit
`5173fd0f…`, checksum `1f984801…`); any change to a protected normal-path
file fails closed with `legacy_default_regression`. That is intentional
fail-closed behaviour, not a defect. Because the planned 0.2D Phase 3
canonical-Bulwark migration must change exactly those normal-path files, D66
authorises a VERSIONED SUCCESSOR SOURCE BASELINE mechanism that separates two
claims. **Claim A — original governance authority:** the v1 snapshot and the
official Phase 3F/3F.1 governance bundle (decision `58e8cd87-…`, seven hashes
`0f143dde…`/`5721585d…`/`972d99b9…`/`0cc07da6…`/`5f345ce4…`/`da377b33…`/
`63259937…`) remain immutable historical evidence and are never rewritten.
**Claim B — current-source compatibility:** a new versioned successor baseline
`grid-beta-legacy-isolation-reviewed-source-v2` (name may be refined) attests
that a later reviewed source commit remains compatible with the source
properties material to the original approval; it does not re-authorise beta or
replace the original decision. The beta may operate against evolved source
only when BOTH are valid; failure of either fails closed. Every successor
baseline is explicitly versioned, bound to one exact Git commit and exact
reviewed file bytes, deterministically checksummed, independently reviewed and
activated only by an explicit decision — no mutable "latest" baseline. The
first permitted successor exists only to allow the Phase 3 canonical-Bulwark
migration (normal `run-match`/`run-series` move from historical hard-coded
Bulwark input to `data/opponents/bulwark.v1.json` plus the minimum reviewed
support modules), with required equivalence facts (legacy remains default,
`runMatch` still used, no grid/beta normal path, no runtime fallback, versions
`0.2.0`/`0.2.0`/catalogue `1`/C2 unchanged, Bulwark fixture anchors
`053e61e8…`/`d109c73a…`, test-only behavioural equivalence, provider-ordering
fail-closed) and a successor protected set that includes every currently
protected path plus the new fixture/runtime/loader modules. During the
transition (migration candidate committed, v2 not yet activated) grid beta is
operationally NOT authorised and the beta is simply not invoked; the preflight
is not weakened. The required Phase 3 sequence is **Commit M** (migration
candidate, exact SHA recorded, beta unavailable by design, no operational beta
command, equivalence tests may run) → **independent review of M** → **Commit
G** (successor source snapshot constructed from exact Git commit M — never
uncommitted working-tree bytes — with path/blob-SHA/content-SHA-256 per
reviewed path, deterministic v2 checksum, active preflight updated to compare
against v2, v1 preserved unchanged, full suite passing); M and G are never
squashed. After v2 activation any future protected change fails closed again
and a later legitimate evolution requires a new candidate, review, new
successor version, exact hashes and an explicit activation decision. GRID-BETA
001–005 provenance is preserved unchanged (executed under the v1 baseline);
future matches record the then-current successor identity separately. The
bridge makes zero statement about balance, strength, difficulty, fairness,
tuning, C2 finality or fixture performance — source-governance only.

Milestone 0.2D Phase 0 (D61, 2026-08-07) defines — and does not implement —
the opponent-suite governance. ADR-004 (`docs/ADR-004-multi-opponent-fixture-format.md`)
freezes the fixture contract: immutable/versioned identity
(`schemaVersion`, `opponentId`, `fixtureVersion`, `displayName`, `build`,
`policy`, `catalogueVersion`, `rulesetCompatibility`,
`runtimeCompatibility`, `description`, `archetypeIntent`), no subjective
balance labels, a descriptive-only `archetypeIntent`, and a canonical
SHA-256 fixture checksum binding the build proposal, complete validated
build, policy, schema/fixture/catalogue versions and runtime-compatibility
declaration. The chosen runtime model is runtime-neutral fixture with
runtime-specific execution: fixtures own build/policy identity valid across
runtimes, declare `runtimeCompatibility` explicitly, and never cause a
runtime change or request grid activation. Six conceptual archetype envelopes
(`bulwark`, `skirmisher`, `crusher`, `spinner`, `controller`, `generalist`)
are defined without fixture JSON. The historical "tournament runner" is
retired in favour of the local development opponent-suite runner
(cross-opponent matrix runner), which is not the public Arena tournament
system and creates no rankings/prizes/matchmaking/public play. The evidence
firewall prohibits benchmark, held-out, `all`, AB2, and GRID-BETA-001–005
outcome use for fixture tuning or selection; no seed bank is opened; no
statistical sample is selected. The phased sequence (fixture schema → six
canonical fixtures → validation + Bulwark migration → development-only
runner → factual cross-opponent report) is defined but not started; each
phase requires independent review. No opponent fixture, runner, package
script or `src/` change was made in Phase 0.

Milestone 0.2D Phase 1 (D62, 2026-08-07) implements the opponent-fixture
foundation only: `src/opponents/opponent-fixture.ts` (strict v1 fixture
schema, strictness preflight, canonical identity/checksum, deep immutability)
and `src/opponents/opponent-fixture-loader.ts` (secure fixed-root loader).
The fixture schema is strict at every object level via an exact-key preflight
before the authoritative non-strict build/policy schemas (never silently
stripping unknown fields; value/enum/budget validation remains
`machineBuildProposalSchema`, `actionPolicySchema`, `validateBuild(…,
CATALOGUE_V1)`). The persisted `validatedBuild` must equal the complete
authoritative build and `catalogueVersion == CATALOGUE_V1.version`.
`rulesetCompatibility` binds exact `RULESET_VERSION`; `runtimeCompatibility`
binds the frozen `LEGACY_RUNTIME_IDENTITY`/`GRID_RUNTIME_IDENTITY` with both
entries explicit and at least one `supported`; compatibility is data only.
`fixtureChecksum` is SHA-256 over the canonical identity serialization
(deterministic recursive key ordering, complete `validatedBuild`, no
timestamps/random IDs, `fixtureChecksum` excluded from its own input), and a
persisted fixture must already equal the canonical serialization
byte-for-byte (fail closed, no auto-rewrite). `loadOpponentFixture(opponentId,
fixtureVersion, dependencies?)` uses the fixed logical root `data/opponents`
with no alternate-root API: identifier+version selection, canonical filename
only, path-escape rejection, `lstat`-based symlink/junction ancestry
inspection, regular-file requirement, bounded JSON size, post-read re-`lstat`,
strict schema + canonical-bytes + build/policy/compatibility/checksum binding,
and a deeply frozen result; all failures are `OpponentFixtureError`.
Test-only path remapping lives in `tests/helpers/opponent-fixture-mapped-fs.ts`;
no real `data/opponents/` tree exists. Phase 1 adds no runner, no canonical
fixture, no package script, no provider/benchmark/held-out/grid-beta
dependency and no runtime/default change.

Phase 1.1 (D63, 2026-08-07) completes the nested strictness boundary: the
exported parser's exact-key preflight now also covers
`validatedBuild.proposal.armour` via a shared `assertExactBuildProposalKeys`
helper used identically for `build` and `validatedBuild.proposal` (both with
their nested armour), so no unknown authoritative field can be silently
stripped by the non-strict global schemas at any level. Direct-parser,
coherent-tamper and loader regressions prove fail-closed behaviour; the
checksum algorithm, canonical serialization, loader API, fixed root,
compatibility contracts and global schemas are unchanged.

Milestone 0.2D Phase 2 (D64/D65, 2026-08-07) freezes and creates the canonical
opponent suite v1. The complete human-selected design was frozen in Git
(`docs/OPPONENT-SUITE-V1-SELECTION.md`, commit `4750dd9…`) before any fixture
file existed; six canonical fixtures then appear under the fixed root
`data/opponents/` (`bulwark`, `skirmisher`, `crusher`, `spinner`, `controller`,
`generalist`, all `v1`) — exactly six regular files, no manifest/dotfiles/
symlinks/subdirectories. Each was generated through the reviewed foundation
only: `validateBuild(build, CATALOGUE_V1)` → complete `ValidatedBuild` →
frozen compatibility structures → `opponentFixtureChecksum` →
`parseOpponentFixture` verification → `serializeOpponentFixture` exact bytes.
No production generator, package script or `src/` change was made; the
production `src/opponents/` modules are byte-unchanged. `bulwark` reproduces
`BULWARK_BUILD_PROPOSAL`/`BULWARK_POLICY` and `createBulwarkBuild()` exactly
(data migration only; `bulwark-agent.ts` unchanged, source migration deferred
to Phase 3). `skirmisher` and `controller` declare legacy incompatible (grid
only); the other four are dual-compatible. Per-fixture `fixtureChecksum` and
persisted-file SHA-256 are frozen immutable v1 evidence anchors (D65, selection
doc, canonical fixture tests). All six load through production
`loadOpponentFixture(id, 1)` with exact identity/values, complete
validated-build agreement, exact checksum recomputation, canonical bytes equal
to the source files and deeply frozen results. No simulator and no opponent
match ran; zero benchmark/held-out/provider access.

Milestone 0.2D Phase 3 Commit M (D67, 2026-08-07) migrates normal legacy
application Bulwark combat configuration to the canonical `bulwark.v1`
fixture, under the D66 governed source-evolution sequence (Commit M →
independent review → Commit G; Commit G is NOT started). New modules:
`src/opponents/opponent-runtime-compatibility.ts` — explicit runtime gate
(`OpponentRuntime = "legacy" | "grid"`, `OpponentRuntimeCompatibilityError`,
pure fail-closed `assertOpponentFixtureSupportsRuntime(fixture, runtime)`
binding `"legacy"`/`"grid"` only to `LEGACY_RUNTIME_IDENTITY`/
`GRID_RUNTIME_IDENTITY` and requiring the corresponding `supported` entry,
plus `loadOpponentFixtureForRuntime(opponentId, fixtureVersion, runtime)` whose
production public inputs are ONLY those three, calling the reviewed fixed-root
loader and returning the same deeply frozen fixture) — and
`src/opponents/legacy-bulwark.ts` — `loadLegacyBulwark()` freezing
`bulwark`/`1`/`legacy` and enforcing the exact v1 fixture checksum
`053e61e8…`, failing closed otherwise with no fallback to historical
constants. `src/app/run-match.ts` now loads canonical legacy Bulwark exactly
once per CLI invocation before the provider branch (fixture failure fails
closed before any DeepSeek request) and uses `fixture.validatedBuild` /
`fixture.policy`; mirror mode reuses the same immutable objects safely.
`src/app/run-series.ts` loads canonical legacy Bulwark once per `runSeries`
after option validation and before any series-record creation/persistence or
agent/provider call, reusing the fixture across the series and for
factual-report enrichment. Historical `src/agents/scripted/bulwark-agent.ts`
is unchanged (regression/evidence anchors). Legacy `runMatch` remains the
simulator in both normal paths; no `runGridMatch`, no grid-beta invocation, no
runtime fallback, no arbitrary opponent selection. Migration evidence:
compatibility matrix (legacy supported bulwark/crusher/spinner/generalist;
legacy incompatible skirmisher/controller; grid supported all six); exact data
equivalence with the historical constants and `createBulwarkBuild()`;
behavioural equivalence under unchanged legacy `runMatch` on predeclared
test-only seeds 32001/32002/32003 (mirror + asymmetric roles, exact runtime/
config/initial-state/events/result/rounds equality); immutability through
simulation verified (canonical bytes, checksum and deep freeze unchanged).
**Intentional transition state:** Commit M differs from the active v1 reviewed
source for `run-match.ts`/`run-series.ts`, so the v1 legacy-isolation preflight
fails closed with `legacy_default_regression`; operational grid beta is NOT
authorised, the v1 snapshot/preflight are byte-unchanged, no marker is
created/cleared, successor v2 is not created and Commit G is not started. The
full repository suite is expected to contain the v1 protected-source mismatch
failures until Commit G activates v2; migration-focused tests and
check/lint/format pass.

Milestone 0.2D Phase 3 Commit G (D68, 2026-08-07) establishes the successor
source baseline v2 and restores a fully passing test state (Commit M passed
independent review). `src/beta/grid-beta-legacy-isolation-reviewed-source-v2.ts`
freezes `grid-beta-legacy-isolation-reviewed-source-v2` bound to exact Commit M
(`e6d981f…`), an ordered 23-path protected source set (all v1 protected paths
plus `package.json`, the historical Bulwark equivalence anchor and the
complete canonical opponent loading/compatibility chain
`bulwark-agent.ts`/`opponent-fixture.ts`/`opponent-fixture-loader.ts`/
`opponent-runtime-compatibility.ts`/`legacy-bulwark.ts`), per-path blob SHA and
LF-normalised content SHA-256, the Bulwark anchor
(`dbfed215…`/`d109c73a…`/`053e61e8…`), and a deterministic baseline checksum
`134e7ce2…`. The snapshot builds ONLY from Commit M Git objects (missing/
shallow commits, missing paths, wrong blob SHAs, changed content, reordered
files, Bulwark byte changes and coherent tampering all fail closed; the
working tree is never substituted). `src/beta/grid-beta-legacy-preflight-v2.ts`
(`schemaVersion "2"`) re-verifies: successor commit availability + byte anchor,
current-checkout protected files equal the successor snapshot, normal
run-match/run-series legacy routing + canonical Bulwark usage + no
grid/beta invocation, package legacy default, `0.2.0`/`0.2.0` global versions,
catalogue `1`, frozen C2 qualification, separate grid identity, frozen canary
sources, and schema-v2/v3 conversion+replay presence — any failure suspends
with `legacy_default_regression`. Selection V2 and Manifest V2 carry the dual
`sourceAuthority` (original v1 governance authority + successor v2 baseline);
the bundle validator accepts V1+V1 and V2+V2 and rejects mixed V1/V2 pairs.
The service validates both authorities before simulation and emits V2
artifacts. **Post-commit state:** original v1 governance authority, all 23
protected paths, the Bulwark JSON, `src/readiness/grid-opt-in-beta-source-
snapshot.ts` and `src/beta/grid-beta-legacy-preflight.ts` are byte-unchanged;
the six canonical opponent fixtures are unchanged; the full repository suite
passes. **Operational grid beta remains NOT AUTHORISED pending independent
review of Commit G; no real beta match executed and no real suspension marker
created/cleared.**

Milestone 0.2D Phase 4 (D70, 2026-08-07) implements the development-only
legacy opponent-suite runner v1 (LEGACY RUNTIME ONLY; ADR-004 does NOT
authorise a general grid cross-opponent matrix runner, and the bounded beta
service is not used as a matrix runner). `src/opponents/opponent-suite-v1.ts`
freezes the canonical suite identity (`canonical-opponent-suite-v1`, schema
`1`, suite version `1`, ruleset `0.2.0`, exact ordered six opponent IDs,
fixture version `1`, the six D65 fixture checksums and exact declared legacy
compatibility: supported bulwark/crusher/spinner/generalist, incompatible
skirmisher/controller) with deterministic suite checksum
`2a276edc8fe6958cb06b0f2a844dd261a878ccf092da238f8ddc2b381c1b8fae`.
`src/opponents/opponent-suite-runner.ts` provides the explicit runtime
contract (only `"legacy"`; `"grid"` rejected as separately unauthorised; no
ambient inference, no fallback), canonical suite loading + compatibility
preflight through the reviewed fixed-root `loadOpponentFixture` (anchor:
opponentId, fixtureVersion 1, exact fixtureChecksum, supported ruleset,
persisted validation, declared legacy compatibility consistent with the
fixture's legacy runtime status), the exact frozen 12-entry ordered
role-aware matchup plan (no self matches; every unordered pair twice with
reverse roles), unchanged legacy `runMatch` execution with normal MatchConfig
from `fixture.validatedBuild`/`fixture.policy` and frozen
`RULESET_VERSION`/`CATALOGUE_V1.version`/`DEFAULT_COMPONENT_QUALIFICATION_ID`,
a primary/repeat determinism guard (fresh config graphs; exact equality of
runtime/config/initial-state/events/result/rounds + identical result
checksums; any difference fails the whole run; 12 factual entries and 24
internal executions per seed), deterministic match IDs
(`opponent-suite-match-v1:<64hex>` over suiteId/suiteVersion/runtime/seed/
planIndex/fighter identities+checksums), a generic
`sha256Hex(JSON.stringify(result))` result checksum (not the grid-beta
checksum), canonical fixture immutability verified before/after (serialized
bytes, checksum, build/armour, validatedBuild(+proposal), policy, runtime
compatibility; mutation fails closed), and a deeply frozen factual
`OpponentSuiteRunV1` (schemaVersion/suiteId/suiteVersion/suiteChecksum/
runtime/seed/fixtureInventory/runnableOpponentIds/incompatibleOpponentIds/
12 match entries with winner mapped to canonical opponent ID or null). No
aggregate interpretation fields exist; the two incompatible fixtures are
visible factual members, never executed. `src/app/run-opponent-suite.ts` is a
development-only CLI (no package script; direct `npx tsx ... --runtime legacy
--seed <N>`), printing deterministic JSON only. No persistence, no
AI/provider/adaptation, no benchmark/held-out/readiness/beta access. Phase 5
factual report is not started. None of the 23 successor-V2 protected paths,
the v1/v2 snapshot/preflight modules, the six canonical fixtures,
`docs/OPPONENT-SUITE-V1-SELECTION.md` or `package.json` were changed; no
successor baseline v3.

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
