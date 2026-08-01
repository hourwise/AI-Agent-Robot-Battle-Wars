# Decisions

## D29: Armour-band Candidate AB2 development passage (2026-07-31)

`component-impact-ab2` is the sole new immutable candidate, checksum
`6b9f70450d3f10b8`, preserving C1/C2 and C2's default status. It uses fixed
struck-zone bands `0-9`, `10-24`, `25-49`, and `50+` with critical/high
thresholds `17/20`, `15/18`, `13/15`, and `11/13`. The temporary identity
`component-impact-ab1` and checksum `4ccfa5e666b0d4fb` were superseded.

Exactly one 480-simulation development suite ran against the unchanged fixture
manifest and seed bank. Fixture checksum remained `ffc11deb47e6049f`; suite
checksum was `951cdbe01132b06c`. Guarded and unguarded resistance were 64 and 0,
representative-light terminal incidence was 58.8%, all hard first-round
terminal rates were 0%, and maximum suite component-terminal share was 52.98%.
Factual, replay, guard, lifecycle, and qualification-before-selection gates
passed. Decision **A**: AB2 passes all revised development lifecycle gates.
Held-out execution was not part of this decision; it was later authorised
exactly once (D31) and the partition is now permanently sealed (D32).

## D31: AB2 held-out confirmation failure (2026-07-31)

The separately authorised held-out command ran exactly once for AB2, using 20
held-out seeds and 120 simulations. Candidate checksum remained
`6b9f70450d3f10b8`, fixture checksum remained `ffc11deb47e6049f`, and the
held-out suite checksum was `4ea2fe4423a0de8c`. Guarded Bulwark had 18 damaged,
3 disabled, and 18 resisted events; unguarded Bulwark had 32 damaged, 6
disabled, and zero resistance. Representative light had 40 damaged and 19
disabled transitions with 85.0% terminal incidence.

All other hard and general gates passed, but the strict representative-light
terminal-disable requirement is `<85%`, so Decision **B** applies. AB2 remains
unchanged and C2 remains the runtime default. No tuning, default promotion, or
final Milestone 0.2B completion was performed. No individual held-out seed or
per-match result is recorded. This decision is finalised and sealed by D32.

## D32: AB2 evaluation closed and held-out suite resealed (2026-07-31)

The AB2 evaluation is closed. Decision B is final and the strict `<0.85`
representative-light terminal-incidence gate will not be retroactively relaxed.
No AB3 (or any further candidate) search will be performed against the spent
validation evidence. Further qualification tuning is deferred until positioning
and multi-opponent evaluation provide a broader combat distribution.

The original held-out partition is spent and can never validate another
candidate. AB2 is frozen and retained for historical reproducibility only; it
is permanently ineligible for default promotion and no later task may promote
it. The temporary `--confirm-held-out` authorisation path has been removed:
`--partition held-out` and `--partition all` are rejected before seed selection
or simulation, and the historical confirmation flag cannot reopen the
partition. C2 remains the unchanged experimental runtime default and is not an
accepted final balance solution. Milestone 0.2B's lifecycle mechanism is
implemented, but its qualification/balance acceptance remains unresolved and
deferred; 0.2B is not marked complete.

Any future qualification cycle requires:

- a new immutable candidate ID;
- a newly predeclared development protocol;
- a genuinely fresh held-out partition;
- creation or custody of that held-out partition outside the candidate-design AI context;
- one-time execution only after the candidate is frozen.

No individual seed values or per-match held-out records are recorded here.

## D33: 3×3 positioning representation accepted for phased implementation (2026-07-31)

Milestone 0.2C Phase 1 freezes the positioning representation. Option A, the
discrete 3×3 grid, is accepted (ADR-001,
`docs/ADR-001-positioning-representation.md`):

- Canonical zone IDs: `north_west`, `north`, `north_east`, `west`, `center`,
  `east`, `south_west`, `south`, `south_east`, with immutable integer
  coordinates in the `-1..1` range (north increases `y`, east increases `x`).
- One ordinary movement step is orthogonal only (`north`, `east`, `south`,
  `west`); diagonal cells cannot be entered diagonally in one step. Two
  fighters may share a cell.
- Deterministic traversal order is frozen as `north → east → south → west`.
  Out-of-bounds movement is explicit (`null`) and never wraps.
- Path distance (Manhattan) and combat proximity (Chebyshev: `close` 0,
  `medium` 1, `far` 2) are distinct, explicit concepts.
- Relative bearing is defender-relative (`same`, `front`, `front_right`,
  `right`, `rear_right`, `rear`, `rear_left`, `left`, `front_left`),
  computed from the attacker's cell delta rotated into the defender's facing
  frame.
- Planar armour exposure is frozen (`front`, `left`, `right`, `rear`; `same`
  exposes `front`/`left`/`right`; top is weapon-specific and excluded).
- The legacy five zones (`north_edge`, `south_edge`, `east_edge`, `west_edge`,
  `center`) remain version-bound and authoritative for 0.1/0.2 matches; the
  conceptual migration mapping is for a future versioned boundary only and is
  not applied to live matches.
- Phase 1 adds only the pure geometry module `src/simulator/arena-grid.ts` and
  its exhaustive tests. It produces no live gameplay change; C1/C2/AB2,
  qualification checksums, the live five-zone simulator, match schemas and
  replay behaviour are all unchanged. Simulator/ruleset/catalogue remain
  `0.2.0 / 0.2.0 / 1`.

Milestone 0.2C is started but not complete: the authoritative runtime
migration, simulator `0.3.0`, match schema v3, replay migration, ASCII 3×3
rendering and policy-driven lateral movement all remain outstanding.

