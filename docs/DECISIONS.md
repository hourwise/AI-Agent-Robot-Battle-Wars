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

## D41: Isolated deterministic grid match canary (2026-08-01)

Milestone 0.2C Phase 3D2A introduces the first executable application-level
grid path: a deliberately isolated, deterministic, local-only **single-match
canary** proving the complete grid pipeline works operationally. The canary is
a separate explicit command; it changes no default application command and
adds no grid adaptive-series runner, no runtime selector and no default
activation.

- **The canary is a separate explicit command**: `npm run match:grid:canary
-- --seed <non-negative integer>` runs `src/app/run-grid-canary-match.ts`.
  The existing `match` and `series` scripts are unchanged; `runMatch` and
  `runSeries` are untouched. No general runtime-selection flag is added and
  grid is not made the default runtime.
- **It is local-only, deterministic and requires an explicit seed**: no random
  default seed is generated; the argument parser rejects missing, negative or
  non-integer seeds, duplicate seeds, unknown arguments, `--ai`, `--review`,
  runtime-selection flags and provider arguments. The canary re-executes the
  same seed and scenario and fails if the event stream differs, proving
  determinism. No external network or API call is ever made.
- **It uses a built-in no-combat flank scenario**: `grid-canary-flank-v1`
  (`src/canary/grid-canary-scenario.ts`) freezes Fighter A
  (`opening: flank`, `primaryTarget: rear`, `secondaryTarget: rear`,
  `preferredRange: medium`, `aggression: 0`, thresholds `0/100`,
  `fallback: defend`) and Fighter B (`opening: hold`, `front/front`,
  `aggression: 0`, thresholds `0/100`, `fallback: defend`), both using the
  Bulwark build. The scenario factory returns fresh build and policy values on
  every call. Fighter A advances then translatedly circles while Fighter B
  holds; both always defend, so no attack, damage or component event occurs
  and the match reaches the frozen round cap, resolving by judges as a draw.
  The flanking path produces observable grid-only positioning evidence:
  translated `circle_left`/`circle_right` events, a canonical corner visit
  (`north_west`), and a rear-adjacent flanking position relative to the
  stationary fighter (whose strict rear is off-grid because it holds at the
  north edge facing south).
- **It consumes only a direct `runGridMatch` result**: the service
  (`src/app/grid-match-canary.ts`) executes `runGridMatch` directly and never
  accepts imported match records or user-supplied event streams; persisted
  records are never used as the source from which combat is executed.
- **It produces match-record v3 and factual-report v2**: the result is
  converted with `matchResultToRecord` (schema v3 by grid identity) and
  reported with `buildGridFactualReport` (schema v2).
- **The factual report is bound to the actual persisted match UUID**: the pure
  helper `bindGridFactualReportToMatchRecord` (`src/reports/
grid-factual-report-binding.ts`) replaces the builder's `matchId: "pending"`
  with the record's real UUID, requiring both to be authoritative schema v2/v3
  with identical grid identity, seed, rounds, winner and result method, and
  rejecting every identity or factual mismatch without mutating its inputs.
  The helper is designed for later reuse by a grid-series canary.
- **Replay, report and record agreement is checked**: the final `round_ended`
  event, the factual-report final states and the canonical replay
  reconstruction must agree on both fighters' final zone (report and replay
  must also agree on facing and integrity); text replay and the version-aware
  3×3 ASCII replay render successfully.
- **Deterministic fallback review is exercised without provider access**: the
  existing `buildFallbackReview` shape is produced as a valid `MatchReview`
  (`confidence: low`, `"AI review unavailable."`) with no `ArenaAgent`,
  provider configuration, API key or external call.
- **Artifact bundles are isolated and atomically published**: each run writes
  only under `data/canary/grid-match/<canaryId>/` with the fixed artifact
  names (`match.json`, `factual-report.json`, `text-replay.txt`,
  `ascii-replay.txt`, `review-prompt.txt`, `fallback-review.json`,
  `manifest.json`). The bundle is constructed in a sibling `.tmp-<canaryId>`
  directory, `manifest.json` is written last, every artifact is read back and
  the machine-readable artifacts are revalidated, and the completed directory
  is atomically renamed. Existing canary directories are never overwritten; on
  any failure no final canary directory exists, the temporary directory is
  removed recursively and the original error is preserved. The canary manifest
  (`GridMatchCanaryManifestV1`) carries the frozen identity, the observed
  evidence and the fixed artifact-name block and contains no win rates,
  comparative performance, balance metrics or benchmark terminology.
- **No normal data directory or command is modified**: the canary never writes
  to `data/matches` or normal series storage, never updates a mutable
  "latest" pointer and never reuses a previous UUID; `data/canary/` is excluded
  from tracked source artifacts.
- **The canary is not a benchmark and produces no balance conclusion**: it is
  a correctness and operational pipeline check, not balance sampling; no
  benchmark partition ran, no benchmark seed or fixture changed, and held-out
  and `all` partitions remain sealed.
- **Grid adaptive-series execution is still not implemented**: no grid
  adaptive-series runner was added and no series-v2 record is produced by any
  application path.
- **Default activation is still not performed**: the normal application
  remains legacy (`SIMULATOR_VERSION`/`RULESET_VERSION` `0.2.0`, catalogue 1,
  match v2, factual-report v1, series v1); grid match records remain v3 and
  grid factual reports remain v2. C1/C2/AB2 checksums and qualification
  constants remain frozen with C2 the default.
- **No combat, policy or prompt changes**: no movement actions or policy
  fields were added; component qualification and lifecycle constants are
  unchanged; no balance conclusion or combat tuning is authorised.

Status: Phase 1 geometry complete; Phase 2 persistence/replay complete; Phase
3A grid runtime core complete; Phase 3B activation hardening complete; Phase
3B.1 momentum correction complete; Phase 3C lateral/flank integration complete;
Phase 3D1 reporting/series compatibility foundation complete; Phase 3D1.1
reporting hardening complete; Phase 3D2A isolated grid match canary
**complete**; grid canary series **not implemented**; default grid activation
**not performed**; Milestone 0.2C **not complete** pending a separately
authorised activation-readiness decision.

## D42: Canary evidence and artifact verification hardening (2026-08-01)

Milestone 0.2C Phase 3D2A.1 corrects three issues found in the Phase 3D2A
review before a grid adaptive-series canary is added: the manifest claimed rear
exposure it did not prove, bundle publication did not reread or cross-validate
all artifacts, and the exported service did not prevent callers from selecting
normal match or series storage as its output root. No simulator, policy or
combat semantics changed and no grid series was introduced.

- **The previous corner-adjacency proxy was not proof of rear exposure**: Phase
  3D2A inferred `rearExposureObserved: true` when the moving fighter reached a
  canonical corner adjacent to the stationary fighter. That proxy is removed.
- **Canonical bearings are now the only exposure evidence**: all exposure is
  derived through the existing `getRelativeBearing` and
  `getPlanarExposedArmourZones` functions; a corner's name or adjacency is
  never sufficient to infer exposure and no new bearing/exposure
  implementation was added.
- **The frozen scenario proves lateral side flanking and currently observes
  `right`**: fighter B holds at `north` facing `south`; fighter A's observed
  `north_west` position is defender-relative `right` (exposing `right`, not
  `rear`). The canary requires at least one canonical flank bearing
  (`left`, `right`, `rear_left`, `rear_right` or `rear`); `front_left` and
  `front_right` never count as a successful flank.
- **Strict rear exposure is reported separately and truthfully**: the evidence
  result replaces `rearExposureObserved: true` with
  `lateralFlankObserved` / `observedFlankBearings` /
  `strictRearExposureObserved`. `strictRearExposureObserved` is false for the
  frozen scenario and is set true only when the canonical exposed zones
  actually contain `rear`. Neither boolean is hard-coded; both are derived from
  inspected positions, and the frozen-scenario role invariants (fighter A
  translates, fighter B never changes cell, fighter B faces south, at least
  one translated circle, no combat events) are verified and fail closed.
- **Manifest v2 supersedes the pre-hardening manifest-v1 evidence contract**:
  `GridMatchCanaryManifestV2Schema` / `GridMatchCanaryManifestV2` require
  `lateralFlankObserved: true`, a non-empty unique `observedFlankBearings`
  array, a derived `strictRearExposureObserved` boolean,
  `stationaryFighterCellUnchanged: true`, `allArtifactsReadBack: true` and
  `bundleCrossAgreementPassed: true`, and never contain
  `rearExposureObserved`. Manifest-v1 types are retained only for historical
  inspection (`isGridMatchCanaryManifestV1`/`isGridMatchCanaryManifestV2`);
  version-aware deserialization may read both versions, but current bundle
  validation requires v2 and a v1 artifact is never accepted as current passing
  canary evidence. Artifacts produced by the pre-hardening Phase 3D2A commit
  are superseded and must not be treated as current canary proof.
- **Manifest v2 contains SHA-256 digests for all non-manifest artifacts**:
  `match`, `factualReport`, `textReplay`, `asciiReplay`, `reviewPrompt` and
  `fallbackReview` each carry a lowercase 64-char SHA-256 hex digest
  (`^[a-f0-9]{64}$`) computed from the exact UTF-8 string written to disk using
  the Node standard cryptography library (no dependency added). The manifest is
  constructed only after all six artifact contents and digests exist, and
  `manifest.json` is never digested inside itself.
- **Every artifact is reread and cross-validated**: bundle publication now
  reads back all seven files, compares all seven strings byte-for-byte with the
  strings that were written (including the serialized manifest), deserializes
  and validates all four JSON artifacts, requires manifest v2, runs the pure
  bundle cross-agreement validator, and only then atomically renames the
  temporary directory. The complete final bundle is reread and reverified at
  the published path; if final-path verification fails the final directory is
  removed recursively and the original verification error is preserved.
- **Bundle artifacts are cross-validated by a pure validator**:
  `validateGridMatchCanaryBundle` verifies identity agreement
  (`manifest.matchId = record.matchId = report.matchId`, `seed` agreement, and
  simulator/positioning/ruleset/catalogue/schema-version agreement), result
  agreement (`rounds`, `winner`, `resultMethod`, `eventCount =
record.events.length`), fallback-review agreement (winner, method, rounds,
  both final integrity values, both disabled-component lists), text-artifact
  requirements (non-empty, no NUL, valid UTF-8, plus renderer-output markers:
  text replay contains the completion marker, ASCII replay contains the grid
  rendering header and a canonical 3×3 corner label, review prompt contains the
  grid simulator identity and human-readable grid positioning) and every SHA-256
  digest. It never mutates its inputs and throws a clear canary-bundle boundary
  error.
- **Protected normal storage roots are rejected by the service itself**:
  `assertCanaryOutputRootIsolation` resolves and normalises absolute paths and
  rejects `data/matches`, `data/series` and every descendant, the repository
  `data` root and any non-canary child under repository `data` (the only
  accepted in-repo root is the canonical `data/canary/grid-match`); arbitrary
  external temporary roots remain allowed for tests. Path traversal and
  equivalent normalized forms are handled, and Windows drive/path comparisons
  are case-insensitive. The guard runs before any directory is created or any
  match is executed.
- **The CLI is truthful**: `match:grid:canary` prints
  `Lateral flank observed: yes`, `Observed flank bearings: right` and
  `Strict rear exposure observed: no` from inspected evidence and never prints
  a positive claim inferred from a zone name. The argument contract and
  existing package scripts are unchanged.
- **Corruption is rejected with full cleanup**: a filesystem adapter that
  changes any single artifact after writing but before read-back (match record
  to another schema-valid v3 record, factual report to another schema-valid v2
  report, fallback review to another schema-valid review, manifest to another
  schema-valid v2 manifest, or any text artifact) fails publication, leaves no
  final directory, removes the temporary directory, preserves the original
  failure and never writes to normal match or series storage.
- **No simulator, policy or combat semantics changed**: `runGridMatch`
  behaviour, initial positions/facings, lateral/flank scoring, damage/armour/
  qualification/victory logic and the no-combat canary policies are unchanged.
  The frozen event stream, match-record v3 and factual-report v2 output are
  preserved.
- **No grid series or default activation occurred**: no grid adaptive-series
  runner, runtime selector, provider integration, benchmark execution or
  balance conclusion was made; no external API call occurred; the normal
  `match`/`series` commands remain legacy; match v2, report v1, series v1,
  C1/C2/AB2 checksums and qualification constants are unchanged with C2 the
  default; held-out and `all` partitions remain sealed.

Status: Phase 1 geometry complete; Phase 2 persistence/replay complete; Phase
3A grid runtime core complete; Phase 3B activation hardening complete; Phase
3B.1 momentum correction complete; Phase 3C lateral/flank integration complete;
Phase 3D1 reporting/series compatibility foundation complete; Phase 3D1.1
reporting hardening complete; Phase 3D2A isolated grid match canary
**implemented**; Phase 3D2A.1 canary evidence and artifact hardening
**complete**; grid canary series **not implemented**; default grid activation
**not performed**; Milestone 0.2C **not complete** pending a separately
authorised activation-readiness decision.

## D43: Immutable and exclusive grid canary publication (2026-08-02)

Milestone 0.2C Phase 3D2A.2 closes three remaining filesystem-publication gaps
found in the Phase 3D2A.1 review before a grid adaptive-series canary is added:
arbitrary descendants of `data/canary/grid-match` were accepted as service
output roots, an existing empty final canary path was not detected because
existence was checked only by reading `manifest.json`, and a pre-existing
`.tmp-<canaryId>` directory could be silently reused and subsequently removed
by cleanup. No canary evidence, simulator behaviour or artifact contents
changed.

- **Service roots inside repository data must equal the canonical root
  exactly**: within the repository `data` tree, the service-level `outputRoot`
  must resolve to exactly `data/canary/grid-match`. Descendants such as
  `data/canary/grid-match/<canaryId>`, `data/canary/grid-match/custom` and
  `data/canary/grid-match/.tmp-<id>` are publication destinations or internal
  temporary locations and are rejected as service roots. External temporary
  roots outside the repository remain allowed for tests. Normalized equivalent
  syntax is accepted (after `resolve`); traversal forms resolving to a
  rejected path and Windows case-insensitive comparisons continue to be
  handled.
- **Published bundle directories cannot be reused as service roots**: an
  existing canary-directory path is rejected as an output root because it is a
  descendant of the canonical root.
- **Final and temporary collisions are detected through `lstat`**:
  `CanaryFileSystem` now exposes `lstat(path)` (returning `isFile()`,
  `isDirectory()` and `isSymbolicLink()`) and `readdir(path)`. Collision
  preflights use `lstat`, never `stat`, so symbolic links and broken symbolic
  links count as existing entries. The service never inspects only
  `manifest.json` to decide existence and never bypasses the injectable
  filesystem with direct filesystem calls inside publication logic.
- **Empty directories, files and symbolic links all count as collisions**: a
  pre-existing final or temporary path as any filesystem entry (directory,
  empty directory, regular file, symbolic link, broken symbolic link or other)
  is rejected before the match is executed and before any directory is
  created; the failure identifies whether the collision is at the final or
  temporary path. Pre-existing entries are never modified or removed.
- **Temporary directories are created exclusively**: after the parent output
  root is created, the temporary directory is created with non-recursive
  `mkdir(tmpDir, { recursive: false })`, so an entry that races in between
  preflight and creation fails with `EEXIST`. Recursive creation is never used
  for the temporary directory.
- **Pre-existing temporary paths are never reused or cleaned**: a pre-existing
  `.tmp-<canaryId>` path (empty directory, directory containing a sentinel,
  regular file, symbolic link or broken symbolic link) is rejected and
  preserved unchanged.
- **Cleanup applies only to invocation-owned paths**: the service tracks
  `tmpCreatedByThisInvocation` and `finalPublishedByThisInvocation` explicitly.
  The temporary directory is removed only when this invocation successfully
  created it; the final directory is removed only when this invocation
  successfully published it and final verification subsequently failed. Paths
  that existed before the invocation are never removed, and the original
  operational or verification error is preserved if cleanup also fails.
