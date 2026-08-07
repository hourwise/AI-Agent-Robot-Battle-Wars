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

Phase 3F.1 bound the official governance decision to the exact reviewed
source snapshot (`grid-opt-in-beta-reviewed-source-v1`, commit
`5173fd0f...`, checksum `1f984801...`). A commit string alone was
insufficient: `source-state.json` only recorded the authorised commit string
and static-preflight booleans, so the validator reconstructed approval from
persisted claims. The provenance tooling now reads the exact reviewed file
bytes from the Git commit object (`git cat-file`/`git rev-parse`, argument
array only, never the working tree), freezes 26 reviewed file identities
(blob SHA + content SHA-256), recomputes the source facts
(`GridOptInBetaReviewedSourceFactsV1`) from those bytes — including the
canary source-isolation booleans, which are derived from the frozen canary
file hashes instead of being hard-coded to `true` — and requires
`assertCanonicalGridOptInBetaGovernanceSourceState` to hold. The strengthened
anchor `anchorOfficialGridOptInBetaGovernanceDecision` accepts the official
approval only when the unchanged seven-file bundle (frozen hashes
`0f143dde...`/`5721585d...`/`972d99b9...`/`0cc07da6...`/
`5f345ce4...`/`da377b33...`/`63259937...`) and the exact reviewed Git source
snapshot both validate. The official Phase 3F decision was not rerun and its
bytes remain unchanged; the decision still passes the strengthened anchor
with outcome `approved_for_bounded_opt_in_beta_implementation`.

Phase 3G implemented the one explicitly selected, internal/development,
local-scripted, single-match grid-beta surface authorised by that decision.

```bash
npm run match:grid:beta -- \
  --seed 12345 --fighter-a alpha --fighter-b beta --acknowledge-grid-beta
npm run replay:grid:beta -- --match <uuid> [--ascii]
```

The explicit command and acknowledgement are the only way to select grid; all
match arguments are required except `--help`; there is no `--runtime`/output/
provider argument; missing acknowledgement fails before fighter loading, ID
generation, simulation or writes; invalid selection fails closed. Fighters
are `GridBetaFighterSpecV1` documents loaded by identifier from the fixed
root `data/beta/grid-fighters/<fighterId>.json` (strict schema, catalogue-v1
build validation, authoritative policy schema, deterministic SHA-256,
traversal/symlink/size protections; input errors never suspend). Each beta
match anchors the official governance bundle (exact seven files, all seven
frozen hashes, exact reviewed Git source snapshot, re-checked before
simulation and before publication), runs a read-only protected legacy-source
preflight against the current checkout, executes the same grid match twice
via the pure `executeGridBetaMatch` core (only `runGridMatch`; deterministic
equality required) and publishes an immutable ten-file bundle under
`data/beta/grid-matches/<matchId>/` (manifest last). The one deterministic
suspension marker `data/beta/GRID_BETA_SUSPENDED` stops only new grid-beta
matches on any confirmed safety trigger; legacy matches and existing beta
replays stay readable. No official beta match was executed during Phase 3G
implementation (tests use external temporary roots); the beta was later
completed, independently reviewed and authorised for bounded internal
operation (D58); no default/public/ranked/tournament activation occurred and
Milestone 0.2C is COMPLETE with legacy remaining the default.

Phase 3G.1 hardened the bounded grid-beta safety and artifact provenance
without running a beta match or altering any official artifact. The
pre-simulation checkpoint window is closed (load fighters → collision-free
identity → canonical protected-source preflight → governance bytes unchanged →
suspension marker absent → synchronous `runGridMatch` with no await between
the final marker check and the execution core). The shared immutable
publisher gained an optional `beforeAtomicPublish` hook that the beta uses to
re-run the complete protected-source preflight, governance byte-unchanged
check, suspension-marker check and physical output-root recheck immediately
before the atomic rename; a typed safety error retains the original trigger.
Suspension-marker creation is genuinely exclusive (`writeFileExclusive` on
`CanaryFileSystem`, `wx` semantics) with secure marker-parent creation and
full filesystem-root ancestry inspection; it never replaces an existing
marker. All beta-owned machine schemas are strict (unknown `provider`/`model`/
`runtime`/`outputRoot`/`ranked`/`tournament`/`balanceQualified` fields
reject), fighter artifacts are parsed through the same authoritative
`parseGridBetaFighterSpec` path used by live loading with canonical byte
serialization, the complete validated build and policies are bound across the
record config and initial states, the complete canonical C2 metadata is bound
across the selection, record and record config, the persisted preflight must
be the exact canonical pass, the execution attestation primary checksum is
bound to the persisted record reconstruction, deterministic repeat inputs are
independent fresh graphs with mutation detection, governance inventory
reading is exact (dotfiles included, sorted, regular files only), fighter
input ancestry is inspected from the filesystem root via `lstat`, and the
physical replay bundle is inventory-validated before any content is read.
No real beta match or suspension marker was created during Phase 3G.1; the
hardening remains in force and unchanged through the authorised GRID-BETA-001
smoke run.