## D34: Grid match schema and versioned replay foundation (2026-07-31)

Milestone 0.2C Phase 2 defines the persistence and replay foundation for the
future 3×3 runtime without changing authoritative combat:

- `MatchRecord` schema v3 is defined for grid records: it requires
  `schemaVersion: "3"` and an explicit `positioningModel: "grid-3x3-v1"`,
  uses canonical grid zones in initial fighter states, retains the full v2
  component representation, and validates positioning facts inside
  `movement_resolved` and `round_ended` events.
- The positioning model is explicit (`grid-3x3-v1`; v1/v2 remain implicitly
  `legacy-five-zone-v1`). `center` exists in both models, so the model is
  never inferred from zone values.
- v1 and v2 records remain legacy and unchanged; v1/v2 accept legacy zones,
  reject grid-only corners, and are never rewritten during deserialisation.
- Replay dispatch uses record identity only: v1/v2 → `legacy-five-zone-v1`;
  v3 → `grid-3x3-v1`. Raw current `0.2.0` results resolve explicitly to the
  legacy model.
- Both ASCII renderers now exist: the existing five-zone renderer (preserved
  byte-for-byte) and a new deterministic 3×3 renderer with same-cell
  occupancy and fixed-width layout, selected by a version-aware dispatcher.
- State reconstruction accepts an explicit positioning model; grid mode
  reconstructs all nine zones and rejects legacy edge values.
- Current matches still produce schema v2 legacy records; no normal
  application path produces schema v3, and `mapLegacyZoneToGridZone` is never
  used for automatic conversion.
- No live gameplay migration occurred: the five-zone simulator, movement,
  actions, damage, armour exposure, knockback and component behaviour are
  unchanged, and simulator/ruleset/catalogue remain `0.2.0 / 0.2.0 / 1`.

Milestone 0.2C status: Phase 1 geometry foundation complete; Phase 2
persistence/replay foundation complete; authoritative runtime migration not
started; simulator `0.3.0` not active; grid movement/action/damage integration
not implemented; policy-driven lateral movement not implemented. Milestone
0.2C is not complete.

## D35: Opt-in deterministic grid combat runtime core (2026-07-31)

Milestone 0.2C Phase 3A implements the full deterministic 3×3 grid combat core
as an **opt-in** runtime that must not become the default:

- **Explicit in-memory runtime identity**: `MatchResult` carries a required
  `runtime` identity — legacy `{ simulatorVersion: "0.2.0",
positioningModel: "legacy-five-zone-v1" }`, grid
  `{ simulatorVersion: "0.3.0", positioningModel: "grid-3x3-v1" }`. Replay
  dispatch and persistence routing read this identity directly; the model is
  never inferred from zone strings (`center` exists in both models).
- **Legacy/grid state separation**: `FighterCoreState` is position-independent;
  `ZoneFighterState<Z>` is the core plus a zone; grid uses `GridZone`, legacy
  uses `ArenaZone`. There is no mixed-zone union for runtime functions.
- **Shared core**: the deterministic match loop, round reducer, component
  lifecycle, energy/heat, victory and event production are shared through
  generic `PositioningAdapter<Z>` and `MatchRuntimeAdapter<Z>` contracts.
  Legacy behaviour is byte-for-byte identical (lifecycle checksums and the
  full legacy test surface unchanged).
- **Deterministic grid movement**: `advance` steps along the frozen
  `north → east → south → west` shortest path; `retreat` picks the
  greatest-distance orthogonal neighbour (NESW ties); circle/hold turn or
  preserve in place; movement never wraps. RNG consumption order (movement
  first, then combat roll) is preserved.
- **Grid distance/actions**: distance uses combat proximity (Chebyshev
  `close`/`medium`/`far`); `deriveGridAction` uses the grid proximity band; no
  new policy fields are introduced.
- **Grid exposure/targeting**: defender-relative bearing → planar armour
  zones; hammer additionally exposes `top`; hit zone resolves
  primary → secondary → front.
- **Knockback and grapple repositioning**: deterministic greatest-distance
  neighbours; grid grapple repositions the target one shortest-path step
  toward the attacker and is emitted as `movement_resolved` with
  `action: "grapple"` and `targetId`; reconstruction treats `knockback` and
  `grapple` as target-repositioning movements.
- **Opt-in entry point**: `runGridMatch(config)` returns a `GridMatchResult`
  with `0.3.0` / `grid-3x3-v1` identity. The normal application still calls
  `runMatch` (legacy) and persists schema v2; `runGridMatch` is not wired into
  CLI, series, battle or application commands.
- **Persistence by identity**: legacy results persist as schema v2; grid
  results persist as schema v3 with `positioningModel: "grid-3x3-v1"`.
  Invalid identity combinations are rejected; `mapLegacyZoneToGridZone` is
  never used for automatic conversion.
- **No balance conclusions**: Phase 3A makes no grid-vs-legacy balance claims.

Status: Phase 3A grid runtime core complete and tested (781 tests total, 54
new). Authoritative runtime migration is **not** performed: `SIMULATOR_VERSION`
and `RULESET_VERSION` remain `0.2.0`, catalogue `1`, C2 remains the runtime
default, and normal persistence remains schema v2. Policy-driven lateral
movement is unimplemented. Milestone 0.2C is not complete.

## D36: Grid runtime hardening — identity, version contract and positional symmetry (2026-08-01)

Milestone 0.2C Phase 3B hardens the opt-in grid runtime before any
policy-driven lateral movement or default activation. It makes the grid runtime
**no closer to the default**: `SIMULATOR_VERSION`/`RULESET_VERSION` remain
`0.2.0`, catalogue `1`, normal application commands still use legacy `runMatch`,
and normal persistence still produces schema v2.

