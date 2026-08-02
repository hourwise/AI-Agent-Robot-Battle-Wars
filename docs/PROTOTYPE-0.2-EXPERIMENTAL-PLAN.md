# Prototype 0.2 Experimental Plan

## Armour-band Candidate AB2 development result (2026-07-31)

AB2 is the frozen armour-band candidate that passed the development lifecycle
suite. Its final ID is `component-impact-ab2` and its canonical checksum is
`6b9f70450d3f10b8`. The exact immutable table is exposed `0-9` (`17/20`
critical/high), light `10-24` (`15/18`), protected `25-49` (`13/15`), and heavy
`50+` (`11/13`). Band selection uses only `armourAtHitZone`; the linear impact
formula, qualification precedence, lifecycle, guard, fixtures, seeds, and
C1/C2 entries remain unchanged. C2 remains the default.

The one authorised development run used fixture checksum
`ffc11deb47e6049f`, seed bank `prototype-0.2-baseline-v1`, 80 development seeds,
480 simulations, simulator/ruleset/catalogue `0.2.0/0.2.0/1`, and suite checksum
`951cdbe01132b06c`. Guarded Bulwark had 164/1255 qualifying hits and 64
resisted events; unguarded Bulwark had 147/1074 and zero resistance;
representative light had 207/509; Glass diagnostic-extreme had 238/462; and
the asymmetric diagnostic had 418/1101. Hard terminal incidence was 22.5%,
42.5%, and 58.8%, with 0% first-round terminal incidence in each hard fixture.
All hard lifecycle, factual, guard, replay, and randomness gates passed;
component-terminal dominance was 52.98%. Decision A: AB2 passes the revised
development lifecycle gates. The separately authorised held-out confirmation
then ran exactly once with 20 held-out seeds and 120 simulations. It preserved
candidate checksum `6b9f70450d3f10b8` and fixture checksum `ffc11deb47e6049f`;
held-out suite checksum was `4ea2fe4423a0de8c`.

Held-out aggregate results were guarded Bulwark 311 hits / 39 qualifications,
18 damaged / 3 disabled, 15.0% terminal incidence; unguarded Bulwark 283 / 38,
32 / 6, 30.0%; representative light 118 / 59, 40 / 19, **85.0%**; Glass
diagnostic-extreme 101 / 56, 38 / 18, 80.0%; and the asymmetric diagnostic
268 / 98, 62 / 32, 75.0%. All general and diagnostic gates passed, but the
unchanged representative-light terminal gate failed at exactly 0.85 against
the strict `<0.85` requirement. Decision B: held-out confirmation failed one
hard gate, so AB2 is **held-out-rejected**. AB2 was not changed; it is frozen
and retained for historical reproducibility and is permanently ineligible for
default promotion — no later task may promote AB2. The original held-out
partition is spent and cannot validate another candidate. C2 remains the
unchanged experimental runtime default and is not an accepted final balance
solution. Milestone 0.2B's lifecycle mechanism is implemented, but its
qualification/balance acceptance remains unresolved and deferred; 0.2B is not
marked complete. No individual held-out seeds or per-match results are
recorded.

## Handoff: next authorised direction (2026-07-31)

The next permitted implementation milestone after the 0.2B closure is
**Milestone 0.2C — Positioning Model (3×3 Grid)**. That work:

- may build on the current C2 default without treating C2 as final;
- must keep component qualification constants frozen during 0.2C;
- must not use the AB2 held-out result to tune combat;
- will see component qualification reconsidered only in a later separately
  authorised evaluation cycle.

Milestone 0.2C Phase 1 (pure geometry foundation) is implemented by the
`agent/0.2c-grid-foundation` task; Phase 2 (schema v3 + versioned replay
foundation) is implemented by the `agent/0.2c-schema-v3-replay` task; Phase 3A
(opt-in deterministic grid combat runtime core) is implemented by the
`agent/0.2c-grid-runtime-core` task; Phase 3B (activation hardening — frozen
runtime identities, paired zone/identity types, grid version contract,
converter-boundary validation and simultaneous positional effects) is
implemented by the `agent/0.2c-grid-runtime-hardening` task; Phase 3B.1 (grid
movement momentum correction — charge momentum granted only to translated
`advance`, never to retreat/circle/hold) is implemented by the
`agent/0.2c-grid-momentum-correction` task; Phase 3C (deterministic translated
lateral circling and `opening: "flank"` integration) is implemented by the
`agent/0.2c-grid-lateral-flank` task; Phase 3D1 (version-aware factual
reporting and series compatibility foundation) is implemented by the
`agent/0.2c-grid-reporting-foundation` task; Phase 3D1.1 (reporting boundary
and series traceability hardening — explicit movement-event actions,
no-fallthrough movement subjects, projection isolation, facing/condition
validation, report-builder boundary validation and series-v2 match-ID and
factual-summary agreement) is implemented by the
`agent/0.2c-grid-reporting-hardening` task; Phase 3D2A (isolated deterministic
grid match canary — a separate, local-only, single-match canary command
proving the full grid pipeline operationally) is implemented by the
`agent/0.2c-grid-match-canary` task; Phase 3D2A.1 (canary evidence and
artifact verification hardening — canonical flank bearings, truthful strict
rear reporting, manifest v2 with SHA-256 digests, complete artifact read-back
and cross-validation, and output-root isolation) is implemented by the
`agent/0.2c-grid-match-canary-hardening` task; Phase 3D2A.2 (immutable and
exclusive canary publication — exact canonical root enforcement, `lstat`-based
collision detection, exclusive temporary-directory creation, invocation-owned
cleanup, and exact seven-file temporary/final inventories) is implemented by
the `agent/0.2c-grid-canary-publication-hardening` task; Phase 3D2B (isolated
deterministic grid adaptive-series canary — a separate, local-only,
three-match canary with two deterministic policy adaptations, series-record
v2, JSON envelopes, an adaptation trace, a series report and a validated
atomic artifact bundle, sharing the extracted immutable publication and
physical-root guards) is implemented by the `agent/0.2c-grid-series-canary`
task; Phase 3D2B.1 (grid series canary provenance and immutability hardening —
runtime-frozen seed plan, safe-integer seed contracts in persisted schemas,
complete report/review agreement including disabled components before
adaptation, full series-entry-to-record and envelope provenance binding,
build/policy execution binding, manifest evidence recomputation from
persisted artifacts, rendered per-match fact and raw score validation, and
the shared publisher declaration contract) is implemented by the
`agent/0.2c-grid-series-canary-hardening` task. Phase 3E1 (bounded
development-only grid activation-readiness evaluation — a source-controlled
development-only seed registry with a reserved numeric range, a frozen
seven-scenario/thirteen-assignment registry, an exact 312-run plan, a pure
execution core with deterministic re-execution, authoritative envelopes, a
pure metrics reducer, frozen hard/coverage/slot/progress gates, a decision
v1, a human-readable report and an immutable nine-file evaluation bundle
under `data/readiness/grid/`, all non-benchmark, non-holding-out and
non-activating) is implemented by the `agent/0.2c-grid-activation-readiness`
task. Phase 3E1.1 (grid readiness evidence hardening — selected actions
counted from `policy_triggered` events so stationary `hold` coverage is
correctly evidenced, deep-frozen scenario registry with distinct per-scenario
definitions, and end-to-end published-bundle recomputation of per-run
evidence, metrics, gates, decision and report from the persisted records and
reports as v2 artifacts, with the historical v1 bundle preserved) is
implemented by the `agent/0.2c-grid-readiness-hardening` task. Phase 3E1.2
(grid readiness provenance finalisation and canonical suite binding — the
current v3 suite identity with the
`canonical-registry-record-derived-decision-v1` provenance model, exact
canonical seed and scenario registry anchoring, complete event chronology and
ordinary-hold invariant enforcement, record-derived execution metrics with
explicit operational attestations, complete report/final-state agreement,
corrected timing validation, and an explicit CRLF formatting contract) is
implemented by the `agent/0.2c-grid-readiness-provenance-finalization` task.
The authoritative runtime
migration and live grid match production remain future, separately
authorised phases.

**Milestone 0.2C progress (2026-08-01):**

- Phase 1 — 3×3 geometry foundation: **complete**.
- Phase 2 — grid match schema v3, explicit positioning identifier,
  version-aware replay dispatch, 3×3 ASCII renderer: **complete**.
- Phase 3A — opt-in deterministic grid combat runtime core: **complete**.
  `runGridMatch` provides a full deterministic grid match (movement,
  proximity-based actions, planar exposure/targeting, knockback and grapple
  repositioning, shared damage/component/victory core) with explicit
  `0.3.0` / `grid-3x3-v1` identity, persisting schema v3.
- Phase 3B — activation hardening: **complete**. Runtime identities are frozen
  at runtime (`Object.freeze`, not just `readonly`); zone type and identity
  profiles are paired so invalid combinations cannot be constructed through
  normal typed use; the grid version contract is frozen at
  `0.3.0 / grid-3x3-v1 / ruleset 0.2.0 / catalogue 1` and enforced by
  `runGridMatch` and the v3 schema; `matchResultToRecord` validates every
  constructed record at the converter boundary before returning; and grid
  knockback/grapple destinations are planned simultaneously from the common
  post-movement snapshot (A-before-B remains event ordering only, not
  positional initiative). A bounded deterministic correctness matrix proves
  canonical zones, valid v3 records, replay reconstruction and deterministic
  repetition without any balance conclusions.