- **Temporary and final directories require exactly seven regular files**:
  before rename, `readdir(tmpDir)` must contain exactly `manifest.json`,
  `match.json`, `factual-report.json`, `text-replay.txt`, `ascii-replay.txt`,
  `review-prompt.txt` and `fallback-review.json` (names sorted before
  comparison, matching manifest v2 exactly), with no missing artifact, no
  additional file, no additional directory, no nested data and no symbolic
  link; every artifact must be a regular file. After the atomic rename the
  same exact inventory and regular-file checks run at `finalDir` before the
  complete final bundle verification. A stale or injected eighth entry fails
  publication; an injected extra final file during final verification fails
  and the final directory is removed because this invocation published it.
- **Races are handled defensively**: if preflight reports no temporary entry
  and exclusive `mkdir(tmpDir)` then returns `EEXIST`, the service fails
  closed, does not remove the raced-in temporary path, does not create a final
  directory and never writes into the raced-in path. If a final entry appears
  after preflight and causes the rename to fail, that final entry is preserved
  and only the invocation-owned temporary directory is removed.
- **Manifest-v2 evidence and digest semantics remain unchanged**: the actual
  observed bearing remains `right` with strict rear exposure `false` for the
  frozen scenario; manifest v2 remains the only current passing manifest; the
  six SHA-256 artifact digests, the all-seven-file read-back, byte-for-byte
  comparison, JSON schema validation, bundle cross-agreement and final-path
  revalidation are all preserved without weakening. The current artifact
  schemas and text output were not changed.
- **No grid-series runner or default activation occurred**: no grid adaptive-
  series runner, runtime selector, provider integration, benchmark execution
  or balance conclusion was made; no external API call occurred; the normal
  `match`/`series` commands remain legacy; match v2, report v1, series v1,
  C1/C2/AB2 checksums and qualification constants are unchanged with C2 the
  default; held-out and `all` partitions remain sealed.

Status: Phase 1 geometry complete; Phase 2 persistence/replay complete; Phase
3A grid runtime core complete; Phase 3B activation hardening complete; Phase
3B.1 momentum correction complete; Phase 3C lateral/flank integration complete;
Phase 3D1 reporting/series compatibility foundation complete; Phase 3D1.1
reporting hardening complete; Phase 3D2A isolated grid match canary
**implemented**; Phase 3D2A.1 evidence and artifact verification **complete**;
Phase 3D2A.2 immutable publication hardening **complete**; grid canary series
**not implemented**; default grid activation **not performed**; Milestone 0.2C
**not complete** pending a separately authorised activation-readiness
decision.

## D44: Isolated deterministic grid adaptive-series canary (2026-08-02)

Milestone 0.2C Phase 3D2B introduces the second executable application-level
grid path: a deliberately isolated, deterministic, local-only **three-match
adaptive-series canary** proving the complete grid series pipeline works
operationally, including two deterministic policy adaptations, series-record
v2 construction and a validated atomic artifact bundle. Like the match canary,
it is a separate explicit command; it changes no default application command
and adds no runtime selector, provider integration or default activation.

- **Shared immutable publication infrastructure was extracted**: the atomic,
  exclusive, immutable bundle publisher (`src/canary/immutable-canary-bundle.ts`)
  now provides the injectable `CanaryFileSystem`, `fsEntryKind`, exact-declared
  inventory checks and `publishImmutableBundle` used by both canaries. The
  single-match canary was refactored onto it with byte-compatible behaviour:
  the same CLI, manifest v2, artifact names, bytes, digests, evidence, output
  root, success output and failure semantics, and every existing single-match
  canary test still passes. The deterministic fallback review was also extracted
  to `src/canary/grid-canary-fallback-review.ts` and is shared by both canaries.
- **A kind-aware output-root guard now covers both canaries**: the neutral
  `src/canary/canary-output-root.ts` freezes the canonical roots
  (`grid-match` → `data/canary/grid-match`, `grid-series` →
  `data/canary/grid-series`), rejects cross-kind roots and protected normal
  storage for both kinds, and adds an async **physical-root guard**
  (`assertCanaryPhysicalRoot`) that inspects every existing component of the
  root ancestry with `lstat` (rejecting symbolic links and junctions, regular
  files and other entry types), creates missing components normally, and
  re-inspects the complete ancestry after recursive root creation and again
  before any artifact write. External test roots must be existing real
  directories; a symbolic link supplied as the service root is never followed.
  The guard runs before combat/series execution and is shared by both canaries.
- **The series scenario is frozen and combat-observable**:
  `grid-series-canary-adaptive-v1` freezes the deterministic local competitor
  (`grid-canary-competitor` / `deterministic-local`, initial policy
  `flank`/`medium`/aggression `100`/`rear`/`rear`/thresholds `20`/`80`/
  `defend`) against the canonical `BULWARK_POLICY` opponent, both using fresh
  deep-cloned Bulwark builds every match, with `maximumMatches 3`,
  `targetWins 3`, no `nextDesign` and no provider. Unlike the no-combat match
  canary, the series canary deliberately exercises combat: it requires at
  least one translated grid movement and at least one `attack_attempted` event
  across the three matches, and every match terminates within the frozen round
  cap.
- **Seeds, adaptation and trace are deterministic and auditable**: the frozen
  seed plan is `[baseSeed, baseSeed + 1, baseSeed + 2]` with safe-integer
  bounds. `adaptGridCanaryPolicy` applies the frozen
  `grid-canary-policy-adaptation-v1` rule after matches 1 and 2 (aggression
  `80/70` after match 1 and `60/90` after match 2 by integrity comparison;
  opening `hold` when mobility-disabled or immobilised/overturned, `cautious`
  when behind, otherwise `flank`; untouched fields preserved), requiring the
  authoritative factual-report v2 and the deterministic fallback review to
  agree first. The adaptation-trace v1 schema and the series-record v2
  cross-field contract re-derive every decision, and no RNG, provider, clock
  or filesystem is used.
- **The pure core is fully deterministic with injected identity**: the core
  (`executeGridSeriesCanary`) never generates UUIDs, never reads the clock,
  never touches the filesystem and never calls a provider, `runSeries` or
  benchmark code; match UUIDs, the series UUID and timestamps are injected
  through service dependencies. Each match is converted to match-record v3
  with the injected identity (the converter gained an optional identity
  parameter without weakening normal conversion), bound to its factual-report
  v2, rendered to text/ASCII replay, and validated for determinism, canonical
  zones, round-cap termination and replay/report/final-round agreement. The
  service re-executes the core with the same identities and requires identical
  series, matches, reports and trace.
- **The published bundle is a validated atomic eight-file artifact set**: each
  run writes only under `data/canary/grid-series/<canaryId>/` with exactly
  eight regular files — `manifest.json`, `series.json`, `matches.json`,
  `factual-reports.json`, `fallback-reviews.json`, `match-artifacts.json`,
  `adaptation-trace.json` and `series-report.txt`. The series canary manifest
  v1 freezes the canary/series identities, the three sequential seeds, the grid
  runtime identity, sixteen evidence flags (including both adaptations, the
  series and trace round trips, deterministic re-execution, full read-back and
  bundle cross-agreement) and seven SHA-256 digests, and contains no win rates,
  percentages, promotion, balance or benchmark terminology. The pure bundle
  validator cross-checks identity/ordering, runtime/schema identity, result
  facts, adaptation facts, series facts, text-artifact markers (text replay
  completion, ASCII grid labels, grid review prompt, and a series report that
  states canary/non-benchmark with the raw three-match score and no win rate)
  and every digest.
- **The CLI is separate, explicit and truthful**: `npm run series:grid:canary
-- --seed <base>` runs `src/app/run-grid-series-canary.ts` and prints the
  canary ID, scenario, series ID, seed plan, runtime identity, per-match IDs and
  results, the final raw score, both adaptation summaries and the artifact
  directory, with the banner `NON-DEFAULT / NON-BENCHMARK / LOCAL-ONLY`. The
  parser rejects missing, negative, unsafe or overflowing seeds, duplicates,
  unknown arguments, target-wins/maximum-matches overrides, runtime selectors,
  `--ai`, `--review`, provider and API-key arguments.
- **No normal data directory or command is modified**: the series canary never
  writes to `data/matches` or normal series storage and never reuses a UUID;
  the normal `match` and `series` commands remain legacy (match v2, report v1,
  series v1). Corruption of any published artifact fails publication with full
  cleanup of invocation-owned paths and no final bundle. Pre-existing final or
  temporary paths are rejected and preserved.
- **No benchmark, balance or activation occurred**: no benchmark partition
  ran, no benchmark seed or fixture changed, held-out and `all` partitions
  remain sealed, no provider or external API call occurred, and no balance
  conclusion, tuning or default grid activation was performed.
  `SIMULATOR_VERSION`/`RULESET_VERSION` remain `0.2.0`, catalogue `1`, and
  C1/C2/AB2 checksums and qualification constants remain frozen with C2 the
  default. Activation-readiness was not performed and Milestone 0.2C remains
  incomplete.

Status: Phase 1 geometry complete; Phase 2 persistence/replay complete; Phase
3A grid runtime core complete; Phase 3B activation hardening complete; Phase
3B.1 momentum correction complete; Phase 3C lateral/flank integration complete;
Phase 3D1 reporting/series compatibility foundation complete; Phase 3D1.1
reporting hardening complete; Phase 3D2A isolated grid match canary
**implemented**; Phase 3D2A.1 evidence and artifact verification **complete**;
Phase 3D2A.2 immutable publication hardening **complete**; Phase 3D2B isolated
grid adaptive-series canary **complete**; activation-readiness **not
performed**; default grid activation **not performed**; Milestone 0.2C **not
complete** pending a separately authorised activation-readiness decision.

## D45: Grid series canary provenance and immutability hardening (2026-08-02)

Milestone 0.2C Phase 3D2B.1 closes four contract gaps found in the Phase 3D2B
review of the isolated deterministic three-match grid adaptive-series canary,
before any activation-readiness evaluation is introduced: the seed plan was
TypeScript-readonly but not frozen at runtime; adaptation did not fully
establish factual-report/fallback-review agreement before using impairment
facts; persisted series entries were not fully bound to the actual match
records and envelope artifacts; and bundle validation did not verify
disabled-component lists or the authoritative score rendered in the series
report. No simulator, policy, seed-derivation, adaptation-rule or combat
semantics changed, and no activation-readiness work occurred.

- **The seed plan is now runtime-frozen**: `createGridSeriesCanarySeedPlan`
  returns `Object.freeze`d plan and seed-tuple values (`Object.isFrozen(plan)`
  and `Object.isFrozen(plan.seeds)` are both true), attempted mutation can
  never alter any seed, and separate calls return separate frozen values with
  no shared mutable tuple. Seed derivation remains `[base, base + 1, base + 2]`.
- **Safe-integer seed contracts now exist in persisted schemas**: the
  grid-series manifest schema requires a non-negative safe base seed and three
  safe seeds with `baseSeed ≤ Number.MAX_SAFE_INTEGER - 2` and exact
  `seeds[0]=base`, `seeds[1]=base+1`, `seeds[2]=base+2`; the adaptation-trace
  schema requires safe base and source seeds with transition 1 source seed =
  base and transition 2 source seed = base + 1. The pure bundle validator
  independently requires every relevant seed in the manifest, series entries,
  match records, factual reports and adaptation trace to be a safe integer.
  General legacy match/series seed schemas are unchanged.
- **Adaptation requires complete report/review outcome agreement**:
  `adaptGridCanaryPolicy` now requires the deterministic fallback review to
  agree with the authoritative factual-report v2 on winner, result method,
  rounds, both final integrity values **and both canonical disabled-component
  lists** before any impairment fact is read for opening selection. Disabled
  lists are derived in the canonical order `mobility`, `weapon`, `utility`;
  a missing claim, an extra component, a different component, a duplicate or
  an incorrect canonical order is rejected. Conditions remain authoritative
  factual-report facts and are never inferred from the review.
- **A single shared fallback-agreement helper is used everywhere**:
  `gridFallbackReviewDisagreements` (`src/canary/grid-canary-fallback-agreement.ts`)
  plus `normaliseDisabledComponents` is used by the adaptation preflight, the
  series-bundle cross-validation and the deterministic fallback-review
  builder, so there is exactly one canonical implementation. The existing
  single-match fallback-review validation is preserved unchanged.
- **Every series entry is bound to its actual match record and envelopes**:
  the bundle validator now requires `entry.matchId` / `entry.match.matchId` /
  `entry.match.createdAt` / seed / rounds / winner / resultMethod / schema /
  simulator / positioning to equal the record; the embedded factual report to
  equal the factual-reports envelope item (complete structural value, not only
  the ID and summary); the embedded review to be non-null and equal the
  fallback-review envelope item; the fallback-envelope entry's match number and
  match ID to align; and every entry's `reviewFailure` to exactly equal the
  frozen intentional local-fallback marker (`category: local_fallback` with the
  exact message). An absent or different marker is rejected.
- **Recorded builds and policies are bound to actual execution**: each entry's
  `designBeforeMatch` must equal the record's fighter A build proposal and its
  `policyBeforeMatch` must equal the record's fighter A policy; every record's
  fighter B build proposal and policy must equal the frozen Bulwark proposal
  and `BULWARK_POLICY`; the competitor build proposal must remain identical
  across all three records. No `nextDesign`; matches 1 and 2 carry a
  `nextPolicy`, match 3 does not; the adaptation chain (trace policy-after,
  series entry policy-before/next-policy and the actual match-record config
  policies) must agree end-to-end.
- **Disabled-component facts are validated in the bundle**: the shared helper
  validates own and opponent disabled lists for every fallback review, and
  the manifest evidence recomputation covers mobility-disabled impairment
  facts used for opening selection through the adaptation-facts agreement.
- **Manifest evidence is recomputed from persisted artifacts**: the pure
  `recomputeGridSeriesCanaryEvidence` derives `allMatchesTerminated` (round
  cap), `allMatchRecordsV3`, `allFactualReportsV2`, `allReportsBoundToRecords`,
  `allFallbackReviewsValid`, `allMovementZonesCanonical` (initial, movement and
  round-end zones), `translatedGridMovementObserved`, `combatAttemptObserved`,
  `policyAdaptationCount` and `adaptationFactsAgree` directly from the parsed
  records/reports/reviews/transitions, and every corresponding manifest field
  must agree. Evidence established operationally before publication (series
  and trace round trips, deterministic re-execution, full read-back, bundle
  cross-agreement and replay final-state agreement) retains its service check;
  the distinction is documented. No new balance evidence was invented.
- **Rendered per-match facts are cross-validated**: each text replay must
  contain the exact authoritative completion line (winner or draw and method,
  via the shared `formatCompetitionEndedLine` used by the renderer), the
  authoritative round count and the match seed; each review prompt must be
  exactly reproducible from the corresponding factual report
  (`buildReviewUserPrompt`); each ASCII replay must retain the grid marker and
  match-specific identity/final-result facts (seed, method, round/draw).
- **The authoritative raw series score is verified in the report**: the report
  must contain the exact canonical score line (competitor wins, Bulwark wins,
  draws, via the shared `formatSeriesCanaryScoreLine`) and exactly
  "3 matches completed"; a report with the wrong score, swapped scores, wrong
  draw count, wrong match count or any percentage/win rate is rejected.
- **The shared publisher validates its declaration contract before any
  filesystem activity**: `assertValidBundleDeclaration` rejects duplicate or
  path-like entry/artifact names, a manifest filename absent or duplicated in
  `entryNames`, artifact/manifest collisions, artifacts not declared in
  `entryNames`, and missing artifacts for non-manifest entries, before the
  final/temporary preflight or any directory creation. The existing seven-file
  match-canary and eight-file series-canary bundles are byte-for-byte
  unchanged.
- **Frozen regression is proven**: seed 3 with fixed injected identities keeps
  identical three-match event streams, reports, adaptation trace and series
  record (frozen SHA-256 digests asserted); the series-grid canary keeps
  match v3 / report v2 / series v2 / manifest v1; match-grid canary bytes and
  behaviour, collision/race/symlink/inventory/digest/cleanup guarantees, legacy
  `runSeries` (calls `runMatch`, schema v1), legacy match persistence (v2),
  legacy factual reports (v1) and all package scripts except the previously
  added `series:grid:canary` remain unchanged.