- **Runtime identities are frozen at runtime**: `LEGACY_RUNTIME_IDENTITY`
  (`0.2.0` / `legacy-five-zone-v1`) and `GRID_RUNTIME_IDENTITY` (`0.3.0` /
  `grid-3x3-v1`) are `Object.freeze`d in `src/simulator/runtime-identity.ts`.
  A caller cannot modify an identity through a returned result, and an
  attempted mutation of one match result cannot affect later matches.
- **Zone type and identity profiles are paired**: the discriminated runtime
  profile (`LegacyZoneProfile` / `GridZoneProfile` / `ZoneRuntimeProfile`) and
  `RuntimeIdentityFor<Z>` make it impossible to pair `ArenaZone` with the grid
  identity, `GridZone` with the legacy identity, legacy initial zones with a
  grid profile, or grid-only corners with a legacy profile through normal
  typed use (compile-time `@ts-expect-error` assertions).
- **Grid version contract**: `0.3.0 / grid-3x3-v1 / ruleset 0.2.0 /
catalogue 1`. The positioning change is a _simulator_ version change and does
  not introduce a new balance ruleset, so `runGridMatch` rejects any
  configuration whose `rulesetVersion` is not `0.2.0` or whose
  `catalogueVersion` is not `1`. The v3 schema enforces `simulatorVersion`
  `0.3.0`, `positioningModel` `grid-3x3-v1`, and agreement between top-level and
  config `rulesetVersion`, `catalogueVersion` and `seed` (v3-only; v1/v2 keep
  their historical validation).
- **Record conversion validates before returning**: `matchResultToRecord`
  validates every constructed v2/v3 record with its authoritative schema and
  throws a clear error on an invalid record at the converter boundary — before
  repository access — instead of relying on save-time validation.
- **Simultaneous positional effects**: both fighters' knockback/grapple
  destinations are planned from the common post-movement snapshot
  (`PlannedReposition<Z>`); A-before-B remains **event ordering only**, not
  positional initiative. The legacy adapter keeps its historical
  sequential-origin behaviour via `planFromSharedSnapshot: false` and is proven
  byte-for-byte unchanged (lifecycle checksums and the legacy test surface are
  unchanged; legacy grapple still does not reposition; legacy persistence
  remains v2).
- **Grid correctness matrix**: a bounded deterministic unit/integration matrix
  (not the benchmark harness) covers all five weapons, three chassis, three
  mobility types, guarded/unguarded utilities, front/side/rear/diagonal/
  same-cell exposure, normal movement/knockback/grapple, and damaged/disabled
  components — proving no exceptions, canonical zones, valid v3 records,
  replay reconstruction of final positioning and deterministic repetition.
- **Legacy runtime remains unchanged**; the grid runtime remains opt-in through
  `runGridMatch` only.
- **No balance conclusions were made** in Phase 3B. No constants, seeds,
  fixtures, checksums (C1 `2a40a56f97062ca3`, C2 `13548462df34a183`, AB2
  `6b9f70450d3f10b8`) or partitions changed; C2 remains the default.

Status: Phase 1 geometry complete; Phase 2 persistence/replay complete; Phase
3A grid runtime core complete; Phase 3B activation hardening complete;
policy-driven lateral movement **not implemented**; default grid activation
**not performed**; Milestone 0.2C **not complete**.

## D37: Grid movement momentum restricted to translated advance (2026-08-01)

Milestone 0.2C Phase 3B.1 corrects a gameplay-contract defect found in the
opt-in grid runtime before any policy-driven lateral movement or default
activation:

- **Grid movement momentum is granted only to translated `advance`.** The
  frozen rule is `action = advance AND translated = true → momentum 1`; every
  other combination yields `0`. It is implemented as the named pure function
  `getGridMovementMomentum(action, translated)` in
  `src/simulator/grid-runtime.ts`, which the grid positioning adapter calls
  via `momentumFor`.
- **Retreat and lateral/circle movement never receive charge momentum.** A
  translated `retreat`, `circle_left`, `circle_right`, `hold`, or any future
  lateral action must never receive ram charge momentum. Synthetic
  `translated: true` cases for circle and hold are tested intentionally to
  protect the invariant against future movement changes.
- **The previous adapter implementation was corrected before lateral
  movement.** The Phase 3A/3B adapter awarded momentum for any translated
  movement (`translated ? 1 : 0`), which would have granted charge momentum to
  a translated retreat. This was corrected now, before lateral movement
  exists.
- **Legacy momentum semantics remain unchanged.** The legacy adapter keeps its
  historical rule (momentum only on `advance`), and the legacy event streams,
  persistence (schema v2) and component-lifecycle checksums are unchanged.
- **No balance conclusion or tuning was performed.** This is a contract
  correction only: no weapon, damage, armour, qualification or global
  constants changed; no benchmark partition ran; seeds and fixtures are
  unchanged.

Status: Phase 1 geometry complete; Phase 2 persistence/replay complete; Phase
3A grid runtime core complete; Phase 3B activation hardening complete; Phase
3B.1 momentum correction complete; policy-driven translated lateral movement
**not implemented**; default grid activation **not performed**; Milestone 0.2C
**not complete**.

## D38: Deterministic grid lateral movement and flank-policy integration (2026-08-01)

Milestone 0.2C Phase 3C implements genuine lateral grid movement using the
existing `circle_left` / `circle_right` movement actions and the existing
`opening: "flank"` policy field. No new movement-action values and no policy
fields or schema changes were introduced; the grid runtime remains opt-in.

