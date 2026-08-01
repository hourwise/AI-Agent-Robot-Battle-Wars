# Forge Arena

A deterministic text-based robot combat arena where an AI agent designs, builds and fights a combat robot under equal constraints.

**Status:** Prototype 0.1 — validated. See [`docs/PROTOTYPE-0.1-VALIDATION.md`](docs/PROTOTYPE-0.1-VALIDATION.md).

**Next:** Prototype 0.2 — planned. See [`docs/PROTOTYPE-0.2-EXPERIMENTAL-PLAN.md`](docs/PROTOTYPE-0.2-EXPERIMENTAL-PLAN.md).

## What works now

- Component catalogue (v1) and build validation
- Deterministic combat simulator with seeded RNG
- ASCII replay rendering with robot portraits and arena snapshots
- Text replay and match statistics
- DeepSeek design adapter with schema validation and bounded correction
- AI tactical policy selection
- Bulwark scripted opponent
- Post-match factual reports and AI review
- Best-of-five series with rebuild loop and comparative reports
- Provider-neutral agent interface
- Usage and cost tracking
- Atomic JSON persistence for matches and series
- 3×3 arena foundation (Milestone 0.2C Phases 1–3D2A.1) — pure
  `src/simulator/arena-grid.ts` geometry, grid match schema v3, version-aware
  replay dispatch, a 3×3 ASCII renderer, and an **opt-in** deterministic grid
  combat runtime (`runGridMatch`, identity `0.3.0` / `grid-3x3-v1`, persists
  schema v3). Phase 3B hardened that runtime: identities are frozen at
  runtime, zone/identity profiles are type-paired, the grid version contract
  (`0.3.0` / `grid-3x3-v1` / `ruleset 0.2.0` / `catalogue 1`) is enforced, the
  record converter validates before returning, and positional effects are
  planned simultaneously from the shared post-movement snapshot. Phase 3B.1
  corrected grid movement momentum: ram charge momentum is granted only to a
  translated `advance`, never to retreat, circle or hold. Phase 3C added
  deterministic translated lateral movement: `circle_left`/`circle_right` move
  one orthogonal cell (facing toward the opponent) and the existing
  `opening: "flank"` policy drives grid flanking via a pure selector. Phase
  3D1 added version-aware reporting and series compatibility: factual-report
  v1 stays the frozen legacy contract, a grid factual-report v2 represents
  opt-in grid matches (builders dispatch on the explicit runtime identity),
  the canonical movement-event subject rule is shared by reporting and replay,
  a pure shared final-state projection never invents facts, AI review/rebuild
  accept either report version, and a reserved single-runtime series v2 exists
  alongside the unchanged v1 (which `runSeries` still produces). Phase 3D1.1
  hardened the reporting boundary: movement-event actions are explicitly
  enumerated and unknown/malformed movement moves nothing, final-state
  projection retains no event-owned references and validates facing and
  conditions, both report builders validate against their schemas before
  and series-v2 entries require one shared persisted match UUID with agreement
  on rounds, winner and method. Phase 3D2A added an isolated deterministic
  grid match canary: a separate, local-only, single-match command
  (`match:grid:canary`) that proves the full grid pipeline operationally
  (built-in no-combat flank scenario → direct `runGridMatch` → match-record v3
  → factual-report v2 bound to the persisted match UUID → replay →
  deterministic fallback review → validated atomic artifact bundle under
  `data/canary/grid-match/`). It requires an explicit seed, consumes only a
  direct `runGridMatch` result, is not a benchmark and changes no default
  command. Phase 3D2A.1 hardened the canary: exposure is reported through
  canonical flank bearings only (the frozen scenario observes `right`, not
  rear — strict rear exposure is reported truthfully as `no`), manifest v2 is
  the only current passing manifest and carries SHA-256 digests for every
  artifact, every artifact is reread and cross-validated, and protected normal
  storage roots are rejected. The live
  five-zone simulator is unchanged: the normal application still uses
  `runMatch` (legacy `0.2.0`) and emits schema v2, and `runGridMatch` is not
  wired into CLI, series or application commands.

## Architecture

- **Authoritative deterministic engine** — the simulator decides all outcomes; no LLM-generated prose may alter results.
- **Provider-neutral agents** — DeepSeek is implemented through an `ArenaAgent` interface; core modules never import a provider directly.
- **Replay-first event architecture** — every meaningful state transition produces a typed event; the event log drives text replay, statistics and future visual clients.
- **No secrets in source control** — API keys are read from environment variables only.

See `docs/ARCHITECTURE.md` for details.

## Setup

### Prerequisites

- Node.js 22 or later
- npm
- A DeepSeek API key (for AI matches only)

### Install

```bash
npm install
```

### Environment

Copy `.env.example` to `.env` and fill in your API key. Only required for AI matches; scripted matches work without it.

```bash
cp .env.example .env
```

## Commands

### Development and testing