- **No benchmark, balance, provider or activation change**: no benchmark
  partition ran, no benchmark seed or fixture changed, held-out and `all`
  remain sealed, C1/C2/AB2 checksums and qualification constants remain frozen
  with C2 the default, global simulator/ruleset constants remain `0.2.0 /
0.2.0`, catalogue `1`, normal `match`/`series` remain legacy, no provider or
  external API call occurred, no activation-readiness evaluation was performed
  and no default activation occurred.

Status: Phase 1 geometry complete; Phase 2 persistence/replay complete; Phase
3A grid runtime core complete; Phase 3B activation hardening complete; Phase
3B.1 momentum correction complete; Phase 3C lateral/flank integration complete;
Phase 3D1 reporting/series compatibility foundation complete; Phase 3D1.1
reporting hardening complete; Phase 3D2A isolated grid match canary
**implemented**; Phase 3D2A.1 evidence and artifact verification **complete**;
Phase 3D2A.2 immutable publication hardening **complete**; Phase 3D2B isolated
grid adaptive-series canary **implemented**; Phase 3D2B.1 provenance and
immutability hardening **complete**; activation-readiness **not performed**;
default grid activation **not performed**; Milestone 0.2C **not complete**
pending a separately authorised activation-readiness decision.

## D46: Bounded development-only grid activation-readiness evaluation (2026-08-02)

Milestone 0.2C Phase 3E1 creates and executes one bounded, deterministic,
development-only **activation-readiness evaluation** to answer whether the grid
runtime is technically suitable for a separately authorised opt-in beta
decision. It does not activate grid, does not alter defaults, does not tune
combat or policies, does not claim production readiness and produces exactly
one classification: `ready_for_opt_in_beta_review`, `inconclusive` or
`not_ready`. Even `ready_for_opt_in_beta_review` is not permission to activate
grid; default activation remains a later, separately authorised decision.

- **A development-only seed registry is source-controlled.** `config/readiness/grid-readiness-development-v1.json`
  registers exactly 24 frozen seeds (`grid-readiness-development-v1`,
  `development-only` partition, `explicit-list-v1`) in the reserved range
  `1703000000–1703099999`. The registry is runtime-frozen, safe-integer
  enforced, distinct after the signed 32-bit seed conversion, and has a
  deterministic canonical checksum (`54acf0151360f59d429fd7b2a84f48b48f4a791e522cf58bc381b927d62b78a0`).
  The numeric range is reserved for grid-readiness development and must not be
  used by future benchmark or held-out registries. It is logically independent
  from every existing benchmark partition and is never read through a
  benchmark seed bank; the readiness command never opens any existing
  benchmark seed file.
- **A frozen scenario registry defines seven families and thirteen
  assignments.** `grid-readiness-scenarios-v1` (canonical checksum
  `b07270171f6e38efac2d1992f051d7bd881e323c00cee92b9caa9490ddb85b67`) contains
  one Bulwark-mirror assignment and six role-swapped pairs (Flanker, Spinner,
  Grappler, Flipper, Runner, Sentinel versus the canonical Bulwark). Every
  build validates against catalogue v1 before evaluation; every factory returns
  fresh deep-cloned builds and policies.
- **The exact suite is 312 primary matches.** `24 seeds × 13 assignments`,
  ordered scenario → assignment → seed, with a unique
  `(scenarioId, assignmentId, seed)` tuple, no shuffling, frozen plan and
  entries, and a deterministic suite checksum
  (`dd38ac8a5d2e35007b4b6890418b21aca8f621f3e165fa7d158d2f179672ae5a`) that
  includes the registry IDs, registry checksums, runtime identity and ordered
  runs.
- **A pure execution core runs the suite.** `executeGridActivationReadinessSuite`
  calls `runGridMatch` directly, requires the exact grid runtime identity and
  `1 ≤ rounds ≤ MAX_ROUNDS`, validates every initial/event zone, movement
  action, movement subject, facing and round-end condition, converts to
  match-record v3 with injected identities, builds and binds factual-report
  v2, validates every record/report, verifies replay/report/final-round
  agreement, renders text/ASCII replays and the review prompt, and produces a
  canonical per-run result with action, zone, bearing/exposure, event-type and
  no-progress evidence and artifact checksums. It is pure (no files, UUIDs,
  clock, provider, benchmark or legacy runtime) and fails closed on input
  mutation. Replay/prompt text is never persisted.
- **The suite re-executes deterministically.** All 312 matches run a second
  time with the same run plan, match IDs and timestamps; byte-identical
  records, reports, evidence, replay/ASCII/prompt checksums and aggregate
  inputs are required, and a mismatch is a hard failure. No duplicate
  second-run records are published.
- **Authoritative envelopes and a pure metrics reducer.** `run-index.json`,
  `match-records.json` and `factual-reports.json` each carry exactly 312
  ordered items with the evaluation UUID and cross-envelope agreement. The
  reducer aggregates execution, movement (actions, translated actions, holds,
  nine zone visits, bearings, exposed zones), combat (attempts, hits, misses,
  integrity damage, criticals, knockback, grapple, overturns, component
  transitions), results (judges/destruction/immobilisation/draws, round
  statistics, maximum no-progress streak), slot-order diagnostics (first-slot
  advantage, Bulwark-mirror slot imbalance, paired role-swap sensitivity) and
  timing percentiles (informational only).
- **Frozen gates produce the decision.** H01–H10 are hard pass/fail; C01–C06
  are coverage pass/inconclusive; S01–S03 and P01–P02 are gross-pathology
  pass/inconclusive/fail with frozen thresholds. Any hard, slot-stability or
  progress failure produces `not_ready`; otherwise any inconclusive gate
  produces `inconclusive`; otherwise `ready_for_opt_in_beta_review`. The
  decision v1 and the human-readable report carry every gate with its frozen
  threshold, observed value, evidence and blocking reason and the mandatory
  disclaimer that the evaluation does not activate the grid runtime, does not
  qualify combat balance and does not authorise default migration. No tuning
  recommendation is ever included.
- **An immutable nine-file evaluation bundle is published.** The kind-aware
  root guard now includes `grid-readiness → data/readiness/grid`; the service
  rejects normal match/series storage, both canary roots, other data roots,
  canonical-root descendants, symlink/junction ancestry and external symlink
  roots. Each evaluation writes exactly nine regular files under
  `data/readiness/grid/<evaluationId>/` via the shared immutable publisher;
  the manifest v1 records the evaluation identity, exact counts (24/7/13/312),
  registry/suite/outcome/report checksums, the decision, fixed artifact names
  and SHA-256 digests, with read-back and cross-agreement evidence. The
  complete bundle is cross-validated from the persisted records and reports.
- **The service and CLI are explicit and bounded.** `runGridActivationReadiness`
  orchestrates guards, registries, plan, identities, primary/repeat execution,
  determinism, envelopes, metrics, gates, decision, report, round trips,
  digests, manifest, shared publish and read-back. The `readiness:grid`
  command accepts no arguments and prints the evaluation/suite IDs, counts,
  checksums, runtime identity, gate/coverage/slot/progress summaries, final
  classification and artifact directory under the
  `DEVELOPMENT-ONLY / NON-BENCHMARK / NON-ACTIVATING` banner, and exits zero
  for any completed evaluation.
- **No benchmark, held-out, provider, tuning or activation change.** No
  benchmark partition runs, no existing benchmark seed file is opened,
  held-out and `all` remain sealed, seeds and fixtures are unchanged,
  C1/C2/AB2 checksums and qualification constants remain frozen with C2
  default, simulator/ruleset constants remain `0.2.0 / 0.2.0`, catalogue `1`,
  normal `match`/`series` remain legacy, both canaries remain isolated and
  unchanged, no provider or external API call occurs, no tuning follows the
  official result, no opt-in activation decision is performed and no default
  activation occurs.

**Official development-only run (2026-08-02):** exactly one official run of
`npm run readiness:grid` executed (`evaluationId
864991f7-d060-4669-beec-11e0d42b7e68`), publishing the immutable nine-file
bundle under `data/readiness/grid/864991f7-d060-4669-beec-11e0d42b7e68/`.
Determinism passed; all ten hard correctness gates (H01–H10), all three
slot-order gates (S01–S03) and both progress gates (P01–P02) passed; coverage
gates C01, C03, C05 and C06 passed; coverage gates **C02** (the canonical
`hold` movement action was not observed) and **C04** (no grapple reposition
was observed) were **inconclusive**. Per the frozen decision derivation, the
final readiness classification is **`inconclusive`**. Nothing was tuned after
seeing the result; no opt-in activation decision and no default activation
was performed.

Status: Phase 1 geometry complete; Phase 2 persistence/replay complete; Phase
3A grid runtime core complete; Phase 3B activation hardening complete; Phase
3B.1 momentum correction complete; Phase 3C lateral/flank integration complete;
Phase 3D1 reporting/series compatibility foundation complete; Phase 3D1.1
reporting hardening complete; Phase 3D2A isolated grid match canary
**implemented**; Phase 3D2A.1 evidence and artifact verification **complete**;
Phase 3D2A.2 immutable publication hardening **complete**; Phase 3D2B isolated
grid adaptive-series canary **implemented**; Phase 3D2B.1 provenance and
immutability hardening **complete**; Phase 3E1 evaluation tooling **complete**;
Phase 3E1 official development run **complete**; readiness classification
**inconclusive** (coverage gates C02 and C04 inconclusive; all hard,
slot-order and progress gates passed); opt-in beta decision **not performed**;
default grid activation **not performed**; Milestone 0.2C **not complete**
pending a separately authorised activation-readiness decision.

## D47: Grid readiness evidence hardening (Phase 3E1.1, 2026-08-02)

Phase 3E1.1 corrects the readiness action-evidence source and hardens decision
provenance, without changing the 24 seeds, 7 scenarios, 13 assignments, the
312-run plan, gate thresholds or simulator semantics. The historical Phase 3E1
v1 evaluation remains preserved (`864991f7-d060-4669-beec-11e0d42b7e68`,
`inconclusive`, C02 + C04; v1 suite checksum
`dd38ac8a5d2e35007b4b6890418b21aca8f621f3e165fa7d158d2f179672ae5a` frozen).

- **Selected actions are counted from `policy_triggered`, not
  `movement_resolved`.** The Phase 3E1 C02 gap counted selected actions from
  ordinary `movement_resolved`, so a stationary `hold` (which emits no
  movement event) was never observed and C02 was inconclusive. The shared
  record-evidence inspector now derives selected movement/combat actions from
  `policy_triggered` (exactly one per fighter per completed round; canonical
  actor/movement/combat; no duplicates; no events after completion; selected
  total = `2 × completed rounds`). Ordinary `movement_resolved` must agree with
  the actor's selected policy movement; knockback/grapple are target-subject
  and never selected actions. The live core and the read-back validator share
  this inspector, so live and persisted evidence are always identical.
- **The scenario registry is deeply frozen.** Every nested build proposal,
  armour object and policy is a distinct deeply frozen clone; equal Bulwark
  definitions and the mirror X/Y are distinct objects with no shared
  references. Deserialized registries reconstruct the same guarantees; the
  canonical checksum
  (`b07270171f6e38efac2d1992f051d7bd881e323c00cee92b9caa9490ddb85b67`) is
  unchanged.
- **The published bundle is revalidated end-to-end.** The validator recomputes
  per-run evidence and render checksums from the persisted records, then
  metrics, gates, the decision and `report.txt` from those artifacts; any
  disagreement fails the bundle. `run-index.json` gains
  `selectedMovementActionCounts` / `selectedCombatActionCounts`; `metrics.json`,
  `decision.json` and `manifest.json` are v2 (suite
  `grid-activation-readiness-v2`, action-evidence model
  `policy-triggered-round-actions-v1`). Version-aware parsers read v1 and v2;
  only v2 is current readiness evidence.
- **No supplemental grapple scenario was added.** C04 (no grapple reposition
  observed) may remain inconclusive; that is accepted and recorded. No
  seed/scenario/policy/threshold/simulator change occurred; no benchmark ran;
  no seed bank was opened; held-out/all remain sealed; C1/C2/AB2 and
  simulator/ruleset constants are unchanged; no provider call, tuning or
  activation occurred.

**Official v2 run (2026-08-02):** `evaluationId
d788284d-a795-4125-984c-9146261e271a` under
`data/readiness/grid/d788284d-a795-4125-984c-9146261e271a/` (suite checksum
`df9444101ca68f7b7ca9fef24adfe8575363ef744e9f37b4449b111e0bb29fd9`).
Determinism passed; H01–H10, S01–S03, P01–P02 and C01/C02/C03/C05/C06 passed
(C02 now passes via `policy_triggered` evidence); C04 was **inconclusive** (no
grapple reposition observed). Final readiness classification:
**`inconclusive`**. No tuning occurred; no supplemental grapple scenario was
added; no opt-in activation decision and no default activation was performed.

Status: Phase 3E1 v1 tooling **historical**; Phase 3E1 v1 official evaluation
**complete** (`inconclusive`, C02 + C04); Phase 3E1.1 v2 evidence hardening
**complete**; Phase 3E1.1 v2 official evaluation **complete** (`inconclusive`,
C04 only); current readiness classification **`inconclusive`**; supplemental
grapple coverage **not performed**; opt-in beta decision **not performed**;
default grid activation **not performed**; Milestone 0.2C **not complete**
pending a separately authorised activation-readiness decision.

## D48: Grid readiness provenance finalisation and canonical suite binding (Phase 3E1.2, 2026-08-02)

Phase 3E1.2 finalises the readiness provenance chain and binds the suite to
the exact canonical registries, without changing seeds, scenarios,
assignments, the 312-run tuples, gate thresholds or simulator semantics. The
historical v1 (`864991f7-d060-4669-beec-11e0d42b7e68`) and v2
(`d788284d-a795-4125-984c-9146261e271a`) evaluations remain preserved and
their parsers remain available; neither is accepted as the current evidence
contract.

- **Current v3 suite identity.** `grid-activation-readiness-v3` with
  action-evidence model `policy-triggered-round-actions-v1` and provenance
  model `canonical-registry-record-derived-decision-v1`. The v3 suite checksum
  includes the suite ID, action-evidence model, provenance model, exact
  canonical registry checksums, runtime identity and all ordered run tuples.
  Current executions emit run-index v3, metrics v3, decision v3 and manifest
  v3; record and factual-report envelopes keep their schema versions.
- **Exact canonical registries are anchored.** `assertCanonicalGridReadinessSeedRegistry`
  requires the exact metadata, exactly 24 seeds in the exact order, the exact
  reserved domain and the exact canonical checksum `54acf015...` (single-source
  anchor, no second seed list). `assertCanonicalGridReadinessScenarioRegistry`
  requires exact structural equality with a freshly created canonical registry
  plus the known checksum `b0727017...`. A self-consistent alternate registry
  is never accepted, even with all downstream artifacts coherently changed.
- **Complete event chronology is enforced.** `competition_started` exactly
  once and first; `competition_ended` exactly once and last with terminal
  winner/method/rounds agreeing with the record; per completed round exactly
  one `round_started`, two `policy_triggered` (one per fighter, between
  `round_started` and `round_ended`) and one `round_ended`; monotonic round
  ordering; no ordinary/combat event after the round's `round_ended`; and
  strictly increasing unique sequence numbers within each of the frozen
  runtime's two sequence counters.
- **Ordinary hold invariants are frozen.** Selected `hold` from
  `policy_triggered`; translated `hold` always zero; `stationaryHoldCount` =
  selected hold count; an emitted ordinary `hold` movement event must be
  same-cell and same-facing (translated hold or facing change rejected).
- **Execution metrics are record-derived.** `totalPlannedRuns`,
  `totalCompletedRuns`, `schemaValidRecords`, `schemaValidReports` and
  `replayAgreeingMatches` (complete report/final-state agreement count) are
  derived from the parsed records; `invalidEventCount` is zero after every
  record passes the authoritative inspector; `deterministicMatches` (312) and
  `mutationFailures` (0) follow the explicit operational attestations. The
  persisted metrics artifact is the value being verified, never the source of
  truth for its non-timing execution fields. H02/H07 use the manifest
  attestations directly; H06 derives from record inspection; H05 derives from
  the complete agreement count.