Phase 3G.1.1 closed the final beta trust-boundary gaps without running a beta
match or creating a marker. The production beta service is now unbypassable:
the public match request contains only `seed`, `fighterA`, `fighterB` and
`acknowledgement` (no root overrides), the production dependency contract has
no alternate execution seam, and every production invocation enters the fixed
`executeGridBetaMatch` core (which hard-codes `runGridMatch`) using exactly
`data/beta/grid-fighters`, `data/beta/grid-matches`,
`data/readiness/grid-governance/58e8cd87-504e-4b5f-9bac-f6b81d82377b` and
`data/beta/GRID_BETA_SUSPENDED`. Suspension-marker parent creation no longer
performs recursive `mkdir` before inspecting existing ancestors: the ancestry
is walked from the filesystem root with `lstat`, every existing component must
be a real directory, and missing directories are created incrementally beneath
the last verified real directory so no symbolic-link ancestor is ever
followed. Replay validates physical regular-file identity before and after
every read (plus a final exact inventory check before semantic validation),
closing the regular-file-to-symlink substitution window. The suspension-marker
schema is now strict.

Phase 3G.1.2 removed the final exported alternate-root production service. The
production module `src/app/grid-beta-match.ts` now exposes only
`runGridBetaMatch(request, dependencies?)` with a request containing only
`seed`, `fighterA`, `fighterB` and `acknowledgement`; the exported
`runGridBetaMatchWithEnvironment` runner and `GridBetaMatchEnvironment` type
are gone, and no production source exports any function that accepts alternate
`outputRoot`/`fighterRoot`/`governanceBundleDir`/`suspensionMarkerPath`. The
source-level test harness was deleted; all temporary path remapping now lives
entirely in test code — a test-only `CanaryFileSystem` wrapper in
`tests/helpers/` transparently redirects the canonical beta logical paths onto
an external temporary directory (fighter root, match output, governance
bundle and suspension marker), while ordinary repository/source-file reads
used by the protected-source preflight still access the genuine checkout. The
general dependency contract keeps the injectable filesystem, source-commit
reader, UUID, clock and a non-result-producing `onExecutionStart` observer
(which only counts entry into the fixed `executeGridBetaMatch` call and cannot
cancel, replace or mutate execution). No real beta match or marker was
created during implementation; the production API was independently reviewed
at commit `8b96161bb22f927179cfd350d390fdca23b062fd`.

## Milestone 0.2C closure and GRID-BETA-001

Independent review passed Phase 3G.1.2 at
`8b96161bb22f927179cfd350d390fdca23b062fd` and **Milestone 0.2C is COMPLETE**.
The first tightly controlled internal grid-beta match, **GRID-BETA-001**, was
authorised and executed exactly once as an operational smoke test of the
completed 0.2C beta surface: seed `20260807`, `beta-smoke-01` vs
`beta-smoke-01` (a deliberate mirror match, not comparative balance
evidence), match ID `19c41607-21d0-48e1-a419-23d4721e4be4`, winner
`fighter_b` by judges in 20 rounds. The immutable ten-file bundle under
`data/beta/grid-matches/19c41607-21d0-48e1-a419-23d4721e4be4/` passed the
complete production bundle validator, and both the text replay and the ASCII
replay validated the full physical bundle before display. The suspension
marker remained absent after completion and all seven official governance
hashes stayed unchanged. Run 001 is an operational smoke test only: it is not
balance evidence, not readiness evidence, not adaptation evidence, not
held-out evaluation, does not authorise grid as the default, does not
authorise public/ranked/tournament/monetised play, and does not begin
Milestone 0.2D.