- Phase 3B.1 — grid momentum correction: **complete**. Ram charge momentum is
  granted only when an `advance` action actually translates the robot
  (`getGridMovementMomentum`); a translated `retreat`, `circle_left`,
  `circle_right`, `hold`, or any future lateral action never receives charge
  momentum. Legacy momentum semantics are unchanged.
- Phase 3C — deterministic lateral/flank integration: **complete**.
  `circle_left` / `circle_right` are now genuine translated lateral movement
  in the opt-in grid runtime (frozen tangent vectors, deterministic candidate
  ranking, facing toward the opponent, blocked/same-cell in-place rotation),
  and the existing `opening: "flank"` policy drives grid lateral movement via
  a pure deterministic selector (desired planar target + tactical score, no
  RNG). No new movement actions or policy fields were added; legacy circling
  remains turn-in-place.
- Phase 3D1 — version-aware factual reporting and series compatibility
  foundation: **complete**. Factual-match-report v1 is the frozen legacy
  contract (unchanged, byte-compatible); factual-report v2 represents an
  opt-in grid match only (frozen grid identity `0.3.0 / grid-3x3-v1 / ruleset
0.2.0 / catalogue 1`, nine grid zones, no cooldown fields because the event
  stream cannot reconstruct them). Builders dispatch through the explicit
  immutable runtime identity, never zone strings. A canonical
  `getMovementEventSubjectId` (knockback/grapple → target, ordinary movement →
  actor) is shared by reporting and replay, and a pure shared
  `projectFinalFighterState` applies events then the latest authoritative
  `round_ended` facts without inventing any. AI review/rebuild accept either
  report version (v1 prompt rendering byte-identical; v2 adds the simulator
  identity line and human-readable grid zones — corners are never called
  "edges"). Series v1 remains the unchanged legacy contract and the only
  record `runSeries` produces; series v2 is a reserved single-runtime grid
  contract (one immutable runtime identity per series, cross-field seed /
  matchId / runtime / uniqueness / score validation) handled by the repository
  and report renderer. No policy schema, seeds, fixtures or benchmark
  partitions changed.
- Phase 3D1.1 — reporting boundary and series traceability hardening:
  **complete**. Movement-event actions are explicitly enumerated
  (`MovementEventAction` = the five normal actions + `knockback` + `grapple`
  with `isMovementEventAction`); `getMovementEventSubjectId` is an explicit
  exhaustive switch with no catch-all, so unknown, missing, non-string or
  malformed actions have no subject and reporting and replay both ignore
  malformed movement rather than moving the actor. `projectFinalFighterState`
  retains no event-owned mutable references (build, comps, armour, component
  flags and conditions all cloned/copied; round-end conditions validated and
  copied). A present but invalid movement facing is rejected and
  `round_ended.conditions` must be a canonical array. Both report builders
  validate against their authoritative schemas before returning, throwing a
  clear construction-boundary error on malformed reconstructed zones, facing,
  conditions, component/lifecycle facts or fixed grid identity fields. Series
  v2 now requires the entry, match summary and factual report to share one
  persisted match UUID and to agree on rounds, winner and method; the
  standalone builders may still use `matchId: "pending"` before persistence.
  Current match and series application paths remain legacy; no grid canary or
  default activation occurred; no benchmark partition ran; seeds and fixtures
  are unchanged; no balance conclusion or tuning occurred.
- Phase 3D2A — isolated deterministic grid match canary: **complete**. A
  separate, local-only, deterministic single-match canary proves the complete
  grid pipeline operationally — built-in no-combat flank scenario
  (`grid-canary-flank-v1`: Fighter A flank/rear, Fighter B hold/front, both
  Bulwark builds and always defend) → direct `runGridMatch` → match-record v3
  → factual-report v2 bound to the persisted match UUID →
  `bindGridFactualReportToMatchRecord` → text and 3×3 ASCII replay →
  deterministic fallback review → validated atomic artifact bundle under
  `data/canary/grid-match/<canaryId>/`. A pure evidence inspector fails closed
  on missing evidence (identity, canonical zones, translated circles, corner
  visit, rear/rear-diagonal flanking position, no combat events) using the
  canonical movement-subject and geometry/bearing helpers, verifies
  replay/report/record agreement and re-execution determinism, and never
  mutates inputs. The manifest (`GridMatchCanaryManifestV1`) carries the
  frozen identity, evidence and artifact-name block. The explicit
  `match:grid:canary` command requires `--seed <non-negative integer>` and
  rejects every unsupported argument; the existing `match` and `series`
  commands are unchanged and no grid series runner, runtime selector, default
  activation, provider integration, benchmark execution or balance conclusion
  was added. Full suite, typecheck, lint and CRLF formatting pass.
- Phase 3D2A.1 — canary evidence and artifact verification hardening:
  **complete**. The Phase 3D2A corner-adjacency proxy (corner + adjacency →
  rear exposure) was removed; all exposure is now derived only through the
  canonical `getRelativeBearing` / `getPlanarExposedArmourZones` functions.
  The frozen scenario's fighter B holds at `north` facing `south`, so fighter
  A's observed `north_west` position is defender-relative `right` — a canonical
  lateral flank — and `strictRearExposureObserved` is reported truthfully
  (`false` for the frozen scenario). The evidence result now uses
  `lateralFlankObserved` / `observedFlankBearings` /
  `strictRearExposureObserved` and verifies the frozen-scenario role
  invariants (fighter A translates, fighter B never changes cell, fighter B
  faces south, at least one translated circle, no combat events). Manifest v2
  is the only current passing manifest and contains SHA-256 digests for all six
  non-manifest artifacts (computed with the Node standard cryptography library,
  no dependency); manifest-v1 types are retained only for historical inspection
  and pre-hardening artifacts are superseded. Bundle publication now reads back
  all seven files, byte-compares every written string, deserializes and
  validates all four JSON artifacts, requires manifest v2, runs the pure
  cross-agreement validator `validateGridMatchCanaryBundle` (identity, result,
  review, text-artifact and digest agreement) and reverifies the complete final
  bundle after the atomic rename. `assertCanaryOutputRootIsolation` rejects
  `data/matches`, `data/series` and descendants, the repository `data` root and
  any non-canary in-repo root (canonical `data/canary/grid-match` only), with
  path-traversal and case-insensitive Windows handling, before any directory is
  created or any match is executed. Corruption of any artifact (including
  schema-valid corruption) fails publication with full cleanup and never writes
  to normal storage. The CLI prints truthful flank fields. No simulator, policy
  or combat semantics changed; no grid series or default activation occurred;
  no balance conclusion was made.
- Phase 3D2A.2 — immutable and exclusive canary publication: **complete**. The
  service-level output root inside repository `data` must resolve to exactly
  `data/canary/grid-match`; descendants (published canary directories, custom
  paths and `.tmp-*` locations) are rejected as service roots. `CanaryFileSystem`
  now exposes `lstat` and `readdir`; collision preflights use `lstat` so empty
  directories, regular files, symbolic links and broken symbolic links all
  count as existing entries. The canary ID is generated and validated and the
  final/temporary publication paths are preflighted before the match executes.
  The temporary directory is created exclusively with non-recursive `mkdir`
  (raced-in entries fail with `EEXIST` and are never cleaned), and cleanup
  applies only to invocation-owned paths (`tmpCreatedByThisInvocation`,
  `finalPublishedByThisInvocation`). Before rename and after rename both
  directories must contain exactly the seven canonical regular files (sorted
  names matching manifest v2, no extra/missing entries, no directories, no
  symbolic links). Races are handled defensively: an exclusive-mkdir `EEXIST`
  fails closed without touching the raced-in path, and a post-preflight final
  entry that breaks the rename is preserved while only the invocation-owned
  temporary directory is removed. Manifest-v2 evidence (`right`, strict rear
  `false`), the six SHA-256 digests, all-seven-file read-back, byte/schema/
  cross-agreement validation and final revalidation are unchanged. No grid
  series or default activation occurred; no balance conclusion was made.