```bash
npm run check          # Type-check the project
npm test               # Run tests
npm run lint           # Lint with ESLint
npm run format:check   # Check formatting with Prettier
npm run format         # Auto-format with Prettier
```

### Matches

```bash
npm run match                          # Bulwark vs Bulwark (no API key needed)
npm run match -- --ai                  # AI vs Bulwark (requires API key)
npm run match -- --ai --review         # AI vs Bulwark with post-match review
npm run match -- --ai --seed 12345     # Fixed seed for reproducibility
```

### Series

```bash
npm run series                              # AI best-of-five series (requires API key)
npm run series -- --target-wins 3           # First to 3 wins
npm run series -- --maximum-matches 5       # Cap at 5 matches
```

### Grid match canary

```bash
npm run match:grid:canary -- --seed 12345   # Isolated deterministic grid canary
```

The grid match canary is a separate, local-only, deterministic single-match
check. It requires `--seed <non-negative integer>` (no random default), runs
only the built-in no-combat flank scenario through `runGridMatch`, and
publishes a validated atomic artifact bundle under `data/canary/grid-match/`.
It consumes only a direct `runGridMatch` result, never accepts imported
records, is not a benchmark, uses no AI provider and never modifies the normal
`match` or `series` commands or their storage. It reports truthful flank
evidence (for the frozen scenario: `Observed flank bearings: right`, `Strict
rear exposure observed: no`) and rejects output roots that resolve inside
`data/matches` or `data/series`.

### Replay

```bash
npm run replay -- --match <match-id>    # Replay a saved match from JSON
```

### Smoke test

```bash
npm run smoke:design    # Live test of DeepSeek design generation
```

### Benchmarks

```bash
npm run benchmark                                  # Existing Bulwark mirror benchmark
npm run benchmark:lifecycle -- --partition development
npm run benchmark:lifecycle -- --partition development --fixture glass-cannon-mirror
npm run benchmark:lifecycle -- --partition development --qualification component-impact-c1
npm run benchmark:lifecycle -- --partition development --qualification component-impact-c2
npm run benchmark:lifecycle -- --partition development --qualification component-impact-ab2
npm run benchmark:lifecycle -- --list-qualifications
npm run benchmark:lifecycle -- --partition development --json
```

The component-lifecycle suite uses a fixed, qualification-independent manifest
in `data/bench-fixtures/component-lifecycle-v1/`. Registered qualification IDs
are immutable; `component-impact-c2` is the default when the option is omitted.
Only the development partition is executable; the held-out partition is
permanently sealed after the one-time AB2 confirmation, and `all` remains
prohibited. AB2 is **development-passed** and **held-out-rejected**: its
one-time confirmation failed the representative-light strict terminal-incidence
gate at exactly 85% (requirement is strictly `<0.85`). AB2 is frozen and
retained for historical reproducibility only and is permanently ineligible for
default promotion. C2 remains the unchanged experimental runtime default and is
not an accepted final balance solution. Milestone 0.2B's lifecycle mechanism is
implemented, but its qualification/balance acceptance remains unresolved and
deferred; 0.2B is not marked complete.

## Output

- **Matches** are saved to `data/matches/<match-id>.json`
- **Series** are saved to `data/series/<series-id>.json`
- All saved data is gitignored

## Documentation

| Document                                                                             | Purpose                                               |
| ------------------------------------------------------------------------------------ | ----------------------------------------------------- |
| [`docs/PROTOTYPE-0.1-VALIDATION.md`](docs/PROTOTYPE-0.1-VALIDATION.md)               | 0.1 validation results, canonical series, limitations |
| [`docs/PROTOTYPE-0.2-EXPERIMENTAL-PLAN.md`](docs/PROTOTYPE-0.2-EXPERIMENTAL-PLAN.md) | 0.2 research questions, milestones, ADRs              |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)                                       | System architecture and design decisions              |
| [`docs/RULESET.md`](docs/RULESET.md)                                                 | Game rules and combat mechanics                       |
| [`docs/RELEASE-CHECKLIST.md`](docs/RELEASE-CHECKLIST.md)                             | Pre-release verification checklist                    |
| [`docs/DECISIONS.md`](docs/DECISIONS.md)                                             | Architecture Decision Records                         |

## Data directories

```
data/
  bench-fixtures/ # Versioned benchmark-only fixtures
  matches/    # Individual match JSON files
  series/     # Series JSON files
```

## Documentation

| File                   | Description                                      |
| ---------------------- | ------------------------------------------------ |
| `BUILDPLAN.md`         | Full scope and milestone definitions             |
| `docs/RULESET.md`      | All rules, catalogue values and combat mechanics |
| `docs/ARCHITECTURE.md` | Module boundaries, dependency rules, data flow   |
| `docs/SECURITY.md`     | Security baseline                                |
| `docs/EVENT_FORMAT.md` | Event envelope, types and versioning             |
| `docs/DECISIONS.md`    | Decision log (D1-D21)                            |

## License

UNLICENSED — private prototype.