- **Translated circle semantics**: in the opt-in grid runtime,
  `circle_left`/`circle_right` translate one orthogonal cell along the frozen
  tangent vectors (`circle_left (-dy, dx)`, `circle_right (dy, -dx)` for
  actor-to-opponent `(dx, dy)`), excluding the opponent's cell, never
  diagonally and never wrapping.
- **Deterministic candidate ranking**: smallest absolute Chebyshev-distance
  change to the opponent, then greatest positive tangent dot product, then the
  frozen north→east→south→west order; a translated circle faces toward the
  opponent from the destination.
- **Blocked and same-cell in-place rotation**: when no lateral candidate exists
  or the fighters share a cell, the fighter rotates in place (left/right)
  without translating, exactly as the Phase 3A fallback.
- **Existing `opening: "flank"` now drives grid lateral movement**: after
  early-state rules (overturned, overheated, disabled mobility, retreat
  threshold, heat threshold) which override flanking, the grid flank selector
  advances at far range, holds when sharing a cell or when the desired planar
  target is already exposed, and otherwise previews both circle directions and
  selects the higher deterministic tactical score.
- **Desired target selection and tactical scoring**: the desired planar target
  is `primaryTarget` when `left`/`right`/`rear`, else `secondaryTarget` when
  `left`/`right`/`rear`, else `rear`. The pure score is desired-target exposed
  +100, secondary planar target +20, rear exposed +30, either side exposed +10,
  translated +1, and preferred-range fit +8; exact ties choose `circle_left`.
- **No policy fields or movement actions were added**; the policy schema is
  unchanged.
- **Flank selection consumes no RNG**: movement is chosen before the combat
  roll, and the combat selection uses the existing cooldown/aggression/seeded
  roll unchanged.
- **Circle movement never receives ram momentum**: the Phase 3B.1 momentum
  rule (only translated `advance`) is unchanged.
- **Legacy circling remains unchanged**: translated lateral movement exists
  only in the opt-in grid runtime; the legacy runtime keeps turn-in-place
  circling, and its event streams, persistence (schema v2) and component
  checksums are unchanged.
- **Grid runtime remains opt-in** through `runGridMatch` (persists schema v3);
  the normal application still uses legacy `runMatch`.
- **No balance conclusions were made**: no weapon, damage, armour, hit chance,
  qualification or global constants changed; no benchmark partition ran; seeds
  and fixtures are unchanged.

Status: Phase 1 geometry complete; Phase 2 persistence/replay complete; Phase
3A grid runtime core complete; Phase 3B activation hardening complete; Phase
3B.1 momentum correction complete; Phase 3C lateral/flank integration complete;
default grid activation **not performed**; Milestone 0.2C **not complete**
pending a separately authorised activation-readiness decision.

## D39: Version-aware factual reporting and series compatibility foundation (2026-08-01)

Milestone 0.2C Phase 3D1 makes the reporting, AI-review and adaptive-series
contracts capable of **representing** grid matches without changing any legacy
record. Grid matches remain opt-in; no normal command produces a grid report or
grid series; `runSeries` stays v1-only. No policy schema, seeds, fixtures or
benchmark partitions changed.

- **Factual-report v1 is the frozen legacy contract, unchanged**: `schemaVersion`
  `"1"`, legacy five-zone fighter states, persisted cooldown fields, grid-only
  corners rejected; the deprecated `FactualMatchReportSchema` /
  `FactualMatchReport` aliases keep every legacy caller compiling.
- **Factual-report v2 represents an opt-in grid match only**: `schemaVersion`
  `"2"` with the frozen grid identity (`simulatorVersion` `0.3.0`,
  `positioningModel` `grid-3x3-v1`, `rulesetVersion` `0.2.0`,
  `catalogueVersion` `1`), the nine canonical grid zones, and **no**
  `weaponCooldown`/`utilityCooldown` because the event stream cannot
  reconstruct precise final cooldowns.
- **Builders dispatch through the explicit immutable runtime identity**, never
  zone strings: legacy `0.2.0`/`legacy-five-zone-v1` → v1; grid
  `0.3.0`/`grid-3x3-v1` → v2; invalid pairings are rejected.
- **A canonical movement-event subject rule is shared by reporting and replay**:
  `getMovementEventSubjectId` maps `knockback` and `grapple` to `targetId` and
  every ordinary movement action to `actorId`, returning `null` for malformed
  events so a broken event never silently moves the wrong fighter. Grid grapple
  is therefore target movement in both reporting and replay.
- **Final-state projection is shared, pure and never invents facts**:
  `projectFinalFighterState` walks the event stream (integrity damage,
  movement via the canonical subject rule, component damaged/disabled
  incl. immobilisation, damage-resisted guard, overturns, overheat/recovery)
  and then applies the latest authoritative `round_ended` facts; a zone outside
  the active model is rejected rather than guessed.
- **AI review/rebuild accept either version**: prompts, fallback review and
  `validateReviewAgainstFacts` work for v1 and v2; v1 prompt rendering is
  byte-identical (raw zones), v2 adds the simulator identity line and
  human-readable grid zone names, and grid corners are never called "edges".
- **Series v1 is the unchanged legacy contract** and remains the only record
  `runSeries` produces.
- **Series v2 is a reserved single-runtime grid contract**: one immutable
  runtime identity per series (`0.3.0`/`grid-3x3-v1`/ruleset `0.2.0`/catalogue
  `1`, match-record schema v3, factual-report schema v2) with cross-field
  validation (seed agreement, matchId agreement, runtime agreement, unique
  matchIds/match numbers, score ≤ entries). Repository and report rendering
  handle both versions; v2 reports render a `Runtime:` identity line.