- Phase 3D2B — isolated deterministic grid adaptive-series canary:
  **complete**. A separate, local-only, deterministic three-match adaptive
  series proves the complete grid series pipeline operationally — frozen
  combat-observable scenario `grid-series-canary-adaptive-v1` (deterministic
  local competitor `flank`/`medium`/aggression `100`/`rear`/`rear`/`20`/`80`/
  `defend` against the canonical `BULWARK_POLICY`, both fresh deep-cloned
  Bulwark builds every match, `maximumMatches 3`, `targetWins 3`, no
  `nextDesign`) → direct `runGridMatch` × 3 → match-record v3 × 3 →
  factual-report v2 × 3 bound to the injected match UUIDs → text and 3×3
  ASCII replay × 3 → deterministic fallback review × 3 → two frozen
  `grid-canary-policy-adaptation-v1` adaptations → series-record v2 → four
  JSON envelopes + adaptation trace + series report → validated atomic
  eight-file artifact bundle under `data/canary/grid-series/<canaryId>/`.
  The shared immutable publication infrastructure and the kind-aware
  output-root/physical-root guards were extracted to `src/canary/` and used
  by both canaries; the single-match canary was refactored byte-compatibly.
  The pure core never generates UUIDs, reads the clock, touches the
  filesystem or calls a provider/`runSeries`/benchmark; identities are
  injected and the service re-executes the core to prove determinism. The
  manifest v1 freezes sixteen evidence flags and seven SHA-256 digests with
  no win rates, percentages, promotion, balance or benchmark terminology,
  and the pure bundle validator cross-checks identity/ordering, runtime,
  result, adaptation, series, text-artifact and digest agreement. The
  explicit `series:grid:canary` command requires `--seed <base>` and rejects
  every unsupported argument (including target-wins/maximum-matches
  overrides, runtime selectors, `--ai`, `--review`, provider and API-key
  arguments); the existing `match` and `series` commands are unchanged and
  no runtime selector, provider integration, default activation, benchmark
  execution or balance conclusion was added.
- Phase 3D2B.1 — grid series canary provenance and immutability hardening:
  **complete**. The Phase 3D2B review gaps were closed before any
  activation-readiness evaluation: the seed plan is now runtime-frozen
  (`Object.isFrozen` plan and seeds; mutation cannot change values; separate
  frozen values per call); the manifest and adaptation-trace schemas require
  safe-integer seeds (with `baseSeed ≤ Number.MAX_SAFE_INTEGER - 2` and
  sequential source seeds) and the bundle validator independently requires
  every seed in the manifest, series entries, match records, factual reports
  and trace to be a safe integer; adaptation now requires **complete**
  report/review agreement — winner, method, rounds, both final integrity
  values and both canonical disabled-component lists (`mobility`, `weapon`,
  `utility` order; missing/extra/different/duplicate/reordered claims
  rejected) — before any impairment fact is read, via one shared
  `gridFallbackReviewDisagreements` / `normaliseDisabledComponents` helper
  used by the adaptation, the fallback-review builder and both bundle
  validators; series entries are bound to their actual match records and
  envelopes (match summary fields, embedded factual report and review,
  fallback-envelope alignment, and the frozen intentional local-fallback
  `reviewFailure` marker); builds and policies are bound to actual execution
  (entry design/policy = record fighter A proposal/policy, fighter B =
  frozen Bulwark proposal/`BULWARK_POLICY`, competitor build identical across
  records, and the adaptation chain agrees with the actual record policies);
  manifest evidence is recomputed from persisted artifacts
  (`recomputeGridSeriesCanaryEvidence`) and must agree with the manifest;
  rendered per-match facts are cross-validated (text replay exact completion
  line/round/seed via the shared `formatCompetitionEndedLine`, review prompt
  exactly reproducible via `buildReviewUserPrompt`, ASCII seed/method/round)
  and the authoritative raw series score line and "3 matches completed" are
  required in the report; and the shared publisher validates its declaration
  contract before any filesystem activity while keeping the seven-file and
  eight-file bundles byte-for-byte unchanged. Frozen regression digests for
  seed 3 prove the event streams, reports, trace and series record are
  unchanged, and artifact versions remain match v3 / report v2 / series v2 /
  manifest v1. No simulator, scenario, policy, seed-derivation,
  adaptation-rule or combat semantics changed; no benchmark partition ran;
  seeds and fixtures unchanged; held-out and `all` sealed; C1/C2/AB2 and
  checksums unchanged with C2 default; constants `0.2.0 / 0.2.0` and
  catalogue `1`; normal match/series legacy; no provider or external API
  call; no activation-readiness evaluation; no default activation.
- Phase 3E1 — bounded development-only grid activation-readiness evaluation:
  **v1 tooling historical; v1 official development run complete; v1
  classification `inconclusive`**. One bounded,
  deterministic, development-only evaluation answers whether the grid runtime
  is technically suitable for a separately authorised opt-in beta decision.
  `config/readiness/grid-readiness-development-v1.json` registers exactly 24
  frozen development-only seeds in the reserved range `1703000000–1703099999`
  (runtime-frozen, safe-integer, signed-32-bit distinct, canonical checksum
  `54acf0151360f59d429fd7b2a84f48b48f4a791e522cf58bc381b927d62b78a0`);
  `grid-readiness-scenarios-v1` freezes seven families and thirteen
  assignments (one Bulwark mirror plus six role-swapped pairs versus the
  canonical Bulwark, all catalogue-v1-valid with fresh deep-cloned values,
  checksum `b07270171f6e38efac2d1992f051d7bd881e323c00cee92b9caa9490ddb85b67`);
  the exact suite is 312 primary matches (24 seeds × 13 assignments, ordered
  scenario → assignment → seed, suite checksum
  `dd38ac8a5d2e35007b4b6890418b21aca8f621f3e165fa7d158d2f179672ae5a`). The
  pure execution core calls `runGridMatch` directly with injected identities,
  requires the exact grid runtime identity and `1 ≤ rounds ≤ MAX_ROUNDS`,
  validates every zone/action/subject/facing/condition fact, converts to
  match-record v3, builds and binds factual-report v2, verifies
  replay/report/final-round agreement, renders text/ASCII replays and the
  review prompt, and never mutates inputs; the suite re-executes
  byte-identically under the same identities. Envelope schemas (run index,
  match records, factual reports — exactly 312 ordered items each) and a pure
  metrics reducer (execution, movement, combat, results, slot-order and
  informational timing) feed frozen gates H01–H10 (hard), C01–C06
  (coverage), S01–S03 (slot-order) and P01–P02 (progress), whose outcomes
  derive exactly one classification (`ready_for_opt_in_beta_review`,
  `inconclusive`, `not_ready`). The kind-aware root guard now includes
  `grid-readiness → data/readiness/grid`; each official evaluation publishes
  an immutable nine-file bundle (`manifest.json`, `seed-registry.json`,
  `scenario-registry.json`, `run-index.json`, `match-records.json`,
  `factual-reports.json`, `metrics.json`, `decision.json`, `report.txt`)
  through the shared publisher with read-back and cross-agreement
  validation. The `readiness:grid` command accepts no arguments and exits
  zero for any completed evaluation. No benchmark partition ran, no existing
  benchmark seed file was opened, held-out and `all` remain sealed, seeds and
  fixtures are unchanged, C1/C2/AB2 and checksums remain frozen with C2
  default, constants remain `0.2.0 / 0.2.0` and catalogue `1`, normal
  match/series remain legacy, both canaries remain isolated and unchanged,
  no provider or external API call occurred, no tuning follows the result, no
  opt-in activation decision was performed and no default activation
  occurred. Exactly one official run executed (`evaluationId
864991f7-d060-4669-beec-11e0d42b7e68`, bundle under
  `data/readiness/grid/864991f7-d060-4669-beec-11e0d42b7e68/`): determinism
  passed, all hard (H01–H10), slot-order (S01–S03) and progress (P01–P02)
  gates passed, coverage gates C01/C03/C05/C06 passed, and coverage gates
  **C02** (the canonical `hold` movement action was not observed) and **C04**
  (no grapple reposition was observed) were **inconclusive**, producing the
  final readiness classification **`inconclusive`**. Nothing was tuned after
  the result; no opt-in activation decision and no default activation was
  performed.
- Phase 3E1.1 — grid readiness evidence hardening: **complete; official v2
  run complete; readiness classification `inconclusive`**. The v2 evidence
  hardening corrects the action-evidence source and hardens decision
  provenance without changing seeds, scenarios, assignments, the 312-run plan,
  thresholds or simulator semantics; the historical v1 evaluation
  (`864991f7-d060-4669-beec-11e0d42b7e68`, suite checksum
  `dd38ac8a5d2e35007b4b6890418b21aca8f621f3e165fa7d158d2f179672ae5a`) is
  preserved. Selected movement and combat actions are now derived from
  `policy_triggered` events (exactly one per fighter per completed round;
  selected total = `2 × completed rounds`) by the shared record-evidence
  inspector, so stationary `hold` coverage is correctly evidenced without a
  `movement_resolved` (C02 now passes; `hold` selected count 4373); ordinary
  `movement_resolved` must agree with the actor's selected policy movement,
  and knockback/grapple are target-subject events that are never selected
  actions. The scenario registry is deeply frozen (every nested build
  proposal, armour object and policy is a distinct deeply frozen clone with
  no shared references; checksum unchanged). The published bundle is
  revalidated end-to-end: per-run evidence and render checksums are
  recomputed from the persisted records, then metrics, gates, the decision
  and `report.txt` byte-for-byte; run-index v2 carries
  `selectedMovementActionCounts`/`selectedCombatActionCounts` and metrics/
  decision/manifest are v2 artifacts (suite `grid-activation-readiness-v2`,
  action-evidence model `policy-triggered-round-actions-v1`); v1 artifacts
  parse but are rejected as current evidence. Exactly one official v2 run
  executed (`evaluationId d788284d-a795-4125-984c-9146261e271a`, bundle
  under `data/readiness/grid/d788284d-a795-4125-984c-9146261e271a/`, suite
  checksum `df9444101ca68f7b7ca9fef24adfe8575363ef744e9f37b4449b111e0bb29fd9`):
  determinism passed, all hard (H01–H10), slot-order (S01–S03), progress
  (P01–P02) and coverage gates except C04 passed (C02 now passes via
  `policy_triggered` evidence), and coverage gate **C04** (no grapple
  reposition was observed) was **inconclusive**, producing the final
  readiness classification **`inconclusive`**. No supplemental grapple
  scenario was added; nothing was tuned after the result; no opt-in
  activation decision and no default activation was performed.