## Bounded beta observation window A

A small bounded operational observation window (D59, 2026-08-07) ran four
further controlled mirror matches (`beta-smoke-01` vs `beta-smoke-01`, frozen
fighter checksum `e168c618…`) before any decision about Milestone 0.2D. It is
not balance evaluation, readiness evaluation, tuning, adaptation,
opponent-suite construction or held-out testing. All four commands completed
successfully with zero suspension triggers, all deterministic primary/repeat
pairs agreed, all four bundles passed the complete production bundle
validator, and all eight text/ASCII replays validated the full physical
bundles:

| Run           | Seed     | Match UUID                             | Winner    | Method | Rounds | primary==repeat | bundle | text replay | ASCII replay | marker |
| ------------- | -------- | -------------------------------------- | --------- | ------ | ------ | --------------- | ------ | ----------- | ------------ | ------ |
| GRID-BETA-001 | 20260807 | `19c41607-21d0-48e1-a419-23d4721e4be4` | fighter_b | judges | 20     | yes             | pass   | pass        | pass         | absent |
| GRID-BETA-002 | 20260808 | `f668f59c-076d-42de-ba37-73dd0734bf46` | draw      | judges | 20     | yes             | pass   | pass        | pass         | absent |
| GRID-BETA-003 | 20260809 | `dc7459b6-ee55-4183-be06-36bf19d4cb26` | fighter_a | judges | 20     | yes             | pass   | pass        | pass         | absent |
| GRID-BETA-004 | 20260810 | `64eb89f3-bb4d-4574-8ca8-9ab08e5b87a1` | fighter_a | judges | 20     | yes             | pass   | pass        | pass         | absent |
| GRID-BETA-005 | 20260811 | `e835a904-85b8-4279-bad5-614b4d03e29c` | draw      | judges | 20     | yes             | pass   | pass        | pass         | absent |

Operational counts: 5/5 total controlled beta commands completed; 5/5
deterministic repeats matched; 5/5 bundles validated; 5/5 text replays
validated; 5/5 ASCII replays validated; 0 suspension triggers. These are
factual operational observations only — no win rate, slot advantage, balance,
fairness, policy or weapon/build interpretation is made, and outcomes are
explicitly deferred. Post-window integrity: the suspension marker remained
absent; all seven official governance hashes unchanged; the frozen fighter
checksum unchanged; GRID-BETA-001's ten artifact hashes unchanged; every new
match directory retained exactly ten immutable files; C1/C2/AB2 and the C2
default unchanged; normal match/series/replay remain legacy; no benchmark,
provider, seed bank, held-out or `all` access occurred.

**Execution provenance (D60).** Window A was initiated from the accepted
Milestone 0.2C closure commit `9fcb5ecab1933eacdc27eaaaec01c27928c31768`.
Before GRID-BETA-002, the pre-run suite exposed two stale unit-test
assertions that assumed the entire real `data/beta` tree must be absent;
GRID-BETA-001 had legitimately created ignored operational beta data. The
assertions were corrected in the test-only commit
`f52027033b8e2e7550d6ed895f7dfe950da8c531`
(`test: scope beta storage-absence assertions to test ids`), which changed
only `tests/unit/grid-beta-match-service.test.ts` and no production source.
GRID-BETA-002 through GRID-BETA-005 therefore executed with exact Git HEAD
`f520270…`, while their production/runtime source bytes remained identical to
the accepted `9fcb5ec…` state. Independent review accepts this as
source-equivalent operational provenance; the four observation matches were
not rerun.

## Milestone 0.2D Phase 0 — Opponent-suite definition and governance gate

