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
- 3×3 arena foundation (Milestone 0.2C Phases 1–3E1) — pure
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
  storage roots are rejected. Phase 3D2A.2 hardened publication: the service
  root inside repository data must equal the canonical root exactly, final and
  temporary collisions (including empty directories and symlinks) are detected
  via `lstat`, temporary directories are created exclusively, cleanup applies
  only to invocation-owned paths, and bundles must contain exactly seven
  regular files. Phase 3D2B added an isolated deterministic grid
  **adaptive-series** canary: a separate, local-only, three-match command
  (`series:grid:canary`) that proves the complete grid series pipeline
  operationally — frozen combat-observable scenario → direct `runGridMatch`
  × 3 → match-record v3 × 3 → factual-report v2 × 3 → replay × 3 →
  deterministic fallback review × 3 → two frozen policy adaptations →
  series-record v2 → JSON envelopes + adaptation trace + series report →
  validated atomic artifact bundle under `data/canary/grid-series/`. It
  shares the extracted immutable publication and physical-root guards with
  the match canary, requires an explicit base seed, uses no AI provider, is
  not a benchmark and changes no default command. Phase 3D2B.1 hardened the
  series canary's provenance and immutability (runtime-frozen seed plan,
  safe-integer seed contracts, complete report/review agreement before
  adaptation, full entry-to-record/envelope binding, recomputed manifest
  evidence and rendered-score validation). Phase 3E1 added a bounded
  development-only **grid activation-readiness evaluation** (`readiness:grid`):
  exactly 312 deterministic grid matches (24 development-only seeds × 13
  scenario role assignments) run twice under fixed identities, frozen
  hard/coverage/slot-order/progress gates are evaluated, and an immutable
  nine-file bundle is published under `data/readiness/grid/`. It is
  non-benchmark, non-holding-out and non-activating, and classifies the
  implementation as `ready_for_opt_in_beta_review`, `inconclusive` or
  `not_ready` without authorising any activation. Phase 3E1.1 hardened the
  evaluation's evidence provenance: selected movement/combat actions are now
  counted from `policy_triggered` events (so stationary `hold` coverage is
  correctly evidenced without a `movement_resolved`), the scenario registry is
  deeply frozen with distinct per-scenario definitions, and the published
  bundle is revalidated end-to-end by recomputing per-run evidence, metrics,
  gates, the decision and the report from the persisted records and reports.
  Phase 3E1.2 finalised the provenance chain: the current v3 suite is bound to
  the exact canonical seed and scenario registries, the complete event
  chronology is enforced, execution metrics are record-derived with explicit
  operational attestations, complete report/final-state agreement drives H05,
  timing validation is corrected, and Prettier uses an explicit CRLF contract
  (the historical v1 and v2 bundles remain preserved for archival inspection).
  Phase 3E1.3 hardened the verifier only (no new official run): report/
  final-state disagreement is now fatal to current readiness evidence — a
  bundle whose factual report disagrees with its authoritative record is
  rejected before any classification is returned, even when every downstream
  artifact (metrics, gates, decision, report, manifest) has been coherently
  rewritten to `not_ready`; round 0 permits only `competition_started`; and
  the official v3 evaluation (`0d8487a8-...`, suite checksum
  `c3b8a16d...`) remains unchanged and still validates.
  Phase 3E2 added an **isolated, additive supplemental grapple-coverage
  check** (`readiness:grid:grapple`): because the official v3 suite observed
  no grapple reposition (coverage gate C04 inconclusive), a separate
  deterministic 48-match supplement (24 canonical readiness seeds × 2 role
  assignments of a feature-exercising Grapple Coverage Attacker versus a
  Stationary Coverage Target) collects ONLY the missing grapple-reposition
  feature evidence through the frozen runtime's actual event contract,
  anchors and validates the official v3 bundle before any match, and
  publishes an immutable ten-file supplement bundle under
  `data/readiness/grid-supplements/`. The official supplement confirmed
  grapple repositioning in both fighter slots (`coverage_confirmed`), giving
  a combined readiness classification of `ready_for_opt_in_beta_review`,
  which still is not an activation decision.
  Phase 3F added the **bounded opt-in beta governance decision**
  (`readiness:grid:governance`): a non-activating, no-simulation governance
  review that validates and anchors the official v3 evaluation and the
  official supplement, runs a read-only static isolation preflight, applies
  the frozen `grid-opt-in-beta-contract-v1` policy contract and a pure
  criteria function, and publishes an immutable seven-file governance bundle
  under `data/readiness/grid-governance/`. The official decision was
  `approved_for_bounded_opt_in_beta_implementation` — authorising at most
  implementation of a bounded, explicitly selected grid beta in a later,
  separately reviewed phase; no runtime was enabled.
  The live
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
rear exposure observed: no`), rejects output roots that resolve inside
`data/matches` or `data/series`, requires the in-repo output root to be exactly
`data/canary/grid-match`, and never reuses or cleans a pre-existing final or
temporary path.

### Grid adaptive-series canary

```bash
npm run series:grid:canary -- --seed 12345   # Isolated deterministic grid series canary
```

The grid adaptive-series canary is a separate, local-only, deterministic
three-match check. It requires `--seed <non-negative safe base>` (no random
default), runs the frozen combat-observable scenario through direct
`runGridMatch` three times with the sequential seeds `[base, base+1, base+2]`,
applies two frozen deterministic policy adaptations, and publishes a validated
atomic eight-file artifact bundle under `data/canary/grid-series/` (series
record, match/report/review/artifact envelopes, adaptation trace, series
report and manifest). It uses no AI provider, is not a benchmark, and never
modifies the normal `match` or `series` commands or their storage. It rejects
unsafe or overflowing seeds, target-wins/maximum-matches overrides, runtime
selectors and provider/API-key arguments, requires the in-repo output root to
be exactly `data/canary/grid-series`, and never reuses or cleans a pre-existing
final or temporary path.

The series canary bundle is hardened for provenance and immutability: the seed
plan is runtime-frozen, persisted manifest and adaptation-trace schemas require
safe-integer seeds, adaptation requires complete factual-report/fallback-review
agreement (including canonical disabled-component lists) before deciding,
series entries are bound to their actual match records, reports, reviews,
builds and policies, manifest evidence is recomputed from persisted artifacts,
rendered per-match results and the raw series score are cross-validated, and
the shared publisher validates its declaration before writing anything —
keeping the published bundles byte-identical.

### Grid activation-readiness evaluation

```bash
npm run readiness:grid   # Bounded development-only activation-readiness evaluation (no arguments)
```

The grid activation-readiness evaluation is a bounded, deterministic,
development-only check that asks whether the grid runtime is technically
suitable for a separately authorised opt-in beta decision. It executes exactly
312 grid matches (24 development-only seeds × 13 scenario role assignments:
one Bulwark mirror plus six role-swapped pairs against the canonical Bulwark),
re-executes them deterministically under fixed identities, evaluates frozen
hard/coverage/slot-order/progress gates and publishes an immutable nine-file
artifact bundle under `data/readiness/grid/<evaluationId>/` (`manifest.json`,
`seed-registry.json`, `scenario-registry.json`, `run-index.json`,
`match-records.json`, `factual-reports.json`, `metrics.json`, `decision.json`,
`report.txt`). The `readiness:grid` command accepts **no arguments** and exits
zero for any completed evaluation; it exits nonzero only on an operational
failure that prevents producing a validated decision bundle.

This evaluation is **development-only and non-activating**: it does not
activate the grid runtime, does not qualify combat balance and does not
authorise default migration. It is not a benchmark, uses no AI provider, never
opens any existing benchmark seed file, never touches held-out or `all`
partitions, and never writes to `data/matches`, `data/series` or either canary
root. Even a `ready_for_opt_in_beta_review` classification is not permission to
activate grid; an opt-in beta decision and any default activation remain later,
separately authorised decisions.

Since Phase 3E1.2 the evaluation uses **v3 evidence artifacts**
(`schemaVersion` 3, suite `grid-activation-readiness-v3`, action-evidence
model `policy-triggered-round-actions-v1`, provenance model
`canonical-registry-record-derived-decision-v1`). Selected movement and combat
actions are derived from `policy_triggered` events (exactly one per fighter per
completed round; the selected-action total always equals `2 × completed
rounds`), so a stationary `hold` is counted as selected movement coverage
without any `movement_resolved`; translated `hold` is always zero. Ordinary
`movement_resolved` events must exactly agree with the actor's selected policy
movement; knockback and grapple repositions are target-subject events and are
never selected actions. The bundle validator requires the **exact canonical
seed and scenario registries** (checksums `54acf015…` and `b0727017…`),
enforces the **complete event chronology** (`competition_started` first, one
`round_started` + two `policy_triggered` + one `round_ended` per completed
round, `competition_ended` last, monotonic rounds, strictly increasing unique
sequence numbers within each of the frozen runtime's two counters), derives
the execution metrics from the records plus the explicit operational
attestations (deterministic re-execution, input immutability), enforces
complete report/final-state agreement for H05, and regenerates the report
byte-for-byte; any disagreement fails the bundle. The scenario registry is
deeply frozen (every nested build proposal, armour object and policy) with
distinct definitions per scenario and no shared references. Since Phase 3E1.3
a record/report **final-state disagreement is fatal**: the validator rejects
the bundle before any classification is returned, even when the persisted
metrics, gates, decision, `report.txt` and manifest have all been coherently
rewritten to `not_ready` — the bundle fails specifically because the factual
report disagrees with its authoritative record. Round 0 now permits only the
`competition_started` event (every nonterminal event must carry a round in
`1..record.rounds`, the start-event seed must agree with the record seed, and
the terminal loser must agree with the record result). The historical
Phase 3E1 v1 bundle (`data/readiness/grid/864991f7-d060-4669-beec-11e0d42b7e68/`,
suite checksum `dd38ac8a…`) and Phase 3E1.1 v2 bundle
(`data/readiness/grid/d788284d-a795-4125-984c-9146261e271a/`, suite checksum
`df944410…`) remain preserved and parse as historical but are rejected as
current readiness evidence.

#### Grid grapple coverage supplement

```bash
npm run readiness:grid:grapple   # Isolated additive grapple-reposition coverage supplement (no arguments)
```

Phase 3E2 is an isolated, additive supplement that collects **only** the
missing grapple-reposition feature evidence. The official v3 evaluation is
valid and authoritative (`0d8487a8-...`, suite checksum `c3b8a16d...`, suite
`grid-activation-readiness-v3`, classification `inconclusive`, C04 only — no
grapple reposition observed, with base reposition observations knockback 36 /
overturn 8 / grapple 0). The supplement answers whether the frozen grid
runtime can produce valid, deterministic grapple-reposition events through
the full `runGridMatch → record → report → replay` pipeline in **both fighter
slots**, without altering, replacing, reinterpreting or rerunning the official
v3 suite.

The service first anchors the official v3 bundle at
`data/readiness/grid/0d8487a8-.../` (strong validator, exact evaluation ID,
suite checksum, canonical registry checksums, `inconclusive` classification,
C04 as the only non-pass gate, and base reposition counts 36/8/0); it fails
without running any match if the base is absent or invalid. It reuses the
canonical 24-seed readiness registry unchanged and a new
feature-exercising scenario registry (`grid-grapple-coverage-scenarios-v1`,
checksum `1aba546d...`) with exactly one scenario (Grapple Coverage Attacker
`x` versus Stationary Coverage Target `y`) and two role assignments, run as
`24 seeds × 2 assignments = 48` deterministic matches with a frozen plan
(checksum `e30dda08...`). A valid grapple-reposition observation requires an
authoritative `attack_hit` by the Grappler, a corresponding
`movement_resolved` event with `action: "grapple"`, canonical actor/target
semantics, `from !== to`, and a destination that exactly agrees with the
canonical `resolveGridGrapple` resolver; attempts, misses, knockback,
malformed events, resolver disagreements and same-cell hits are never counted.
The supplement runs twice under fixed identities (byte-identical repeat),
derives execution/grapple/isolation metrics, produces the
`GridGrappleCoverageDecisionV1` (`coverage_confirmed`, `inconclusive` or
`not_ready`) and the combined readiness addendum, and publishes an immutable
ten-file bundle under `data/readiness/grid-supplements/<supplementId>/`
(`manifest.json`, `base-readiness-reference.json`, `seed-registry.json`,
`scenario-registry.json`, `run-index.json`, `match-records.json`,
`factual-reports.json`, `metrics.json`, `decision.json`, `report.txt`). The
root guard rejects `data/readiness/grid`, normal match/series storage, both
canary roots, every other in-repository data root, descendants, symlink or
junction ancestry and external symlink roots.

Official Phase 3E2 supplement result: **`coverage_confirmed`** (480 Grappler
attempts, 204 hits, 276 misses; 8 valid grapple-reposition events — 4 with the
attacker in fighter A and 4 in fighter B, each from 4 distinct seeds; 186
same-cell Grappler hits without reposition), combined readiness classification
**`ready_for_opt_in_beta_review`**, artifact directory
`data/readiness/grid-supplements/4eca43e2-cc3d-41ee-bfad-73e18238ff61/`. This
is additive development-only coverage evidence: it does not modify the
official v3 evaluation, does not qualify combat balance, does not perform the
opt-in beta decision and does not activate the grid runtime.

Phase 3E2.1 hardened the supplement's provenance (verifier-only, no rerun):
a resolver-valid grapple must now be causally backed by an unmatched
non-same-cell Grappler hit in the same round (a second grapple for one hit, a
grapple without a hit, a false origin, a noncanonical destination or an
outcome without an attempt is malformed and never counts as coverage);
persisted run-index entries and records are bound to the canonical 48-run plan
and the canonical supplemental scenario (attacker slot derived from the plan,
never from the persisted entry); the decision and the combined readiness
addendum are independently rebuilt and must equal the persisted payloads; and
the official v3 base hashes (manifest/decision/metrics) are pinned to frozen
values and re-checked byte-for-byte immediately before publication. The
official supplement still passes the strengthened validator unchanged
(480/204/276, 8 valid repositions, 186 same-cell, 0 malformed).

#### Grid opt-in beta governance

```bash
npm run readiness:grid:governance   # Bounded opt-in beta governance decision (no arguments)
```

Phase 3F performs the separately governed opt-in beta review of the grid
runtime. It reads the official v3 readiness evaluation
(`data/readiness/grid/0d8487a8-.../`) and the official supplemental grapple
evidence (`data/readiness/grid-supplements/4eca43e2-.../`), validates and
anchors both with the production validators and anchors (never modifying
them), snapshots all nineteen files, runs a read-only static isolation
preflight, derives the governance outcome by a pure criteria function over the
frozen evidence facts, and publishes an immutable seven-file governance bundle
under `data/readiness/grid-governance/<decisionId>/` (`manifest.json`,
`source-state.json`, `base-evidence-reference.json`,
`supplement-evidence-reference.json`, `beta-contract.json`, `decision.json`,
`report.txt`). The root guard rejects the official readiness and supplement
roots, normal match/series storage, both canary roots, other in-repository
data roots, descendants, symlink or junction ancestry and external symlink
roots.

The bounded-beta policy contract `grid-opt-in-beta-contract-v1` (checksum
`5f345ce4...`) binds any later implementation: explicit beta-labelled
selection only (absence → legacy; invalid selection fails closed), legacy
default isolation with no silent grid/legacy fallback, internal/development
single-match scope with schema-v3 persistence and the complete frozen grid
identity, user/operator clarity, one immediate deterministic kill switch,
migration-free rollback and frozen suspension triggers. Possible outcomes are
`approved_for_bounded_opt_in_beta_implementation`, `deferred` and `rejected`;
approval authorises at most implementation of a bounded and explicitly
selected grid beta in a later, separately reviewed phase — it is not runtime
activation.

Official Phase 3F governance decision:
**`approved_for_bounded_opt_in_beta_implementation`** (decision ID
`58e8cd87-504e-4b5f-9bac-f6b81d82377b`, bundle under
`data/readiness/grid-governance/58e8cd87-504e-4b5f-9bac-f6b81d82377b/`) —
every criterion
passed (official v3 and supplement validated and anchored exactly; all hard
readiness gates passed; C04 the sole base non-pass gate; supplement
`coverage_confirmed`; combined `ready_for_opt_in_beta_review`; both attacker
slots and distinct seeds produced causal grapple reposition; legacy remains
the active default; complete contract and safeguards; no default/public
activation; no forbidden claims; frozen constraints unchanged). No runtime was
enabled, legacy remains default, no beta implementation started, no public
rollout and no balance claim are authorised, and Milestone 0.2C remains
incomplete pending a separately reviewed bounded opt-in implementation.

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