- **Complete report/final-state agreement.** `assertGridReadinessRecordReportFinalAgreement`
  reconstructs both fighters' complete final states from the authoritative
  event stream and requires exact agreement with the bound report on identity,
  result, integrity, energy, heat, zone, facing, conditions, component
  lifecycle states, binary component projection and armour where represented.
- **Timing validation corrected.** Finite and non-negative; `mean ≈
totalElapsedMs / 312` within a documented tolerance; `p95 >= median`; the
  invalid `median <= mean <= p95` assumption is removed. Timing changes never
  alter a gate or decision.
- **Operational attestations** remain exactly `deterministicReexecutionPassed`,
  `inputsUnmodified`, `fullBundleReadBackPassed` and
  `legacyIsolationRegressionPassed`; record-derived, registry-derived and
  informational-only timing evidence are documented separately.
- **Formatting contract.** Prettier is configured with `endOfLine: crlf`;
  non-conforming line endings were normalised without altering code content;
  `npm run format:check` passes repository-wide.
- **No supplemental grapple coverage was added** and the honest C04 result is
  preserved (nothing is hard-coded). No seed, scenario, policy, threshold or
  simulator semantics changed; no benchmark ran; no seed bank was opened;
  held-out/all remain sealed; C1/C2/AB2 and constants are unchanged; no
  provider call, tuning, opt-in beta decision or default activation occurred.

**Official v3 run (2026-08-02):** `evaluationId
0d8487a8-939d-4f9a-a16a-544b71eaa869` under
`data/readiness/grid/0d8487a8-939d-4f9a-a16a-544b71eaa869/` (suite checksum
`c3b8a16d407891d0a92966fb9d6ed20fe5e11776bf545624fb3dbcadb4e2503c`).
Determinism passed (operational attestation); H01–H10, S01–S03, P01–P02 and
C01/C02/C03/C05/C06 passed; selected `hold` = 4373, translated `hold` = 0,
grapple reposition = 0 (knockback 36, overturn 8); C04 was **inconclusive**.
Final readiness classification: **`inconclusive`**. No tuning occurred; no
supplemental grapple scenario was added; no opt-in activation decision and no
default activation was performed.

Status: Phase 3E1 v1 evaluation **historical**; Phase 3E1.1 v2 evaluation
**historical**; Phase 3E1.2 v3 provenance finalisation **complete**; Phase
3E1.2 v3 official evaluation **complete**; current readiness classification
**`inconclusive`** (C04 only); supplemental grapple coverage **not performed**;
opt-in beta decision **not performed**; default grid activation **not
performed**; Milestone 0.2C **not complete** pending a separately authorised
activation-readiness decision.

## D49: Report disagreement is fatal to current readiness evidence (Phase 3E1.3, 2026-08-02)

Phase 3E1.3 is a verifier-only hardening pass. It changes no suite identity,
no artifact schema version, no seed, scenario, assignment, gate threshold or
simulator semantics, and it performs **no new official evaluation**. The
official v3 evaluation (`0d8487a8-939d-4f9a-a16a-544b71eaa869`, suite
checksum `c3b8a16d407891d0a92966fb9d6ed20fe5e11776bf545624fb3dbcadb4e2503c`,
classification `inconclusive`, C04 only) and its bundle remain exactly as
published and still validate under the stronger validator.

- **Report/final-state disagreement is a bundle-invalidity failure.** The
  core artifact validator now runs `assertGridReadinessRecordReportFinalAgreement`
  for every bound record/report pair and treats any disagreement as a core
  artifact-validation failure (with the run number and match ID in the
  message). A current v3 bundle is valid only when all 312 pairs pass complete
  agreement, and a bundle containing a final-state disagreement is rejected
  before any classification is returned — it can never validate under a
  `not_ready` classification or any other.
- **The authoritative persisted-bundle path never downgrades disagreement.**
  `recomputeGridActivationReadinessMetricsFromArtifacts` throws immediately on
  the first record/report disagreement instead of silently counting a
  non-agreeing pair into `replayAgreeingMatches`. H05 (`replayAgreeingMatches
=== 312`) is retained for live in-memory evaluation; the persisted-bundle
  path relies on the single shared agreement rule (the same
  `assertGridReadinessRecordReportFinalAgreement` helper), so there is no
  duplicated or downgraded disagreement handling.
- **A fully coherent false bundle is rejected for exactly the disagreement.**
  Regression tests corrupt one schema-valid factual-report final state and
  coherently rewrite every downstream artifact to match: the report artifact
  and its run-index checksum, persisted metrics (`replayAgreeingMatches` =
  311 so H05 fails), recomputed gates, the decision (`not_ready`), a
  regenerated `report.txt`, and every manifest digest/checksum plus the
  manifest classification (`not_ready`). The validator still rejects the
  bundle specifically because the factual report disagrees with its
  authoritative record, not because a downstream artifact was left stale.
  Fields exercised: integrity, zone, facing, conditions, disabled-component
  projection and damaged-component projection. The unmodified official-shape
  v3 test bundle still validates (positive regression).
- **Round 0 is exclusively the `competition_started` event.** The chronology
  validator requires every nonterminal event (`round_started`,
  `policy_triggered`, `round_ended`, ordinary and combat events) to carry an
  integer round in `1..record.rounds`; round 0 round-structure or ordinary
  events and nonterminal events beyond `record.rounds` are rejected. The
  `competition_started` seed must agree with the record seed and the terminal
  `competition_ended` loser must agree with the record result. The documented
  dual sequence-counter validation required by the frozen runtime is
  preserved unchanged.
- **No rerun and no scope expansion.** The official v3 evaluation was not
  rerun; no replacement evaluation ID was created; no supplemental grapple
  scenario or seed was added; no benchmark ran and no seed bank was opened;
  held-out/all remain sealed; C1/C2/AB2 and constants are unchanged; no
  provider call, tuning, opt-in beta decision or default activation occurred.
  Phase 3E2 has not started and Milestone 0.2C remains incomplete pending a
  separately authorised activation-readiness decision.

Status: Phase 3E1 v1 evaluation **historical**; Phase 3E1.1 v2 evaluation
**historical**; Phase 3E1.2 v3 provenance finalisation **complete**; Phase
3E1.3 fatal-agreement hardening **complete** (verifier-only, no new official
run); current readiness classification **`inconclusive`** (C04 only);
supplemental grapple coverage **not performed**; opt-in beta decision **not
performed**; default grid activation **not performed**; Phase 3E2 **not
started**; Milestone 0.2C **not complete** pending a separately authorised
activation-readiness decision.

## D50: Isolated supplemental grapple-reposition coverage (Phase 3E2, 2026-08-03)

Phase 3E2 collects only the missing grapple-reposition feature evidence
through a separate deterministic supplement. The official v3 evaluation
(`0d8487a8-939d-4f9a-a16a-544b71eaa869`, suite checksum
`c3b8a16d407891d0a92966fb9d6ed20fe5e11776bf545624fb3dbcadb4e2503c`,
classification `inconclusive`) is valid and authoritative and was **not**
altered, replaced, reinterpreted or rerun. All hard, slot-order, progress and
other coverage gates passed; C04 (no grapple reposition observed) was the only
non-pass gate, with base reposition observations knockback 36 / overturn 8 /
grapple 0.

- **Why the original 312-run v3 suite did not observe grapple reposition.**
  The v3 suite's only Grappler is R4 `grappler-bulwark` (Grid Grappler versus
  the canonical Bulwark), whose Bulwark opponent uses `BULWARK_POLICY` and a
  defensive build. Grapple repositioning requires a Grappler hit with the 50%
  `grappleReposition` roll and a resolvable destination; the observed suite
  produced 36 knockbacks, 8 overturns and 0 grapple repositions. The
  supplement deliberately increases the grapple-reposition opportunity by
  pairing a maximum-aggression Grapple Coverage Attacker against a stationary,
  zero-aggression target in both fighter slots — a feature-exercising
  scenario, not a balance scenario.
- **Why Phase 3E2 is additive evidence rather than a v3 rerun.** The official
  v3 suite identity, checksum, classification, bundle and evaluation ID are
  frozen historical fact. A rerun would create a replacement evaluation and
  reinterpret existing evidence. The supplement is a separate, bounded,
  development-only check (24 canonical seeds × 2 role assignments = 48
  matches) that anchors the official base before executing any match and adds
  a new immutable bundle under `data/readiness/grid-supplements/` without
  touching the official `data/readiness/grid/` directory.
- **Fixed supplemental scenario and 48-run plan.** New scenario registry
  `grid-grapple-coverage-scenarios-v1` (checksum
  `1aba546d5e0aa3ef3c95ee5bb45b2c412480a3822543999b291227a22a8c503f`) with one
  scenario and two role assignments (Grapple Coverage Attacker `x` versus
  Stationary Coverage Target `y`, attacker in fighter A then fighter B),
  deeply frozen with catalogue-valid builds, no shared mutable references and
  fresh mutable configurations per execution. The exact plan is `24 seeds × 2
assignments = 48` runs (assignment order → canonical readiness-seed order),
  no shuffling, unique `(assignmentId, seed)` tuples, frozen entries and a
  deterministic plan checksum
  (`e30dda08253c3cdaba771a5c4af810fcb17cd7a7669a1efcc2b86e5d9df01a26`) that
  includes the supplement suite ID, the anchored base v3 evaluation ID and
  suite checksum, the seed and scenario registry checksums, the runtime
  identity and the ordered run tuples.
- **Base-v3 anchoring.** Before any match, the supplement reads all nine
  official v3 artifacts, validates them with
  `validateGridActivationReadinessBundle`, and requires the exact evaluation
  ID, suite ID, suite checksum, canonical seed/scenario-registry checksums,
  `inconclusive` classification, C04 as the only non-pass gate and base
  reposition counts 36/8/0, retaining the SHA-256 of the base manifest,
  decision and metrics. If the official base is absent or invalid, the CLI
  fails without running matches or writing artifacts.
- **Authoritative grapple-event requirements.** A valid grapple-reposition
  observation must come from the frozen runtime's actual event contract: an
  authoritative successful `attack_hit` by the Grapple Coverage Attacker with
  weapon `grappler`, a corresponding `movement_resolved` event with `action:
"grapple"`, canonical fighter IDs (attacker is the actor, repositioned
  defender is the target), canonical `from`/`to` zones with `from !== to`,
  canonical facing, a valid in-match round, valid chronology, and a
  destination that exactly agrees with the canonical `resolveGridGrapple`
  resolver. Attack attempts without hits, same-cell hits (no reposition
  possible), ordinary movement, knockback, malformed actor/target semantics
  and report-only statements are never counted.
- **Decision derivation.** `GridGrappleCoverageDecisionV1` returns `not_ready`
  on any hard failure (fewer than 48 completed matches, deterministic
  mismatch, runtime identity mismatch, invalid record/report,
  report/final-state disagreement, invalid chronology, malformed grapple
  event, resolver disagreement, input mutation, artifact-integrity failure,
  invalid base bundle or identity mismatch, or legacy/canary isolation
  regression). It returns `coverage_confirmed` only when there are at least 2
  valid grapple-reposition events, at least 1 in each fighter slot, and at
  least one distinct seed produces a valid reposition in each role assignment;
  otherwise `inconclusive`. The combined readiness addendum derives
  `ready_for_opt_in_beta_review` only when the base is valid and inconclusive
  solely on C04, base knockback and overturn are both observed, and the
  supplement is `coverage_confirmed`; any hard failure gives `not_ready`;
  otherwise `inconclusive`.
- **Immutable supplemental bundle.** The root guard now includes
  `grid-readiness-supplement → data/readiness/grid-supplements` and the
  supplement service rejects `data/readiness/grid`, normal match/series
  storage, both canary roots, other in-repository data roots, descendants,
  symlink/junction ancestry and external symlink roots. Each official
  supplement writes exactly ten regular files (`manifest.json`,
  `base-readiness-reference.json`, `seed-registry.json`,
  `scenario-registry.json`, `run-index.json`, `match-records.json`,
  `factual-reports.json`, `metrics.json`, `decision.json`, `report.txt`) with
  manifest-last immutable publication, complete read-back, exact inventory,
  SHA-256 digests of every non-manifest artifact, schema round trips and
  complete cross-artifact validation (records/reports/run-index binding,
  shared record-evidence inspector, complete report/final-state agreement,
  recomputed run checksums, authoritative grapple evidence, recomputed
  metrics, recomputed decision, recomputed combined classification and
  byte-for-byte report regeneration). No replay text is persisted.
- **Actual official supplemental result.** Exactly one official supplement
  executed (`supplementId 4eca43e2-cc3d-41ee-bfad-73e18238ff61`, artifact
  directory `data/readiness/grid-supplements/4eca43e2-cc3d-41ee-bfad-73e18238ff61/`):
  48/48 deterministic matches, 480 Grappler attempts / 204 hits / 276 misses,
  **8 valid grapple-reposition events** (4 with the attacker in fighter A and
  4 in fighter B, each from 4 distinct seeds), 186 same-cell Grappler hits
  without reposition, 0 wrong-fighter and 0 malformed/resolver-disagreeing
  grapple events. Supplemental coverage decision: **`coverage_confirmed`**.
- **Combined readiness classification.** With the official v3 base valid and
  inconclusive solely on C04 (knockback 36 > 0, overturn 8 > 0) and the
  supplement `coverage_confirmed`, the combined readiness classification is
  **`ready_for_opt_in_beta_review`**. This means only that a separate opt-in
  beta decision may now be considered; it is not an activation decision.
- **No balance qualification, no opt-in beta decision, no default
  activation.** The supplement is additive development-only coverage evidence:
  it does not modify the official v3 evaluation, does not qualify combat
  balance, does not perform the opt-in beta decision and does not activate the
  grid runtime. No official v3 rerun occurred; no benchmark ran and no seed
  bank was opened; held-out and `all` remain sealed; C1/C2/AB2, constants and
  defaults are unchanged; the 24 seeds, seven readiness scenarios, thirteen
  assignments and 312-run plan are unchanged; both canaries and legacy
  match/series are unchanged; no provider or external API call occurred; no
  tuning followed the result; Milestone 0.2C remains incomplete.

Status: Phase 3E1 v1 evaluation **historical**; Phase 3E1.1 v2 evaluation
**historical**; Phase 3E1.2 v3 provenance finalisation **complete**; Phase
3E1.2 v3 official evaluation **complete**; Phase 3E1.3 fatal-agreement
hardening **complete**; Phase 3E1.3.1 coherent tamper proof **complete**;
Phase 3E2 supplemental grapple tooling **complete**; Phase 3E2 official
supplement **complete**; supplemental coverage decision
**`coverage_confirmed`**; combined readiness classification
**`ready_for_opt_in_beta_review`**; opt-in beta decision **not performed**;
default grid activation **not performed**; Milestone 0.2C **not complete**.

## D51: Supplemental grapple evidence provenance hardening (Phase 3E2.1, 2026-08-03)

Phase 3E2.1 hardens the provenance guarantees of the Phase 3E2 supplemental
grapple-reposition bundle. The official v3 evaluation
(`0d8487a8-939d-4f9a-a16a-544b71eaa869`, suite checksum
`c3b8a16d407891d0a92966fb9d6ed20fe5e11776bf545624fb3dbcadb4e2503c`,
classification `inconclusive`) and the official Phase 3E2 supplement
(`4eca43e2-cc3d-41ee-bfad-73e18238ff61`) were **not** altered, replaced,
reinterpreted or rerun.

- **Resolver-valid grapples must be causally backed by a Grappler hit.** The
  strengthened evidence extractor maintains a per-round attack ledger: every
  `attack_attempted` (weapon `grappler`, attacker slot) must resolve to
  exactly one `attack_hit`/`attack_missed` in the same round with canonical
  actor/target/weapon before `round_ended`; a `movement_resolved` grapple must
  consume an unmatched non-same-cell hit in the same round; a second grapple
  for one hit, a grapple without a preceding hit, an outcome without an
  attempt, a duplicate outcome, noncanonical actor/target, a grapple on a
  same-cell hit, noncanonical zones/facing, `from === to`, a `from` that does
  not equal the tracked defender zone, or a destination that disagrees with
  the canonical resolver are all malformed and never count as reposition
  coverage. The 50% reposition roll is never inferred: a non-same-cell hit
  without a movement event is allowed (the roll may have failed).