- Phase 3E1.2 — grid readiness provenance finalisation and canonical suite
  binding: **complete; official v3 run complete; readiness classification
  `inconclusive`**. The current suite is `grid-activation-readiness-v3` with
  the action-evidence model `policy-triggered-round-actions-v1` and the
  provenance model `canonical-registry-record-derived-decision-v1`; the v3
  suite checksum includes the suite ID, action-evidence model, provenance
  model, exact canonical registry checksums, runtime identity and all ordered
  run tuples (and differs from v1/v2 only by the versioned identity). Current
  executions emit run-index v3, metrics v3, decision v3 and manifest v3; the
  record and factual-report envelopes keep their schema versions. The exact
  canonical seed registry (checksum `54acf015...`, exactly 24 seeds in exact
  order) and scenario registry (checksum `b0727017...`, exact structural
  equality with a freshly created canonical registry) are anchored and a
  self-consistent alternate registry is never accepted. The record-evidence
  inspector enforces complete event chronology (`competition_started` first,
  one `round_started` + two `policy_triggered` + one `round_ended` per
  completed round, `competition_ended` last with terminal payload agreeing,
  monotonic rounds, strictly increasing unique sequences within each of the
  frozen runtime's two counters) and the ordinary-hold invariants (translated
  `hold` always zero; `stationaryHoldCount` = selected hold count; an emitted
  `hold` must be same-cell and same-facing). Execution metrics are derived
  from the parsed records and the explicit operational attestations
  (`deterministicMatches` 312, `mutationFailures` 0, `invalidEventCount` 0
  after all inspectors pass, `replayAgreeingMatches` from the complete
  report/final-state agreement check); H02/H07 use the manifest attestations
  directly and H05/H06 derive from record inspection. Timing validation now
  requires finite/non-negative values, `mean ≈ totalElapsedMs / 312` within a
  documented tolerance and `p95 >= median` (the invalid `median <= mean <=
p95` assumption is removed); timing changes never alter a gate or decision.
  Prettier is configured with `endOfLine: crlf` and `npm run format:check`
  passes repository-wide. Exactly one official v3 run executed (`evaluationId
0d8487a8-939d-4f9a-a16a-544b71eaa869`, bundle under
  `data/readiness/grid/0d8487a8-939d-4f9a-a16a-544b71eaa869/`, suite checksum
  `c3b8a16d407891d0a92966fb9d6ed20fe5e11776bf545624fb3dbcadb4e2503c`):
  determinism passed; H01–H10, S01–S03, P01–P02 and C01/C02/C03/C05/C06 passed
  (selected `hold` = 4373, translated `hold` = 0, grapple reposition = 0);
  coverage gate **C04** (no grapple reposition observed) was **inconclusive**,
  producing the final readiness classification **`inconclusive`**. The
  historical v1 (`864991f7-...`) and v2 (`d788284d-...`) bundles remain
  preserved. No supplemental grapple scenario was added; no seed, scenario,
  policy, threshold or simulator semantics changed; no benchmark ran; no seed
  bank was opened; held-out/all remain sealed; no provider call, tuning,
  opt-in beta decision or default activation occurred.
- Active/default runtime migration: **not performed**. `SIMULATOR_VERSION` and
  `RULESET_VERSION` remain `0.2.0`, catalogue `1`; the normal application
  still uses legacy `runMatch` and persists schema v2; `runGridMatch` is not
  wired into CLI, series, battle or application commands.
- Default grid activation: **not performed**. Milestone 0.2C remains
  **not complete**, pending a separately authorised activation-readiness
  decision.
- Grid adaptive-series execution: **not implemented** for live play. The grid
  adaptive-series **canary** (Phase 3D2B) is complete and produces a
  series-v2 record locally under `data/canary/grid-series/`, but no normal
  application command or runner produces a series-v2 record and no
  adaptive-series execution is wired into the application; the canaries are
  separate and local-only.
- Balance evaluation of the grid runtime: **not performed**; no grid-vs-legacy
  balance conclusions are made.
- Milestone 0.2C is **not complete**.

This is an evidence-led plan, not a feature wishlist. Every proposed change is driven by a specific limitation observed in Prototype 0.1.

---

## 1. Research Questions

### Positioning

Prototype 0.1 proved the AI can adapt its **build** but could not test whether it can exploit positional weaknesses through tactical movement.

Questions:

- Can the simulator represent and reward lateral movement, genuine flank attempts, rear positioning, disengagement, pursuit, and facing advantage?
- Can a fighter meaningfully escape close range once both fighters occupy the same zone?
- Does the AI's policy system have enough expressive range to request positional manoeuvres?

### Component-Disable Volatility

Every AI victory in Prototype 0.1 was decided by a component disable. Match 2 ended in Round 1 due to a critical mobility disable. We cannot separate design quality from critical-hit luck.

Questions:

- Are component disables too frequent relative to structural destruction?
- Are they too decisive — can a single roll overwhelm design quality?
- Should disables require prior component damage rather than occurring on the first damaging hit?
- Should `reinforced_drive` provide broader protection, or should other utilities offer analogous defence?

### Generalisation

Prototype 0.1 tested against a single opponent. We do not know whether adaptation generalises.

Questions:

- Can an adaptive design improve against multiple fixed opponents with different weapons, chassis, and tactical archetypes?
- Does adaptation against one opponent harm performance against another?
- Can the system detect opponent-specific overfitting?

### Statistical Confidence

Four matches cannot distinguish genuine improvement from favourable seeds.

Questions:

- Can the system run batch evaluations against a fixed seed bank?
- What sample size is needed to detect a meaningful win-rate change?
- Can we measure held-out seed performance to detect overfitting?
- What threshold separates genuine improvement from noise?

---

## 2. Version Boundaries

Prototype 0.1 must remain replayable. Any 0.2 change that affects authoritative outcomes requires a version bump in the appropriate component:

| Change affects                                     | Version to bump             |
| -------------------------------------------------- | --------------------------- |
| Simulator logic (movement, damage, hit zones)      | `SIMULATOR_VERSION`         |
| Game rules (budget, armour cost, weapon stats)     | `RULESET_VERSION`           |
| Available components                               | `CATALOGUE_VERSION`         |
| Policy schema (new fields, changed constraints)    | Policy prompt version       |
| Event format (new event types, changed data shape) | Event schema version        |
| Match/series record shape                          | Match/series schema version |

Old Prototype 0.1 matches must replay under their original versions. Events must not be silently reinterpreted under new rules.

---

## 3. Positioning Models

Three candidate approaches. All must preserve deterministic resolution, ASCII rendering compatibility, and replay clarity.

### Option A — Expanded Discrete Arena (3×3 grid)

```
north_west | north | north_east
west       | centre | east
south_west | south | south_east
```

**Evaluation:**

| Criterion                 | Assessment                                                                                                           |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Implementation complexity | Medium — 9 zones, richer adjacency graph, pathfinding for advance/retreat                                            |
| Pathfinding requirements  | Low — still discrete; BFS or lookup table suffices                                                                   |
| Replay clarity            | Good — ASCII grid renders naturally                                                                                  |
| Tactical expressiveness   | Good — lateral movement, corner positioning, multiple approach paths                                                 |
| Deterministic resolution  | Straightforward — same zone-based model                                                                              |
| ASCII rendering           | Good — natural 3×3 grid with centre highlight                                                                        |
| Migration cost            | Medium — all zone references, movement logic, facing helpers, exposure checks, arena snapshot renderer need updating |

### Option B — Range + Relative Bearing

Track continuous concepts without discrete zones:

```
range: close | medium | far
bearing: front | left | right | rear
positional advantage: none | flanking | rear
```

Movement actions change range and bearing relative to the opponent. Facing is explicit.

**Evaluation:**

| Criterion                 | Assessment                                                                  |
| ------------------------- | --------------------------------------------------------------------------- |
| Implementation complexity | Low-medium — replace zone graph with range/bearing transitions              |
| Pathfinding requirements  | None — movement is relative, not absolute                                   |
| Replay clarity            | Medium — abstract; harder to visualise than a grid                          |
| Tactical expressiveness   | Medium — bearing captures relative position well; loses arena geometry feel |
| Deterministic resolution  | Straightforward — state-machine transitions                                 |
| ASCII rendering           | Difficult — no natural spatial layout; would need abstract position diagram |
| Migration cost            | High — fundamental model change; all zone-dependent code rewrites           |

### Option C — Abstract Positional States

```
engaged        — fighters in contact, front-on
flanking       — attacker has side advantage
rear-advantage — attacker behind defender
disengaged     — fighters separated
pinned         — defender cannot retreat
```

Transitions governed by speed, facing, and movement choices.

**Evaluation:**