- **No CLI/application grid activation**: no explicit grid canary, no grid
  runtime default; `runMatch`/`runSeries` and normal persistence stay legacy.
- **No balance conclusions were made**: no weapon, damage, armour, hit chance,
  qualification or global constants changed; no benchmark partition ran; seeds
  and fixtures are unchanged.

Status: Phase 1 geometry complete; Phase 2 persistence/replay complete; Phase
3A grid runtime core complete; Phase 3B activation hardening complete; Phase
3B.1 momentum correction complete; Phase 3C lateral/flank integration complete;
Phase 3D1 reporting/series compatibility foundation **complete**; explicit grid
application canary **not implemented**; default grid activation **not
performed**; Milestone 0.2C **not complete** pending a separately authorised
activation-readiness decision.

## D40: Reporting boundary and series traceability hardening (2026-08-01)

Milestone 0.2C Phase 3D1.1 closes three narrow contract gaps identified in the
Phase 3D1 review — unknown/malformed movement actions falling through to
`actorId`, projected final conditions retaining an event-owned array, and
series v2 not verifying that its factual report belongs to the same match as
the entry and match summary. No grid canary or default activation was
introduced.

- **Movement-event actions are explicitly enumerated**: `MovementEventAction`
  is exactly `advance`, `retreat`, `circle_left`, `circle_right`, `hold`,
  `knockback`, `grapple` with the runtime guard `isMovementEventAction`;
  `MovementResolvedData.action` uses the canonical type. Arbitrary strings are
  never treated as movement actions.
- **Unknown or malformed movement actions have no subject**: the canonical
  `getMovementEventSubjectId` is an explicit exhaustive switch (knockback and
  grapple → `targetId`; the five normal actions → `actorId`; unknown, missing,
  non-string or malformed action, or a non-movement event → `null`). There is
  no "everything else is actor movement" branch; an unknown action with a
  valid `actorId` or `targetId` still returns `null`, and a known normal
  action without `actorId`, or knockback/grapple without `targetId`, also
  returns `null`.
- **Reporting and replay both ignore malformed movement**: both use the shared
  helper, so malformed movement events cannot move either fighter and are
  never silently reinterpreted as `hold`; the input event remains unchanged.
- **Final-state projection retains no event-owned mutable references**:
  `projectFinalFighterState` clones/copies build, component state, armour,
  binary component flags and conditions; round-end conditions are validated
  and copied, never referenced. Isolation tests prove mutation of either side
  cannot leak across.
- **Movement facing is validated**: a present but invalid facing is rejected
  (only `north`/`east`/`south`/`west`); the current facing is preserved only
  when the facing field is genuinely absent.
- **Round-end conditions are validated and copied**: an array of canonical
  conditions (`overturned`, `immobilised`, `overheated`, `stunned`) is
  required; unknown condition strings are rejected; deterministic ordering is
  preserved; no condition is inferred or added beyond authoritative events and
  component rules. This hardening applies to event-to-report projection; old
  valid legacy reports remain readable.
- **Both report builders validate against their schemas before returning**:
  `buildFactualReport` validates with `FactualMatchReportV1Schema` and
  `buildGridFactualReport` with `FactualMatchReportV2Schema`, returning the
  parsed valid report. A clear boundary error identifies the report version,
  the schema failure and the construction boundary, catching malformed
  reconstructed zones, facing, conditions, component/lifecycle facts and fixed
  grid identity fields before review formatting, fallback review, series
  construction or persistence. Valid legacy v1 output and prompt snapshots are
  preserved.
- **Series-v2 entry, match summary and factual report share one match UUID**:
  `entry.matchId = entry.match.matchId = entry.factualReport.matchId`. The
  standalone factual-report builders may initially produce `matchId: "pending"`
  during pre-persistence construction (the v2 report schema still permits it);
  a persisted grid-series entry must reference its real persisted match UUID,
  so `"pending"`, empty or malformed report IDs are rejected.
- **Series-v2 match summaries agree with factual reports**: `rounds`, `winner`
  and `resultMethod` must match between the match summary and the factual
  report; the established seed, runtime and positioning agreements remain
  required. These stricter cross-field rules are series-v2-only; series v1 is
  untouched.
- **Current match and series application paths remain legacy**: `runMatch`
  still produces legacy results, `runSeries` still calls legacy `runMatch` and
  creates match-record v2, factual-report v1 and series-record v1; normal
  review prompts remain v1; grid match records remain v3 and grid factual
  reports remain v2; no grid series is produced by an application path.
- **No grid canary or default activation occurred**: no grid CLI command,
  runtime-selection flag, grid adaptive-series runner or default activation was
  added; no combat, movement, damage, exposure or victory behaviour changed;
  no policy schema or prompt changed; no benchmark partition ran; seeds and
  fixtures are unchanged; no external API calls were made; no balance
  conclusion or tuning was performed.

Status: Phase 1 geometry complete; Phase 2 persistence/replay complete; Phase
3A grid runtime core complete; Phase 3B activation hardening complete; Phase
3B.1 momentum correction complete; Phase 3C lateral/flank integration complete;
Phase 3D1 reporting/series compatibility foundation **complete**; Phase 3D1.1
reporting hardening **complete**; explicit grid application canary **not
implemented**; default grid activation **not performed**; Milestone 0.2C **not
complete** pending a separately authorised activation-readiness decision.

## D24: Candidate C component-impact qualification

