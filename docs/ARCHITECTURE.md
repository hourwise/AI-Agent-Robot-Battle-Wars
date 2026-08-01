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

### Agent usage tracking

Every agent result (design, policy, review) produces an `AgentUsageRecord` capturing token usage, cost, latency and fallback status. The `AgentPhase` enum (`design` | `policy` | `review` | `design_correction`) tracks which stage each record belongs to.

### Cost calculation

`agents/cost-calculator.ts` provides `estimateCost()` and `getPricingTier()` for token usage estimation. Used for display purposes; actual billing comes from the provider.

### Fallback policy

`agents/fallback-policy.ts` provides a legal default `ActionPolicy` used when the AI fails to produce a valid policy. The policy version is tracked for reproducibility.

### Reports

- `reports/factual-match-report.ts` — builds a deterministic `FactualMatchReport` from `MatchResult` without AI involvement (D18)
- `reports/review-formatter.ts` — converts factual report data into prompt-safe text
- `reports/design-diff.ts` — structured comparison of two build proposals
- `reports/series-report.ts` — comparative report model across a series

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