| Criterion                 | Assessment                                                              |
| ------------------------- | ----------------------------------------------------------------------- |
| Implementation complexity | Low — few states, clear transitions                                     |
| Pathfinding requirements  | None                                                                    |
| Replay clarity            | Low — visually abstract; hard to narrate spatially                      |
| Tactical expressiveness   | Low — too coarse; flattening all positions into 4–5 states loses nuance |
| Deterministic resolution  | Straightforward                                                         |
| ASCII rendering           | Difficult — no meaningful spatial layout                                |
| Migration cost            | Medium                                                                  |

### Recommendation: Option A (3×3 grid)

The 3×3 grid preserves the spirit of the current arena while adding the missing lateral dimension. It enables true flanking, corner positioning, and multiple approach paths. ASCII rendering is natural. Migration cost is moderate but contained — zone references, movement helpers, facing/exposure checks, and the arena snapshot renderer are the primary touch points.

Options B and C are preserved as fallbacks if the 3×3 grid proves too complex to balance or too expensive to render in ASCII.

---

## 4. Volatility Study

Before changing critical-hit or component-disable rules, we must measure current behaviour.

### Benchmark Protocol

Run each design pairing against a **fixed seed bank of 100+ predefined seeds**. The seed bank must be versioned and committed so results are reproducible.

Measure for each pairing:

| Metric                          | Purpose                |
| ------------------------------- | ---------------------- |
| Win rate                        | Primary outcome        |
| Average rounds                  | Match duration         |
| Integrity differential          | Damage balance         |
| Component-disable rate          | Volatility indicator   |
| First-round immobilisation rate | Early-luck indicator   |
| Critical-hit rate               | Raw critical frequency |
| Damage dealt per fighter        | Offence balance        |
| Outcome variance across seeds   | Seed sensitivity       |
| Winner integrity distribution   | Decisiveness measure   |

### Candidate Rule Changes

Do not select a rule merely because it reduces randomness. Preserve combat drama while reducing single-roll dominance.

| Proposal                                                                                                                     | Rationale                                                | Risk                                                 |
| ---------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- | ---------------------------------------------------- |
| Component disable requires prior component damage ("damaged" state before "disabled")                                        | No first-hit disable; damage must accumulate             | Adds state complexity                                |
| Disable probability scales with effective damage dealt in that hit                                                           | Big hits more likely to disable; chip damage less so     | May favour high-damage weapons further               |
| Armour zone value influences component exposure (e.g., 0 armour = higher disable chance)                                     | Rewards armour investment                                | May already be partially true via damage calculation |
| Critical hits always deal damage; component disable is a separate subsequent roll                                            | Separates "big hit" from "permanent consequence"         | Adds a roll; slightly more complex                   |
| `reinforced_drive` reduces mobility-disable probability by a fixed factor                                                    | Existing utility becomes more meaningful                 | May become mandatory pick                            |
| First-round disable protection (cannot disable in round 1)                                                                   | Eliminates most egregious luck case                      | Feels arbitrary; masks design flaws                  |
| Repairable "damaged" state: damaged component functions at reduced effectiveness for 1 round, then recovers unless hit again | Adds tactical depth; disables require sustained pressure | Complexity; unclear UI/replay impact                 |

### Recommended Evaluation Order

1. Run benchmark on current rules against the seed bank. Establish baseline.
2. Prototype "damaged before disabled" as the smallest change that directly addresses first-hit disables.
3. Re-run benchmark. Compare distributions.
4. If insufficient, add scaling with effective damage.
5. Evaluate `reinforced_drive` interaction last (utility balance is secondary to core mechanic).

---

## 5. Opponent Archetypes

A small deterministic opponent suite. Every opponent must have a canonical build, canonical policy, intended strength, intended weakness, versioned fixture, and no model API dependency.

| ID           | Name        | Chassis | Weapon             | Strength                             | Weakness                       | Policy                           |
| ------------ | ----------- | ------- | ------------------ | ------------------------------------ | ------------------------------ | -------------------------------- |
| `bulwark`    | The Bulwark | heavy   | ram                | Frontal assault durability           | Zero rear armour, slow turning | rush, close, 85% aggression      |
| `skirmisher` | Iron Cicada | light   | grappler           | Speed, flanking, rear targeting      | Low integrity, fragile         | flank, close, 70% aggression     |
| `crusher`    | Hammerfall  | heavy   | hammer             | Top-armour damage, overturn threat   | Slow, cooldown-reliant         | cautious, medium, 55% aggression |
| `spinner`    | Whirlwind   | medium  | horizontal_spinner | High knockback, burst damage         | High heat, long cooldown       | rush, close, 75% aggression      |
| `controller` | Lockdown    | medium  | grappler           | Control, reposition, forced exposure | Low base damage                | cautious, close, 60% aggression  |
| `generalist` | Sentinel    | medium  | flipper            | Balanced stats, overturn threat      | No extreme specialisation      | hold, medium, 65% aggression     |

Each archetype should be stored as a versioned fixture (e.g., `data/opponents/bulwark.v1.json`) with its canonical build and policy. The existing Bulwark scripted agent should be adapted to load from the fixture rather than hardcoded.

---

## 6. Evaluation Protocol

For each AI design generation:

1. Evaluate the original design against the seed bank (100+ fixed seeds) against **each** opponent archetype.
2. Generate grounded review context from the aggregate results (not a single match).
3. Redesign once.
4. Evaluate the redesign against the **same** seed bank (training seeds).
5. Evaluate the redesign against **held-out** seeds (different fixed bank, never shown to the AI).
6. Compare statistically: win-rate change, integrity differential change, disable-rate change.
7. Record adaptation cost (API calls, tokens, USD).
8. Measure design diversity (is the AI converging on one dominant design?).
9. Detect opponent overfitting (does improvement against one opponent harm another?).

### Acceptance Criteria (Proposed)

A redesign counts as improved when:

- Minimum **+10 percentage-point** win-rate improvement on training seeds against at least one opponent.
- No greater than **5-point regression** on held-out seeds for any opponent.
- Improvement demonstrated against **at least two opponent archetypes**.
- Win-rate change exceeds the standard deviation of the baseline.

These thresholds are proposals to be reviewed after baseline data is collected. They may be adjusted if they prove too strict or too lenient.

### Statistical Notes

- 100 seeds per pairing give ~±10% confidence interval for win rate.
- Held-out seeds must be fixed and versioned — never regenerated.
- A single match (Prototype 0.1 style) is insufficient evidence of improvement.
- Design diversity should be tracked: if the AI always converges to heavy+spinner, the system may be rewarding a single dominant strategy rather than adaptation.

---

## 7. Implementation Milestones

### Milestone 0.2A — Benchmark Harness ✅ COMPLETED (2026-07-27)

**Scope:** Fixed seed bank, batch simulation runner, statistical report generator. No gameplay changes.

**Deliverables:**

- ADR-003: Deterministic Seed-Bank Evaluation Protocol (`docs/ADR-003-seed-bank-evaluation.md`)
- Seed fixture: `data/seeds/benchmark-100-v1.json` (80 dev / 20 held-out)
- Benchmark module: `src/bench/` (types, seed-bank, runner, metrics, report renderer)
- CLI: `npm run benchmark -- --partition development|held-out|all`
- Tests: `tests/unit/seed-bank.test.ts`, `tests/unit/benchmark.test.ts`

**Exclusions:** Arena changes, rule changes, new opponents, adaptation loop changes.

**Affected modules:** New `src/bench/` module; `src/app/run-benchmark.ts`.

**Schema implications:** New benchmark result schema.

**Version implications:** None — no gameplay changes.

**Tests:** Seed bank determinism, batch output consistency, statistical calculation correctness.

**Acceptance criteria:**

- 100 seeds stored in versioned fixture.
- Batch run completes all pairings without error.
- Statistical report includes all metrics from §4.
- Report is deterministic for same inputs.

**Rollback:** Remove `src/bench/` directory. No effect on gameplay.

---

### Milestone 0.2A.1 — Benchmark Correctness Hardening ✅ COMPLETED (2026-07-28)

**Scope:** Correctness hardening for the deterministic benchmark harness. The completed work fixes canonical mirror outcome accounting, role-slot metric calculation, and result checksum coverage without changing gameplay.

**Version implications:** None — simulator, ruleset, catalogue, and seed-bank fixture remain frozen.

---

### ADR-002 — Component Damage and Disable Lifecycle ✅ ACCEPTED (2026-07-28)

- Decision record: `docs/ADR-002-component-damage-lifecycle.md`
- Candidate threshold set A: `10` critical / `35` normal (benchmark-tuned, not permanent).
- The accepted 0.2B lifecycle implementation is complete in the current repository.
- Candidate Set A failed qualification in the Bulwark mirror benchmark: zero component state transitions.
- Candidate B1-B3 rejected analytically; Candidate C selected in `docs/ADR-002-tuning-amendment-candidate-B.md` (Accepted for Candidate C implementation; implementation not started).

---

### Milestone 0.2B — Component-State Refinement ⚠️ QUALIFICATION/BALANCE ACCEPTANCE DEFERRED

**Scope:** Damaged vs disabled states, revised critical logic, simulator/ruleset version bump, benchmark comparison against 0.1 baseline.