Accepted for Candidate C implementation. The separate component-impact architecture remains selected. Candidate B1-B3 were rejected analytically against the frozen 80-seed Bulwark mirror; Candidate C1 (`component-impact-c1`) is selected with `COMPONENT_ARMOUR_FACTOR = 0.20`, `COMPONENT_MIN_IMPACT = 0`, `CRITICAL_COMPONENT_IMPACT_THRESHOLD = 11`, and `HIGH_COMPONENT_IMPACT_THRESHOLD = 13`. Implementation is complete, but the development benchmark failed, so Milestone 0.2B is not complete.

Implementation is complete but development benchmark confirmation failed, so Milestone 0.2B is not complete and held-out confirmation remains prohibited.

### D25: Candidate C1 development result

Candidate C1 ran against the unchanged 80-seed development partition only. It produced 164 qualifying hits versus the analytical estimate of 161, 81 damaged transitions, 19 disabled transitions, 64 resisted events, 0% destruction, 95% judges, and 19.79 average rounds. The small qualification-count divergence is expected from live combat paths and qualification-before-selection PRNG consumption. Hard gates failed; no automatic tuning or held-out execution is authorised.

### D26: Candidate C1 Development Failure Diagnosis

**Decision outcome B:** Candidate C1 is viable, but the 0.2B gates must be split
or re-scoped before acceptance. Select the combined split-and-fixture-suite
strategy.

The development event stream supports this decision:

- 164 qualifying hits produced 64 reinforced-drive resistances, 81
  healthy-to-damaged transitions, and 19 damaged-to-disabled transitions;
- 4 mobility disables caused 4 immobilisations; 15 weapon disables and no
  utility disables completed the terminal mix;
- 160 guards started available, 64 were spent, none were lost, and 50 matches
  spent at least one;
- an analytical no-guard transformation of persisted selections suggests 21
  additional fighter mobility disables and 19 additional match outcomes, but
  is not a simulation;
- every one of 1,255 successful hits dealt the one-damage minimum. A fighter
  can receive at most 20 damage in 20 rounds against 150 starting integrity, so
  structural destruction is mathematically impossible in this fixture;
- 77/80 matches reached round 20. Moving judges below 45% requires 41
  additional match-ending mobility disables;
- the bounded incidence model reaches only 24.58% immobilisation at five
  qualifications per match. Reaching about 56% requires about 8.2 and predicts
  93.22% terminal-disable incidence, violating the `< 85%` gate;
- all 164 qualifications used the critical branch. The high-impact branch added
  zero exclusive qualifications, and a one-point critical-threshold change
  creates a large 259/164/59 qualification cliff.

Statements B and C are supported: the guarded high-armour mirror is unsuitable
as the sole acceptance fixture, and several finish-distribution gates require
whole-combat mechanics outside qualification-only 0.2B. Statement A is only
partially supported: C1 is conservative for guarded mobility finishes, but
tuning cannot make destruction possible or reconcile the judge and terminal
incidence gates.

Hard 0.2B gates should cover lifecycle semantics, non-zero damaged and terminal
transitions, first-round volatility, terminal-disable incidence,
reinforced-drive observability, gross component dominance, replay
compatibility, and factual reconstruction. Structural destruction, judges,
draws, finish dominance, and match length move to whole-combat or
fixture-dependent diagnostics.

Keep the Bulwark mirror as a hard guarded stress fixture. Add a benchmark-only
no-utility Bulwark fixture using the existing valid heavy/tracks/ram/`none`
configuration, retain the committed Glass Cannon mirror as a diagnostic, and
defer formal role-swapped heavy-versus-light acceptance to Milestone 0.2D.

C1 is retained pending revised gates and fixture diagnostics. It is not
permanently accepted or rejected. C2 is not justified, critical-rate review is
a separate future ADR/balance task, and Milestone 0.2B remains incomplete.

### D27: Split 0.2B gates and freeze lifecycle fixture suite

Accepted the combined split-and-fixture strategy from D26. Qualification-only
0.2B hard gates now cover lifecycle state legality, damaged/disabled mobility
semantics, non-zero qualification and both transition stages,
guarded/unguarded resistance, qualification-before-selection randomness,
historical replay, C1 factual completeness, first-round volatility,
per-hard-fixture terminal incidence below 85%, and suite component-terminal
dominance at or below 70% when at least ten disables exist.

The former destruction, overall immobilisation, judges, finish dominance,
average-round, and round-cap gates remain in the audit trail but are superseded
for 0.2B lifecycle acceptance. They are retained as future whole-combat balance
objectives.

Frozen benchmark-only suite `component-lifecycle-v1`:

- guarded Bulwark mirror: hard, 80 development simulations;
- unguarded Bulwark mirror: hard, 80;
- Glass Cannon mirror: hard, 80;
- guarded Bulwark versus Glass Cannon: diagnostic, role-swapped, 160.

The 400-simulation development run passed every event invariant, factual,
compatibility, guard, first-round, and dominance gate. Guarded and unguarded
terminal incidence were 22.5% and 42.5%. Glass Cannon qualified 345/355 hits and
had terminal disables in 80/80 matches. Its 100% incidence fails the strict
`<85%` gate, although first-round terminal incidence was zero.

Decision outcome:

> **B. Candidate C1 fails revised lifecycle gates and requires one bounded
> tuning candidate.**

Candidate C1 is not development-passed. No new candidate is created by this
decision. Held-out confirmation remains prohibited and Milestone 0.2B remains
incomplete. Suite checksum: `04fe9aeb6cd48dbe`.

### D28: Candidate C2 bounded cross-fixture tuning result