Milestone 0.2C is COMPLETE and Observation Window A is ACCEPTED. Milestone
0.2D Phase 0 (D61, 2026-08-07) is a documentation, architecture and
governance task only: it redefines the older 0.2D roadmap before any
implementation. **No opponents, fixture JSON files, runner, `data/opponents/`
tree, package-script change or `src/` change was made.** The authorised 0.2D
question is: can the project represent a small, diverse set of fixed robot
opponents as immutable, versioned, deterministic local fixtures and
execute/report against them reproducibly without changing combat semantics,
performing adaptation, or making balance claims? ADR-004
(`docs/ADR-004-multi-opponent-fixture-format.md`) freezes the fixture
contract (immutable/versioned identity, canonical SHA-256 fixture checksum,
no subjective balance labels, descriptive `archetypeIntent`), chooses the
runtime-neutral-fixture / runtime-specific-execution model, defines six
conceptual archetype envelopes (`bulwark`, `skirmisher`, `crusher`,
`spinner`, `controller`, `generalist`), the Bulwark migration rule, the
evidence firewall, and the phased implementation sequence (Phases 1–5, each
requiring independent review). The historical "tournament runner" term is
retired in favour of the local development **opponent-suite runner**
(cross-opponent matrix runner) — not the public Arena tournament system, no
rankings, prizes, matchmaking or public/ranked play. No seed bank, held-out
partition or `all` is opened; adaptation and balance evaluation are not
authorised; legacy remains default; Milestone 0.2E is not started.

## Milestone 0.2D Phase 1 — Opponent fixture foundation

Milestone 0.2D Phase 0 passed independent review (D62, 2026-08-07). Phase 1
implements ONLY the generic opponent-fixture foundation: the strict v1
fixture schema, the canonical identity/checksum machinery, and the secure
fixed-root loader under `src/opponents/`. No canonical opponent fixture
exists, Bulwark is not migrated, no opponent-suite runner exists and no
opponent match has been executed.