- **Persisted run-index entries and records are bound to the canonical plan
  and scenario.** Each run-index entry must equal the canonical plan run (run
  number, scenario ID, assignment ID, seed, role swap, competitors), the
  attacker slot is derived from the plan (never trusted from the persisted
  entry), record/report indices must match canonical run order, the run-index
  summary must agree with the authoritative record, the record configuration
  must exactly match the canonical supplemental scenario (machine name,
  chassis, mobility, weapon, utility, armour, policy, ruleset, catalogue;
  attacker weapon `grappler`, target weapon `hammer`), the grid runtime
  identity must be exactly `0.3.0 / grid-3x3-v1 / 0.2.0 / 1`, and every record
  must use the injected supplement timestamp.
- **Decision and addendum payloads are independently rebuilt and compared.**
  The validator rebuilds the complete decision from the recomputed metrics and
  hard checks and requires full equality with the persisted decision; it
  rebuilds the complete combined readiness addendum from the anchored base
  reference and the recomputed metrics and requires full equality with the
  persisted addendum; the combined classification is re-derived from the
  rebuilt addendum; the report is regenerated from the recomputed metrics,
  rebuilt decision, re-derived combined classification and rebuilt addendum.
- **Official base hashes are pinned, not self-declared.** The base identity
  now carries frozen SHA-256 hashes of the official v3 manifest, decision and
  metrics (`46b1b888dd66021fc811451c1db8f22f21c912621fc85a90a4cc52980ff06f85`,
  `d4bf61e1e5c74bbb9181f95d22889fdae263e1520e58e8720e2bfe8cfeb07b9a`,
  `113bfa2cc66e364eab637f3d7c00b8f05602c355133fe21eb2aae6d79467eee4`), and
  anchoring requires every identity field plus these three pinned hashes
  computed over the actual bytes. The service retains the exact start-of-run
  base bytes and re-checks them (plus the pinned hashes) immediately before
  publication: any change is an operational failure that prevents publication.
- **Official supplement passes the stronger validator unchanged.** The frozen
  official supplement passes the complete strengthened bundle validator and
  the frozen official anchor unchanged: 480 attempts / 204 hits / 276 misses,
  8 valid repositions (4 per fighter slot, 4 distinct seeds each), 186
  same-cell hits without reposition, 0 wrong-fighter and 0
  malformed/resolver-disagreeing grapple events; decision
  `coverage_confirmed`; combined readiness classification
  `ready_for_opt_in_beta_review`; all ten artifacts byte-for-byte unchanged.
- **Fully coherent corruption tests.** Nine corruption scenarios rebuild the
  whole bundle coherently (all downstream artifacts, digests and checksums
  consistent with the tamper) and must be rejected by the intended provenance
  rule — not a stale digest: alternate run plan, alternate build, fake
  resolver-valid grapple without a hit, false grapple origin, second grapple
  for one hit, decision payload corruption with the label kept, addendum
  corruption with the combined label kept, cross-envelope supplement-ID
  disagreement, and a base-mutation race (base mutated after anchoring and
  before publication → operational failure, no supplement artifact published).
- **No evaluation rerun, no balance qualification, no opt-in beta decision,
  no default activation.** The official v3 evaluation and the official
  supplement are unchanged historical facts; no official rerun occurred; no
  benchmark ran and no seed bank was opened; held-out and `all` remain sealed;
  C1/C2/AB2, constants, defaults, both canaries and legacy match/series are
  unchanged; no provider or external API call occurred; no tuning followed the
  result; Milestone 0.2C remains incomplete.

Status: Phase 3E1 v1 evaluation **historical**; Phase 3E1.1 v2 evaluation
**historical**; Phase 3E1.2 v3 provenance finalisation **complete**; Phase
3E1.2 v3 official evaluation **complete** and **unchanged**; Phase 3E1.3
fatal-agreement hardening **complete**; Phase 3E1.3.1 coherent tamper proof
**complete**; Phase 3E2 supplemental grapple tooling **complete**; Phase 3E2
official supplement **complete** and **unchanged**; Phase 3E2.1 provenance
hardening **complete**; official supplement under the stronger validator
**passes unchanged**; supplemental coverage decision
**`coverage_confirmed`**; combined readiness classification
**`ready_for_opt_in_beta_review`**; opt-in beta decision **not performed**;
default grid activation **not performed**; Milestone 0.2C **not complete**.

## D52: Bounded opt-in beta governance decision (Phase 3F, 2026-08-03)

Phase 3F performs the separately governed opt-in beta review of the grid
runtime using the frozen official evidence. The official v3 readiness
evaluation and the official supplemental grapple evidence were read,
validated, anchored and snapshotted — **not** altered, replaced,
reinterpreted or rerun. No simulation ran, no benchmark ran, no seed bank was
opened and no provider or external API call occurred.

- **Evidence reviewed.** Official v3 evaluation
  `0d8487a8-939d-4f9a-a16a-544b71eaa869` (suite
  `grid-activation-readiness-v3`, checksum
  `c3b8a16d407891d0a92966fb9d6ed20fe5e11776bf545624fb3dbcadb4e2503c`,
  classification `inconclusive`, only non-pass gate C04; all hard, slot-order,
  progress and other coverage gates passed; frozen base hashes manifest
  `46b1b888…`, decision `d4bf61e1…`, metrics `113bfa2c…`). Official supplement
  `4eca43e2-cc3d-41ee-bfad-73e18238ff61` (suite
  `grid-grapple-coverage-supplement-v1`, scenario-registry checksum
  `1aba546d…`, plan checksum `e30dda08…`, decision `coverage_confirmed`,
  combined `ready_for_opt_in_beta_review`; frozen hashes manifest `a9220d52…`,
  base-reference `c2830114…`, metrics `76d1290f…`, decision `7da3d619…`,
  report `5569aecb…`). The supplement confirmed 48 deterministic matches, 480
  Grappler attempts / 204 hits / 276 misses, 8 valid grapple-reposition events
  (4 per fighter slot, 4 distinct seeds each), 186 same-cell hits without
  reposition, 0 wrong-fighter and 0 malformed/resolver-disagreeing events.
- **Bounded-beta policy contract.** The frozen versioned contract
  `grid-opt-in-beta-contract-v1` (checksum
  `5f345ce4e933a4cc1f9db7633c1e03d21e8b323d65d36eb7f52ef5251953fff6`, purpose
  `internal-bounded-grid-beta-implementation`) binds any later implementation:
  explicit beta-labelled selection only (absence → legacy; invalid selection
  fails closed), legacy default isolation with no silent grid/legacy fallback,
  internal/development single-match scope with schema-v3 persistence and the
  complete frozen grid identity, user/operator clarity banners, one immediate
  deterministic kill switch, migration-free rollback, and frozen suspension
  triggers (nondeterminism, schema-v3 failure, record/report disagreement,
  replay disagreement, wrong runtime identity, legacy-default regression,
  cross-root isolation failure, silent fallback, corrupt/unreplayable v3
  record, canary regression, evidence-anchor failure).
- **Actual governance decision.** One official governance decision executed
  (`decisionId 58e8cd87-504e-4b5f-9bac-f6b81d82377b`, immutable bundle under
  `data/readiness/grid-governance/58e8cd87-504e-4b5f-9bac-f6b81d82377b/`;
  source commit
  `5173fd0f287465e1181969dbad2f37cee10fd47e`). Every governance criterion
  passed (official v3 and supplement validated and anchored exactly; all hard
  readiness gates passed; C04 the sole base non-pass gate; supplement
  `coverage_confirmed`; combined `ready_for_opt_in_beta_review`; both attacker
  slots and distinct seeds produced causal grapple reposition; legacy remains
  the active default; schema-v3 persistence/replay available; deterministic
  rollback possible; complete contract and safeguards; no default/public
  activation requested; no forbidden claims; frozen constraints unchanged).
  Governance outcome: **`approved_for_bounded_opt_in_beta_implementation`**.
- **Exact authorised scope.** A positive decision authorises at most
  implementation of a bounded, explicitly selected, internal/development grid
  beta: explicitly beta-labelled single matches, deterministic local scripted
  fighters, schema-v3 persistence with the complete frozen grid identity, and
  existing grid text/ASCII replay, factual reports and review prompts.
- **Explicitly forbidden scope.** Public default selection, ranked matches,
  prizes/rewards/monetised outcomes, tournaments, adaptation evaluation,
  held-out evaluation, mixed-runtime series, automatic migration of legacy
  matches, provider-driven autonomous runtime selection, production
  matchmaking, balance claims, public rollout, default activation and changing
  the default runtime.
- **Kill switch and rollback.** Any later implementation must include one
  immediate deterministic kill switch that prevents new grid-beta matches
  without affecting legacy matches, without deleting existing v3 records and
  with existing v3 replay remaining available; rollback must require no data
  migration and no change to legacy records.
- **Unresolved risks.** Combat balance of the grid runtime is not evaluated
  and not claimed; the beta surface, CLI and selection contract are not
  implemented in this phase; long-running v3 persistence/replay/mixed-storage
  behaviour is not production-observed; performance observations are
  development-only and may trigger review without changing gameplay or
  evidence thresholds. None of these blocks the bounded internal
  implementation approval.
- **No implementation, no activation.** C2 remains the experimental
  component-qualification default; no runtime selector, beta surface or
  grid wiring was added to any normal command; legacy remains default
  (`0.2.0 / 0.2.0`, catalogue `1`); grid identity remains
  `0.3.0 / grid-3x3-v1 / 0.2.0 / 1`; both canaries and legacy match/series
  are unchanged; no balance claim is authorised; no default activation; no
  public rollout; no evaluation rerun; Milestone 0.2C remains incomplete
  until a separately reviewed bounded opt-in implementation is completed.

Status: Official v3 readiness evidence **complete and unchanged**; Official
grapple supplement **complete and unchanged**; Phase 3E2.1 provenance
hardening **complete**; Phase 3F governance tooling **complete**; Phase 3F
official governance decision **complete**; governance outcome
**`approved_for_bounded_opt_in_beta_implementation`**; bounded opt-in beta
implementation **not started**; grid runtime enabled **no**; legacy default
**yes**; public rollout **not authorised**; balance qualification **not
performed**; Milestone 0.2C **not complete**.

## D53: Bind the governance decision to the exact reviewed source snapshot (Phase 3F.1, 2026-08-06)

Phase 3F.1 closes the remaining provenance gap in the Phase 3F governance
decision: `source-state.json` recorded the authorised source-commit string and
static-preflight booleans, but nothing proved that the reviewed source bytes
came from that Git commit, and the validator reconstructed approval from the
persisted source-state claims. Additionally, the two canary-isolation booleans
were hard-coded to `true`. This correction adds a reviewed source snapshot and
strengthened official anchoring without rerunning or altering the official
Phase 3F governance decision.

- **Why a commit string alone was insufficient.** A `sourceCommit` string
  inside the bundle is a claim, not proof. Any coherent rewrite of the
  persisted source-state booleans (and the downstream decision, report,
  manifest and digests) could reconstruct an approval that no reviewed source
  actually supports. The official approval is therefore authoritative only
  when the unchanged official seven-file bundle AND the exact reviewed Git
  source snapshot at commit `5173fd0f…` both validate.
- **Reviewed source snapshot identity.** Snapshot
  `grid-opt-in-beta-reviewed-source-v1` (repository
  `hourwise/AI-Agent-Robot-Battle-Wars`, source commit
  `5173fd0f287465e1181969dbad2f37cee10fd47e`, deterministic snapshot checksum
  `1f984801f6e7ed1809080f88e84004e8dc426de31c2e877dfbbcb09967c3680c`). The
  snapshot covers 26 reviewed files (ordered paths, Git blob SHA and content
  SHA-256 each) that materially establish legacy default routing, schema-v2/v3
  persistence, grid replay availability, grid runtime identity, C1/C2/AB2
  checksums and the C2 default, canary isolation and the absence of
  automatic/default grid selection.
- **Exact commit-object source reading.** The provenance tooling reads the
  reviewed bytes from the Git commit object (`git rev-parse --verify
<commit>:<path>` and `git cat-file blob <sha>`, argument-array process API
  only, never a shell with interpolated input). It requires commit
  `5173fd0f…` to exist locally, requires every reviewed path to exist in that
  commit, rejects shallow/missing objects instead of silently using current
  files, rejects a different commit, never modifies the repository and never
  accesses the network. No working-tree byte is substituted for a
  commit-object byte.
- **Reviewed source facts.** `GridOptInBetaReviewedSourceFactsV1` is
  reconstructed from the exact committed bytes: normal match/series use legacy
  `runMatch`; neither normal path invokes `runGridMatch`; grid exists only as
  the explicit alternate `runGridMatch`; global simulator/ruleset constants
  `0.2.0/0.2.0`; catalogue `1`; grid identity
  `0.3.0/grid-3x3-v1/0.2.0/1`; schema-v2 legacy converter path present;
  schema-v3 grid converter path present; schema-v3 replay dispatch present; no
  normal application command automatically selects grid; both canary source
  files equal the exact reviewed snapshot; C1/C2/AB2 checksums and the C2
  default remain frozen.
- **Removal of hard-coded canary source claims.** The canary source-isolation
  booleans are no longer hard-coded to `true`. They are derived from the
  reviewed snapshot and its frozen canary file hashes (`match-canary` content
  `4ce94b9c…`, `grid-series-canary-core` content `41cd2631…`). The test suite
  separately proves the canary executions pass, but the governance artifact
  no longer claims canary source isolation without a source binding.
- **Canonical source-state assertion.**
  `assertCanonicalGridOptInBetaGovernanceSourceState` requires a persisted
  `source-state.json` to agree with the canonical reviewed source state
  (repository name, source commit, global identities, contract ID/checksum,
  all static-preflight outcomes, canary-isolation outcomes, governance inputs
  and the exact expected shape). The official `source-state.json` passes
  unchanged; a generic governance bundle can no longer validate after
  coherently rewriting arbitrary source-state booleans.
- **Frozen official governance hashes.** The official Phase 3F bundle identity
  is frozen with exact SHA-256 hashes of the seven persisted artifacts:
  `manifest.json 0f143dde…`, `source-state.json 5721585d…`,
  `base-evidence-reference.json 972d99b9…`,
  `supplement-evidence-reference.json 0cc07da6…`,
  `beta-contract.json 5f345ce4…`, `decision.json da377b33…`,
  `report.txt 63259937…`.
- **Official governance anchor result.**
  `anchorOfficialGridOptInBetaGovernanceDecision` requires the unchanged
  official seven-file bundle (validated, exact decision ID `58e8cd87…`, exact
  reviewed source commit `5173fd0f…`, exact outcome
  `approved_for_bounded_opt_in_beta_implementation`, exact contract identity
  and all seven frozen hashes) together with successful validation of the
  reviewed Git source snapshot at commit `5173fd0f…`, its canonical source
  facts and the canonical source state. The official Phase 3F governance
  decision **passes the strengthened anchor** and its outcome remains
  **`approved_for_bounded_opt_in_beta_implementation`**.
- **Future service correctness.** Future non-official governance runs
  construct the source state from the exact configured Git commit snapshot,
  never write a commit string supplied without verifying the commit object,
  never derive source facts from uncommitted working-tree changes, and fail
  before publication if the commit or required blobs are unavailable; the
  evidence immutability checks and the no-simulation behaviour are retained.
- **No governance rerun, no implementation.** The official Phase 3F decision
  was not rerun and its bytes remain unchanged; no readiness or supplement
  evaluation ran; no benchmark ran; no seed bank was opened; held-out and
  `all` remained sealed; no provider or external API call occurred; no beta
  selector or implementation was added; no runtime was enabled; no default
  changed; no public rollout or balance claim was authorised; Milestone 0.2C
  remains incomplete.

Status:

```
Official v3 readiness evidence:          complete and unchanged
Official grapple supplement:             complete and unchanged
Official Phase 3F governance decision:   complete and unchanged
Phase 3F.1 source-provenance hardening:  complete
official governance decision under strengthened anchor: pass
governance outcome:                      approved_for_bounded_opt_in_beta_implementation
bounded opt-in beta implementation:      not started
legacy default:                          yes
grid runtime enabled:                    no
public rollout:                          not authorised
balance qualification:                   not performed
Milestone 0.2C:                          not complete
```