Candidate C2-B was selected from three immutable-fact analyses: `COMPONENT_ARMOUR_FACTOR = 0.20`, `CRITICAL_COMPONENT_IMPACT_THRESHOLD = 13`, and `HIGH_COMPONENT_IMPACT_THRESHOLD = 15`. It reduced Glass Cannon analytical qualification from 97.2% to 87.9% while preserving positive qualification in both Bulwark fixtures. A factor-only alternative at 0.30 produced zero Bulwark qualifications and was rejected.

The implementation uses `component-impact-c2` and leaves damage, armour absorption, critical probability, selection, guard, lifecycle, match cap, fixtures, and seed bank unchanged. The development suite result was guarded `2` qualifying / `0` damaged / `2` resisted, unguarded `2` / `2` / `0`, and Glass Cannon `333` / `214` / `119` with 97.5% terminal incidence. The guarded progression and Glass Cannon terminal gates failed; factual completeness, lifecycle legality, guard semantics, first-round, dominance, and historical replay gates passed. Decision B: no C3 or automatic retuning; held-out confirmation remains prohibited. Suite checksum: `7c734547c93214f5`.

### D29: Cross-armour qualification architecture and fixture strategy

Preserve C1 (`component-impact-c1`, suite `04fe9aeb6cd48dbe`) and C2
(`component-impact-c2`, suite `7c734547c93214f5`) as auditable historical
configurations. Their fixture and seed-bank identities remain unchanged.

**Decision C:** both qualification shape and fixture strategy require
amendment. The current monotonic linear impact thresholds leave high-armour
Bulwark at impacts 4-13 and low-armour Glass Cannon at 11-24. The bounded
development-fact analysis identifies severe one-point cliffs but does not
authorise an unrestricted search or C3. An armour-sensitive qualification shape
requires a separate ADR amendment before implementation.

Glass Cannon remains evidence of over-aggression (C1 100%, C2 97.5% terminal
incidence), but its original guaranteed-transition, no-utility, 5-front-armour
mirror role makes it an extreme diagnostic rather than the sole representative
light-armour hard fixture. Future strategy: add a representative light-armour
hard fixture and retain Glass Cannon with an anti-instant-volatility diagnostic
gate; do not weaken current gates automatically.

Future configuration architecture is an immutable runtime registry selected by
ID, with fixture manifests describing only competitors and policies. The future
CLI shape is `benchmark:lifecycle --partition development --qualification
component-impact-c1`; reports must carry a canonical configuration checksum.
That work, fixture approval, and any later candidate are separate tasks.
Held-out execution remains prohibited and Milestone 0.2B remains incomplete.

### D30: Qualification registry, representative light fixture, and armour-band gate

Decision **A**: the architecture step is complete and a fixed struck-zone
armour-band model is implementation-ready for a separate future candidate.

The immutable registry preserves `component-impact-c1`
(`2a40a56f97062ca3`) and `component-impact-c2` (`13548462df34a183`), with C2
as the default. Fixture manifests are qualification-independent, while match
events and factual, benchmark, and suite reports carry the selected
configuration checksum. Unknown IDs fail before simulation.

The revised development fixture definition has checksum
`ffc11deb47e6049f`. It adds the hard, 80-match
`representative-light-mirror` fixture and reclassifies unchanged Glass Cannon
as an extreme diagnostic with a hard first-round anti-instant-volatility gate.
C1 and C2 each ran 480 development simulations. Their suite checksums are
`3289f1c9e4ab8398` and `801981a42474b5b6`; historical fixture outcome
checksums remain unchanged. Representative-light terminal incidence was 92.5%
under C1 and 87.5% under C2, so neither registered configuration passes.

The Proposed future shape uses inclusive struck-zone armour bands: exposed
`0-9`, light `10-24`, protected `25-49`, and heavy `50+`, with linear impact
inside each band and explicit per-band thresholds. It may not branch on
fixture, chassis, competitor, or build name. No banded runtime entry, C3,
automatic tuning, seed change, or held-out execution is authorised by this
decision. Milestone 0.2B remains incomplete.