**State:** The `healthy → damaged → disabled` lifecycle mechanism, v2 match schema, replay, reporting, and benchmark measurement support are implemented. Candidate Set A and Candidate B1-B3 failed analytically. The lifecycle qualification candidates C1, C2, and AB2 exist; C2 is the unchanged experimental runtime default and is not an accepted final balance solution. AB2 is development-passed but held-out-rejected and permanently ineligible for default promotion.

**Completion gate:** Milestone 0.2B's lifecycle mechanism is implemented, but its qualification/balance acceptance remains unresolved and deferred. The original held-out partition is spent and cannot validate another candidate; further qualification cycles require a separately authorised evaluation with a fresh held-out partition (see the handoff section below). This milestone is not complete.

**Exclusions:** Positioning changes, new opponents.

**Affected modules:** `src/simulator/damage.ts`, `src/simulator/reducer.ts`, `src/simulator/types.ts`, `src/simulator/constants.ts`, `src/replay/` (new event types).

**Schema implications:** New event types for component damage, possible new conditions.

**Version implications:** `SIMULATOR_VERSION` → 0.2.0, `RULESET_VERSION` → 0.2.0.

**Tests:** Component lifecycle unit tests, regression against 0.1 seed bank (comparing distributions, not exact outcomes), benchmark report comparison.

**Acceptance criteria:**

- First-round disable rate reduced by ≥50% vs 0.1 baseline.
- Component disables still possible (game retains drama).
- No design wins ≥90% of matches against any opponent (balance check).
- All 0.1 matches remain replayable under their original versions.

**Rollback:** Restore 0.1 damage/component logic. Drop new event types or version-gate them.

---

### Milestone 0.2C — Positioning Model (3×3 Grid) 🚧 IN PROGRESS — GRID RUNTIME OPT-IN, NOT DEFAULT

**Phase status (2026-08-01):**

- Milestone 0.2C has **started** and remains **not complete**.
- **Phase 1 geometry foundation is complete**: ADR-001 accepted
  (`docs/ADR-001-positioning-representation.md`) and the pure geometry module
  `src/simulator/arena-grid.ts` shipped with exhaustive tests
  (`tests/unit/arena-grid.test.ts`, 48 tests).
- **Phase 2 persistence/replay foundation is complete**: grid match schema v3
  (`src/schemas/match-record.schema.ts`), positioning schemas
  (`src/schemas/positioning.schema.ts`), version-aware replay dispatch
  (`src/replay/positioning-model.ts`), 3×3 ASCII renderer and dispatcher
  (`src/replay/ascii/grid-arena-snapshot-renderer.ts`,
  `src/replay/ascii/arena-renderer.ts`), and grid-aware state reconstruction
  (`src/replay/ascii/state-reconstructor.ts`).
- **Phase 3A opt-in grid runtime core is complete**: `runGridMatch` provides a
  full deterministic grid match (movement, actions, planar exposure/targeting,
  knockback and grapple repositioning, shared damage/component/victory core)
  with explicit simulator `0.3.0` / `grid-3x3-v1` identity, persisting schema
  v3. Grid movement, actions, exposure, damage integration, knockback and
  grapple integration are implemented in this opt-in runtime.
- **Phase 3B runtime hardening is complete**: runtime identities are frozen at
  runtime (`Object.freeze`, not just `readonly`); zone type and identity
  profiles are paired; the grid version contract
  (`0.3.0 / grid-3x3-v1 / ruleset 0.2.0 / catalogue 1`) is enforced by
  `runGridMatch` and the v3 schema; the record converter validates before
  returning; and positional effects are planned simultaneously from the common
  post-movement snapshot.
- **Phase 3B.1 momentum correction is complete**: grid ram charge momentum is
  granted **only** to a translated `advance` (`getGridMovementMomentum`); a
  translated `retreat`, `circle_left`, `circle_right`, `hold` or any future
  lateral action never receives charge momentum. Legacy momentum semantics are
  unchanged.
- **Phase 3C deterministic lateral/flank integration is complete**:
  `circle_left`/`circle_right` are genuine translated lateral movement in the
  opt-in grid runtime (frozen tangent vectors, deterministic candidate
  ranking, facing toward the opponent, blocked/same-cell in-place rotation),
  and the existing `opening: "flank"` policy drives grid lateral movement via
  a pure deterministic selector (desired planar target + tactical score, no
  RNG). No new movement-action values or policy fields were added.
- The grid runtime exists and identifies itself as simulator `0.3.0`; the
  **active/default application runtime is still legacy `0.2.0`**.
- `SIMULATOR_VERSION` `0.3.0` has **not** been activated globally (still
  `0.2.0`); the grid runtime is **not wired into normal application paths**
  (CLI, series, battle or application commands).
- Grid schema v3 and grid replay are implemented; current normal matches still
  produce schema v2 legacy records.
- Translated lateral movement is implemented in the opt-in grid runtime only;
  legacy `circle_left` / `circle_right` remain turn-in-place.
- Default grid activation: **not performed**; Milestone 0.2C is **not
  complete** pending a separately authorised activation-readiness decision.

**Scope:** New arena representation, movement events, facing and rear advantage, replay updates, policy updates.

**Exclusions:** Opponent suite, evaluation protocol changes.

**Affected modules (completed):** `src/simulator/arena-grid.ts` (new), `src/simulator/grid-runtime.ts` (new), `src/simulator/grid-lateral.ts` (new — canonical lateral/flank module), `src/simulator/runtime-identity.ts` (new), `src/simulator/simulator.ts` (generic `runMatchForZone` + `MatchRuntimeAdapter`), `src/simulator/reducer.ts` (generic `applyRoundForZone` + `PositioningAdapter`), `src/simulator/damage.ts` (grid attack path), `src/simulator/actions.ts` (grid action derivation + flank intent), `src/simulator/types.ts` (zone/identity profile types), `src/schemas/match-record.schema.ts` (schema v3), `src/schemas/positioning.schema.ts` (new), `src/persistence/match-converter.ts` (v3 routing + converter validation), `src/replay/positioning-model.ts` (new), `src/replay/ascii/grid-arena-snapshot-renderer.ts` (new), `src/replay/ascii/arena-renderer.ts` (new), `src/replay/ascii/state-reconstructor.ts`, `src/replay/zone-format.ts` (new), `src/replay/text-replay-renderer.ts`.

**Schema implications:** Schema v3 is defined and produced for opt-in grid
matches (identity `0.3.0` / `grid-3x3-v1`); normal application matches still
produce schema v2. The v3 schema enforces the grid version contract and
canonical grid positioning facts.

**Version implications:** The grid runtime identifies as simulator `0.3.0`;
`SIMULATOR_VERSION` / `RULESET_VERSION` global constants remain `0.2.0`,
catalogue `1`. No global version bump is performed.

**Tests:** Phase 1: exhaustive pure geometry tests. Phase 2: positioning schema
consistency, match-record v3 (validation, round trips, version guards, event
positioning facts), replay dispatch, grid ASCII renderer, dispatcher, grid
state reconstruction, legacy regression, zone formatting. Phases 3A/3B: grid
runtime integration, runtime identity hardening, runtime-profile type tests,
version-contract tests, converter-boundary tests, positional-symmetry tests,
grid correctness matrix, legacy regression. Phase 3B.1: grid momentum truth
table and round-level momentum regression. Phase 3C: exhaustive lateral
geometry tests (all nine actor cells × all nine opponent cells × four facings ×
both circle directions), flank-policy selector tests, and round/persistence/
replay integration tests for translated circling.

**Acceptance criteria (correctness-test evidence):**

- Lateral movement (east/west edges) reaches centre or adjacent edges — **has
  correctness-test evidence** (Phase 3C exhaustive lateral sweep and explicit
  east/west corner routes).
- Fighter can reach a position behind opponent in ≥3 moves from starting edge —
  **has correctness-test evidence** (Phase 3C rear-route test: south →
  south_west → west → north_west exposes rear of a south-facing centre
  opponent in three translated moves).
- ASCII grid renders all 9 zones clearly — **has correctness-test evidence**
  (Phase 2/3A renderer and reconstruction tests; Phase 3C ASCII replay shows
  translated positions).
- Flank policy produces lateral movement when tactically appropriate — **has
  correctness-test evidence** (Phase 3C flank selector tests and the flank-vs-
  hold opt-in match that emits translated circle events).

Balance or activation acceptance is **not** marked: no balance conclusions and
no default activation were performed.

**Rollback:** Restore 5-zone arena. Version-gate new zone values. All grid
phases are additive and opt-in: `runGridMatch` and the v3 schema can be
removed without touching live legacy behaviour (normal matches remain
`runMatch` / schema v2).

---

### Milestone 0.2D — Opponent Suite

**Scope:** Versioned deterministic archetypes, tournament runner, cross-opponent reports.

**Exclusions:** Adaptation evaluation, rule changes.

**Affected modules:** New `data/opponents/` fixtures, `src/agents/scripted/` (refactor Bulwark to load from fixture), new `src/app/run-tournament.ts`.

**Schema implications:** Opponent fixture schema.

**Version implications:** New fixture version field.

**Tests:** Each opponent produces deterministic behaviour; tournament runner produces correct cross-table; no opponent calls external API.