## D54: Bounded explicit grid beta implementation (Phase 3G, 2026-08-06)

Phase 3G implements the one explicitly selected, internal/development,
local-scripted, single-match grid-beta surface authorised by the authoritative
Phase 3F governance decision (`58e8cd87-504e-4b5f-9bac-f6b81d82377b`,
outcome `approved_for_bounded_opt_in_beta_implementation`, reviewed source
commit `5173fd0f…`, snapshot `grid-opt-in-beta-reviewed-source-v1` checksum
`1f984801…`, contract `grid-opt-in-beta-contract-v1` checksum
`5f345ce4…`). No official beta match was executed during implementation; the
beta path was exercised only through tests using external temporary roots.

- **Explicit beta command and acknowledgement.** The only beta command is
  `match:grid:beta` (`npm run match:grid:beta -- --seed <n> --fighter-a <id>
--fighter-b <id> --acknowledge-grid-beta`; optional `--help`). All match
  arguments are required except `--help`; unknown or duplicate arguments
  fail; there is no `--runtime` argument, no alternate output root and no
  provider/model argument. Missing acknowledgement fails before fighter
  loading, ID generation, simulation or writes; invalid selection fails
  closed. The explicit command and acknowledgement are the only way to select
  grid — no environment, stored preference, previous record or fallback may
  select grid, and no grid/legacy failure retries through the other runtime.
- **Implementation identity and banner.** Implementation
  `grid-opt-in-beta-match-v1`; banner
  `FORGE ARENA — GRID 3×3 BETA / OPT-IN / EXPERIMENTAL / NOT BALANCE-QUALIFIED
/ LEGACY REMAINS THE DEFAULT`; the beta disclaimer states that the match
  does not change the default runtime, qualify combat balance, authorise
  ranked or public play, or permit the result to be treated as an adaptation
  or held-out evaluation.