- **Schema (`src/opponents/opponent-fixture.ts`).** `OPPONENT_FIXTURE_SCHEMA_VERSION
= "1"`; strict identifier contract `^[a-z0-9][a-z0-9_-]{0,63}$` (rejects
  `/`, `\`, `..`, `:`, `%`, NUL, absolute paths, URLs, drive syntax); positive
  integer `fixtureVersion`; canonical filename `<opponentId>.v<fixtureVersion>.json`.
  Persisted fields: `schemaVersion`, `opponentId`, `fixtureVersion`,
  `displayName`, `build`, `validatedBuild`, `policy`, `catalogueVersion`,
  `rulesetCompatibility`, `runtimeCompatibility`, `description`,
  `archetypeIntent`, `fixtureChecksum`.
- **Strictness boundary.** The global build/policy schemas are unchanged. The
  fixture parser runs an exact-key preflight at every object level (fixture
  top level, `build`, `build.armour`, `policy`, ruleset/runtime compatibility
  and the persisted validated-build snapshot) before the authoritative
  schemas, so unknown authoritative fields are rejected and never silently
  stripped. Value/enum/budget validation stays authoritative
  (`machineBuildProposalSchema`, `actionPolicySchema`, `validateBuild`).
- **Validated-build binding.** After `validateBuild(build, CATALOGUE_V1)`, the
  persisted `validatedBuild` must equal the COMPLETE returned authoritative
  build (proposal, totalCost, armourCost, totalArmourPoints, catalogueVersion
  — no subset comparison, no hand-computed costs), and
  `catalogueVersion == CATALOGUE_V1.version`.
- **Compatibility contracts.** `rulesetCompatibility` binds exact
  `RULESET_VERSION` (`0.2.0`) with status `supported`; `runtimeCompatibility`
  binds the complete frozen identities (`legacy` `0.2.0 /
legacy-five-zone-v1`; `grid` `0.3.0 / grid-3x3-v1`) with explicit
  `supported | incompatible` per runtime, both entries mandatory, at least
  one `supported`, no unknown runtime accepted. Compatibility is data only —
  loading never activates a runtime or executes a match.
- **Text fields.** `displayName` (bounded, terminal-safe, agrees with the
  build `machineName` under the sanitised-name convention), `description` and
  `archetypeIntent` (bounded, terminal-safe). No balance labels (`tier`,
  `powerLevel`, `difficultyRating`, `balanced`, `meta`, `optimal`) exist in
  the schema.
- **Canonical identity/checksum.** A deterministic identity payload (every
  field except `fixtureChecksum`, with the COMPLETE `validatedBuild`)
  serialized with recursive object-key ordering (array order preserved) →
  SHA-256 (`sha256Hex`). `fixtureChecksum` is not part of its own input. The
  persisted file must equal the canonical serialization byte-for-byte
  (rejects alternative key order, extra whitespace, CRLF, trailing junk,
  unknown fields); malformed/noncanonical fixtures fail closed, never
  auto-rewritten.
- **Secure loader (`src/opponents/opponent-fixture-loader.ts`).**
  `loadOpponentFixture(opponentId, fixtureVersion, dependencies?)` uses the
  fixed logical root `data/opponents` (no alternate-root API; selection is
  identifier + version). It validates the ID/version, constructs only the
  canonical filename, rejects path escape, inspects ancestry with `lstat`
  (rejects symlink/junction ancestry), requires a regular final file, bounds
  JSON size, re-`lstat`s after reading, parses JSON, enforces the strict
  schema + canonical bytes + build/policy/compatibility/checksum binding, and
  returns a deeply frozen fixture. All failures are `OpponentFixtureError`
  input/fixture validation failures; no beta suspension marker involvement.
- **Test isolation.** A test-only path-remapping filesystem under
  `tests/helpers/opponent-fixture-mapped-fs.ts` redirects the canonical
  logical root onto temp directories; no real `data/opponents/` tree is
  created. Tests cover positive/determinism/deep-freeze, semantic corruption
  (including coherent-tamper cases with recomputed checksums), physical
  TOCTOU races (missing/directory/symlink/junction ancestry/traversal/
  oversized/deletion/replacement/noncanonical bytes/malformed JSON) and
  static scope regressions proving later 0.2D phases are not implemented.

Status (D62): Milestone 0.2D IN PROGRESS; Phase 0 governance complete and
independently reviewed; Phase 1 fixture foundation complete; canonical
opponent fixtures 0; Bulwark migrated no; six-opponent suite not implemented;
opponent-suite runner not implemented; opponent matches executed 0;
adaptation/balance evaluation not authorised; seed-bank/held-out access none;
provider/API use none; legacy default yes; grid default no;
public/ranked/tournament not authorised; Milestone 0.2E not started.

**Phase 1.1 — complete nested validated-build strictness (D63, 2026-08-07).**
Independent Phase 1 review found one blocker: the exported parser's exact-key
preflight did not cover `validatedBuild.proposal.armour`, so an unknown nested
armour field could be silently stripped by the non-strict global schema while
the original checksum stayed valid. The build exact-key logic was refactored
into a shared `assertExactBuildProposalKeys` helper now used for both `build`
and `validatedBuild.proposal` (each including its nested armour), closing the
gap. Direct-parser, coherent-tamper and loader regressions prove the parser
and the loader fail closed at the strictness boundary regardless of checksum
state; canonical persisted-byte validation and the checksum algorithm are
unchanged. Phase 1 remains complete pending independent Phase 1.1 review;
Phase 2 is not started.

## Milestone 0.2D Phase 2 — Canonical opponent suite v1

Milestone 0.2D Phase 1.1 passed independent review; the opponent-fixture
foundation is COMPLETE. Phase 2 (D64/D65, 2026-08-07) froze the complete
human-selected suite v1 design in Git **before** any fixture file existed
(`docs/OPPONENT-SUITE-V1-SELECTION.md`, commit `4750dd9…`, D64), then created
the six canonical fixtures for the first time — **without executing them**.

- **Selection freeze.** The five new fixtures (`skirmisher`, `crusher`,
  `spinner`, `controller`, `generalist`) were selected structurally from
  ADR-004 archetypes, public catalogue/policy semantics and simple
  human-readable armour distributions — no performance data. `bulwark` is the
  sole historical migration candidate and reproduces `BULWARK_BUILD_PROPOSAL`
  / `BULWARK_POLICY` exactly. The selection is immutable; any future semantic
  change requires a new fixture version.
- **Six canonical fixtures** under `data/opponents/` (exactly six regular
  files, no manifest/dotfiles/symlinks): `bulwark.v1.json` (The Bulwark),
  `skirmisher.v1.json` (Iron Cicada), `crusher.v1.json` (Hammerfall),
  `spinner.v1.json` (Whirlwind), `controller.v1.json` (Lockdown),
  `generalist.v1.json` (Sentinel). All `schemaVersion "1"`, `fixtureVersion 1`,
  `catalogueVersion "1"`, ruleset `0.2.0` supported.
- **Authoritative generation.** Each fixture was generated through the
  reviewed foundation: `validateBuild(build, CATALOGUE_V1)` → complete
  `ValidatedBuild` → frozen compatibility → `opponentFixtureChecksum` →
  `parseOpponentFixture` verification → `serializeOpponentFixture` exact bytes.
  No production generator, no package script, no `src/` change. `src/opponents/`
  and `bulwark-agent.ts` are byte-unchanged.
- **Runtime compatibility.** `skirmisher` and `controller` are grid-only
  (legacy deliberately incompatible under ADR-004); `bulwark`, `crusher`,
  `spinner`, `generalist` are dual-compatible.
- **Immutable evidence anchors.** Per-fixture `fixtureChecksum` and
  persisted-file SHA-256 are recorded in `docs/OPPONENT-SUITE-V1-SELECTION.md`,
  D65 and the canonical fixture tests as expected constants.
- **Bulwark data migration only.** Tests prove the bulwark fixture build/
  policy deep-equal the historical constants and its validated build equals
  `createBulwarkBuild()`. Source-code migration is NOT performed (Phase 3).
- **No execution.** No simulator, no `runMatch`/`runGridMatch`, no beta, no
  benchmark, no readiness, no opponent match. Zero benchmark/held-out/provider
  access.

Status (D65): Milestone 0.2D IN PROGRESS; Phase 2 selection frozen before
fixture creation; canonical opponent suite v1 = 6 fixtures created; Bulwark
source-code migration not performed; opponent-suite runner not implemented;
opponent matches executed 0; adaptation/balance not authorised;
seed-bank/held-out/provider none; legacy default yes; grid default no;
public/ranked/tournament not authorised; Phase 3 not started; Milestone 0.2E
not started.

**Governed source-evolution bridge (D66, 2026-08-07).** Documentation/
governance design only. Independent review confirmed that the planned 0.2D
Phase 3 canonical-Bulwark migration would change `src/app/run-match.ts` and
`src/app/run-series.ts`, which are protected normal-path files in the bounded
grid-beta governance: the legacy-isolation preflight compares current checkout
bytes against the frozen `grid-opt-in-beta-reviewed-source-v1` snapshot
(source commit `5173fd0f…`, checksum `1f984801…`), so any byte change fails
closed with `legacy_default_regression` (intentional fail-closed behaviour).
D66 authorises a VERSIONED SUCCESSOR SOURCE BASELINE mechanism: the original
v1 governance authority (decision `58e8cd87-…`, seven hashes, GRID-BETA-001
–005 provenance) remains immutable historical evidence, while a separately
versioned successor current-source compatibility baseline
(`grid-beta-legacy-isolation-reviewed-source-v2`, name refinable) will attest
that a later independently-reviewed source commit remains compatible with the
invariants material to the original approval. The beta operates against
evolved source only when both are valid; failure of either fails closed. No
mutable "latest" baseline: every successor is versioned, bound to one exact
Git commit and exact reviewed bytes, deterministically checksummed,
independently reviewed and explicitly activated. The first permitted successor
exists only to enable the Phase 3 Bulwark migration, gated on required
equivalence facts (legacy default, `runMatch` still used, no grid/beta normal
path, Bulwark fixture anchors `053e61e8…`/`d109c73a…` equivalent to the
historical constants, test-only behavioural equivalence, provider-ordering
fail-closed). Required Phase 3 sequence: Commit M (migration candidate) →
independent review of M → Commit G (successor snapshot from exact Git commit
M, active preflight updated to v2, v1 preserved) — never squashed. During the
transition grid beta is operationally NOT authorised and simply not invoked;
the preflight is not weakened; no marker is created/cleared. This step changes
no source, test, data or governance artifact; Bulwark migration is not yet
performed; Phase 3 implementation not started.

**Commit M — canonical Bulwark migration candidate (D67, 2026-08-07).** D66
passed independent review and the migration candidate (Commit M) is now
created, awaiting independent review before any successor baseline (Commit G).
Normal legacy application Bulwark combat configuration now comes from the
canonical `bulwark.v1` fixture: `src/opponents/opponent-runtime-compatibility.ts`
adds the explicit runtime gate (`OpponentRuntime`, fail-closed
`assertOpponentFixtureSupportsRuntime`, `loadOpponentFixtureForRuntime(opponentId,
fixtureVersion, runtime)` — no root/path/filesystem inputs), and
`src/opponents/legacy-bulwark.ts` adds `loadLegacyBulwark()` enforcing the
frozen v1 checksum `053e61e8…`. `run-match.ts` loads canonical legacy Bulwark
once per invocation before any provider request and uses `fixture.validatedBuild`
/ `fixture.policy`; `run-series.ts` loads it once per series after option
validation and before any series record persistence or provider call, reusing
the immutable fixture across the series and for factual-report enrichment.
Historical `bulwark-agent.ts` constants are retained unchanged as regression/
evidence anchors (not fallback combat input). Migration evidence: exact data
equivalence with `BULWARK_BUILD_PROPOSAL`/`BULWARK_POLICY`/`createBulwarkBuild()`
and `getBulwarkOpponentSummary()` structural facts; exact behavioural
equivalence under unchanged legacy `runMatch` on predeclared test-only seeds
32001/32002/32003 (mirror and asymmetric roles); immutability through
simulation verified. Compatibility matrix: legacy supported bulwark/crusher/
spinner/generalist, legacy incompatible skirmisher/controller, grid supported
all six. **Transition state (intentional):** Commit M differs from the active
v1 reviewed source for `run-match.ts`/`run-series.ts`, so the v1 beta preflight
fails closed with `legacy_default_regression`; operational grid beta is NOT
authorised, the v1 snapshot/preflight are byte-unchanged, successor v2 is not
created, and Commit G is not started. The full repository suite is expected to
contain the v1 protected-source mismatch failures until Commit G activates v2;
migration-focused tests and check/lint/format all pass.

**Commit G — grid beta successor source baseline v2 (D68, 2026-08-07).** Commit
M passed independent review and the separately-versioned successor
current-source compatibility baseline v2 is now established and the full
repository test state is restored (all green). `grid-beta-legacy-isolation-
reviewed-source-v2` freezes the exact ordered 23-path protected source set at
Commit M (`e6d981f…`, baseline checksum `134e7ce2…`) plus the canonical
Bulwark anchor (`dbfed215…`/`d109c73a…`/`053e61e8…`), built ONLY from Commit M
Git objects; `grid-beta-legacy-preflight-v2` re-verifies the successor commit,
the 23 current-checkout protected paths, legacy routing, package legacy
default, global versions, catalogue, C2 qualification, canary sources and
schema conversion/replay support; Selection/Manifest V2 carry the dual
source-authority identity (original v1 governance + successor v2 baseline);
the bundle validator accepts V1+V1 and V2+V2 and rejects mixed pairs; original
v1 governance authority and all 23 protected paths (plus the Bulwark JSON and
the v1 snapshot/preflight modules) are byte-unchanged. **Operational grid beta
remains NOT AUTHORISED pending independent review of Commit G; no real beta
match was executed and no real suspension marker was created/cleared.**

**Development-only legacy opponent-suite runner v1 (D70, 2026-08-07).** ADR-004
does NOT authorise a general grid cross-opponent matrix runner, so Phase 4 is
LEGACY RUNTIME ONLY. `src/opponents/opponent-suite-v1.ts` freezes the canonical
suite identity (`canonical-opponent-suite-v1`, schema `1`, suite version `1`,
exact ordered six opponent IDs, fixture version `1`, the six D65 fixture
checksums, exact declared legacy compatibility) with deterministic suite
checksum `2a276edc8fe6958cb06b0f2a844dd261a878ccf092da238f8ddc2b381c1b8fae`.
`src/opponents/opponent-suite-runner.ts` executes the four legacy-compatible
fixtures (bulwark/crusher/spinner/generalist) through the unchanged legacy
`runMatch` with an explicit `runtime: "legacy"` contract (grid rejected as
separately unauthorised), exactly 12 ordered role-aware matchups per seed
(no self matches, both role assignments), a primary/repeat determinism guard
(24 internal executions per seed, one factual entry per matchup), deterministic
match IDs, generic result checksums, canonical fixture immutability verified
before/after, and a deeply frozen factual `OpponentSuiteRunV1` with no
ranking/balance/tier interpretation. The two legacy-incompatible fixtures
(skirmisher/controller) are visible factual members, never executed.
Development invocation (no package script):

```bash
npx tsx src/app/run-opponent-suite.ts --runtime legacy --seed 44001
```

Prints deterministic JSON only. No persistence, no provider, no
benchmark/held-out/readiness access; Phase 5 factual report not started.

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