**Acceptance criteria:**

- 6 opponents available as versioned fixtures.
- Tournament runner evaluates one design against all 6 opponents.
- Cross-opponent report shows win/loss/draw per opponent.
- Bulwark behaviour unchanged from 0.1 (validated against canonical series).

**Rollback:** Remove new fixtures and tournament runner. Bulwark agent unchanged.

---

### Milestone 0.2E — Adaptation Evaluation

**Scope:** Baseline vs redesign comparison, held-out seeds, overfitting detection, confidence report.

**Exclusions:** New gameplay mechanics.

**Affected modules:** `src/bench/` (extended), `src/reports/` (adaptation report).

**Schema implications:** Adaptation evaluation report schema.

**Version implications:** None if no gameplay changes.

**Tests:** Held-out seed independence, overfitting detection correctness, statistical threshold validation.

**Acceptance criteria:**

- System can run full evaluation protocol from §6.
- Held-out seed results are never exposed to AI review context.
- Overfitting detection flags designs that improve on training but regress on held-out.
- Report includes confidence intervals for all metrics.

**Rollback:** Remove adaptation report module.

---

## 8. Architecture Decision Records (ADRs)

Decision questions to resolve before implementation. Recommended order reflects dependencies.

| #       | ADR                                | Question                                                                                                                                                                                                                                                                                                                                                 | Depends on                  |
| ------- | ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- |
| ADR-001 | Positioning representation         | **Accepted for phased implementation:** 3×3 grid frozen in `docs/ADR-001-positioning-representation.md`; Phases 1–3C implemented (geometry, schema v3/replay, opt-in grid runtime core, hardening, momentum correction, lateral/flank integration). The grid runtime is opt-in (`runGridMatch`, simulator `0.3.0`); default activation remains deferred. | Nothing                     |
| ADR-002 | Component damage lifecycle         | **Accepted:** healthy→damaged→disabled. Candidate C1 is implemented and viable for lifecycle coverage, but 0.2B acceptance awaits split gates and diagnostic fixtures.                                                                                                                                                                                   | Volatility benchmark (0.2A) |
| ADR-003 | Deterministic seed-bank evaluation | Fixed seeds, sample size, held-out protocol?                                                                                                                                                                                                                                                                                                             | Nothing                     |
| ADR-004 | Multi-opponent fixture format      | How are opponent builds and policies stored and versioned?                                                                                                                                                                                                                                                                                               | Nothing                     |
| ADR-005 | Simulator version compatibility    | How do old matches replay under new rules? Version-gating vs separate code paths?                                                                                                                                                                                                                                                                        | ADR-001, ADR-002            |
| ADR-006 | Adaptation success metrics         | What thresholds define improvement? How is overfitting detected?                                                                                                                                                                                                                                                                                         | ADR-003                     |

Recommended order: ADR-003 and ADR-004 can be resolved immediately (they are independent). ADR-001 is accepted for phased implementation; Phases 1–3C (geometry, schema v3/replay, opt-in grid runtime core, hardening, momentum correction, lateral/flank integration) are complete and the grid runtime is opt-in with default activation deferred. ADR-002's lifecycle and Candidate C qualification architecture are accepted; Candidate C1 is implemented, but split gate approval and diagnostic fixture confirmation remain outstanding. ADR-005 depends on decisions made in ADR-001 and ADR-002. ADR-006 is last — it needs the evaluation protocol defined.

---

## Candidate C1 implementation status (2026-07-29)

Candidate C1 (`component-impact-c1`) is implemented with armour factor `0.20`, minimum impact `0`, critical threshold `11`, and high-impact threshold `13`. Qualification uses canonical raw damage and struck-zone armour before component selection. Facts are persisted in attack/component events, match metadata, replay/report output, and benchmark metadata.

The unchanged development partition produced 80 simulations, 1,255 successful hits, 164 qualifying hits, 81 damaged transitions, 19 disabled transitions, 64 resisted events, 0% destruction, 5% immobilisation, 95% judges, 15 draws, 19.79 average rounds, and a 20-round maximum. It fails the destruction, judges, average-round, and round-cap hard gates. No constants were tuned, no C2 was created, and held-out seeds were not inspected. Milestone 0.2B remains incomplete.

## Candidate C1 Development Failure Diagnosis

The authoritative event stream shows that C1 is not a null lifecycle candidate.
Its 164 qualifying hits produced 164 selections: 64 reinforced-drive
resistances, 81 healthy-to-damaged transitions, and 19
damaged-to-disabled transitions. The terminal mix was 4 mobility and 15 weapon
disables; every mobility disable ended its match. Qualification converted to a
state transition at 60.98%, to resistance at 39.02%, and to a terminal disable
at 11.59%.

The failed finish distribution has two independent causes:

1. Bulwark versus Bulwark includes 160 starting reinforced-drive guards.
   Sixty-four were spent and none were lost. Thirty-six matches spent one guard
   and 14 spent both. A persisted-selection analytical counterfactual indicates
   21 additional fighter mobility disables and 19 additional match outcomes
   without resistance, but it is not a simulated no-utility result.
2. All 1,255 successful hits dealt exactly one integrity damage. Starting from
   150 integrity, a fighter can receive at most 20 such hits in 20 rounds.
   Structural destruction is therefore mathematically impossible under the
   frozen pairing, policy, damage, armour, and cap.

Seventy-seven matches (96.25%) reached round 20. Fifty-two had fewer than the
three total qualifications minimally required to disable guarded mobility, 48
had damage but no disable, 50 spent a guard, and 55 damaged a weapon. Damaged
weapons made 205 successful hits in later rounds with zero further
qualifications. These overlapping mechanisms explain the 76 judge decisions.

To put judges below 45%, 41 currently judged matches would need to become
non-judge finishes. With destruction unavailable, that means 41 additional
match-ending mobility disables and a total immobilisation rate of 56.25%. A
bounded Poisson/selection model estimates that five qualifying hits per match
still yield only 24.58% immobilisation. About 8.2 are needed for 56%, at which
point terminal-disable incidence is about 93.22% and violates the accepted
`< 85%` gate. First-round immobilisation remains structurally zero because the
accepted lifecycle has no healthy-to-disabled path and each fighter can receive
only one selection in round one.

The nominal 70% critical rate is a separate sensitivity concern. The observed
rate was 72.27%; all 164 qualifications were critical-qualified, only two also
met the high-impact branch, and no hit qualified through high impact alone.
Holding the high threshold at 13, a one-point critical-threshold decrease would
raise qualifications from 164 to 259, while a one-point increase would reduce
them to 59. Critical-rate review belongs in a future ADR/balance task and is not
part of 0.2B completion.

### Gate and fixture plan

Classify first-round immobilisation and terminal-disable incidence as
component-lifecycle gates. Classify structural destruction, judge rate,
finish-method dominance, average rounds, and maximum rounds as
whole-combat-balance gates. Overall immobilisation, draw rate, and round-cap
incidence are opponent-fixture-dependent gates.

Select **Option D: combined split and fixture suite**:

- keep the Bulwark mirror as the hard high-armour/reinforced-drive lifecycle
  stress fixture;
- add a benchmark-only no-utility Bulwark mirror, based on the existing valid
  heavy/tracks/ram/`none` configuration, to isolate lifecycle progression;
- use the committed Glass Cannon mirror as a low-armour over-aggression
  diagnostic;
- defer formal asymmetric heavy-versus-light acceptance and broader
  finish-distribution targets to Milestone 0.2D.

Proposed 0.2B hard gates are: first-round immobilisation below 13.2%, terminal
disable incidence below 85%, non-zero damaged and terminal transitions, no
healthy-to-disabled transition, correct damaged/disabled mobility semantics,
observable damaged-state penalties, observable but non-universal
reinforced-drive resistance, no gross selectable-component terminal dominance,
historical v1/v2 replay compatibility, and factual transition reconstruction.
Qualifying-hit incidence, transition incidence and mix, resistance rate,
immobilisation, and average length remain diagnostics rather than finish-balance
gates.

The decision outcome is:

> **B. Candidate C1 is viable, but the 0.2B gates must be split or re-scoped
> before acceptance.**

C1 is retained pending revised gates and fixture diagnostics. It is neither
permanently accepted nor rejected, and C2 is not justified. Milestone 0.2B
remains incomplete. The next task is to approve the split gate definition and
freeze benchmark-only no-utility and Glass Cannon fixtures; it must not tune
constants or combine critical-rate review.

## Split Acceptance Gates and Frozen Diagnostic Fixture Suite

The split model is now implemented. Qualification-only 0.2B hard acceptance
covers transition legality, damaged/disabled mobility semantics, non-zero
qualification and both lifecycle stages, guarded/unguarded resistance,
qualification-before-selection randomness, legacy replay compatibility, C1
factual completeness, first-round immobilisation below 13.2%, terminal-disable
incidence below 85% in every hard fixture, and no component above 70% of suite
terminal disables when at least ten exist. Glass Cannon additionally requires
first-round terminal-disable incidence below 25%.