- **Local fighter-spec format.** `GridBetaFighterSpecV1`
  (`schemaVersion "1"`, `sourceKind "local-scripted"`, `fighterId`, display
  name, `buildProposal`, `policy`), loaded by identifier from the fixed root
  `data/beta/grid-fighters/<fighterId>.json`. Strict schema, catalogue-v1
  build validation and the authoritative policy schema (no duplicated logic),
  canonical JSON serialization and a deterministic SHA-256 checksum. Input
  security: identifiers only (no paths, `/`, `\`, `..`, drive letters, URLs or
  encoded traversal), missing/non-regular files rejected, symbolic links and
  junctions in the input ancestry rejected, the resolved path required to stay
  under the exact fighter root, a maximum JSON size enforced, and the file
  basename required to agree with the internal `fighterId`. User/input/schema
  failures never engage the suspension marker. The same fighter may occupy
  both slots for a mirror match.
- **Suspension marker and triggers.** One deterministic marker at
  `data/beta/GRID_BETA_SUSPENDED`; any filesystem entry there (including
  malformed contents, a symbolic link or a junction) suspends only new
  grid-beta matches. Legacy matches/series are unaffected and existing beta
  records/replays remain readable. No command clears or bypasses the marker.
  Trigger codes: `governance_anchor_failure`, `legacy_default_regression`,
  `canary_regression`, `nondeterministic_result`, `runtime_identity_mismatch`,
  `schema_v3_validation_failure`, `record_report_disagreement`,
  `replay_reconstruction_disagreement`, `silent_runtime_fallback`,
  `cross_root_persistence_failure`, `bundle_integrity_failure`,
  `corrupt_or_unreplayable_v3_record`. The marker is created atomically and
  never overwrites an existing marker; if marker creation itself fails the
  beta fails closed and reports both the trigger and the marker-write failure.
- **Governance anchoring before every beta match.** Before any beta match ID
  is generated, any simulation occurs or any artifact directory is created,
  the exact seven official governance artifacts are read from
  `data/readiness/grid-governance/58e8cd87-…/`, exactly seven regular files
  are required, all seven bytes are snapshotted, and
  `anchorOfficialGridOptInBetaGovernanceDecision` is called (which also
  requires the exact reviewed Git source snapshot). The governance bytes are
  re-checked immediately before simulation and immediately before
  publication. A bundle that is absent, invalid, altered or no longer anchors
  executes no beta match, publishes no beta bundle and engages the suspension
  mechanism.
- **Protected legacy-source preflight.** A read-only preflight runs against
  the current checkout before each beta simulation (and again before
  publication), requiring the current bytes of all protected files to equal
  their frozen reviewed-source identities (with checkout CRLF normalised to
  the committed LF form), normal match/series still calling legacy
  `runMatch`, neither normal path invoking `runGridMatch` or the beta service,
  global versions `0.2.0 / 0.2.0`, catalogue `1`, C1/C2/AB2 frozen with C2
  default, grid identity separate, both canary sources frozen, and
  schema-v2 legacy conversion plus schema-v3 grid conversion/replay present.
  The check is computed from the actual current bytes — never from mutable
  persisted booleans alone. A mismatch is `legacy_default_regression` or
  `canary_regression` and suspends the beta.
- **Deterministic execution.** The pure core `executeGridBetaMatch` calls only
  `runGridMatch` with the supplied non-negative integer seed, fresh validated
  builds/policies, ruleset `0.2.0`, catalogue `1` and explicit C2
  component qualification. The same match is executed twice with identical
  inputs and every simulator fact (runtime identity, config, initial states,
  complete ordered event streams, result, rounds) must be equal; only the
  primary result is published. Any mismatch is `nondeterministic_result` and
  suspends the beta.
- **Schema-v3 persistence and immutable beta bundle.** The primary result is
  converted through `matchResultToRecord` with an injected match UUID and
  timestamp (schema v3, empty agent usage), the factual-report v2 is bound,
  both schemas validated, readiness record evidence inspected, record/report
  final-state agreement asserted, replay reconstruction agreement required,
  text/ASCII replay and review prompt rendered, and every fighter/config/seed/
  C2/runtime identity bound. Each match publishes exactly ten regular files
  under `data/beta/grid-matches/<matchId>/` (`manifest.json`, `selection.json`,
  `fighter-a.json`, `fighter-b.json`, `execution-attestation.json`,
  `match.json`, `factual-report.json`, `text-replay.txt`, `ascii-replay.txt`,
  `review-prompt.txt`) with manifest-last immutable publication, collision
  preflight, temporary-directory cleanup, exact inventory, regular files only,
  complete read-back, schema round trips, and a complete cross-agreement
  validator `validateGridBetaMatchBundle`. The output-root guard
  (`grid-beta-match → data/beta/grid-matches`) rejects normal match/series
  storage, both canary roots, readiness/supplement/governance roots, the
  fighter-input root, the suspension-marker path and every other
  in-repository data root. Immediately before publication the suspension
  marker, all seven governance bytes and the protected-source preflight are
  re-checked.
- **Read-only beta replay.** `replay:grid:beta --match <uuid> [--ascii]` reads
  from the fixed root, validates the complete bundle before displaying
  anything, shows the banner/disclaimer, displays the stored text replay
  (default) and optionally the validated ASCII replay, performs no simulation,
  calls no provider, ignores the suspension marker so existing v3 replays stay
  readable, does not modify the normal `replay` command and does not read
  normal match storage.
- **Scope and status.** No official beta match was executed; no governance
  decision, readiness evaluation, supplement or benchmark ran; no seed bank
  was opened; held-out and `all` remained sealed; no provider or external API
  call occurred; normal match/series remained unchanged on legacy; no runtime
  fallback was introduced; official readiness, supplement and governance bytes
  remained unchanged; no default/public/ranked/tournament activation occurred;
  no balance conclusion was made; Milestone 0.2D did not begin. The explicit
  internal beta command is implemented but **not yet independently reviewed**;
  Milestone 0.2C remains incomplete pending that review.

Status:

```
Official v3 readiness evidence:          complete and unchanged
Official grapple supplement:             complete and unchanged
Official Phase 3F governance decision:   complete, unchanged and source-anchored
Phase 3G bounded beta implementation:    complete
Phase 3G.1 safety/provenance hardening:  complete
explicit internal beta command:          implemented, not yet authorised for first real execution
legacy default:                          yes
grid default activation:                 no
public rollout:                          not authorised
ranked/tournament use:                   not authorised
balance qualification:                   not performed
Milestone 0.2C:                          not complete pending independent Phase 3G.1 review
```

## D55: Grid-beta safety and provenance hardening (Phase 3G.1, 2026-08-06)

Phase 3G.1 hardens the bounded grid-beta safety and artifact provenance after
independent review found the Phase 3G architecture correct but incomplete on
several concurrency, filesystem and persisted-evidence guarantees. No real
beta match was executed, no real suspension marker was created and no
official readiness, supplement or governance artifact was altered. The Phase
3G implementation remains unexecuted and not yet authorised for its first
real execution.

- **Pre-simulation checkpoint window closed.** The final pre-simulation work
  is ordered so no asynchronous preflight occurs after the final governance
  and suspension checks: load and validate fighter inputs → generate/check
  the collision-free identity → run the canonical protected legacy-source
  preflight and require the exact canonical pass → re-read and require the
  governance bytes unchanged → require the suspension marker absent → execute
  `runGridMatch` synchronously with no await between the final marker check
  and entry into the pure execution core. Race tests prove zero execution
  calls, no bundle and the correct suspension when a marker appears or a
  governance artifact changes during the preflight.
- **Final safety hook before atomic publication.** The shared immutable
  publisher gained an optional `beforeAtomicPublish` hook that runs after all
  temporary artifacts are written and the complete temporary bundle is
  validated, immediately before the atomic rename. Existing canary,
  readiness, supplement and governance callers remain byte- and
  behaviour-compatible without the hook. The grid-beta caller uses it to
  re-run the complete protected-source preflight, require the governance
  bytes unchanged, require the suspension marker absent and recheck the
  physical output-root integrity. A typed `GridBetaSafetyError` carries the
  original trigger and message; on failure the temporary directory is
  cleaned up, no final bundle exists, and the service creates the suspension
  marker exactly once with the correct trigger (never collapsing every
  failure into `bundle_integrity_failure`).
- **Genuinely exclusive suspension-marker creation.** `CanaryFileSystem`
  gained `writeFileExclusive` (no-clobber `wx` semantics). The final marker
  path is created directly; it can never replace an existing file, malformed
  marker, directory, symbolic link or junction; a partial marker still means
  suspended; no temporary-marker rename is used; concurrent creators result
  in exactly one created marker and one closed failure; existing marker bytes
  are never replaced. The marker parent is securely created when missing and
  the complete ancestry is inspected from the filesystem root before and
  after creation, rejecting symbolic links, junctions and non-directory
  components.
- **Strict beta machine schemas.** All beta-owned machine schemas
  (`GridBetaFighterSpecV1`, `GridBetaSelectionV1`,
  `GridBetaExecutionAttestationV1`, `GridBetaMatchManifestV1` and nested
  beta-owned objects) are strict. Unknown fields such as `provider`, `model`,
  `runtime`, `outputRoot`, `ranked`, `tournament` and `balanceQualified`
  reject rather than silently disappear. Fighter artifacts must be the
  canonical byte serialization of the parsed spec.
- **Authoritative persisted fighter validation.** The bundle validator parses
  every fighter artifact through the same authoritative path used by live
  loading (`parseGridBetaFighterSpec`): strict schema, identifier agreement,
  display-name sanitisation and agreement, authoritative catalogue-v1 build
  and policy validation, canonical serialization and the deterministic
  checksum — no shape-only duplicate parser.
- **Complete validated-build binding.** The authoritative `ValidatedBuild` is
  reconstructed with the existing catalogue validator and compared field-for-
  field (proposal, total cost, armour cost, total armour points, catalogue
  version) against the record config and initial-state builds; policies must
  match exactly; record config and initial-state builds must match one
  another completely. A schema-shaped over-budget build, invalid catalogue
  ID, inconsistent derived cost or inconsistent armour total rejects even
  when every artifact is coherently rewritten.
- **Complete C2 metadata binding.** The canonical C2 metadata is built from
  the authoritative registry (`getComponentQualificationConfig` +
  `getComponentQualificationMetadata`) and must agree exactly across the
  selection, the record and the record config: `id component-impact-c2`,
  `model linear-component-impact`, `configChecksum 13548462df34a183`. A
  record that retains the C2 ID while changing the model or checksum rejects;
  a separately persisted checksum is never trusted without comparing the
  complete canonical metadata.
- **Canonical successful preflight.** A published beta match requires the
  exact canonical pass: `status pass`, `trigger null`, `failures []` and every
  detailed boolean exactly `true`, applied both when building the selection
  and during bundle read-back validation. `status: pass` with contradictory
  detailed values is rejected. Manifest safety requires
  `protectedSourcePreflightStatus pass` and `suspensionStatus clear`.
- **Execution-attestation provenance.** The attestation builder receives
  explicit confirmed outcomes from the service (governance unchanged before
  simulation and at the final publication gate, suspension absent at each
  checkpoint, preflight pass, deterministic equality, empty agent usage,
  record/report agreement, replay reconstruction agreement, no legacy
  fallback, temporary bundle validation) and fails if any supplied
  confirmation is not true. The primary checksum is bound to the persisted
  record reconstruction (`attestation.primaryResultChecksum ===
gridBetaMatchResultChecksum(gridRecordToGridResult(record))`); the repeat
  checksum equals the primary checksum as an execution attestation because
  the repeat event stream is intentionally not persisted; `manifest.createdAt
=== record.createdAt`.
- **Deterministic repeat input isolation.** The execution core constructs
  independent fresh input graphs for the primary and repeat executions
  (never one shared mutable config). Before and after each execution the
  supplied build and policy inputs must remain unchanged, so simulator
  mutation of the config, build or policy and any primary-influences-repeat
  contamination are detected. The production application service has no
  alternate simulator injection; only a test-only seam around the fixed
  imported `runGridMatch` accepts an injected runner.
- **Governance inventory hardening.** `readGovernanceBundle` lists every
  directory entry including dotfiles, sorts both actual and expected lists,
  requires exact equality, and requires every entry to be a regular
  non-symlink file. Hidden extras, nested directories and other entry types
  are rejected.
- **Fighter input ancestry hardening.** Every existing component from the
  filesystem root through the fighter root and the target fighter file is
  inspected with `lstat` (never `stat`); symbolic-link or junction parents
  above the fighter root, a symbolic-link fighter root, symbolic-link nested
  directories, symbolic-link final files and non-directory ancestry
  components are rejected. The final file entry is rechecked after reading to
  reduce substitution races.
- **Physical replay inventory validation.** Before reading any replay
  content, the physical match directory must contain exactly the ten expected
  entries as regular files (no symbolic links, no directories, no hidden or
  unexpected file, no missing artifact); the complete bundle is then
  validated. An eleventh file, a hidden file, a nested directory, a
  symbolic-link required artifact or an artifact that changes between
  inventory inspection and read-back rejects before display. Replay remains
  readable while the suspension marker exists.
- **Coherent corruption coverage.** Fully coherent corruption tests rebuild
  every affected downstream artifact and digest so rejection cannot depend on
  a forgotten checksum: catalogue-invalid fighter, proposal/derived-build
  disagreement, altered C2 metadata, contradictory preflight, false execution
  checksum, active suspension status, unknown fields, and created-at
  disagreement.
- **Scope and status.** No real beta match ran; no real suspension marker was
  created; no readiness, supplement or governance command ran; no benchmark
  ran; no seed bank was opened; held-out and `all` remained sealed; no
  provider or external API call occurred; normal match/series/replay remained
  unchanged on legacy; both canaries remained unchanged; official readiness,
  supplement and governance bytes (all seven hashes) remained unchanged;
  governance source snapshot, policy-contract checksum and C1/C2/AB2 (with C2
  default) remained frozen; simulator/ruleset/catalogue identities remained
  unchanged; no default/public/ranked/tournament activation occurred; no
  balance conclusion was made; Milestone 0.2D did not begin.

Status:

```
Official v3 readiness evidence:          complete and unchanged
Official grapple supplement:             complete and unchanged
Official Phase 3F governance decision:   complete, unchanged and source-anchored
Phase 3G bounded beta implementation:    complete
Phase 3G.1 safety/provenance hardening:  complete
Phase 3G.1.1 final trust-boundary hardening: complete
first real internal beta match:          not yet authorised
legacy default:                          yes
grid default activation:                 no
public rollout:                          not authorised
ranked/tournament:                       not authorised
balance qualification:                   not performed
Milestone 0.2C:                          not complete pending independent Phase 3G.1.1 review
```

## D56: Close the final grid-beta trust boundaries (Phase 3G.1.1, 2026-08-07)

Independent review confirmed that Phase 3G.1 closed the major concurrency,
provenance and persisted-artifact issues. Three narrow trust-boundary issues
remained before the first real beta match may be authorised, and Phase 3G.1.1
corrects only those. Phase 3G.1 itself remained unexecuted (no real beta
match or suspension marker was ever created), no official readiness,
supplement or governance artifact was altered, and no beta command ran.

- **Unbypassable production beta service.** The public match request now
  contains only `seed`, `fighterA`, `fighterB` and `acknowledgement`; the
  production-request overrides for `outputRoot`, `fighterRoot`,
  `governanceBundleDir` and `suspensionMarkerPath` were removed. The
  production dependency contract no longer contains an `execute?` seam, so
  no production caller can replace the simulator or execution core: every
  production invocation enters the fixed imported `executeGridBetaMatch`
  (which hard-codes `runGridMatch`) and always uses exactly
  `data/beta/grid-fighters`, `data/beta/grid-matches`,
  `data/readiness/grid-governance/58e8cd87-504e-4b5f-9bac-f6b81d82377b` and
  `data/beta/GRID_BETA_SUSPENDED`.
- **Structurally separate test harness.** Phase 3G.1.1 introduced an explicit
  `runGridBetaMatchWithTestEnvironment` test harness with temporary roots and
  an optional `onExecutionStart` observer. Phase 3G.1.2 later removed that
  source-level harness entirely and replaced it with a test-only
  path-remapping `CanaryFileSystem` wrapper in `tests/helpers/`, so no
  shipped `src/` module exists to bypass the fixed production paths. The
  observer only counts entry into the fixed `executeGridBetaMatch` core and
  can never replace or modify the execution result; there is no alternate
  result-producing simulator anywhere in the production service. The pure
  execution-core test seam (`executeGridBetaMatchWithRunner`) remains only
  for direct unit testing of repeat-input mutation detection.
- **Marker-parent creation never follows an ancestor.** The marker parent is
  resolved and its complete ancestry is walked from the filesystem root with
  `lstat` before any directory is created. Every existing component must be a
  real directory (symbolic links, junctions, files and other entries are
  rejected). The walk stops at the first missing component and missing
  directories are created incrementally — one non-recursive `mkdir` at a time
  beneath the last verified real directory — so no recursive `mkdir` ever
  follows an existing symbolic-link ancestor to create a missing descendant.
  Each created component is immediately `lstat`-verified, and the complete
  ancestry is re-inspected before and after exclusive (`wx`) marker creation.
  A real-link test proves that `real root/link -> outside/` with marker path
  `real root/link/missing/GRID_BETA_SUSPENDED` rejects with `outside/missing`
  never created, no marker outside and existing outside contents unchanged.
- **Physical replay validation before and after every read.** Replay keeps
  the initial exact ten-entry inventory check, then for each artifact uses a
  stable regular-file read sequence: `lstat` before read (require a regular
  non-symbolic-link file), read the exact contents, `lstat` after read
  (require a regular non-symbolic-link file). After all ten reads the exact
  inventory is required once more before semantic validation. A deterministic
  injected-filesystem race proves that a regular-file-to-symbolic-link
  substitution immediately after the inventory rejects through the physical
  regular-file rule even when `readFile` returns the original valid bytes;
  deletion during reading and a physical inventory change after one artifact
  has been read also reject. Extra/hidden/nested entries, semantic byte
  corruption, valid immutable bundles and replay-while-suspended behaviour
  are unchanged.
- **Schema consistency cleanup.** The beta-owned suspension-marker object
  schema is now strict (unknown fields reject) without altering any generated
  marker field or frozen identity.
- **Scope and status.** Phase 3G.1 remained unexecuted; no real beta match
  or marker was created; no readiness, supplement or governance command ran;
  no benchmark ran; no seed bank was opened; held-out and `all` remained
  sealed; no provider or external API call occurred; normal match/series/
  replay remained unchanged on legacy; both canaries remained unchanged;
  official readiness, supplement and governance bytes (all seven hashes)
  remained unchanged; governance source snapshot, policy-contract checksum
  and C1/C2/AB2 (with C2 default) remained frozen; simulator/ruleset/
  catalogue identities remained unchanged; no default/public/ranked/
  tournament activation occurred; no balance conclusion was made; Milestone
  0.2D did not begin. The first real internal beta match remains not yet
  authorised, pending independent Phase 3G.1.1 review.

Status:

```
Official v3 readiness evidence:          complete and unchanged
Official grapple supplement:             complete and unchanged
Official Phase 3F governance decision:   complete, unchanged and source-anchored
Phase 3G bounded beta implementation:    complete
Phase 3G.1 safety/provenance hardening:  complete
Phase 3G.1.1 final trust-boundary hardening: complete
Phase 3G.1.2 production API sealing:     complete
first real internal beta match:          not yet authorised
legacy default:                          yes
grid default activation:                 no
public rollout:                          not authorised
ranked/tournament:                       not authorised
balance qualification:                   not performed
Milestone 0.2C:                          not complete pending independent Phase 3G.1.2 review
```

## D57: Seal the grid-beta production API boundary (Phase 3G.1.2, 2026-08-07)

Independent review passed all Phase 3G.1.1 filesystem and replay hardening but
found one final architectural issue: `runGridBetaMatchWithEnvironment` was
exported from the production module `src/app/grid-beta-match.ts`, so any
programmatic caller could import the environment-taking function directly and
supply alternate fighter/output/governance/suspension paths. Phase 3G.1.2
closes that final bypass without changing any beta behaviour. Phase 3G.1
remained unexecuted; no real beta match or suspension marker was ever created
and no official readiness, supplement or governance artifact was altered.

- **Final alternate-root runner removed.** `runGridBetaMatchWithEnvironment`
  and the `GridBetaMatchEnvironment` type are no longer exported from
  production source. `src/app/grid-beta-match.ts` now exposes only
  `runGridBetaMatch(request, dependencies?)` with a request containing only
  `seed`, `fighterA`, `fighterB` and `acknowledgement`; no exported function
  or interface accepts alternate `outputRoot`/`fighterRoot`/
  `governanceBundleDir`/`suspensionMarkerPath`. The production entry point
  directly assigns the four frozen canonical roots and always enters the
  fixed `executeGridBetaMatch` (which hard-codes `runGridMatch`); there
  remains no alternate execution-result injection.
- **Test-only path-remapping filesystem.** Tests still need temporary
  storage, so a test-only `CanaryFileSystem` wrapper in `tests/helpers/`
  (`grid-beta-mapped-fs.ts`) transparently redirects the canonical beta
  logical paths onto an external temporary directory: `data/beta/
grid-fighters` → `<temp>/fighters`, `data/beta/grid-matches` →
  `<temp>/matches`, `data/beta/GRID_BETA_SUSPENDED` → `<temp>/marker` and
  `data/readiness/grid-governance/<official-id>` → `<temp>/governance`, with
  the marker parent `data/beta` redirected to the temp root so no real
  `data/beta` tree is created. Production code still sees only canonical
  logical paths; the injectable-filesystem dependency is a general
  testability seam, not a beta-root selection API; ordinary
  repository/source-file reads used by the protected-source preflight
  continue to access the genuine checkout. The source-level test harness
  (`src/app/grid-beta-match-test-harness.ts`) was deleted — all environment/
  path remapping support lives only in `tests/helpers/`.
- **General execution observer.** The general dependency contract now
  carries a non-result-producing `onExecutionStart?: () => void` observer
  that is invoked immediately before the fixed `executeGridBetaMatch(...)`
  call. It receives no match data and cannot cancel, replace or mutate
  execution; the existing source-commit reader, UUID and clock injection
  remain.
- **Static API-boundary regression.** A source regression proves
  `runGridBetaMatchWithEnvironment` and `GridBetaMatchEnvironment` are
  absent, no exported function/interface contains the four root fields,
  `GridBetaMatchRequest` contains only the four authorised fields,
  `runGridBetaMatch` directly supplies the four canonical constants, the
  service calls only fixed `executeGridBetaMatch`, and no `execute?:`
  dependency exists. A full `src/**/*.ts` scan proves no alternate-root beta
  runner exists under another name (the read-only replay loader is the only
  beta API that legitimately takes a root).
- **Runtime regression through the real entry point.** Using the test-only
  mapped filesystem, the complete beta path executes through production
  `runGridBetaMatch` itself: logical production paths are requested, the
  mapping redirects them only inside the test adapter, exactly one fixed
  `executeGridBetaMatch` entry occurs, a valid ten-file temporary bundle
  results, and real `data/beta` remains absent. All existing pre-simulation
  marker/governance races and pre-publication marker/governance/source races
  now run through `runGridBetaMatch` itself with unchanged safety outcomes.
- **Scope and status.** No real beta match or marker was created; no
  readiness, supplement or governance command ran; no benchmark ran; no seed
  bank was opened; held-out and `all` remained sealed; no provider or
  external API call occurred; normal match/series/replay remained unchanged
  on legacy; both canaries remained unchanged; official readiness, supplement
  and governance bytes (all seven hashes) remained unchanged; governance
  source snapshot, policy-contract checksum and C1/C2/AB2 (with C2 default)
  remained frozen; simulator/ruleset/catalogue identities remained unchanged;
  no default/public/ranked/tournament activation occurred; no balance
  conclusion was made; Milestone 0.2D did not begin. The first real internal
  beta match remains not yet authorised, pending independent Phase 3G.1.2
  review.

Status:

```
Official v3 readiness evidence:          complete and unchanged
Official grapple supplement:             complete and unchanged
Official Phase 3F governance decision:   complete, unchanged and source-anchored
Phase 3G bounded beta implementation:    complete
Phase 3G.1 safety/provenance hardening:  complete
Phase 3G.1.1 trust-boundary hardening:   complete
Phase 3G.1.2 production API sealing:     complete
first real internal beta match:          not yet authorised
legacy default:                          yes
grid default activation:                 no
public rollout:                          not authorised
ranked/tournament:                       not authorised
balance qualification:                   not performed
Milestone 0.2C:                          not complete pending independent Phase 3G.1.2 review
```

## D58: Close Milestone 0.2C and authorise bounded internal grid beta operation (2026-08-07)

Independent review passed Phase 3G.1.2 at commit
`8b96161bb22f927179cfd350d390fdca23b062fd`. Milestone 0.2C is therefore
**COMPLETE**, and the first tightly controlled internal grid-beta match was
authorised and executed exactly once as an operational smoke test of the
completed 0.2C beta surface. It is not Milestone 0.2D and must not become
balance evaluation, opponent-suite work or tuning. No benchmark seed bank was
opened, no readiness/grapple-supplement/governance generation ran, no provider
or external API was called, and held-out and `all` remained sealed.

- **GRID-BETA-001 (Run 001).** Seed `20260807`; `beta-smoke-01` vs
  `beta-smoke-01` — a deliberate mirror match so the first operational run is
  not treated as comparative balance evidence. The local smoke fighter
  `data/beta/grid-fighters/beta-smoke-01.json` was constructed only from the
  public catalogue-v1 definitions, the authoritative fighter schema and
  existing ordinary unit-test examples; it was validated through the
  authoritative `parseGridBetaFighterSpec` and catalogue validator (build
  total cost 94/100) with canonical SHA-256 checksum
  `e168c618fea8eff284add2a2df1c150c7db0fc0f6e11779b24114ce1effff21f`, frozen
  before the run, and never tuned after any result.
- **Result.** Match ID `19c41607-21d0-48e1-a419-23d4721e4be4`, createdAt
  `2026-08-07T10:00:01.907Z`, winner `fighter_b`, method `judges`, 20 rounds.
  Primary and repeat result checksums are identical
  (`867b2df6d1eabeb48e22534070bd9c411db1e383be40b6dee45fc97f56aa9aec`);
  the selection seed is exactly `20260807`; acknowledgement is true; the C2
  ID/checksum (`component-impact-c2` / `13548462df34a183`), the frozen grid
  runtime identity (`0.3.0 / grid-3x3-v1 / 0.2.0 / 1`) and the governance
  decision (`58e8cd87-…`,
  `approved_for_bounded_opt_in_beta_implementation`) are exact; agent usage is
  empty; the protected-source preflight is the canonical pass; suspension
  status is clear; result/report/replay agreement holds; no legacy fallback
  occurred. The complete production bundle validator passed the ten persisted
  artifacts.
- **Persisted artifact hashes (ten exact byte SHA-256).** manifest
  `b6b4622e240d3af9fc84cfbfac287cd07875e685108a8e686b1d229277f9c338`;
  selection `7d9a652218636f4be06c2d365aa90503fc2c46a1841421b0fa4e3427000ddd72`;
  fighter-a `e168c618fea8eff284add2a2df1c150c7db0fc0f6e11779b24114ce1effff21f`;
  fighter-b `e168c618fea8eff284add2a2df1c150c7db0fc0f6e11779b24114ce1effff21f`
  (identical to fighter-a for the mirror match); execution-attestation
  `946687dca49ad1d5cf51a69fc6958117d81a641450a4fb4e8b0fdd5b9bbf64a6`;
  match `6add38fa003b0069669460594dc439bc768b27e4ef7a8be0307219aad4f641e9`;
  factual-report `f89bf40973d1a68526dba6fc6ca5e48f0747c6cbb0f2b9d5e2d33e9628c374cb`;
  text-replay `7eadf08b3982a3be32b42c0f15220fc9f5679bd0a57711819b3d10e67bf0d724`;
  ascii-replay `2c66ad557ff18d8f8373339f95fcfe8901ff060d078742bb8db6766cda1c7d07`;
  review-prompt `08c1c3d1a67dab61a14e773bd357d8467dc43f4d13db59005b99052167587bd4`.
  The fighter-a and fighter-b artifact bytes are identical for this mirror
  match and equal the frozen pre-run fighter checksum.
- **Real replay validated.** `replay:grid:beta --match
19c41607-21d0-48e1-a419-23d4721e4be4` (text) and the `--ascii` variant both
  validated the complete physical ten-file bundle before display and
  completed successfully; no simulation ran during replay.
- **Post-run integrity.** The suspension marker
  `data/beta/GRID_BETA_SUSPENDED` remained absent after completion. All seven
  official governance hashes recomputed unchanged (manifest
  `0f143dde…`, source-state `5721585d…`, base-reference `972d99b9…`,
  supplement-reference `0cc07da6…`, beta-contract `5f345ce4…`, decision
  `da377b33…`, report `63259937…`). Official readiness, grapple-supplement and
  governance artifacts unchanged; C1/C2/AB2 unchanged with C2 default;
  legacy normal match/series/replay source unchanged; both canaries
  unchanged; no benchmark/seed-bank/held-out/provider access occurred. The
  only real beta operational data created is
  `data/beta/grid-fighters/beta-smoke-01.json` and
  `data/beta/grid-matches/19c41607-21d0-48e1-a419-23d4721e4be4/` (plus the
  parent directories), which remain local and untracked (gitignored).
- **Scope.** Run 001 is an operational smoke test only. It is not balance
  evidence. It is not readiness evidence. It is not adaptation evidence. It
  is not held-out evaluation. It does not authorise grid as the default. It
  does not authorise public, ranked, tournament or monetised play. It does
  not begin Milestone 0.2D.

Status:

```
Milestone 0.2C:
COMPLETE

Official v3 readiness evidence:
complete and unchanged

Official grapple supplement:
complete and unchanged

Official Phase 3F governance decision:
complete, unchanged and source-anchored

Phase 3G bounded beta implementation:
complete

Phase 3G.1 safety/provenance hardening:
complete

Phase 3G.1.1 trust-boundary hardening:
complete

Phase 3G.1.2 production API sealing:
complete and independently reviewed

controlled internal grid beta:
authorised

GRID-BETA-001:
complete

legacy default:
yes

grid default activation:
no

public rollout:
not authorised

ranked/tournament:
not authorised

balance qualification:
not performed

Milestone 0.2D:
not started
```

## D59: Record bounded grid beta observation window A (2026-08-07)

Milestone 0.2C is COMPLETE and GRID-BETA-001 passed independent closure review
as a successful operational smoke test. This decision records a small bounded
operational observation window performed before any decision about Milestone
0.2D. It is NOT balance evaluation, readiness evaluation, tuning, adaptation,
opponent-suite construction or held-out testing. The observation used the
existing local smoke fighter `data/beta/grid-fighters/beta-smoke-01.json`
(frozen canonical checksum `e168c618…`, revalidated before the window), and
every observation match was the same deliberate mirror pairing
`beta-smoke-01` vs `beta-smoke-01`; its build and policy were not changed
regardless of outcomes. The complete observation schedule was frozen before
any run — GRID-BETA-002 seed `20260808`, GRID-BETA-003 seed `20260809`,
GRID-BETA-004 seed `20260810`, GRID-BETA-005 seed `20260811` — and was not
changed because of any result.

- **Five-run factual operational table.** Every run executed exactly once;
  each bundle passed the complete production bundle validator; the text and
  ASCII replays each validated the full physical ten-file bundle; the
  suspension marker stayed absent after every run; fighter-a and fighter-b
  artifact bytes were identical (mirror) with the frozen fighter checksum;
  every primary/repeat result-checksum pair agreed; C2 metadata, the frozen
  grid runtime identity, the canonical protected-source preflight pass, empty
  agent usage and no legacy fallback held throughout.

| Run           | Seed     | Match UUID                             | Winner    | Method | Rounds | primary==repeat | bundle | text replay | ASCII replay | marker after |
| ------------- | -------- | -------------------------------------- | --------- | ------ | ------ | --------------- | ------ | ----------- | ------------ | ------------ |
| GRID-BETA-001 | 20260807 | `19c41607-21d0-48e1-a419-23d4721e4be4` | fighter_b | judges | 20     | yes             | pass   | pass        | pass         | absent       |
| GRID-BETA-002 | 20260808 | `f668f59c-076d-42de-ba37-73dd0734bf46` | draw      | judges | 20     | yes             | pass   | pass        | pass         | absent       |
| GRID-BETA-003 | 20260809 | `dc7459b6-ee55-4183-be06-36bf19d4cb26` | fighter_a | judges | 20     | yes             | pass   | pass        | pass         | absent       |
| GRID-BETA-004 | 20260810 | `64eb89f3-bb4d-4574-8ca8-9ab08e5b87a1` | fighter_a | judges | 20     | yes             | pass   | pass        | pass         | absent       |
| GRID-BETA-005 | 20260811 | `e835a904-85b8-4279-bad5-614b4d03e29c` | draw      | judges | 20     | yes             | pass   | pass        | pass         | absent       |

- **Per-run result checksums.** GRID-BETA-001 primary/repeat
  `867b2df6d1eabeb48e22534070bd9c411db1e383be40b6dee45fc97f56aa9aec`;
  GRID-BETA-002 `18b5d46d0df96892b5990def5082ed0fb85be2597cfeb0083caf7ab0b24949d7`;
  GRID-BETA-003 `abebd06823f2455f50ee88ce391e074573b680a10ab9309b2b3957c7ca42cd94`;
  GRID-BETA-004 `1ac11d79534fc29a5baf6a00c5239f7502b177f0e8260a96854638b58477a329`;
  GRID-BETA-005 `2aaf28fb584128a955a82927fff12ad4b340d1ddee49f63510b6b097cbdc64ce`.
- **Post-window integrity.** The suspension marker remained absent; all seven
  official governance hashes recomputed unchanged; the frozen fighter
  checksum unchanged; GRID-BETA-001's ten artifact hashes unchanged; every
  new match directory retained exactly ten immutable files; C1/C2/AB2 and the
  C2 default unchanged; normal match/series/replay remain legacy; no
  benchmark, provider, seed bank, held-out or `all` access occurred.
- **No interpretation.** These are factual operational observations only. No
  win rate, slot advantage, balance, fairness, optimal-policy, weapon/build
  performance or statistical-significance claim is made, and no tuning
  recommendation is derived. Even though the five mirror matches produced a
  mix of outcomes, interpretation is explicitly deferred.

Observation execution provenance

Observation Window A was initiated from the accepted Milestone 0.2C closure
commit:

```
9fcb5ecab1933eacdc27eaaaec01c27928c31768
```

Before GRID-BETA-002 was executed, the required pre-run full test suite exposed
two stale unit-test assertions that still required the entire real `data/beta`
tree to be absent. GRID-BETA-001 had legitimately created ignored operational
beta data, so those assertions no longer represented the intended isolation
property.

The assertions were corrected in the test-only commit:

```
f52027033b8e2e7550d6ed895f7dfe950da8c531
test: scope beta storage-absence assertions to test ids
```

That commit changed only:

```
tests/unit/grid-beta-match-service.test.ts
```

No production source, simulator, runtime, persistence, replay, governance,
catalogue, canary or configuration byte changed.

GRID-BETA-002 through GRID-BETA-005 therefore executed with exact Git HEAD:

```
f52027033b8e2e7550d6ed895f7dfe950da8c531
```

while their production/runtime source bytes remained identical to the accepted
`9fcb5ecab1933eacdc27eaaaec01c27928c31768` state.

Independent review accepts this as source-equivalent operational provenance.
The four observation matches do not require rerun.

Status:

```
Milestone 0.2C:
COMPLETE

Bounded beta observation window A:
COMPLETE

Total controlled beta commands:
5

Operational determinism:
5/5 primary-repeat pairs agreed

Bundle validation:
5/5 pass

Text replay:
5/5 pass

ASCII replay:
5/5 pass

Suspension triggers:
0

Balance conclusion:
NONE

Slot/fairness conclusion:
NONE

Tuning:
NONE

Legacy default:
yes

Grid default activation:
no

Public/ranked/tournament:
not authorised

Milestone 0.2D:
not started
```

## D60: Accept Observation Window A source-equivalent execution provenance (2026-08-07)

Independent review ACCEPTS Bounded Beta Observation Window A operationally.
GRID-BETA-002 through GRID-BETA-005 do NOT need to be rerun. This decision
records the exact execution provenance of the window and resolves the
distinction between the accepted Milestone 0.2C closure commit and the exact
Git HEAD at which the four observation matches executed.

- **Verified history.** Observation Window A was initiated from the accepted
  Milestone 0.2C closure commit
  `9fcb5ecab1933eacdc27eaaaec01c27928c31768`. Before the observation matches,
  the pre-run full suite exposed two stale test assertions that assumed the
  entire real `data/beta` tree must not exist; GRID-BETA-001 had legitimately
  created local operational beta data, so those assertions were no longer
  valid. The correction was committed as the test-only commit
  `f52027033b8e2e7550d6ed895f7dfe950da8c531`
  (`test: scope beta storage-absence assertions to test ids`), which modifies
  exactly one file — `tests/unit/grid-beta-match-service.test.ts` — and no
  production source.
- **Source equivalence.** The test correction does not alter `src/**`,
  simulator semantics, the grid runtime, the beta service, persistence,
  replay, suspension logic, governance, catalogue, C1/C2/AB2, canaries,
  package scripts or runtime configuration. The production/runtime source
  bytes used for GRID-BETA-002 through GRID-BETA-005 therefore remained
  identical to those at `9fcb5ecab1933eacdc27eaaaec01c27928c31768`.
- **Exact execution HEAD.** Because the test correction was committed before
  the corrected pre-run suite and observation execution, the exact Git HEAD
  for the operational runs was
  `f52027033b8e2e7550d6ed895f7dfe950da8c531`. This distinction is recorded
  explicitly: the observation matches executed with exact Git HEAD
  `f520270…` while their production/runtime source bytes were identical to
  the accepted `9fcb5ec…` state. Independent review accepts this as
  source-equivalent operational provenance, and the four observation matches
  do not require rerun.
- **Results remain accepted.** All existing GRID-BETA-001 through
  GRID-BETA-005 results remain accepted and unchanged; no existing match
  bundle, the `beta-smoke-01` fighter, or governance evidence was modified.
  No balance, slot/fairness or tuning conclusion is made. Milestone 0.2C
  remains COMPLETE and Milestone 0.2D remains not started.

Status:

```
Milestone 0.2C:
COMPLETE

GRID-BETA-001:
accepted

Bounded beta observation window A:
ACCEPTED

GRID-BETA-002 through GRID-BETA-005 execution Git HEAD:
f52027033b8e2e7550d6ed895f7dfe950da8c531

Production/runtime source equivalence:
identical to 9fcb5ecab1933eacdc27eaaaec01c27928c31768

Operational determinism:
5/5 primary-repeat pairs agreed

Bundle validation:
5/5 pass

Text replay:
5/5 pass

ASCII replay:
5/5 pass

Suspension triggers:
0

Balance conclusion:
NONE

Slot/fairness conclusion:
NONE

Tuning:
NONE

Legacy default:
yes

Grid default:
no

Public/ranked/tournament:
not authorised

Milestone 0.2D:
not started
```

## D61: Define Milestone 0.2D opponent-suite governance (2026-08-07)

Milestone 0.2C is COMPLETE and Bounded Beta Observation Window A is ACCEPTED
(D58–D60). The infrastructure-safety chapter is closed. Milestone 0.2D Phase 0
is a documentation, architecture and governance task only: it redefines the
older Milestone 0.2D roadmap in light of the completed grid-beta work before
any implementation begins. No opponents, no tournament/cross-opponent runner,
no fixture JSON files and no `data/opponents/` tree are implemented; no
package script changed and no `src/` file changed.

- **Authorised question.** Milestone 0.2D may answer only: "Can the project
  represent a small, diverse set of fixed robot opponents as immutable,
  versioned, deterministic local fixtures and execute/report against them
  reproducibly without changing combat semantics, performing adaptation, or
  making balance claims?" It is not authorised to answer best-build, strongest
  weapon, grid balance, slot fairness, tuning, C2 finality, grid-as-default,
  AI-redesign improvement or public-tournament-readiness questions.
- **ADR-004 accepted.** `docs/ADR-004-multi-opponent-fixture-format.md` freezes
  the fixture contract before implementation: immutable/versioned identity
  (`schemaVersion`, `opponentId`, `fixtureVersion`, `displayName`, `build`,
  `policy`, `catalogueVersion`, `rulesetCompatibility`,
  `runtimeCompatibility`, `description`, `archetypeIntent`); no subjective
  balance labels (`tier`, `powerLevel`, `difficultyRating`, `balanced`,
  `meta`, `optimal`); `archetypeIntent` is descriptive only. Canonical
  identity binds the exact build proposal, complete validated build, policy,
  schema version, fixture version, catalogue version and runtime-compatibility
  declaration to a deterministic canonical serialization and SHA-256 fixture
  checksum; changing any authoritative field requires a new checksum and,
  where semantically appropriate, a new fixture version; no silent fixture
  mutation.
- **Runtime relationship.** Chosen model: runtime-neutral fixture,
  runtime-specific execution. Fixtures own build/policy/archetype identity
  valid across runtimes; runtime execution is chosen separately and recorded
  explicitly (e.g. `runtimeCompatibility: legacy: supported,
grid-3x3-v1: supported`). Non-portable policies/builds are declared
  incompatible rather than translated silently. No fixture may cause a
  runtime change or request grid activation.
- **Six conceptual archetypes.** `bulwark`, `skirmisher`, `crusher`,
  `spinner`, `controller`, `generalist` are retained (no duplicated
  archetype or unsupported component). Phase 0 defines only intended design
  envelopes (chassis family, weapon family, policy style, tactical behaviour,
  compatibility questions, what must NOT be inferred from the label); exact
  builds are deferred to a later phase and must be chosen without
  benchmark/held-out optimisation.
- **Runner terminology.** The historical "tournament runner" term is retired
  in favour of the local development **opponent-suite runner** (cross-opponent
  matrix runner). It is not the public Arena tournament system; it does not
  create rankings, award prizes, perform matchmaking or authorise
  public/ranked play. It is not implemented in Phase 0.
- **Execution governance.** Future 0.2D execution is deterministic and
  local-scripted; no fixture may call an external model/provider API, adapt,
  learn, mutate, or read prior match/benchmark/held-out results. A future
  runner must require explicit runtime selection; absent selection must not
  silently switch the default to grid. A general grid cross-opponent runner is
  NOT authorised in this design phase — grid execution requires separate
  authorisation because the bounded grid-beta governance covers explicit
  internal beta matches, not an unlimited matrix runner. Legacy remains
  default.
- **Evidence firewall.** Fixture design may use public catalogue definitions,
  the public policy schema, deterministic simulator contracts, existing
  unit-test fixtures, the historical Bulwark implementation for compatibility,
  grid geometry/policy semantics for compatibility analysis, and
  GRID-BETA-001–005 only as evidence that the beta infrastructure operates
  safely. It must NOT use development benchmark outcomes, benchmark seed
  identities, held-out seeds/results, `all`, AB2 held-out outcome details,
  GRID-BETA-001–005 winners/scores/round patterns, provider/model-generated
  optimisation or adaptation results for fixture tuning or selection. The five
  beta smoke outcomes remain uninterpreted.
- **Bulwark migration rule.** Migration preserves canonical fixture identity
  (build/policy intent); it does not promise byte-identical event streams
  across legacy and grid because the runtimes intentionally have different
  positioning semantics. A future legacy regression proves replacing
  hard-coded Bulwark data with the fixture does not change relevant legacy
  deterministic behaviour, using bounded ordinary unit fixtures or existing
  canonical non-held-out regression cases — never the benchmark seed bank.
- **Phased sequence (defined, not implemented).** Phase 0 definition/
  governance (this task); Phase 1 fixture schema + canonical
  serializer/checksum + loader; Phase 2 six canonical fixtures (no
  cross-opponent execution); Phase 3 deterministic fixture validation and
  Bulwark migration; Phase 4 development-only opponent-suite runner for
  explicitly authorised runtime(s); Phase 5 cross-opponent factual report (no
  adaptation, no balance verdict). Each future phase requires independent
  review before proceeding.
- **Runner output boundaries.** Factual values only (opponent ID, fixture
  checksum, runtime identity, caller-supplied seed, match IDs,
  win/loss/draw, method, rounds, deterministic result checksum). Automatic
  conclusions (strongest/weakest opponent, best build, optimal weapon,
  balance score, tier list, recommended tuning) are prohibited; interpretation
  requires separate governance.
- **No seed banks.** `benchmark-100-v1`, the development partition, the
  held-out partition and `all` are not opened; no replacement held-out
  partition is created; no statistical sample size is selected; no win-rate
  thresholds are calculated. Those belong to later evaluation governance
  (likely 0.2E or a separately authorised qualification cycle).
- **0.2B / 0.2E relationship.** The component lifecycle mechanism (0.2B)
  exists but qualification/balance acceptance remains deferred; 0.2D must not
  resolve C2 or component-balance questions. 0.2D creates deterministic
  opponents that the historical Adaptation Evaluation (0.2E) may eventually
  use; 0.2D must not invoke redesign, expose results to an AI reviewer,
  compare baseline vs redesign, test overfitting or use held-out seeds.
  Dependency: `0.2C → 0.2D → 0.2E` without implying 0.2E is automatically
  authorised.

Status:

```
Milestone 0.2C:
COMPLETE

Observation Window A:
ACCEPTED

Milestone 0.2D:
DEFINED, NOT IMPLEMENTED

0.2D purpose:
versioned deterministic local opponent fixtures and factual cross-opponent development tooling

Opponent fixtures implemented:
no

Cross-opponent runner implemented:
no

Adaptation:
not authorised

Balance evaluation:
not authorised

Seed-bank access:
none

Held-out access:
none

Provider/API use:
none

Legacy default:
yes

Grid default:
no

Public/ranked/tournament:
not authorised

Milestone 0.2E:
not started
```

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