| Date       | Decision                                                                              | Rationale                                                                                                                                                                                                                                   | Alternatives considered                                                                                                                                        |
| ---------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-07-26 | D1: Five-zone ring arena with derived distance                                        | Positional play, circling, flanking and knockback are core to the concept. Distance derived from zones prevents state contradictions.                                                                                                       | Distance-bands only (simpler but removes spatial tactics)                                                                                                      |
| 2026-07-26 | D2: Fighters start at opposing edges, facing each other                               | Clear readable layout, both fighters one round from engagement. Starting sides may be swapped by seed.                                                                                                                                      | Starting in center (too close for tactical opening)                                                                                                            |
| 2026-07-26 | D3: Simultaneous action selection, speed-ordered movement, simultaneous attack damage | Speed affects positioning without granting first-strike kill. Fair and readable.                                                                                                                                                            | Fully sequential attacks (speed too dominant), fully simultaneous (no speed advantage at all)                                                                  |
| 2026-07-26 | D4: Static armour in v0.1                                                             | Component damage and integrity loss provide sufficient degradation. Simplifies first simulator.                                                                                                                                             | Degrading armour (deferred to future ruleset)                                                                                                                  |
| 2026-07-26 | D5: Weapon traits with momentum-based ram, stat-derived grappler/flipper              | Traits should scale with build stats, not be flat probabilities. Ram bonus only on movement rounds.                                                                                                                                         | Flat trait probabilities (simpler but less interesting)                                                                                                        |
| 2026-07-26 | D6: Component damage only on critical hits, zone-weighted                             | Normal hits should not always damage components. Critical-hit threshold adds tactical depth.                                                                                                                                                | Every hit rolls component damage (too frequent)                                                                                                                |
| 2026-07-26 | D7: Overheat forces defence, no integrity damage                                      | Heat penalty is tempo loss, not arbitrary self-damage. Makes heat management meaningful without being punishing.                                                                                                                            | Overheat + 5 damage (too punishing before balance is understood)                                                                                               |
| 2026-07-26 | D8: Normalised judges scoring with documented tie-break                               | Raw values in different ranges must be normalised before weighting. Tie-break order is deterministic.                                                                                                                                       | Unnormalised scoring (unfair across categories)                                                                                                                |
| 2026-07-26 | D9: Minimum 1 damage on successful damaging hit                                       | Prevents invulnerability and endless matches. Non-damaging control actions excluded.                                                                                                                                                        | Minimum 0 (allows full armour absorption)                                                                                                                      |
| 2026-07-26 | D10: Remove arenaHazardPreference from v0.1 policy                                    | Do not retain unused schema fields. Add when at least one real hazard exists.                                                                                                                                                               | Keep unused field (premature forward compatibility)                                                                                                            |
| 2026-07-26 | D11: Bulwark build validated through same validator                                   | Deliberately understandable, not perfectly optimised. 0 rear armour is the exploitable weakness.                                                                                                                                            | Heavily optimised build (hides the weakness)                                                                                                                   |
| 2026-07-26 | D12: Deterministic template-based ASCII visuals                                       | LLM-generated ASCII is excluded because it would be inconsistent, non-replayable and capable of depicting events that did not occur.                                                                                                        | LLM-generated art (inconsistent, non-deterministic), procedural generation (unpredictable)                                                                     |
| 2026-07-26 | D13: Review is advisory only, never alters a completed match                          | Separates deterministic facts from AI interpretation. A completed match is immutable.                                                                                                                                                       | Modifying match results based on review (breaks determinism)                                                                                                   |
| 2026-07-26 | D14: Rebuild reuses designMachine() with structured DesignRequest                     | Prior build and review context passed as structured fields, not unstructured text. Cleaner and more reliable.                                                                                                                               | Unstructured text prompts (unreliable, harder to validate)                                                                                                     |
| 2026-07-26 | D15: AI policy regenerated after every rebuild                                        | Policy should reflect the updated design and review context, not the previous design.                                                                                                                                                       | Reusing old policy (mismatched with new design)                                                                                                                |
| 2026-07-26 | D16: Max 5 matches, draws consume a match, series may end drawn                       | Clear win condition without excessive matches. Draws count as a full match.                                                                                                                                                                 | Best-of-7 (too many matches), no draw limit (could go indefinitely)                                                                                            |
| 2026-07-26 | D17: Comparative report computed from structured DesignDiff data                      | Deterministic diff calculation produces reproducible comparative reports.                                                                                                                                                                   | AI-generated diff (non-deterministic, could hallucinate differences)                                                                                           |
| 2026-07-26 | D18: Deterministic facts before AI interpretation — FactualMatchReport                | Pure code produces objective data; AI interprets it. Ensures reproducibility.                                                                                                                                                               | AI-only reporting (could misrepresent events)                                                                                                                  |
| 2026-07-26 | D19: Entry-oriented series records — each SeriesMatchEntry owns its data              | Each entry owns its match, report, review, design, policy, usage. Simpler data model, easier to serialize.                                                                                                                                  | Match-centric records (more complex, harder to serialize)                                                                                                      |
| 2026-07-26 | D20: Checkpoint persistence — atomic save after every stage                           | Prevents data loss on crash. Atomic writes ensure file integrity.                                                                                                                                                                           | Batch saves (risk of losing multiple stages on crash)                                                                                                          |
| 2026-07-26 | D21: Review and rebuild failure behaviour — fallback review, retain previous build    | Deterministic fallback ensures forward progress even when AI fails. Previous build reused on design failure.                                                                                                                                | Crashing on failure (blocks progress), using fallback design (too unpredictable)                                                                               |
| 2026-07-27 | D22: Deterministic seed-bank evaluation — committed 100-seed fixture, 80/20 split     | Fixed seeds make benchmarks reproducible. 80 dev / 20 held-out gives reasonable statistical power while keeping confirmation seeds isolated from AI context. Role-swapped evaluation for non-identical designs. Wilson 95% CI on win rates. | Random seeds per run (non-reproducible), larger bank (diminishing returns for 100-match benchmarks), 50/50 split (too few dev seeds for meaningful statistics) |     | 2026-07-28 | D23: Component damage lifecycle — healthy→damaged→disabled with qualification thresholds | ADR-002 accepted. Component lifecycles replace binary disabled state. Critical hits with effectiveDamage ≥ 10 OR normal hits ≥ 35 qualify for a state transition. No direct healthy→disabled path. Reinforced drive becomes a one-use mobility guard with explicit events. Central effective-stat helpers. Simulator/ruleset version 0.2.0. Thresholds 10/35 are candidate set A — benchmark-tuned, not permanent. Milestone 0.2B ready for implementation. | Binary disable on critical hit (too volatile), damage-scaled probability (retains one-roll risk), component durability points (premature for 3-component simulator), temporary repair (adds timer complexity before data justifies it) |     | 2026-07-28 | D23 (Proposed): ADR-002 component damage lifecycle — healthy → damaged → disabled | A two-transition lifecycle with deterministic damaged penalties and post-armour qualification directly addresses measured single-hit volatility while retaining targeting, armour value, and immobilisation. Awaiting approval before 0.2B implementation. | Component durability points, binary damage-scaled disable chance, temporary recovery, round-one immunity, and direct healthy-to-disabled catastrophes |