Structural destruction at least 10%, overall immobilisation 40%-75%, judges
below 45%, finish-method dominance below 85%, average rounds 4-12, and round-cap
incidence at most 10% are preserved but superseded for 0.2B lifecycle
acceptance. They remain future whole-combat objectives for positioning,
damage/armour, weapon, duration, and multi-opponent balance work.

The versioned, development-only manifest is
`data/bench-fixtures/component-lifecycle-v1/suite.json`:

| Fixture                    | Classification | Purpose                                  | Simulations |
| -------------------------- | -------------- | ---------------------------------------- | ----------: |
| `bulwark-guarded-mirror`   | Hard           | High-armour/reinforced-drive stress      |          80 |
| `bulwark-unguarded-mirror` | Hard           | High-armour progression without a guard  |          80 |
| `glass-cannon-mirror`      | Hard           | Low-armour over-aggression density       |          80 |
| `bulwark-vs-glass-cannon`  | Diagnostic     | Armour differentiation and role swapping |         160 |

The guarded fixture remains byte-for-behavior equivalent to the canonical
Bulwark. The unguarded build differs only in utility. Glass Cannon reuses the
committed transition-test definition. None are public opponents or API-backed
agents. `npm run benchmark:lifecycle` rejects held-out and all-partition
requests.

Development results:

| Fixture      | Hits / qualifying | Resisted | Damaged / disabled | Terminal incidence | Outcomes D/I/J | Average rounds / cap |
| ------------ | ----------------- | -------: | ------------------ | -----------------: | -------------- | -------------------- |
| Guarded      | 1,255 / 164       |       64 | 81 / 19            |              22.5% | 0 / 4 / 76     | 19.79 / 96.3%        |
| Unguarded    | 1,074 / 147       |        0 | 111 / 36           |              42.5% | 0 / 21 / 59    | 17.69 / 73.8%        |
| Glass Cannon | 355 / 345         |        0 | 215 / 130          |         **100.0%** | 24 / 47 / 9    | 7.08 / 6.3%          |
| Asymmetric   | 931 / 554         |       18 | 301 / 235          |  100.0% diagnostic | 73 / 87 / 0    | 8.00 / 1.3%          |

All event invariants, mobility semantics, factual completeness, guard behavior,
first-round gates, and compatibility checks pass. The suite terminal mix is
mobility 260, weapon 160, utility 0; the 61.90% maximum passes the 70% ceiling.
The only hard failure is Glass Cannon terminal-disable incidence: all 80 matches
contained a terminal disable, exceeding the strict `<85%` gate despite zero
first-round terminals.

The selected outcome is:

> **B. Candidate C1 fails revised lifecycle gates and requires one bounded
> tuning candidate.**

C1 is not development-passed. No C2 was created, no held-out match was
executed, and Milestone 0.2B remains incomplete. A later bounded-candidate task
may tune against the same frozen suite. Whole-combat finish objectives and
critical-rate review remain separate.

Suite checksum: `04fe9aeb6cd48dbe`.

## Candidate C2 bounded tuning result (2026-07-30)

The C1 fixture diagnosis confirmed a qualification-density failure in the low-armour fixture: Glass Cannon had 345/355 qualifying hits (97.2%), 81 non-critical qualifications, and 100% terminal-disable incidence, while guarded and unguarded Bulwark had 13.1% and 13.7% qualification rates with 22.5% and 42.5% terminal incidence. The failure was not caused by every successful hit qualifying.

Three immutable-fact hypotheses were compared: C2-A (`0.20 / 12 / 14`) gave Glass Cannon 333/355 qualifications; C2-B (`0.20 / 13 / 15`) gave 312/355; C2-C (`0.20 / 12 / 15`) gave 328/355. An armour factor of `0.30` with C1 thresholds collapsed both Bulwark fixtures to zero qualifications. C2-B was selected as the strongest bounded threshold increase that retained positive qualification in every hard fixture.

C2 is `component-impact-c2`, with armour factor `0.20`, minimum `0`, critical threshold `13`, and high-impact threshold `15`. The unchanged development suite produced 400 simulations: guarded Bulwark 2 qualifying hits and 2 resisted events but zero damaged transitions; unguarded Bulwark 2 qualifying hits and 2 damaged transitions; Glass Cannon 333 qualifying hits, 214 damaged transitions, 119 disabled transitions, and 97.5% terminal incidence; the diagnostic asymmetric fixture produced 519 qualifying hits and 233 disabled transitions. Suite checksum: `7c734547c93214f5`.

Decision: **B. Candidate C2 improves Glass Cannon but still fails one or more lifecycle gates.** The guarded progression and Glass Cannon terminal gates fail; all factual, lifecycle legality, guard, first-round, dominance, and historical compatibility gates pass. No C3, automatic retuning, or held-out execution is permitted. Milestone 0.2B remains incomplete.

## Candidate C2 cross-armour scaling diagnosis (2026-07-30)

The C1/C2 evidence is preserved in ADR-002. The global linear signal leaves
Bulwark impacts at 4-13 and Glass Cannon impacts at 11-24. C2's critical
threshold 13 yields two guarded-Bulwark qualifications; threshold 12 would
analytically expose 67. Glass remains densely qualified because its high branch
alone covers 299/391 C2 hits. A bounded 0-25 static threshold enumeration does
not prove every pair impossible, but it leaves no demonstrated safe global
solution and must not be used to select a lucky C3.

Glass Cannon's 97.5% terminal incidence is accumulated across rounds, not
same-round double progression: C2 observed at most one component transition
per fighter per round. Its two selectable front components, no guard, short
lifecycle, and repeated qualifying attacks make it an extreme diagnostic,
despite its useful over-aggression signal.

Decision **C**: both qualification shape and fixture strategy require
amendment. A future approved task must separate fixture identity from an
immutable runtime qualification registry, add a representative light-armour
hard fixture, and retain Glass Cannon as an anti-instant-volatility diagnostic.
No runtime constants, fixtures, seeds, gates, lifecycle states, held-out
partition, or external API use changed here. No C3 is authorised; Milestone
0.2B remains incomplete.

## Qualification registry and Strategy-4 fixture architecture (2026-07-30)

The architecture step is complete. The immutable runtime registry preserves C1
(`component-impact-c1`, checksum `2a40a56f97062ca3`) and C2
(`component-impact-c2`, checksum `13548462df34a183`), with C2 remaining the
default. Match events, benchmark reports, lifecycle reports, and factual
metadata identify the selected configuration and checksum. Fixture manifests
no longer select qualification behavior.

The frozen development fixture definition now has checksum
`ffc11deb47e6049f`. It adds the hard `representative-light-mirror` fixture:
two Light Vanguard builds with 50 total armour, wheels, a ram, no utility, and
a restrained rush policy. Glass Cannon remains unchanged but is reclassified
as an extreme diagnostic; its anti-instant-volatility first-round gate remains
hard.

Both registered configurations were run over the five-fixture development
suite, 480 simulations each:

| Qualification | Representative qualifying | Damaged / disabled | Terminal incidence | Suite checksum     |
| ------------- | ------------------------: | -----------------: | -----------------: | ------------------ |
| C1            |                 292 / 362 |          188 / 104 |              92.5% | `3289f1c9e4ab8398` |
| C2            |                 271 / 402 |           176 / 95 |              87.5% | `801981a42474b5b6` |

The historical guarded, unguarded, Glass Cannon, and asymmetric outcome
checksums are unchanged under their respective C1/C2 configurations. Neither
registered configuration passes the revised hard suite: representative-light
terminal incidence is too high, and guarded Bulwark still lacks
healthy-to-damaged progression.

Decision **A** for this architecture step: use fixed struck-zone armour bands
as the implementation-ready shape for a future qualification candidate:
exposed `0-9`, light `10-24`, protected `25-49`, and heavy `50+`. Impact
remains linear inside each band; thresholds are band data, not fixture,
chassis, or competitor exceptions. This is a Proposed design only. No C3 or
active armour-band configuration exists, held-out execution remains
prohibited, and Milestone 0.2B remains incomplete.

## 9. Final Recommendation

### First Milestone: 0.2A — Benchmark Harness

**Why first:** Rules should not be changed before their current behaviour is measured. The benchmark harness gives us a quantitative baseline for every subsequent change. Without it, we cannot distinguish genuine improvement from placebo — the exact problem that limits Prototype 0.1's conclusions.

**What must remain frozen:**

- Simulator logic (0.1.2)
- Ruleset (0.1.0)
- Catalogue (v1)
- All Prototype 0.1 match and series records
- The canonical validation series `16eae0af`

**What evidence is required before changing movement or critical-hit rules:**

- Baseline win-rate distribution across ≥100 seeds for each design pairing.
- Component-disable rate, first-round disable rate, and integrity differential distributions.
- Confirmation that observed Prototype 0.1 outcomes (3–1 series win) fall within expected variance for the seed set.
- If the benchmark shows that the AI's 3–1 result is a ≥2σ outlier, design changes may be less significant than they appear — which would strengthen the case for reducing volatility.

**Expected 0.2A output:**

- A `data/seeds/benchmark-100.json` fixture.
- A batch runner producing a `bench-results.json` report.
- Statistical summary: win rates, disable rates, round distributions, integrity differentials.
- Comparison of Bulwark vs Bulwark (mirror match baseline) against AI vs Bulwark.
