# ADR-001: Positioning Representation — 3×3 Arena Grid

**Status:** Accepted for phased implementation
**Date:** 2026-07-31
**Scope:** Phase 1 freezes the 3×3 arena representation and provides a pure,
deterministically tested geometry module. Phase 2 defines the grid match
schema (`MatchRecord` v3), the explicit positioning identifier, version-aware
replay dispatch and the 3×3 ASCII renderer. No authoritative combat is switched
to the new arena in either phase.

## 1. Context

Prototype 0.1/0.2 use a five-zone arena (`center`, `north_edge`, `south_edge`,
`east_edge`, `west_edge`). Milestone 0.2C replaces this representation with a
3×3 grid so the simulator can later represent lateral movement, genuine flank
attempts, rear positioning, disengagement and facing advantage (the
"Positioning" research question from `docs/PROTOTYPE-0.2-EXPERIMENTAL-PLAN.md`).

Phase 1 is a pure geometry and contract task. It freezes the representation and
ships an exhaustively tested geometry module that a later, separately
authorised runtime-migration phase can consume. The live five-zone simulator is
not modified.

## 2. Decision

Adopt Option A — a discrete 3×3 arena.

### 2.1 Arena representation

```
north_west | north | north_east
west       | center | east
south_west | south | south_east
```

Canonical zone IDs:

```
north_west
north
north_east
west
center
east
south_west
south
south_east
```

### 2.2 Coordinate system

Immutable integer coordinates:

| Zone         | Coordinate |
| ------------ | ---------- |
| `north_west` | `(-1,  1)` |
| `north`      | `( 0,  1)` |
| `north_east` | `( 1,  1)` |
| `west`       | `(-1,  0)` |
| `center`     | `( 0,  0)` |
| `east`       | `( 1,  0)` |
| `south_west` | `(-1, -1)` |
| `south`      | `( 0, -1)` |
| `south_east` | `( 1, -1)` |

North increases `y`; east increases `x`. Coordinates are immutable integers in
the range `-1..1`.

Directions remain:

```
north | east | south | west
```

### 2.3 Occupancy

Two fighters may occupy the same cell. This preserves close-contact and
collision semantics. Collision or blocking rules are outside this phase.

### 2.4 Movement adjacency

One ordinary movement step is orthogonal only:

- north;
- east;
- south;
- west.

Diagonal cells exist but cannot be entered diagonally in one ordinary movement
step.

The neighbour order used for deterministic traversal and pathfinding is frozen
as:

```
north → east → south → west
```

Out-of-bounds movement is represented explicitly (`null` in the geometry
module) and must never wrap around the grid.

### 2.5 Geometric distance

Two distinct concepts are provided:

1. **Orthogonal path distance** — Manhattan distance. Used for path length and
   movement planning.
2. **Combat proximity** — Chebyshev distance. Same cell: `close`; Chebyshev
   distance 1: `medium`; Chebyshev distance 2: `far`.

The distinction is explicit and tested.

### 2.6 Relative bearing

Freeze a defender-relative bearing model:

```
same
front
front_right
right
rear_right
rear
rear_left
left
front_left
```

Bearing is calculated from the attacker's cell relative to the defender's cell
and then rotated into the defender's facing frame. Coordinate deltas are
normalised by sign before determining the eight-way bearing.

### 2.7 Planar armour exposure

Freeze the future planar exposure mapping:

| Relative bearing | Exposed planar armour    |
| ---------------- | ------------------------ |
| `front`          | `front`                  |
| `front_left`     | `front`, `left`          |
| `left`           | `left`                   |
| `rear_left`      | `rear`, `left`           |
| `rear`           | `rear`                   |
| `rear_right`     | `rear`, `right`          |
| `right`          | `right`                  |
| `front_right`    | `front`, `right`         |
| `same`           | `front`, `left`, `right` |

Top armour remains weapon-specific and is not part of the planar geometry
function. This mapping is **not** wired into live damage calculations in this
task.

### 2.8 Legacy-zone treatment

The existing 0.2 values:

```
north_edge
south_edge
east_edge
west_edge
center
```

remain authoritative for existing 0.1/0.2 matches.

An explicit conceptual migration mapping is defined:

```
north_edge → north
south_edge → south
east_edge  → east
west_edge  → west
center      → center
```

This mapping:

- is for a future versioned migration boundary;
- must not silently reinterpret persisted v1/v2 records;
- must not be applied to live matches in this task;
- does not provide values for the four new corner cells.

### 2.9 Versioning decision

Switching authoritative matches to the 3×3 representation will require, in a
later task:

- `SIMULATOR_VERSION` `0.3.0`;
- a versioned match-record schema capable of storing the nine new zones;
- explicit replay dispatch by stored simulator/schema version;
- preservation of existing 0.1 and 0.2 replay behaviour.

Those version and schema changes are not performed in this phase.

## 3. Phase 1 dependency inventory

The following modules currently depend, directly or indirectly, on the live
positioning surface (`ArenaZone`, the five zone values, `computeDistance`,
`resolveMovement`, directional/facing helpers, `getExposedZones`, movement
event `from`/`to` fields, initial fighter zones, and replay reconstruction of
zones). They are recorded here so the future migration phase knows the
versioned-migration surface. **None are changed by this task.**

### Runtime simulator

| Module                       | Positioning dependency                                                                                                                                           |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/simulator/types.ts`     | Defines `ArenaZone` (five values), `Direction`, `DistanceBand`, `MovementAction`; `FighterState.zone` and `FighterState.facing`.                                 |
| `src/simulator/movement.ts`  | `resolveMovement`, `canAdvance`, `getOppositeEdge`, left/right/back rotation — operates on the five zones and directions.                                        |
| `src/simulator/actions.ts`   | `computeDistance` (five-zone distance bands); `deriveMovement`/`deriveCooldownAction`/`deriveEngagementAction` consume distance + policy + RNG.                  |
| `src/simulator/damage.ts`    | `getExposedZones`, `determineHitZone`, `isNorthOf`/`isSouthOf`/`isEastOf`/`isWestOf` — five-zone exposure.                                                       |
| `src/simulator/reducer.ts`   | `getDistance`, `getKnockbackZone`, imports `resolveMovement`, emits `movement_resolved` with `from`/`to`/`facing`/`action`, derives ram momentum from `advance`. |
| `src/simulator/simulator.ts` | Initial fighter zones: fighter_a at `south_edge` facing `north`; fighter_b at `north_edge` facing `south`; `createFighterState(zone, facing)`.                   |

### Events and schemas

| Module                               | Positioning dependency                                                                                                                                                           |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/events/battle-event.ts`         | `MovementResolvedData` with `from`, `to`, `facing`, `action`.                                                                                                                    |
| `src/schemas/match-record.schema.ts` | v1/v2 record schemas store `zone: z.enum(["center", "north_edge", "south_edge", "east_edge", "west_edge"])`, `facing`, `schemaVersion` literals `"1"`/`"2"`, and version fields. |
| `src/schemas/policy.schema.ts`       | `opening` enum includes `flank`; policy validation (future lateral movement will require policy extension in a later phase).                                                     |

### Replay

| Module                                                                                         | Positioning dependency                                                                                           |
| ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `src/replay/text-replay-renderer.ts`                                                           | `formatZone`; reads `movement_resolved` `from`/`to`/`action`.                                                    |
| `src/replay/ascii/ascii.types.ts`                                                              | `FighterVisualState.zone: string` and `facing`.                                                                  |
| `src/replay/ascii/state-reconstructor.ts`                                                      | Reconstructs fighter zones from `movement_resolved` (`data.to`, `facing`); knockback repositions via `targetId`. |
| `src/replay/ascii/arena-snapshot-renderer.ts`                                                  | Renders the five-zone arena (north/south/east/west/center) from `fighter.zone`.                                  |
| `src/replay/ascii/ascii-layout.ts`                                                             | `FACING_ARROWS`, `ARENA_WIDTH` used by arena rendering.                                                          |
| `src/replay/ascii/highlight-selector.ts`                                                       | Uses `hitZone === "rear"` (armour-zone highlight derived from positioning).                                      |
| `src/replay/ascii/moment-renderer.ts`, `result-card-renderer.ts`, `robot-portrait-renderer.ts` | Display zone/facing text.                                                                                        |

### Tests

| Test file                                                                                                                                 | Positioning dependency                                 |
| ----------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| `tests/unit/actions.test.ts`                                                                                                              | `computeDistance`, `deriveAction` with the five zones. |
| `tests/unit/damage.test.ts`                                                                                                               | `getExposedZones` with the five zones.                 |
| `tests/unit/arena-snapshot.test.ts`                                                                                                       | Five-zone ASCII rendering.                             |
| `tests/unit/state-reconstructor.test.ts`                                                                                                  | `movement_resolved` zone reconstruction.               |
| `tests/unit/text-replay.test.ts`                                                                                                          | Zone text formatting.                                  |
| `tests/unit/canonical-schema.test.ts`                                                                                                     | v2 record schema zone values.                          |
| `tests/unit/round-resolution.test.ts`                                                                                                     | `applyRound` movement resolution.                      |
| `tests/integration/full-match.test.ts`, `tests/integration/benchmark-v2-transitions.test.ts`, `tests/integration/lifecycle-suite.test.ts` | Indirect via the simulator.                            |

### Not dependent on positioning

`src/simulator/victory.ts`, `src/simulator/seeded-random.ts`,
`src/simulator/constants.ts`, `src/simulator/component-state.ts`,
`src/simulator/component-qualification-registry.ts`, and `src/bench/*` (the
bench modules reference `hitZone` armour facts only, not arena zones).

## 4. Consequences

- Phase 1 adds only pure geometry and produces no authoritative gameplay change.
- Phase 2 adds persistence/replay foundation only: grid match schema v3, the
  explicit positioning identifier, version-aware replay dispatch and the 3×3
  ASCII renderer. No authoritative gameplay change.
- The five-zone live simulator, existing v1/v2 schemas, existing replay and
  existing ASCII output remain byte-for-byte unchanged.
- Simulator/ruleset/catalogue versions remain `0.2.0 / 0.2.0 / 1`.
- Component qualification (C1, C2, AB2) remains frozen and unchanged; C2
  remains the experimental runtime default.

## 5. Out of scope (later 0.2C phases)

- Authoritative simulator migration to the 3×3 arena (version `0.3.0`).
- Grid movement, action and damage integration.
- Policy-driven lateral movement.
- Live activation of grid match production (the runtime still emits schema v2).
- Opponent suite and adaptation evaluation (0.2D/0.2E).

## 6. Phase 2 — persistence and replay foundation (2026-07-31)

Phase 2 prepares persistence and replay for the future grid runtime without
changing authoritative match outcomes.

### 6.1 Positioning schemas

`src/schemas/positioning.schema.ts` provides canonical Zod schemas:

- `legacyArenaZoneSchema` — the five legacy values (`center`, `north_edge`,
  `south_edge`, `east_edge`, `west_edge`);
- `gridZoneSchema` — derived directly from `GRID_ZONES` in `arena-grid.ts` so
  the lists cannot drift;
- the explicit persisted positioning identifier `grid-3x3-v1` (schema v1 and
  v2 remain implicitly `legacy-five-zone-v1`).

`center` exists in both models, so the positioning model is never inferred
from a zone string.

### 6.2 MatchRecord schema v3

`src/schemas/match-record.schema.ts` now supports schema versions `1`, `2`
and `3`:

- v3 requires `schemaVersion: "3"` and `positioningModel: "grid-3x3-v1"`;
- v3 fighter states retain the full v2 component representation and use only
  canonical `GridZone` values with the existing four cardinal facings;
- v3 validates positioning facts inside authoritative events
  (`movement_resolved.data.from`/`.to` and `round_ended.data.fighterA/B.zone`
  must be grid zones);
- v1/v2 continue to accept legacy zones and reject grid-only corners;
- v3 rejects legacy edge zones and a missing/incorrect `positioningModel`;
- unsupported schema versions are rejected; deserialisation never mutates or
  upgrades v1/v2 records.

### 6.3 Replay positioning dispatch

`src/replay/positioning-model.ts` selects the model from record identity only:

- schema v1 → `legacy-five-zone-v1`;
- schema v2 → `legacy-five-zone-v1`;
- schema v3 → `grid-3x3-v1`.

Raw current `0.2.0` `MatchResult` values resolve explicitly to the legacy
model. Zone values are never used to guess the model.

### 6.4 ASCII rendering

The existing five-zone renderer is preserved byte-for-byte.
`src/replay/ascii/grid-arena-snapshot-renderer.ts` renders all nine grid cells
with a deterministic fixed-width layout, same-cell occupancy (A before B),
facing arrows and the existing component/condition marker precedence.
`src/replay/ascii/arena-renderer.ts` dispatches between the two renderers by
positioning model.

## 7. Phase 3A — opt-in deterministic grid combat runtime (2026-07-31)

Phase 3A implements the full deterministic grid combat core as an **opt-in**
runtime. The legacy five-zone `runMatch` remains the application default;
`runGridMatch` is a separate entry point that is never wired into the normal
CLI, series, battle or application commands.

### 7.1 Explicit runtime identity

`MatchResult` now carries a required in-memory `runtime` identity:

- legacy: `{ simulatorVersion: "0.2.0", positioningModel: "legacy-five-zone-v1" }`;
- grid: `{ simulatorVersion: "0.3.0", positioningModel: "grid-3x3-v1" }`.

Replay dispatch and persistence routing read this identity directly; the model
is **never** inferred from zone strings (`center` exists in both models).

### 7.2 Shared core, adapter-separated positioning

The deterministic match loop, round reducer, component lifecycle, energy/heat,
victory and event production are shared between runtimes via generic adapters:

- `PositioningAdapter<Z>` — `resolveMovement`, `computeDistance`,
  `computeAttack`, `resolveKnockback`, `resolveGrapple`,
  `enableGrappleRepositioning`, `momentumFor`;
- `MatchRuntimeAdapter<Z>` — initial zones/facing, action derivation, round
  application, `competition_started` extra facts, event simulator version and
  the runtime identity.

Legacy behaviour is proven identical: the lifecycle-suite checksums and the
entire legacy test surface are unchanged (see §7.9).

### 7.3 Grid movement (deterministic)

- `advance` — one orthogonal step along the frozen `north → east → south →
west` shortest path; no translation when sharing a cell.
- `retreat` — greatest-distance orthogonal neighbour from the opponent with
  `north → east → south → west` ties; no translation when blocked.
- `circle_left` / `circle_right` — turn in place (Phase 3A; no lateral
  translation).
- `hold` — preserve zone and facing.
- Out-of-bounds movement never wraps.

### 7.4 Grid distance and action derivation

`computeDistance` uses combat proximity (Chebyshev: `close` / `medium` / `far`).
`deriveGridAction` preserves the legacy RNG consumption order — movement is
derived first, then the combat roll — while using the grid proximity band for
engagement decisions. No new policy fields are introduced.

### 7.5 Grid exposure and targeting

`getGridExposedZones` maps the defender-relative bearing to planar armour
zones (ADR-001 §2.7); the hammer additionally exposes `top`. `determineGridHitZone`
resolves the primary → secondary → front fallback chain deterministically.

### 7.6 Grid knockback and grapple repositioning

- Knockback: different cells → greatest-distance orthogonal neighbour from the
  attacker (NESW ties), none if blocked; same cell → one step in the attacker's
  facing, else first valid NESW neighbour; never wraps.
- Grapple repositioning (enabled for the grid adapter): when the fighters
  occupy different cells, move the target one shortest-path step toward the
  attacker; emitted as `movement_resolved` with `action: "grapple"` and
  `targetId`.
- Legacy reconstruction treats both `knockback` and `grapple` as
  target-repositioning movements.

### 7.7 Persistence routing

`matchResultToRecord` routes by explicit identity only:

- legacy `0.2.0` → schema v2 (unchanged production path);
- grid `0.3.0` → schema v3 with `positioningModel: "grid-3x3-v1"`.

Invalid combinations are rejected (grid-with-0.2.0, legacy-with-0.3.0,
grid-with-legacy-edge, legacy-with-grid-corner, unknown model).
`mapLegacyZoneToGridZone` is never used during persistence.

### 7.8 Entry point

`runGridMatch(config)` returns a `GridMatchResult` with the `0.3.0` /
`grid-3x3-v1` identity. The normal application continues to call `runMatch`
and persists schema v2.

### 7.9 Verification

- Full suite: 781 tests (727 pre-existing + 54 new grid/runtime/identity tests).
- `npm run check`, `npm run lint` and `prettier --end-of-line crlf --check`
  all pass on touched files.
- Legacy lifecycle checksums (C1 `2a40a56f97062ca3`, C2 `13548462df34a183`,
  AB2 `6b9f70450d3f10b8`) are unchanged; C2 remains the runtime default.
- No benchmark partitions ran; seeds, fixtures and held-out/`all` partitions
  remain sealed; no external API calls.

## 8. Phase 3B — grid runtime hardening (2026-08-01)

Phase 3B hardens the opt-in grid runtime contract before any policy-driven
lateral movement or default activation. It does not make the grid runtime the
application default, changes no global constant, and tunes nothing.

### 8.1 Frozen runtime identities

Canonical runtime identities live in `src/simulator/runtime-identity.ts`:

- `LEGACY_RUNTIME_IDENTITY` — `0.2.0` / `legacy-five-zone-v1`;
- `GRID_RUNTIME_IDENTITY` — `0.3.0` / `grid-3x3-v1`.

Both are `Object.freeze`d at runtime, not merely TypeScript-`readonly`. Adapters
and every match result share these frozen constants, so a caller cannot modify
an identity through a returned result, and an attempted mutation of one match
result can never affect a later match. Persistence and replay keep reading the
explicit identity; it is never inferred from zone strings.

### 8.2 Zone type ↔ identity pairing

The discriminated runtime profile (`LegacyZoneProfile` / `GridZoneProfile` /
`ZoneRuntimeProfile` in `src/simulator/types.ts`) pairs each zone type with the
only identity that may accompany it. `RuntimeIdentityFor<Z>` derives the
identity from the profile union, and `MatchRuntimeAdapter<Z>` / `ZoneMatchResult<Z>`
use it, so an adapter's zone type and runtime identity can never be paired
independently through normal typed use. Legacy initial zones cannot be supplied
to a grid profile and grid-only corners cannot be supplied to a legacy profile
(compile-time `@ts-expect-error` assertions enforce this). The shared runtime
functions are not weakened to a mixed-zone state.

### 8.3 Grid version contract

The 3×3 positioning change is a **simulator** version change (`0.3.0`); it does
not introduce a new balance ruleset in this milestone. The grid contract is:

```
simulatorVersion: 0.3.0
positioningModel: grid-3x3-v1
rulesetVersion:   0.2.0
catalogueVersion: 1
```

`runGridMatch` rejects any configuration whose `rulesetVersion` is not `0.2.0`
or whose `catalogueVersion` is not `1`, before simulation. The v3 schema
cross-field contract requires `simulatorVersion` `0.3.0`, `positioningModel`
`grid-3x3-v1`, and agreement between top-level and embedded-config
`rulesetVersion`, `catalogueVersion` and `seed`. These requirements are v3-only;
v1/v2 keep their historical validation.

### 8.4 Converter-boundary validation

`matchResultToRecord` validates each constructed v2/v3 record with its
authoritative schema before returning and throws a clear error if construction
produced an invalid record. For grid results this detects malformed initial
zones, malformed `movement_resolved` / `round_ended` positioning facts, and
inconsistent runtime/version/model, ruleset, catalogue or seed facts at the
converter boundary — before repository access — rather than relying on
save-time validation. Valid legacy v2 production is preserved.

### 8.5 Simultaneous positional effects

Grid combat freezes that both fighters' knockback/grapple destinations are
planned from the **same post-movement snapshot**:

1. Both ordinary movements are calculated from the same start-of-round state.
2. Both translated movement results are applied.
3. Both attacks and their hit/exposure facts are calculated from the same
   post-movement state.
4. Both knockback/grapple destinations are planned from that same post-movement
   positioning snapshot (`PlannedReposition<Z>`).
5. Damage, component and event application retains stable fighter-A then
   fighter-B event ordering.
6. Planned destinations do not change merely because the other fighter's event
   was applied first.
7. Both planned destinations may be applied; same-cell occupancy remains legal.

This removes fighter-A positional initiative without changing deterministic
event ordering. The legacy runtime's historical sequential-origin behaviour is
preserved via the `planFromSharedSnapshot` adapter flag (grid `true`, legacy
`false`) and is proven byte-for-byte unchanged (lifecycle checksums and the
legacy test surface are unchanged). A regression test demonstrates that the old
sequential-origin algorithm would have produced a different destination.

### 8.6 Phase 3B status

- Runtime identities frozen at runtime: complete.
- Zone type / identity profiles paired at compile time: complete.
- Grid version contract `0.3.0 / grid-3x3-v1 / ruleset 0.2.0 / catalogue 1`:
  complete.
- Record conversion validates before returning: complete.
- Simultaneous positional effects from the common post-movement snapshot:
  complete.
- A-before-B remains event ordering only, not positional initiative: complete.
- Grid correctness matrix (unit/integration, not the benchmark harness):
  complete and bounded.
- Policy-driven lateral movement: **not implemented**.
- Default grid activation: **not performed**.
- Milestone 0.2C: **not complete**.

### 8.7 Phase 3B.1 — grid movement momentum correction (2026-08-01)

Review of the Phase 3B grid adapter identified one gameplay-contract defect:
the grid positioning adapter awarded ram charge momentum for **any** translated
movement (`translated ? 1 : 0`). The frozen grid rule grants charge momentum
only when an `advance` action actually translates the robot:

```
movement action = advance
AND
the movement translated to another cell
→ momentum 1

all other combinations
→ momentum 0
```

The correction introduces the named pure function
`getGridMovementMomentum(action, translated): 0 | 1` in
`src/simulator/grid-runtime.ts`, which the grid adapter calls via
`momentumFor`. A translated `retreat`, `circle_left`, `circle_right`, `hold`,
or any future lateral action never receives charge momentum. The synthetic
`translated: true` cases for circle and hold are tested intentionally to
protect the invariant against future movement changes. The legacy adapter's
historical momentum rule is untouched. This is a contract correction only: no
balance conclusion or tuning was performed.

### 8.8 Phase 3C — deterministic lateral circling and flank-policy integration (2026-08-01)

Phase 3C makes `circle_left` / `circle_right` genuine translated lateral
movement in the **opt-in** grid runtime, driven by the existing
`opening: "flank"` policy field. No new movement-action values and no policy
fields or schema changes were introduced; legacy circling remains turn-in-place.

**Canonical lateral module.** `src/simulator/grid-lateral.ts` is the single
pure home for `resolveGridCircleMovement`, `chooseGridCircleCandidate`,
`chooseGridFlankMovement`, `getFacingTowardGridZone`, `resolveDesiredFlankTarget`
and `scoreGridFlankPosition`. It imports only grid geometry, grid fighter and
policy types, and cardinal rotation helpers — never the reducer, damage,
component lifecycle, persistence, replay or seeded randomness.

**Tangent vectors.** For actor `(ax, ay)` and opponent `(ox, oy)`,
`dx = ox - ax`, `dy = oy - ay`; if the fighters share a cell no lateral
direction exists. Frozen tangents:

```
circle_left  tangent = (-dy,  dx)
circle_right tangent = ( dy, -dx)
```

Candidates are the actor's valid orthogonal neighbours in frozen
north→east→south→west order, excluding the opponent's cell, keeping only cells
whose one-step vector has a strictly positive dot product with the tangent.
Ranking freezes: smallest absolute Chebyshev-distance change, then greatest
tangent dot product, then the frozen NESW order. No diagonals, no wrapping.

**Facing.** A translated circle faces toward the opponent from the destination
(first step of the deterministic NESW shortest path); the previous facing is
preserved only if no directional result exists. A blocked circle and a
same-cell circle rotate in place (left/right) without translating.

**Flank-policy intent.** For `opening: "flank"` after early-state rules (which
override flanking): far proximity advances; same-cell holds; an already-exposed
desired planar target holds; otherwise both circle directions are previewed and
scored deterministically. The desired target is `primaryTarget` when it is
`left`/`right`/`rear`, else `secondaryTarget` when it is `left`/`right`/`rear`,
else `rear`. The pure tactical score is:

```
desired target exposed       +100
secondary planar target      +20   (only when secondaryTarget is left/right/rear)
rear armour exposed          +30
either side armour exposed   +10
translated lateral movement  +1
resulting proximity equals preferredRange  +8
```

Exact ties choose `circle_left`; if neither direction translates or improves
the score, the fighter holds. The flank selector consumes no randomness; the
combat selection after it uses the existing cooldown/aggression/seeded roll.
Circle movement never receives ram charge momentum (Phase 3B.1).

**Integration.** `resolveGridMovement` delegates `circle_left` / `circle_right`
to the canonical lateral resolver for both fighters from the same start-of-round
snapshot. Movement events record `from`/`to`/`facing`/`action` for translated
circling; a blocked facing-only circle still emits `movement_resolved`; a
circle that changes neither cell nor facing emits nothing. Knockback/grapple
positional-effect planning is unchanged.

## 9. Phase 3D1 — version-aware factual reporting and series compatibility foundation (2026-08-01)

Phase 3D1 makes the reporting, AI-review and adaptive-series contracts capable
of **representing** grid matches while keeping every legacy record byte-compatible.
Grid matches remain opt-in (`runGridMatch`); no normal command produces a grid
report or grid series; `runSeries` stays v1-only. No policy schema, seeds,
fixtures or benchmark partitions changed.

### 9.1 Factual match reports — v1 legacy, v2 grid

- `FactualMatchReportV1Schema` (`schemaVersion: "1"`) is the persisted legacy
  contract: legacy five-zone fighter states, persisted cooldown fields, and
  rejection of grid-only corner zones. `FactualMatchReportSchema` /
  `FactualMatchReport` remain deprecated aliases of the v1 shape, so every
  existing legacy caller is unchanged.
- `FactualMatchReportV2Schema` (`schemaVersion: "2"`) represents an opt-in
  grid match only: it freezes the grid identity (`simulatorVersion` `0.3.0`,
  `positioningModel` `grid-3x3-v1`, `rulesetVersion` `0.2.0`,
  `catalogueVersion` `1`), accepts only the nine canonical grid zones in
  fighter-state summaries, and omits `weaponCooldown` / `utilityCooldown`
  because the event stream cannot reconstruct precise final cooldowns.
- Version-aware `validateFactualMatchReport`, `serializeFactualMatchReport`
  and `deserializeFactualMatchReport` dispatch on `schemaVersion` and return
  string errors; unsupported versions are rejected and deserialisation never
  upgrades or mutates a v1 report.

### 9.2 Builders dispatch through explicit runtime identity

`buildFactualReportForResult(AnyMatchResult)` dispatches on the frozen in-memory
`runtime` identity — never zone strings:

- legacy `0.2.0` / `legacy-five-zone-v1` → factual-report v1;
- grid `0.3.0` / `grid-3x3-v1` → factual-report v2.

Invalid runtime/model pairings are rejected. `buildFactualReport` keeps the
v1 shape byte-for-byte; `buildGridFactualReport` produces v2 from a
`GridMatchResult`. `enrichMatchSummariesWithPolicy` is generic over the report
version so both v1 and v2 are enriched in place.

### 9.3 Canonical movement-event subject and shared final-state projection

`getMovementEventSubjectId(event)` in `src/events/battle-event.ts` is the single
canonical rule for which fighter a `movement_resolved` event repositions:

- `action: "knockback"` → `targetId`; `action: "grapple"` → `targetId`;
- all ordinary movement actions (`advance`, `retreat`, `circle_left`,
  `circle_right`, `hold`) → `actorId`;
- a malformed event whose required subject id is absent returns `null`, so a
  broken event never silently moves the wrong fighter.

This rule is now shared by reporting and ASCII state reconstruction (which
already treated `grapple` as target repositioning). `src/reports/final-state-projection.ts`
provides the pure, positioning-aware `projectFinalFighterState` used by both
the v1 and v2 builders. It walks the event stream (integrity damage, movement
via the canonical subject rule with model assertions, component damaged /
disabled including immobilisation, damage-resisted guard consumption,
overturns, overheat and recovery) and then applies the **latest** authoritative
`round_ended` facts (integrity, energy, heat, zone, conditions) and syncs
binary component flags. It never invents facts: translated circling updates the
actor's zone and facing, knockback/grapple update the target's zone, and any
zone value outside the active model is rejected rather than guessed. Both
builders now produce the same facts the replay would show (grid grapple is
target movement in both reporting and replay).

### 9.4 AI review and rebuild accept either version

`ReviewRequest` / `RebuildContext` carry `AnyFactualMatchReport`. The deepseek
agent's prompt builder, fallback review, `validateReviewAgainstFacts` and
`normaliseDisabledComponents` work for v1 and v2. `formatFactualReportForPrompt`
renders v1 byte-identically (raw five-zone values) and adds the simulator
identity line plus human-readable grid zone names for v2 — grid corners are
never referred to as legacy "edges". The fallback review output is unchanged
for both versions.

### 9.5 Series records — v1 legacy, v2 single-runtime grid contract

- `SeriesRecordV1Schema` (`schemaVersion: "1"`) is unchanged and remains the
  only record `runSeries` produces. Deprecated aliases `SeriesRecordSchema` /
  `SeriesRecord` / `seriesMatchEntrySchema` / `SeriesMatchEntry` keep legacy
  callers compiling.
- `SeriesRecordV2Schema` (`schemaVersion: "2"`) is a **reserved** single-runtime
  grid contract: it declares one immutable runtime identity for the whole
  series (`simulatorVersion` `0.3.0`, `positioningModel` `grid-3x3-v1`,
  `rulesetVersion` `0.2.0`, `catalogueVersion` `1`, `matchRecordSchemaVersion`
  `3`, `factualReportSchemaVersion` `2`). Every entry embeds a grid factual-
  report v2 and a match summary carrying the grid identity, and the cross-field
  contract validates: entry seed vs match-summary seed, entry seed vs
  factual-report seed, report and match-summary runtime vs the series runtime,
  entry `matchId` vs match-summary `matchId`, unique `matchId`s, unique match
  numbers, and score totals that never exceed the entry count.
- `JsonSeriesRepository` and `buildComparativeReportModel` / `renderSeriesReport`
  accept either version; v2 reports render a `Runtime: simulator 0.3.0
(grid-3x3-v1)` line and v1 reports render exactly as before.
- `app/run-series.ts` remains v1-only; no CLI or application path builds a
  grid series.

### 9.6 Phase 3D1 status and verification

- Factual-report v1 frozen and byte-compatible: complete.
- Factual-report v2 grid contract: complete.
- Explicit-runtime builder dispatch: complete.
- Canonical movement-event subject rule shared by reporting and replay:
  complete.
- Shared positioning-aware final-state projection: complete.
- Review/rebuild accept either version: complete.
- Series v1 legacy; series v2 reserved single-runtime grid contract: complete.
- `runSeries` stays v1-only; persistence and report rendering handle both:
  complete.
- No CLI/application grid activation, no balance conclusions: confirmed.
- New focused tests (movement subject, final-state projection, factual-report
  v1/v2, review compatibility, series v1/v2) plus the full pre-existing suite
  pass; typecheck, lint and CRLF formatting pass on touched files.

Status: Phase 1 geometry complete; Phase 2 persistence/replay complete; Phase
3A grid runtime core complete; Phase 3B activation hardening complete; Phase
3B.1 momentum correction complete; Phase 3C lateral/flank integration complete;
Phase 3D1 reporting/series compatibility foundation complete; explicit grid
application canary **not implemented**; default grid activation **not
performed**; Milestone 0.2C **not complete** pending a separately authorised
activation-readiness decision.

### 9.7 Phase 3D1.1 — reporting boundary and series traceability hardening (2026-08-01)

Phase 3D1.1 closes three narrow contract gaps identified in the Phase 3D1
review, before any grid CLI or adaptive-series canary could be introduced. It
hardens the factual-report construction boundary and series-v2 traceability.
No grid canary or default activation was introduced.

**Explicit movement-event actions.** `src/events/battle-event.ts` defines the
canonical runtime movement-event action type `MovementEventAction =
MovementAction | "knockback" | "grapple"` (exactly `advance`, `retreat`,
`circle_left`, `circle_right`, `hold`, `knockback`, `grapple`) plus the runtime
guard `isMovementEventAction`. `MovementResolvedData.action` is typed as the
canonical action set. Arbitrary strings are never treated as movement actions.

**Explicit exhaustive subject resolution.** `getMovementEventSubjectId` is now
an explicit exhaustive switch with no catch-all "everything else is actor
movement" branch:

```
knockback, grapple                    → targetId
advance, retreat, circle_left,
circle_right, hold                    → actorId
unknown, missing, non-string action   → null
non-movement event                    → null
```

An unknown action with a valid `actorId` or `targetId` still returns `null`;
a known normal action without `actorId`, or knockback/grapple without
`targetId`, returns `null`; source events are never mutated. Both reporting
and replay use this shared helper, so malformed movement events can never move
either fighter and are never silently reinterpreted as `hold`.

**Final-state projection isolation.** `projectFinalFighterState` returns a
state that shares no mutable nested state with the initial fighter state, any
event data object, any `round_ended` fighter object or any event-owned
conditions array. Build, component state, armour, binary component flags and
conditions are all cloned/copied; round-end conditions are validated and
copied (`[...conditions]`), never referenced. Isolation tests prove mutation
of either side cannot leak across.

**Facing and condition validation.** A present but invalid movement `facing`
is rejected (only `north`/`east`/`south`/`west`); the current facing is
preserved only when the facing field is genuinely absent. Authoritative
`round_ended.conditions` must be an array of canonical conditions
(`overturned`, `immobilised`, `overheated`, `stunned`); unknown or malformed
values are rejected, ordering is preserved, and no condition is inferred or
added beyond authoritative events and component rules. Old valid legacy
reports remain readable; this hardening applies to event-to-report projection.

**Report-construction boundary validation.** Both builders validate the
constructed report against its authoritative schema before returning and
return the parsed valid report: `buildFactualReport` against
`FactualMatchReportV1Schema`, `buildGridFactualReport` against
`FactualMatchReportV2Schema`. A clear boundary error identifies the report
version, the schema failure and the construction boundary. This catches
malformed reconstructed zones, facing, conditions, component/lifecycle facts
and fixed grid identity fields before review formatting, fallback review,
series construction or persistence can consume the report. Valid legacy v1
output and prompt snapshots are preserved byte-for-byte.

**Series-v2 match identity and factual-summary agreement.** For every
series-v2 entry, the entry `matchId`, the match-summary `matchId` and the
factual-report `matchId` must all be the same persisted match UUID:
`entry.matchId = entry.match.matchId = entry.factualReport.matchId`. The
standalone factual-report builders may continue to produce `matchId: "pending"`
during pre-persistence construction (the v2 report schema still permits it);
a persisted grid-series entry must carry the real UUID everywhere, so
`"pending"`, empty or malformed report IDs are rejected. The match summary and
factual report must also agree on `rounds`, `winner` and `resultMethod`. These
stricter cross-field rules apply to series v2 only — series v1 is untouched.

### 9.8 Phase 3D1.1 status

- Movement-event actions explicitly enumerated: complete.
- Unknown/malformed movement actions have no subject; reporting and replay
  both ignore malformed movement rather than moving the actor: complete.
- Final-state projection retains no event-owned mutable references: complete.
- Facing and round-end conditions validated, copied, never invented: complete.
- Both report builders validate against their schemas before returning:
  complete.
- Series-v2 entry, match summary and factual report share one match UUID:
  complete.
- Series-v2 match summaries agree with factual reports on rounds, winner and
  method: complete.
- Standalone builders may use `"pending"` before persistence; persisted
  grid-series entries require the real UUID: documented and enforced.
- Current match and series application paths remain legacy: confirmed.
- No grid canary, no default activation, no balance conclusion or tuning:
  confirmed.

Status: Phase 1 geometry complete; Phase 2 persistence/replay complete; Phase
3A grid runtime core complete; Phase 3B activation hardening complete; Phase
3B.1 momentum correction complete; Phase 3C lateral/flank integration complete;
Phase 3D1 reporting/series compatibility foundation complete; Phase 3D1.1
reporting hardening complete; explicit grid application canary **not
implemented**; default grid activation **not performed**; Milestone 0.2C
**not complete** pending a separately authorised activation-readiness
decision.

### 9.9 Phase 3D2A — isolated deterministic grid match canary (2026-08-01)

Phase 3D2A introduces the first executable application-level grid path: a
deliberately isolated, deterministic, local-only **single-match canary**. It
proves the complete grid pipeline works operationally without changing either
existing default application command:

```
built-in scenario
→ runGridMatch
→ match-record v3
→ factual-report v2
→ replay
→ deterministic fallback review
→ validated atomic artifact bundle
```

**Frozen built-in scenario `grid-canary-flank-v1`.** `src/canary/
grid-canary-scenario.ts` freezes Fighter A (`opening: flank`,
`primaryTarget: rear`, `secondaryTarget: rear`, `preferredRange: medium`,
`aggression: 0`, `retreatThreshold: 0`, `heatThreshold: 100`,
`fallback: defend`) and Fighter B (`opening: hold`, `front/front`,
`aggression: 0`, thresholds `0/100`, `fallback: defend`), both using the
Bulwark build, with a pure `createGridCanaryScenario()` factory returning
fresh build and policy values per call and a stable scenario-version
constant. Fighter A advances then translatedly circles; Fighter B holds.
Both always defend, so no attack, damage or component event occurs and the
match reaches the frozen round cap, resolving by judges as a draw. The
flanking path produces observable grid-only positioning evidence — translated
`circle_left`/`circle_right` events, a canonical corner visit (`north_west`),
and a rear-adjacent flanking position relative to the stationary fighter —
without depending on a lucky random combat result.

**Report-to-record binding.** A factual-report builder initially returns
`matchId: "pending"`; the persisted match record owns the real UUID. The pure
helper `bindGridFactualReportToMatchRecord` (`src/reports/
grid-factual-report-binding.ts`) requires authoritative factual-report v2 and
match-record v3, requires the exact grid identity (`0.3.0 / grid-3x3-v1 /
ruleset 0.2.0 / catalogue 1`) on both, requires seed, rounds, winner and
result-method agreement, requires the report `matchId` to be `"pending"` or
already the record UUID, replaces `"pending"` with the real UUID, re-validates
the completed report and never mutates its inputs. It is designed for later
reuse by a grid-series canary.

**Canary manifest contract.** `src/schemas/grid-match-canary.schema.ts`
defines `GridMatchCanaryManifestV1`: frozen identity (`schemaVersion "1"`,
`canaryKind "grid-match"`, `scenarioVersion "grid-canary-flank-v1"`,
`status "passed"`), `canaryId`/`createdAt`/`seed`, runtime identity
(`0.3.0 / grid-3x3-v1 / 0.2.0 / 1`), `matchId`, record/report schema versions
(`3`/`2`), `rounds`/`winner`/`resultMethod`/`eventCount`, a required evidence
block (`translatedCircleEvents`, `cornerZonesVisited`, `rearExposureObserved`,
`allMovementZonesCanonical`, `recordRoundTripPassed`, `reportRoundTripPassed`,
`replayFinalStateAgreement`, `fallbackReviewGenerated`) and the fixed
artifact-name block. It contains no win rates, comparative performance,
balance metrics or benchmark terminology, and never claims the grid runtime is
accepted or promoted.

**Pure evidence inspection.** `src/canary/grid-match-canary-evidence.ts`
inspects the direct `GridMatchResult` and fails closed when any required
evidence is absent: exact grid runtime identity (`0.3.0 / grid-3x3-v1`),
config ruleset `0.2.0` / catalogue `1`, every initial/movement/round-end zone
canonical, at least one translated circle, at least one canonical corner
visited, rear or rear-diagonal exposure relative to the stationary opponent,
and no combat events in the no-combat scenario. It reuses the canonical
movement-event subject helper and the existing geometry/bearing helpers only
— it never re-implements movement subjects, zone membership or exposure — and
never mutates the result or events. `assertGridCanaryFinalAgreement` verifies
the final `round_ended` event, the factual-report final states and the replay
reconstruction agree (zone; facing and integrity for report vs replay), and
`verifyGridCanaryDeterminism` re-executes the same seed and scenario and
fails if the event stream differs.

**Application service and CLI.** `runGridMatchCanary(request, dependencies)`
(`src/app/grid-match-canary.ts`) validates the seed, creates the frozen
scenario, executes `runGridMatch` directly, inspects the evidence, converts to
record v3, builds and binds factual-report v2, validates both, renders text
and 3×3 ASCII replay, formats the review prompt, produces the deterministic
fallback review (existing `buildFallbackReview` shape, no provider), round-trips
record/report serialization, checks replay/report/record agreement, builds the
manifest only after all checks pass, atomically publishes the bundle and
returns a structured result. Injectable dependencies cover UUID creation,
current time and the filesystem bundle writer; an alternate simulator
implementation is never permitted. The service never calls `runMatch`,
`runSeries`, an `ArenaAgent`, a provider or benchmark code, and never accepts
imported records or user-supplied event streams. `src/app/run-grid-canary-match.ts`
adds the explicit `match:grid:canary` script requiring `--seed
<non-negative integer>` and rejecting missing/negative/non-integer/duplicate
seeds, unknown arguments, `--ai`, `--review`, runtime-selection flags and
provider arguments; its banner is `FORGE ARENA — GRID MATCH CANARY /
NON-DEFAULT / NON-BENCHMARK / LOCAL-ONLY`.

**Atomic and isolated artifact bundles.** Each run is published under
`data/canary/grid-match/<canaryId>/` with the fixed artifact names
(`match.json`, `factual-report.json`, `text-replay.txt`, `ascii-replay.txt`,
`review-prompt.txt`, `fallback-review.json`, `manifest.json`). The complete
bundle is constructed in a sibling `.tmp-<canaryId>` directory,
`manifest.json` is written last, every artifact is read back and the
machine-readable artifacts are revalidated, and only then is the completed
temporary directory atomically renamed to `<canaryId>`. Existing canary
directories are never overwritten; on any failure no final canary directory
exists, the temporary directory is removed recursively and the original error
is preserved. The canary never writes to `data/matches` or normal series
storage and `data/canary/` is excluded from tracked source artifacts.

### 9.10 Phase 3D2A status

- Frozen built-in no-combat flank scenario with fresh per-call values:
  complete.
- Report-to-record binding (pure, idempotent, rejects all mismatches):
  complete.
- Canary manifest contract with validate/serialize/deserialize: complete.
- Pure evidence inspection with fail-closed checks; no mutation; no
  re-implemented movement/zone/exposure logic: complete.
- Replay/report/record final-position agreement: complete.
- Determinism re-execution proof: complete.
- Application service with injectable uuid/time/filesystem; no alternate
  simulator; no provider/series/benchmark calls: complete.
- Atomic isolated bundle publication with read-back validation and cleanup:
  complete.
- Explicit `match:grid:canary` command with the strict `--seed` contract and
  unmistakable banner: complete.
- Correctness, filesystem/failure and legacy/contract regression tests:
  complete; full suite, typecheck, lint and CRLF formatting pass.
- No grid adaptive-series runner, no runtime selector, no default activation,
  no provider integration, no combat/policy/prompt changes: confirmed.
- No benchmark partition ran; seeds, fixtures, C1/C2/AB2 checksums and
  qualification constants unchanged; C2 remains the default; held-out and
  `all` partitions remain sealed: confirmed.
- Normal match and series commands remain legacy; match persistence v2,
  factual reports v1, series v1; grid match v3, grid factual reports v2; no
  series-v2 application record: confirmed.

Status: Phase 1 geometry complete; Phase 2 persistence/replay complete; Phase
3A grid runtime core complete; Phase 3B activation hardening complete; Phase
3B.1 momentum correction complete; Phase 3C lateral/flank integration complete;
Phase 3D1 reporting/series compatibility foundation complete; Phase 3D1.1
reporting hardening complete; Phase 3D2A isolated grid match canary
**complete**; grid canary series **not implemented**; default grid activation
**not performed**; Milestone 0.2C **not complete** pending a separately
authorised activation-readiness decision.

### 9.11 Phase 3D2A.1 — canary evidence and artifact verification hardening (2026-08-01)

Phase 3D2A.1 corrects three issues found in the Phase 3D2A review before a grid
adaptive-series canary is added. No simulator, policy or combat semantics
changed and no grid series was introduced.

**Corrected geometric evidence statement.** The Phase 3D2A manifest claimed
`rearExposureObserved: true` from a corner-adjacency proxy (corner zone +
adjacent to the stationary fighter → rear exposure). That proxy was not proof
of rear exposure and is removed. The frozen scenario's fighter B holds at
`north` facing `south`; fighter A's observed `north_west` position is
defender-relative `right`, exposing `right` — not `rear`, `rear_left` or
`rear_right`. All exposure evidence is now calculated only through the
existing canonical functions `getRelativeBearing` and
`getPlanarExposedArmourZones`; no new bearing or exposure implementation was
added.

**Frozen canary evidence contract.** The canary's operational purpose is
translated lateral circling, a canonical corner visit, exposure of a non-front
planar flank, and full pipeline agreement. Canonical flank bearings are
`left`, `right`, `rear_left`, `rear_right` and `rear`; canonical flank
exposure is planar exposure containing at least one of `left`, `right` or
`rear`. The canary requires at least one canonical flank bearing relative to
the opponent (`right` is expected for the frozen scenario); `front_left` and
`front_right` never count. The evidence result replaces
`rearExposureObserved: true` with `lateralFlankObserved`,
`observedFlankBearings` and `strictRearExposureObserved`; both booleans are
derived from inspected positions (never hard-coded), and
`strictRearExposureObserved` is true only when the canonical exposed zones
actually contain `rear` (false for the frozen scenario). The frozen-scenario
role invariants are explicitly verified and fail closed: fighter A produces
translated movement, fighter B never changes cell, fighter B's facing remains
south, fighter A produces at least one translated circle, and both policies
produce no combat events.

**Manifest v2.** `GridMatchCanaryManifestV2Schema` /
`GridMatchCanaryManifestV2` (schemaVersion `"2"`) require
`lateralFlankObserved: true`, a non-empty unique `observedFlankBearings`
array, a derived `strictRearExposureObserved` boolean,
`stationaryFighterCellUnchanged: true`, `allMovementZonesCanonical: true`,
`allArtifactsReadBack: true` and `bundleCrossAgreementPassed: true`, and never
contain `rearExposureObserved`. The service emits manifest v2 only.
Manifest-v1 types are retained only for historical inspection with explicit
guards `isGridMatchCanaryManifestV1` / `isGridMatchCanaryManifestV2`;
version-aware deserialization may read both versions, but current bundle
validation requires v2, and artifacts produced by the pre-hardening Phase 3D2A
commit are superseded and must not be treated as current canary proof.

**SHA-256 artifact digests.** Manifest v2 carries a digest block covering
every non-manifest artifact (`match`, `factualReport`, `textReplay`,
`asciiReplay`, `reviewPrompt`, `fallbackReview`), each a lowercase SHA-256 hex
string (`^[a-f0-9]{64}$`) computed from the exact UTF-8 string written to disk
using the Node standard cryptography library (no dependency). `manifest.json`
is never digested inside itself, and the manifest is constructed only after
all six artifact contents and digests exist.

**Complete artifact read-back and cross-agreement.** Publication now reads
back all seven files, compares all seven strings byte-for-byte with the
written strings, deserializes and validates all four JSON artifacts, requires
manifest v2, runs the pure bundle cross-agreement validator
`validateGridMatchCanaryBundle`, and only then atomically renames the
temporary directory to the final directory. The complete final bundle is
reread and reverified at the published path; if final-path verification fails
the final directory is removed recursively and the original verification error
is preserved, leaving no final or temporary directory. The pure validator
checks identity agreement (matchId across manifest/record/report, seed, and
simulator/positioning/ruleset/catalogue/schema identities), result agreement
(rounds, winner, resultMethod, eventCount = record.events.length), fallback
review agreement (winner, method, rounds, both final integrity values, both
disabled-component lists), text-artifact contracts (non-empty, no NUL, valid
UTF-8, renderer markers: text replay completion marker, ASCII replay grid
header + canonical 3×3 corner label, review prompt grid simulator identity +
human-readable grid positioning) and every digest, without mutating inputs.

**Output-root isolation.** `assertCanaryOutputRootIsolation` is a pure guard
using resolved absolute paths that rejects `data/matches`, `data/series` and
every descendant, the repository `data` root and any non-canary child under
repository `data`; the only accepted in-repo grid-match canary root is the
canonical `data/canary/grid-match`, while arbitrary external temporary roots
remain allowed for tests. Path traversal and equivalent normalized paths are
handled and Windows drive/path comparisons are case-insensitive. The guard runs
before any directory is created or any match is executed.

**CLI truthfulness.** The command prints `Lateral flank observed`, `Observed
flank bearings` and `Strict rear exposure observed` from inspected evidence
and never prints a positive claim inferred from a zone name; the argument
contract and existing package scripts are unchanged.

### 9.12 Phase 3D2A.1 status

- Corner-adjacency proxy removed; canonical bearings are the only exposure
  evidence: complete.
- Frozen scenario proves lateral side flanking and observes `right`; strict
  rear exposure reported truthfully (false for the frozen scenario): complete.
- Scenario role invariants verified and fail closed: complete.
- Manifest v2 is the only current passing manifest; v1 retained for historical
  inspection only: complete.
- SHA-256 digests for all non-manifest artifacts: complete.
- Every artifact reread; all digests verified; all artifacts cross-validated:
  complete.
- Protected normal storage roots rejected before execution or writes:
  complete.
- Corruption (including schema-valid corruption) rejected with full cleanup:
  complete.
- CLI reports truthful flank evidence: complete.
- Full suite, typecheck, lint and CRLF formatting pass; no benchmark partition
  ran; seeds and fixtures unchanged; held-out and `all` remain sealed;
  C1/C2/AB2 checksums and qualification constants unchanged with C2 default;
  simulator/ruleset constants `0.2.0 / 0.2.0`; catalogue `1`; normal match and
  series commands remain legacy; canary match records v3; canary factual
  reports v2; no grid series runner; no external API call; no default
  activation: confirmed.

Status: Phase 1 geometry complete; Phase 2 persistence/replay complete; Phase
3A grid runtime core complete; Phase 3B activation hardening complete; Phase
3B.1 momentum correction complete; Phase 3C lateral/flank integration complete;
Phase 3D1 reporting/series compatibility foundation complete; Phase 3D1.1
reporting hardening complete; Phase 3D2A isolated grid match canary
**implemented**; Phase 3D2A.1 canary evidence and artifact hardening
**complete**; grid canary series **not implemented**; default grid activation
**not performed**; Milestone 0.2C **not complete** pending a separately
authorised activation-readiness decision.

### 9.13 Phase 3D2A.2 — immutable and exclusive canary publication (2026-08-02)

Phase 3D2A.2 closes three remaining filesystem-publication gaps found in the
Phase 3D2A.1 review before a grid adaptive-series canary is added. No canary
evidence, simulator behaviour or artifact contents changed.

**Exact canonical output root.** `assertCanaryOutputRootIsolation` now accepts
a service-level `outputRoot` inside the repository `data` tree only when it
resolves to exactly `data/canary/grid-match`. Descendants such as
`data/canary/grid-match/<canaryId>`, `data/canary/grid-match/custom` and
`data/canary/grid-match/.tmp-<id>` are publication destinations or internal
temporary locations, not valid service roots, and are rejected (so a published
bundle directory can never be reused as a service root). Normalized equivalent
syntax is accepted after `resolve`; traversal forms resolving to any rejected
path and Windows case-insensitive comparisons continue to be handled. External
temporary roots outside the repository remain allowed for tests.

**Extended injectable filesystem.** `CanaryFileSystem` now exposes
`lstat(path)` (returning `isFile()`, `isDirectory()` and `isSymbolicLink()`)
and `readdir(path)`. Publication logic never bypasses the injectable filesystem
with direct filesystem calls.

**Preflight of identity and paths.** The service generates and validates the
`canaryId` (a UUID) and derives `finalDir = outputRoot/<canaryId>` and
`tmpDir = outputRoot/.tmp-<canaryId>` before executing the match. Both paths
are preflighted with `lstat` and must not exist as any filesystem entry
(directory, empty directory, regular file, symbolic link, broken symbolic link
or other); the failure identifies the final or temporary path. The output-root
guard runs before UUID creation, directory creation or match execution, and
the publication-path collision preflight runs before match execution.
Pre-existing final or temporary entries are never modified or removed.

**Exclusive temporary creation.** After the parent output root exists, the
temporary directory is created with non-recursive `mkdir(tmpDir,
{ recursive: false })`, so an entry that races in between preflight and
creation fails with `EEXIST`. The service explicitly tracks
`tmpCreatedByThisInvocation` and `finalPublishedByThisInvocation`; cleanup
removes the temporary directory only when this invocation created it and the
final directory only when this invocation published it and final verification
subsequently failed. Pre-existing paths are never removed, and the original
operational or verification error is preserved if cleanup also fails.

**Exact bundle inventories.** Before rename, `readdir(tmpDir)` must contain
exactly the seven canonical entries (`manifest.json`, `match.json`,
`factual-report.json`, `text-replay.txt`, `ascii-replay.txt`,
`review-prompt.txt`, `fallback-review.json`), names sorted and matching
manifest v2 exactly, with no missing artifact, no additional file or
directory, no nested data and no symbolic link; every artifact must be a
regular file. The same exact inventory and regular-file checks run at
`finalDir` after the atomic rename, before the complete existing byte, schema,
digest and cross-agreement verification. A stale or injected eighth entry
fails publication; an injected extra final file during final verification
fails and the final directory is removed because this invocation published it.

**Race handling.** If preflight reports no temporary entry and exclusive
`mkdir(tmpDir)` returns `EEXIST`, the service fails closed, does not remove the
raced-in temporary path, does not create a final directory and never writes
into the raced-in path. If a final entry appears after preflight and causes the
rename to fail, that final entry is preserved and only the invocation-owned
temporary directory is removed.

**Preserved guarantees.** Manifest v2 remains the only current passing
manifest; the actual observed bearing remains `right` with strict rear
exposure `false` for the frozen scenario; the six SHA-256 artifact digests,
the all-seven-file read-back, byte-for-byte comparison, JSON schema
validation, bundle cross-agreement and final-path revalidation are all
preserved without weakening. Current artifact schemas and text output were
not changed.

### 9.14 Phase 3D2A.2 status

- Service roots inside repository data must equal the canonical root exactly:
  complete.
- Published bundle directories cannot be reused as service roots: complete.
- Final and temporary collisions detected through `lstat` (empty directories,
  files and symbolic links all count): complete.
- Preflight of canary identity and publication paths before match execution:
  complete.
- Exclusive temporary-directory creation; pre-existing temporary paths never
  reused or cleaned: complete.
- Cleanup applies only to invocation-owned paths: complete.
- Temporary and final directories require exactly seven regular files:
  complete.
- Race simulations (exclusive-mkdir EEXIST, post-preflight final entry)
  handled defensively: complete.
- Manifest-v2 evidence and digest semantics unchanged; all verification
  guarantees preserved: confirmed.
- Full suite, typecheck, lint and CRLF formatting pass; no benchmark partition
  ran; seeds and fixtures unchanged; held-out and `all` remain sealed;
  C1/C2/AB2 checksums and qualification constants unchanged with C2 default;
  simulator/ruleset constants `0.2.0 / 0.2.0`; catalogue `1`; normal match and
  series commands remain legacy; no grid-series runner; no provider or external
  API call; no default activation: confirmed.

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

### 9.15 Phase 3D2B — isolated deterministic grid adaptive-series canary (2026-08-02)

Milestone 0.2C Phase 3D2B adds the second isolated application-level grid
path: a deterministic, local-only **three-match adaptive-series canary** that
proves the complete grid series pipeline operationally — three grid matches,
match-record v3 × 3, factual-report v2 × 3, replay × 3, deterministic fallback
reviews, two frozen policy adaptations, series-record v2, four JSON envelopes,
an adaptation trace, a series report and a validated atomic artifact bundle.
It is a separate explicit command (`npm run series:grid:canary -- --seed
<base>`); no default command, runtime selector, provider integration or
activation was added.

- **Shared immutable publication infrastructure.** `src/canary/immutable-
canary-bundle.ts` now owns the injectable `CanaryFileSystem`, `fsEntryKind`,
  exact-declared inventory checks and `publishImmutableBundle` (lstat
  collision preflight, exclusive temporary `mkdir`, manifest-last writing,
  full read-back, byte comparison, caller `verify` hook, atomic rename,
  invocation-owned cleanup). The single-match canary was refactored onto it
  with byte-compatible behaviour (same CLI, manifest v2, artifact names,
  bytes, digests, evidence, output root, success output and failure
  semantics), and `CanaryFileSystem`/`CanaryFsEntry`/`buildDeterministicFallbackReview`
  remain re-exported from `src/app/grid-match-canary.ts` for test and caller
  compatibility. All pre-existing single-match canary tests pass unchanged.
- **Kind-aware output-root guard and physical-root guard.** The neutral
  `src/canary/canary-output-root.ts` freezes `grid-match` →
  `data/canary/grid-match` and `grid-series` → `data/canary/grid-series`,
  rejects cross-kind roots and protected normal storage for both kinds, and
  adds `assertCanaryPhysicalRoot` (async): every existing component of the
  root ancestry is inspected with `lstat` and must be a real directory (symbolic
  links, junctions, regular files and other entry types are rejected), missing
  components are created normally, the complete ancestry is re-inspected after
  recursive root creation and again before any artifact write, and external
  roots must be existing real directories (a symlink supplied as the service
  root is never followed). The guard runs before combat/series execution and
  is shared by both canaries.
- **Frozen combat-observable series scenario.** `grid-series-canary-adaptive-v1`
  freezes the deterministic local competitor (`grid-canary-competitor` /
  `deterministic-local`, initial policy `flank`/`medium`/aggression `100`/
  `rear`/`rear`/thresholds `20`/`80`/`defend`) against the canonical
  `BULWARK_POLICY` opponent; both fighters use fresh deep-cloned Bulwark builds
  every match; `maximumMatches 3`, `targetWins 3`, no `nextDesign`, no
  provider. The series requires at least one translated grid movement and at
  least one `attack_attempted` event across the three matches and terminates
  every match within the frozen round cap.
- **Frozen seed plan and deterministic adaptation.** The seed plan is
  `[baseSeed, baseSeed + 1, baseSeed + 2]` with safe-integer bounds (base ≤
  `Number.MAX_SAFE_INTEGER - 2`). `adaptGridCanaryPolicy` applies the frozen
  `grid-canary-policy-adaptation-v1` rule after matches 1 and 2 only, requiring
  the authoritative factual-report v2 and the deterministic fallback review to
  agree first: aggression `80`/`70` (match 1) and `60`/`90` (match 2) by
  integrity comparison; opening `hold` when mobility-disabled or
  immobilised/overturned, `cautious` when behind, otherwise `flank`; untouched
  policy fields preserved; output validated against `actionPolicySchema`. The
  adaptation-trace v1 schema re-derives every decision; no RNG, provider,
  clock or filesystem is used and the adaptation is never described as
  intelligent or AI-generated.
- **Pure deterministic core with injected identity.** `executeGridSeriesCanary`
  never generates UUIDs, never reads the clock, never touches the filesystem
  and never calls a provider, `runSeries` or benchmark code. Match UUIDs, the
  series UUID and timestamps are injected through service dependencies; the
  match converter gained an optional identity parameter (matchId/createdAt)
  without weakening normal conversion. Each match is converted to match-record
  v3 with the injected identity, bound to its factual-report v2, rendered to
  text/ASCII replay, and checked for determinism (re-execution), canonical
  zones, round-cap termination and replay/report/final-round agreement. The
  service re-executes the core with identical identities and requires identical
  series, matches, reports and trace.
- **Series-record v2 and envelopes.** `buildGridSeriesCanarySeriesRecord`
  produces the authoritative series v2 (grid runtime identity, status
  `completed`, target/max 3, three entries each with the bound report, the
  fallback review and an explicit intentional-local-fallback review-failure
  marker, the build proposal used, the policy used, the next policy for
  matches 1–2 and none for 3, no next design, empty usage; all-zero
  totalUsage; score and winner derived from actual outcomes). The four JSON
  envelopes (`matches.json`, `factual-reports.json`, `fallback-reviews.json`,
  `match-artifacts.json`) enforce order (index = match number), uniqueness and
  series identity, non-empty/no-NUL text artifacts, and never-`pending` report
  IDs.
- **Manifest v1 and pure bundle validator.** The series canary manifest v1
  freezes the canary/series identities, three sequential seeds, grid runtime
  identity, sixteen evidence flags (all matches terminated, all records v3, all
  reports v2, all bound, all fallback reviews valid, all replay final states
  agree, all zones canonical, translated movement, combat attempt, policy
  adaptation count 2, adaptation facts agree, series and trace round trips,
  deterministic re-execution, full read-back, bundle cross-agreement) and seven
  SHA-256 digests, with no win rates, percentages, promotion, balance or
  benchmark terminology. `validateGridSeriesCanaryBundle` cross-checks
  identity/ordering (one series UUID, sequential seeds, three ordered matches,
  unique match IDs, number/ID/seed alignment), runtime/schema identity, result
  facts, adaptation facts (two transitions sourcing matches 1–2, entry
  nextPolicy == trace policyAfter, next-entry policyBefore == prior nextPolicy,
  decisions recalculated, no build change), series facts (score == outcomes,
  winner rule, zero usage, completed, target/max 3), text-artifact markers
  (text replay completion, ASCII grid labels, grid review prompt, and a series
  report that identifies `0.3.0`/`grid-3x3-v1`, states canary/non-benchmark,
  and gives the raw three-match score with no win rate) and every digest,
  never mutating inputs.
- **Isolated immutable publication.** Each run writes exactly eight regular
  files under `data/canary/grid-series/<canaryId>/`; the shared publisher
  enforces the exact inventory, manifest-last order, full read-back,
  byte-for-byte comparison, JSON revalidation and the pure bundle validator at
  both the temporary and final paths, with atomic rename and invocation-owned
  cleanup. Pre-existing final or temporary paths are rejected and preserved.
  The service never writes to `data/matches` or normal series storage.
- **CLI is separate, explicit and truthful.** `series:grid:canary` prints the
  canary ID, scenario, series ID, seed plan, runtime identity, per-match IDs
  and results, the final raw score, both adaptation summaries and the artifact
  directory under the `NON-DEFAULT / NON-BENCHMARK / LOCAL-ONLY` banner. The
  parser rejects missing, negative, unsafe or overflowing seeds, duplicates,
  unknown arguments, target-wins/maximum-matches overrides, runtime selectors,
  `--ai`, `--review`, provider and API-key arguments.
- **No balance, benchmark, provider or activation change.** No benchmark
  partition ran, seeds and fixtures are unchanged, held-out and `all` remain
  sealed, no provider or external API call occurred, and no balance
  conclusion, tuning or default grid activation was performed.
  `SIMULATOR_VERSION`/`RULESET_VERSION` remain `0.2.0`, catalogue `1`, and
  C1/C2/AB2 checksums and qualification constants remain frozen with C2 the
  default. Activation-readiness was not performed and Milestone 0.2C remains
  incomplete.

### 9.16 Phase 3D2B status

- Shared immutable publication infrastructure extracted and used by both
  canaries; single-match canary refactored byte-compatibly: complete.
- Kind-aware output-root guard (cross-kind rejection) and async physical-root
  guard (lstat ancestry, symlink/junction rejection, re-inspection before
  artifact write): complete.
- Frozen combat-observable series scenario with fresh per-match values:
  complete.
- Frozen seed plan with safe-integer bounds: complete.
- Deterministic policy adaptation (`grid-canary-policy-adaptation-v1`) with
  report/review agreement and structured decisions: complete.
- Adaptation-trace v1 schema with cross-field contract: complete.
- Pure three-match core with injected identity, determinism, evidence and no
  provider/fs/clock/RNG: complete.
- Series-record v2 construction (completed, zero usage, no next design, bound
  reports and reviews, derived score/winner): complete.
- Four envelope schemas with order/uniqueness/series-identity and text
  contracts: complete.
- Series canary manifest v1 (16 evidence flags, 7 digests, no win rates):
  complete.
- Pure series bundle validator (identity/ordering, runtime, result,
  adaptation, series, text, digests): complete.
- `runGridSeriesCanary` service (root/physical guards, five distinct UUIDs,
  preflight, core, series, report, envelopes, round trips, deterministic
  re-execution, digests, manifest, shared publish, read-back, structured
  result): complete.
- Storage layout `data/canary/grid-series/<canaryId>/` with exactly eight
  regular files; never writes normal storage: complete.
- CLI parser and `series:grid:canary` command with truthful output: complete.
- Full suite, typecheck, lint and CRLF formatting pass; no benchmark partition
  ran; seeds and fixtures unchanged; held-out and `all` remain sealed;
  C1/C2/AB2 checksums and qualification constants unchanged with C2 default;
  simulator/ruleset constants `0.2.0 / 0.2.0`; catalogue `1`; normal match and
  series commands remain legacy; no provider or external API call; no default
  activation: confirmed.

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

### 9.17 Phase 3D2B.1 — grid series canary provenance and immutability hardening (2026-08-02)

Milestone 0.2C Phase 3D2B.1 closes four contract gaps found in the Phase 3D2B
review of the grid adaptive-series canary, before any activation-readiness
evaluation: runtime immutability of the seed plan, complete report/review
agreement (including disabled components) before adaptation, full
series-entry-to-record/envelope provenance binding, and bundle validation of
disabled-component lists and the authoritative rendered series score. No
simulator, scenario, policy, seed-derivation, adaptation-rule or combat
semantics changed.

- **Runtime-frozen seed plan**: `createGridSeriesCanarySeedPlan` returns
  `Object.freeze`d plan and seed tuples; `Object.isFrozen` holds for both;
  attempted mutation cannot change any seed; separate calls return separate
  frozen values. Derivation stays `[base, base + 1, base + 2]`.
- **Safe-integer seed contracts in persisted schemas**: manifest v1 requires
  safe base/derived seeds with `baseSeed ≤ Number.MAX_SAFE_INTEGER - 2` and
  exact sequential seeds; the adaptation-trace v1 schema requires safe
  base/source seeds with transition 1 source = base and transition 2 source =
  base + 1; the bundle validator independently requires every seed in the
  manifest, series entries, match records, factual reports and trace to be a
  safe integer. Legacy match/series seed schemas are unchanged.
- **Complete report/review agreement before adaptation**: `adaptGridCanaryPolicy`
  uses the shared `gridFallbackReviewDisagreements` helper to require
  agreement on winner, method, rounds, both final integrity values and both
  canonical disabled-component lists (`mobility`, `weapon`, `utility` order;
  missing/extra/different/duplicate/reordered claims rejected) before any
  impairment fact is read for opening selection. Conditions remain
  authoritative factual-report facts.
- **One shared fallback-agreement implementation**: `grid-canary-fallback-agreement.ts`
  provides `gridFallbackReviewDisagreements` and `normaliseDisabledComponents`,
  used by the adaptation, the deterministic fallback-review builder and both
  bundle validators; the single-match fallback-review validation is preserved
  unchanged.
- **Full series-entry provenance binding**: the bundle validator requires the
  entry match summary to equal the record on every field (matchId, createdAt,
  seed, rounds, winner, resultMethod, schema, simulator, positioning), the
  embedded factual report to equal the report-envelope item structurally, the
  embedded review to be non-null and equal the fallback-review-envelope item,
  the fallback envelope's match number/ID to align, and every entry's
  `reviewFailure` to equal the frozen intentional local-fallback marker
  exactly.
- **Build/policy execution binding**: entry `designBeforeMatch` = record
  fighter A build proposal; entry `policyBeforeMatch` = record fighter A
  policy; record fighter B proposal/policy = frozen Bulwark proposal and
  `BULWARK_POLICY`; competitor build identical across all three records; the
  adaptation chain (trace policy-after, entry policies, actual record config
  policies) agrees end-to-end.
- **Disabled-component facts validated in the bundle** and manifest evidence
  recomputed from persisted artifacts (`recomputeGridSeriesCanaryEvidence`)
  for the ten recomputable flags; operational-only evidence (round trips,
  re-execution, read-back, bundle cross-agreement, replay final-state
  agreement) retains its service check. No new balance evidence.
- **Rendered per-match facts cross-validated** (text replay exact completion
  line + round count + seed via the shared `formatCompetitionEndedLine`;
  review prompt exactly reproducible via `buildReviewUserPrompt`; ASCII replay
  grid markers + seed/method/round) and the **authoritative raw series score**
  verified in the report via the exact canonical score line and "3 matches
  completed", rejecting wrong/swapped scores, wrong draw/match counts and any
  percentage.
- **Publisher declaration contract validated before filesystem activity**:
  `assertValidBundleDeclaration` rejects duplicate/path-like names, manifest
  absence/duplication, artifact/manifest collisions, undeclared artifacts and
  missing artifacts for non-manifest entries before any preflight or directory
  creation; the seven-file and eight-file bundles remain byte-for-byte
  unchanged.
- **Frozen regression proven**: seed 3 with fixed identities keeps identical
  event streams/reports/trace/series (frozen SHA-256 digests); series-grid
  canary stays match v3 / report v2 / series v2 / manifest v1; match-canary
  bytes/behaviour, all collision/race/symlink/inventory/digest/cleanup
  guarantees, legacy `runSeries`/match v2/report v1 and all scripts except the
  already-added `series:grid:canary` are unchanged.
- **No benchmark, balance, provider or activation change**: no benchmark
  partition ran, seeds/fixtures unchanged, held-out and `all` sealed,
  C1/C2/AB2 and checksums unchanged with C2 default, constants `0.2.0 / 0.2.0`
  and catalogue `1`, normal match/series legacy, no provider/API call, no
  activation-readiness evaluation and no default activation.

### 9.18 Phase 3D2B.1 status

- Seed plan runtime-freezing (`Object.isFrozen` plan and seeds; mutation
  cannot change values; separate frozen values per call): complete.
- Safe-integer seed constraints in manifest and trace schemas and in the pure
  bundle validator; legacy seed schemas untouched: complete.
- Complete report/review agreement (winner, method, rounds, integrity,
  disabled components) before adaptation, with canonical ordering and no
  review-derived conditions: complete.
- Single shared fallback-agreement helper used by adaptation, bundle
  validation and the fallback-review builder; single-match validation
  preserved: complete.
- Series-entry-to-record and envelope provenance binding (match summary,
  factual report, review, fallback envelope, frozen review-failure marker):
  complete.
- Build/policy execution binding (competitor and Bulwark proposals/policies,
  adaptation chain to actual record policies): complete.
- Disabled-component facts validated in the bundle: complete.
- Manifest evidence recomputation from persisted artifacts with manifest
  agreement; operational-only evidence preserved: complete.
- Rendered per-match facts (text replay completion, review prompt
  reproducibility, ASCII seed/method/round) cross-validated: complete.
- Authoritative raw series score line and three-match count verified in the
  report: complete.
- Publisher declaration contract validated before filesystem activity;
  seven/eight-file bundles byte-for-byte unchanged: complete.
- Frozen regression digests for seed 3 and artifact-version assertions:
  complete.
- Full suite, typecheck, lint and CRLF formatting pass; no benchmark partition
  ran; seeds and fixtures unchanged; held-out and `all` remain sealed;
  C1/C2/AB2 and qualification checksums unchanged with C2 default;
  simulator/ruleset constants `0.2.0 / 0.2.0`; catalogue `1`; normal match and
  series commands remain legacy; match and series canaries remain isolated; no
  normal storage modified; no provider or external API call; no balance
  conclusion; no activation-readiness evaluation; no default activation:
  confirmed.

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

### 9.19 Phase 3E1 — bounded development-only grid activation-readiness evaluation (2026-08-02)

Milestone 0.2C Phase 3E1 introduces one bounded, deterministic,
development-only **activation-readiness evaluation** that answers whether the
grid runtime is technically suitable for a separately authorised opt-in beta
decision. It does not activate grid, does not alter defaults, does not tune
combat or policies and does not claim production readiness. The evaluation
classifies the current implementation as exactly one of
`ready_for_opt_in_beta_review`, `inconclusive` or `not_ready`; even
`ready_for_opt_in_beta_review` is not permission to activate grid.

- **Development-only seed registry.** `config/readiness/grid-readiness-development-v1.json`
  registers exactly 24 frozen seeds in the reserved range
  `1703000000–1703099999` (identity `grid-readiness-development-v1`,
  `development-only` partition, explicit-list generator). The registry is
  runtime-frozen, safe-integer enforced, distinct after the simulator's signed
  32-bit seed conversion, and carries a deterministic canonical checksum. The
  numeric range is reserved for grid-readiness development and must not be
  used by future benchmark or held-out registries. The registry is logically
  independent from all existing benchmark partitions and is never read through
  a benchmark seed bank; the readiness command never opens any existing
  benchmark seed file.
- **Frozen scenario registry.** `grid-readiness-scenarios-v1` contains seven
  scenario families and thirteen concrete role assignments: one Bulwark-mirror
  assignment and six role-swapped pairs (Flanker, Spinner, Grappler, Flipper,
  Runner, Sentinel versus the canonical Bulwark). Every build is validated
  against catalogue v1 before any evaluation begins; every factory returns
  fresh deep-cloned builds and policies; the registry is runtime-frozen with a
  deterministic canonical checksum.
- **Exact run plan.** The suite is `24 seeds × 13 assignments = 312` primary
  matches, ordered scenario registry → assignment order within scenario → seed
  registry order, with a unique `(scenarioId, assignmentId, seed)` tuple, no
  random shuffling, frozen plan and entries, and a deterministic suite checksum
  that includes the registry IDs, registry checksums, runtime identity and the
  ordered runs.
- **Pure execution core.** `executeGridActivationReadinessSuite` calls
  `runGridMatch` directly, requires the exact grid runtime identity
  `0.3.0 / grid-3x3-v1 / 0.2.0 / 1` and `1 ≤ rounds ≤ MAX_ROUNDS`, validates
  every initial and event zone, movement action, movement subject, facing and
  round-end condition, converts to match-record v3 with injected UUIDs and
  timestamps, builds and binds factual-report v2, validates every record and
  report, verifies replay/report/final-round agreement, renders text and ASCII
  replays and the grid-aware review prompt, and produces a canonical per-run
  result (action, translated-action, zone-visit, bearing/exposure and
  event-type counts, maximum consecutive no-progress rounds, and record /
  report / text-replay / ascii-replay / review-prompt checksums). The core is
  pure: no file reads/writes, no UUIDs, no clock, no provider, no benchmark,
  no legacy runtime code, and it fails closed on any input mutation. Replay
  and prompt text are never persisted in the readiness bundle.
- **Deterministic re-execution.** The full 312-match suite executes a second
  time with the same run plan, the same injected match IDs and the same
  timestamps; byte-identical serialized v3 records, v2 reports, per-run
  evidence, replay/ASCII/prompt checksums and ordered aggregate inputs are
  required. A mismatch is a hard readiness failure. No duplicate second-run
  records are published.
- **Authoritative artifact envelopes.** `run-index.json` (312 ordered run
  entries), `match-records.json` (312 match-record v3 values) and
  `factual-reports.json` (312 factual-report v2 values), each v1 with the
  evaluation UUID, with cross-envelope agreement on index, match ID, seed,
  runtime, scenario/assignment identity, result, rounds and record/report
  binding.
- **Pure metrics reducer.** Aggregates execution (planned/completed/
  deterministic/schema-valid/replay-agreeing/invalid-event/mutation counts),
  movement (canonical and translated actions, stationary holds, nine zone
  visits, relative bearings, exposed planar armour zones), combat (attempts,
  hits, misses, integrity damage, criticals, knockback, grapple reposition,
  overturns, damaged/disabled/resisted transitions), results (judges,
  destruction, immobilisation, draws, round-cap, round statistics, maximum
  no-progress streak), slot-order diagnostics (fighter-A/B wins, first-slot
  advantage, Bulwark-mirror decisive count and slot imbalance, paired
  role-swap stable/sensitive comparisons and sensitivity ratio) and timing
  percentiles. Slot-order diagnostics detect gross slot-order pathology only;
  timing is informational and never affects the decision.
- **Frozen gates.** Hard correctness gates H01–H10 (complete execution,
  determinism, runtime identity, persistence and reporting, replay agreement,
  event validity, input immutability, progress deadlock with a 10-round
  no-progress limit, artifact integrity, legacy isolation) are pass/fail.
  Coverage gates C01–C06 (grid-space, movement, core combat, reposition
  feature, component lifecycle, result-method coverage) are pass/inconclusive;
  missing coverage is `inconclusive`, never a simulator failure, and nothing
  is tuned to make an item appear. Slot-order stability gates S01–S03 and
  progress gates P01–P02 use frozen gross-pathology thresholds (S01 ≤ 0.25
  pass / > 0.50 fail with ≥ 8 decisive mirror matches; S02 and S03 analogous;
  P01 attackless ≤ 0.10 pass / > 0.25 fail; P02 round-cap ≤ 0.75 pass /
  > 0.95 fail). Any hard, slot-stability or progress failure produces
  > `not_ready`; otherwise any inconclusive gate produces `inconclusive`;
  > otherwise `ready_for_opt_in_beta_review`.
- **Decision v1.** `GridActivationReadinessDecisionV1` (`grid-activation-readiness`
  evaluation kind, `grid-activation-readiness-v1` suite, `completed` status)
  carries every gate with category, outcome, frozen threshold, observed value,
  concise evidence and blocking reason, the derived classification and the
  mandatory disclaimer: "This development-only evaluation does not activate
  the grid runtime, does not qualify combat balance and does not authorise
  default migration." No tuning recommendation is ever included.
- **Human-readable report.** A deterministic development-only report includes
  the evaluation and suite IDs, runtime identity, registry IDs and checksums,
  scenario/assignment/seed counts, total simulations, determinism, contract,
  movement/combat coverage, result-method counts, slot-order and progress
  diagnostics, timing, every gate result, the final classification, blockers/
  missing evidence and the mandatory non-activation disclaimer. It never
  recommends threshold/build/policy changes, never calls the suite a
  benchmark, never calls a result a balance pass, never claims production
  readiness and never states that grid is now default.
- **Immutable evaluation bundle.** The kind-aware root guard now includes
  `grid-readiness → data/readiness/grid`; the readiness service rejects normal
  match/series storage, both canary roots, every other in-repository data
  root, descendants of the canonical readiness root as service roots, symlink
  or junction ancestry and external symlink roots. Each official evaluation
  writes exactly nine regular files under `data/readiness/grid/<evaluationId>/`
  (`manifest.json`, `seed-registry.json`, `scenario-registry.json`,
  `run-index.json`, `match-records.json`, `factual-reports.json`,
  `metrics.json`, `decision.json`, `report.txt`) through the shared immutable
  publisher. The manifest v1 carries the evaluation UUID, creation time, suite
  and runtime identity, exact counts (24/7/13/312), registry/suite/outcome/
  report checksums, the readiness decision, fixed artifact names, the SHA-256
  digest of every non-manifest artifact and read-back/cross-agreement
  evidence. The complete bundle is cross-validated from the persisted records
  and reports; individual replay text is never included.
- **Service and CLI.** `runGridActivationReadiness(request, dependencies)`
  orchestrates the root guard, fixed registries, run plan, injected identities,
  primary and repeat execution, determinism comparison, artifact/envelope
  construction, metrics, gates, decision, report, round trips, digests,
  manifest, shared publish, explicit read-back and cross-validation. The
  `readiness:grid` command accepts no arguments (seed/scenario/partition/
  output/threshold/`--force`/runtime/provider/API-key arguments are all
  rejected) under the `FORGE ARENA — GRID ACTIVATION-READINESS EVALUATION /
DEVELOPMENT-ONLY / NON-BENCHMARK / NON-ACTIVATING` banner. A successfully
  completed evaluation exits zero regardless of its decision; it exits nonzero
  only for an operational failure that prevents producing a validated decision
  bundle.
- **No benchmark, held-out, provider, tuning or activation change.** No
  benchmark partition runs, no existing benchmark seed file is opened,
  held-out and `all` remain sealed, C1/C2/AB2 checksums and qualification
  constants remain frozen with C2 default, simulator/ruleset constants remain
  `0.2.0 / 0.2.0`, catalogue `1`, normal `match`/`series` remain legacy, both
  canaries remain isolated and unchanged, no provider or external API call
  occurs, no tuning follows the official result, no opt-in activation decision
  is performed and no default activation occurs.

**Official development-only run (2026-08-02):** exactly one official run of
`npm run readiness:grid` executed (`evaluationId
864991f7-d060-4669-beec-11e0d42b7e68`), publishing the immutable nine-file
bundle under `data/readiness/grid/864991f7-d060-4669-beec-11e0d42b7e68/`.
Determinism passed; all ten hard correctness gates (H01–H10), all three
slot-order gates (S01–S03) and both progress gates (P01–P02) passed; coverage
gates C01, C03, C05 and C06 passed; coverage gates **C02** (movement coverage —
the canonical `hold` movement action was not observed) and **C04**
(reposition feature coverage — no grapple reposition was observed) were
**inconclusive**. Per the frozen decision derivation, the final readiness
classification is **`inconclusive`**. No code, scenario, policy, seed,
threshold or gate was altered after seeing the result; no tuning occurred; no
opt-in activation decision and no default activation was performed.

### 9.21 Phase 3E1.1 — grid readiness evidence hardening (2026-08-02)

Phase 3E1.1 corrects the readiness action-evidence source and hardens decision
provenance without changing the 24 seeds, 7 scenarios, 13 assignments, the
312-run plan, gate thresholds or simulator semantics. The historical Phase 3E1
v1 evaluation (`864991f7-d060-4669-beec-11e0d42b7e68`,
`inconclusive`, C02 + C04) is preserved as historical evidence; the v1 suite
checksum `dd38ac8a5d2e35007b4b6890418b21aca8f621f3e165fa7d158d2f179672ae5a`
and the v1 bundle remain frozen for archival inspection.

- **Selected actions come from `policy_triggered`, not `movement_resolved`.**
  The Phase 3E1 C02 gap counted selected actions from ordinary
  `movement_resolved` events, so a stationary `hold` (which emits no movement
  event) was never observed and C02 was inconclusive. The shared
  record-evidence inspector (`src/readiness/record-evidence.ts`) now derives
  selected movement and combat actions from `policy_triggered` events —
  exactly one per fighter per completed round, canonical actor/movement/combat,
  no duplicates, no events after competition completion, and a selected-action
  total that must equal `2 × completed rounds`. Ordinary `movement_resolved`
  events are still validated against the actor's selected policy movement for
  the same round; knockback and grapple repositions use target-subject
  semantics and are never selected actions. The live execution core and the
  read-back bundle validator both use this same inspector, so live evidence
  and persisted-record evidence are always identical. The Sentinel hold
  scenario is now correctly evidenced (`hold` selected count 4373 across the
  v2 suite).
- **Deep-frozen scenario registry with distinct definitions.** Every nested
  fighter definition, build proposal, armour object and policy is a fresh
  deeply frozen clone; equal Bulwark definitions across scenarios, and the
  mirror X and Y, are distinct objects with equal content and no shared
  references. Deserialized registries reconstruct the same guarantees. The
  serialized bytes and canonical checksum
  (`b07270171f6e38efac2d1992f051d7bd881e323c00cee92b9caa9490ddb85b67`) are
  unchanged.
- **The published bundle recomputes its evidence end-to-end.** The validator
  no longer trusts the persisted derived artifacts alone: it parses all nine
  artifacts, verifies digests and registry checksums, recomputes the exact run
  plan and suite checksum, derives per-run evidence and render checksums from
  the persisted records, recomputes metrics from the records/reports (timing
  supplied as informational input), recomputes gates from those metrics and
  records, derives the decision, and regenerates `report.txt` byte-for-byte.
  Any disagreement fails the bundle. `run-index.json` now carries
  `selectedMovementActionCounts` and `selectedCombatActionCounts` per entry;
  `metrics.json`, `decision.json` and `manifest.json` are v2 (`schemaVersion`
  2, suite `grid-activation-readiness-v2`, action-evidence model
  `policy-triggered-round-actions-v1`). Version-aware parsers read both v1 and
  v2; only v2 is accepted as current readiness evidence.
- **No supplemental grapple scenario was added.** C04 (reposition feature
  coverage — no grapple reposition observed, grapple count 0) may remain
  inconclusive in the v2 result; that is an accepted, recorded outcome of this
  phase.
- **All frozen constraints are preserved.** Seeds, scenarios, assignments, the
  312-run plan, gate thresholds, C1/C2/AB2 checksums, simulator/ruleset
  constants `0.2.0 / 0.2.0`, catalogue `1`, legacy match/series, both canaries
  and the frozen seed/scenario registry checksums are unchanged. No benchmark
  partition ran, no seed bank was opened, held-out/all remain sealed, no
  provider call occurred, no tuning occurred and no activation occurred.

**Official v2 development-only run (2026-08-02):** exactly one official run of
`npm run readiness:grid` executed (`evaluationId
d788284d-a795-4125-984c-9146261e271a`), publishing the immutable nine-file v2
bundle under `data/readiness/grid/d788284d-a795-4125-984c-9146261e271a/`
(suite checksum `df9444101ca68f7b7ca9fef24adfe8575363ef744e9f37b4449b111e0bb29fd9`).
Determinism passed; all ten hard correctness gates (H01–H10), all three
slot-order gates (S01–S03), both progress gates (P01–P02) and coverage gates
C01, C02, C03, C05 and C06 passed (C02 movement coverage now passes because
selected actions come from `policy_triggered`). Coverage gate **C04**
(reposition feature coverage — no grapple reposition was observed) was
**inconclusive**. Per the frozen decision derivation, the final readiness
classification is **`inconclusive`**. No code, scenario, policy, seed,
threshold or gate was altered after seeing the result; no tuning occurred; no
supplemental grapple scenario was added; no opt-in activation decision and no
default activation was performed.

### 9.22 Phase 3E1.2 — grid readiness provenance finalisation and canonical suite binding (2026-08-02)

Phase 3E1.2 finalises the readiness provenance chain and binds the suite to
the exact canonical registries. It changes no seeds, scenarios, assignments,
312-run tuples, gate thresholds or simulator semantics. The historical v1
(`864991f7-d060-4669-beec-11e0d42b7e68`, suite checksum `dd38ac8a...`) and v2
(`d788284d-a795-4125-984c-9146261e271a`, suite checksum `df944410...`) bundles
are preserved as historical evidence; their parsers remain available but they
are never accepted as the current evidence contract.

- **Current v3 suite identity.** The current suite is
  `grid-activation-readiness-v3` with the action-evidence model
  `policy-triggered-round-actions-v1` and the provenance model
  `canonical-registry-record-derived-decision-v1`. The v3 suite checksum
  includes the suite ID, action-evidence model, provenance model, exact
  canonical seed-registry and scenario-registry checksums, runtime identity
  and all ordered run tuples; it differs from v1 and v2 solely because the
  versioned evidence/provenance identity changed. Current executions emit
  run-index v3, metrics v3, decision v3 and manifest v3; the record and
  factual-report envelopes keep their schema versions because their meaning is
  unchanged.
- **Exact canonical registries are anchored.** `assertCanonicalGridReadinessSeedRegistry`
  requires the exact metadata identity, exactly 24 seeds in the exact order,
  the exact reserved domain and the exact canonical checksum
  `54acf0151360f59d429fd7b2a84f48b48f4a791e522cf58bc381b927d62b78a0`
  (single-source, no second seed list). `assertCanonicalGridReadinessScenarioRegistry`
  requires exact structural equality with a freshly created canonical registry
  (runtime identity, scenario IDs and order, family names, every fighter
  display name, every complete build proposal and armour value, every complete
  policy, every assignment ID and order, role mapping and role-swapped flags)
  and the known checksum
  `b07270171f6e38efac2d1992f051d7bd881e323c00cee92b9caa9490ddb85b67`. The
  bundle validator rejects a persisted seed or scenario registry even when all
  downstream records, reports, metrics, gates, decision, report and manifest
  values are coherently changed to match it.
- **Complete event chronology is enforced.** The record-evidence inspector
  now requires: exactly one `competition_started` first and exactly one
  `competition_ended` last (no event of any type after it); terminal winner,
  method and rounds agree with the record result and `competition_ended.round
=== record.rounds`; each completed round has exactly one `round_started`,
  exactly two `policy_triggered` (one per fighter, after `round_started` and
  before `round_ended`) and exactly one `round_ended`; round ordering is
  monotonic; no ordinary or combat event occurs after the round's
  `round_ended`; structural events carry strictly increasing unique sequence
  numbers and non-structural events carry strictly increasing unique sequence
  numbers within each round (the frozen runtime emits two sequence counters;
  cross-counter collisions are documented emission behaviour and are not
  rejected). Sequence/order within the same round is validated, not just round
  numbers.
- **Ordinary hold invariants are frozen.** Selected `hold` is derived from
  `policy_triggered`; translated `hold` is always zero; `stationaryHoldCount`
  equals the selected hold count. An emitted ordinary `movement_resolved`
  `hold` must be same-cell and same-facing; a translated hold or a hold that
  changes facing is rejected as impossible under the frozen grid runtime.
- **Execution metrics are record-derived, not copied from metrics.json.**
  `totalPlannedRuns` (312), `totalCompletedRuns`, `schemaValidRecords` and
  `schemaValidReports` come from the parsed and bound records; `replayAgreeingMatches`
  is the count of record/report pairs passing the complete report/final-state
  agreement; `invalidEventCount` is exactly zero after every record passes the
  authoritative inspector; `deterministicMatches` and `mutationFailures` follow
  the explicit operational attestations (manifest `deterministicReexecutionPassed`
  → 312 and `inputsUnmodified` → 0). The persisted metrics artifact is the
  value being verified, never the source of truth for its non-timing execution
  fields. H02 uses the manifest deterministic-reexecution attestation directly,
  H07 uses the manifest input-immutability attestation directly, H06 derives
  from record inspection and H05 derives from the complete report/final-state
  agreement count.
- **Complete report/final-state agreement.** `assertGridReadinessRecordReportFinalAgreement`
  reconstructs each fighter's complete final state from the authoritative
  event stream (including the latest `round_ended` facts) and requires exact
  agreement with the bound factual-report v2 on match ID, seed, runtime
  identity, rounds, winner, result method, integrity, energy, heat, grid zone,
  facing, conditions, component lifecycle states, the binary component
  projection and armour where represented. A report never counts as agreeing
  merely because its winner and round count match; `replayAgreeingMatches =
312` is required for a publishable bundle.
- **Timing validation is corrected.** All four timing values must be finite
  and non-negative; `meanMsPerMatch` must approximate `totalElapsedMs / 312`
  within a documented tolerance; `p95MsPerMatch >= medianMsPerMatch`. The
  invalid `median <= mean <= p95` assumption is removed because the mean is
  not mathematically guaranteed to lie between those percentiles. Because
  individual samples are not persisted, median and p95 are described as
  operational timing attestations. Timing changes alone never change a gate or
  decision.
- **Operational attestations.** The manifest v3 retains exactly
  `deterministicReexecutionPassed`, `inputsUnmodified`,
  `fullBundleReadBackPassed` and `legacyIsolationRegressionPassed` (all true)
  as the only non-reconstructable execution facts; record-derived evidence,
  registry-derived evidence and informational-only timing are documented
  separately.
- **Honest C04 result is preserved.** No Grappler, Bulwark, policy, seed,
  312-run plan or C04 threshold was altered and no supplemental grapple probe
  was added; the official v3 result may remain `C04: inconclusive /
classification: inconclusive`. Nothing is hard-coded.
- **Formatting contract.** Prettier is configured explicitly with
  `endOfLine: crlf` (`.prettierrc`); non-conforming line endings were
  normalised to CRLF without altering code content, and `npm run format:check`
  now passes repository-wide.

**Official v3 development-only run (2026-08-02):** exactly one official run of
`npm run readiness:grid` executed (`evaluationId
0d8487a8-939d-4f9a-a16a-544b71eaa869`), publishing the immutable nine-file v3
bundle under `data/readiness/grid/0d8487a8-939d-4f9a-a16a-544b71eaa869/`
(suite checksum `c3b8a16d407891d0a92966fb9d6ed20fe5e11776bf545624fb3dbcadb4e2503c`).
Determinism passed (operational attestation true); all ten hard correctness
gates (H01–H10), all three slot-order gates (S01–S03), both progress gates
(P01–P02) and coverage gates C01, C02, C03, C05 and C06 passed. Selected
`hold` = 4373, translated `hold` = 0, grapple reposition = 0 (knockback 36,
overturn 8). Coverage gate **C04** (no grapple reposition was observed) was
**inconclusive**. Per the frozen decision derivation, the final readiness
classification is **`inconclusive`**. No code, seed, scenario, policy,
threshold, evidence rule or gate was altered after seeing the result; no
tuning occurred; no supplemental grapple scenario was added; no opt-in
activation decision and no default activation was performed.

### 9.23 Phase 3E1.3 — report disagreement is fatal to current readiness evidence (2026-08-02)

Phase 3E1.3 is a verifier-only hardening pass. It changes no suite identity,
no artifact schema version, no seed, scenario, assignment, gate threshold or
simulator semantics, and it performs **no new official evaluation**. The
official v3 evaluation (`0d8487a8-939d-4f9a-a16a-544b71eaa869`, suite checksum
`c3b8a16d407891d0a92966fb9d6ed20fe5e11776bf545624fb3dbcadb4e2503c`,
classification `inconclusive`, C04 only) and its bundle remain exactly as
published and still validate under the stronger validator.

- **Report/final-state disagreement is a bundle-invalidity failure.** The
  core artifact validator runs `assertGridReadinessRecordReportFinalAgreement`
  for every bound record/report pair and treats any disagreement as a core
  artifact-validation failure (with the run number and match ID in the
  message). A current v3 bundle is valid only when all 312 pairs pass complete
  agreement; a bundle containing a final-state disagreement is rejected before
  any classification is returned and can never validate under a `not_ready`
  classification or any other.
- **The authoritative persisted-bundle path never downgrades disagreement.**
  `recomputeGridActivationReadinessMetricsFromArtifacts` throws immediately on
  the first record/report disagreement rather than silently counting a
  non-agreeing pair into `replayAgreeingMatches`. H05 (`replayAgreeingMatches
=== 312`) is retained for live in-memory evaluation; the persisted-bundle
  path relies on the one shared agreement rule (the same
  `assertGridReadinessRecordReportFinalAgreement` helper), so disagreement
  handling is never duplicated or downgraded.
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
  integer round in `1..record.rounds`; round-0 round-structure or ordinary
  events and nonterminal events beyond `record.rounds` are rejected. The
  `competition_started` seed must agree with the record seed and the terminal
  `competition_ended` loser must agree with the record result. The documented
  dual sequence-counter validation required by the frozen runtime is preserved
  unchanged.
- **No rerun and no scope expansion.** The official v3 evaluation was not
  rerun; no replacement evaluation ID was created; no supplemental grapple
  scenario or seed was added; no benchmark ran and no seed bank was opened;
  held-out/all remain sealed; C1/C2/AB2 and constants are unchanged; no
  provider call, tuning, opt-in beta decision or default activation occurred.
  Phase 3E2 has not started and Milestone 0.2C remains incomplete.

### 9.24 Phase 3E2 — isolated supplemental grapple-reposition coverage (2026-08-03)

Phase 3E2 collects only the missing grapple-reposition feature evidence
through a separate deterministic supplement. The official v3 evaluation
(`0d8487a8-939d-4f9a-a16a-544b71eaa869`, suite checksum
`c3b8a16d407891d0a92966fb9d6ed20fe5e11776bf545624fb3dbcadb4e2503c`,
classification `inconclusive`, C04 only — no grapple reposition observed, with
base reposition observations knockback 36 / overturn 8 / grapple 0) is valid,
authoritative and unchanged, and was not altered, replaced, reinterpreted or
rerun.

- **Additive evidence, not a rerun.** The official v3 suite identity, checksum,
  classification, evaluation ID and nine-artifact bundle are frozen historical
  fact. The supplement is a separate, bounded, development-only check that
  anchors the official base before executing any match and publishes a new
  immutable bundle under `data/readiness/grid-supplements/`, never touching
  `data/readiness/grid/`.
- **Fixed supplemental scenario and 48-run plan.** A new deeply frozen
  scenario registry (`grid-grapple-coverage-scenarios-v1`, checksum
  `1aba546d5e0aa3ef3c95ee5bb45b2c412480a3822543999b291227a22a8c503f`) defines
  one feature-exercising scenario — Grapple Coverage Attacker (`medium` /
  `legs` / `grappler` / `traction_boost`, armour `30/25/25/25/15`, rush policy
  with aggression 100) versus Stationary Coverage Target (`light` / `wheels` /
  `hammer` / `cooling`, armour `20/25/25/35/15`, hold policy with aggression 0)
  — and two role assignments (attacker in fighter A, then fighter B), all
  builds catalogue-valid, no shared mutable references, fresh mutable
  configurations per execution. The exact plan is `24 canonical seeds × 2
assignments = 48` runs (assignment order → seed registry order), frozen with
  unique `(assignmentId, seed)` tuples and a deterministic plan checksum
  (`e30dda08253c3cdaba771a5c4af810fcb17cd7a7669a1efcc2b86e5d9df01a26`) that
  includes the supplement suite ID, the anchored base v3 evaluation ID and
  suite checksum, both registry checksums, the runtime identity and the
  ordered runs.
- **Base-v3 anchoring before any match.** The service reads all nine official
  v3 artifacts, validates them with `validateGridActivationReadinessBundle`,
  and requires the exact evaluation ID, suite ID, suite checksum, canonical
  seed/scenario-registry checksums, `inconclusive` classification, C04 as the
  only non-pass gate and base reposition counts 36/8/0, retaining the SHA-256
  of the base manifest, decision and metrics. Absent or invalid base → the CLI
  fails without running matches or writing artifacts.
- **Authoritative grapple-event requirements.** A valid grapple-reposition
  observation comes from the frozen runtime's actual event contract: an
  authoritative successful `attack_hit` by the Grapple Coverage Attacker with
  weapon `grappler`, a corresponding `movement_resolved` event with `action:
"grapple"`, canonical fighter IDs (attacker = actor, repositioned defender =
  target), canonical `from`/`to` zones with `from !== to`, canonical facing,
  a valid in-match round, valid chronology, and a destination exactly agreeing
  with the canonical `resolveGridGrapple` resolver. Attack attempts without
  hits, same-cell hits (no reposition possible), ordinary movement, knockback,
  malformed actor/target semantics and report-only statements are never
  counted.
- **Decision and combined classification.** `GridGrappleCoverageDecisionV1`
  gives `not_ready` on any hard failure, `coverage_confirmed` only when there
  are at least 2 valid grapple-reposition events with at least 1 in each
  fighter slot and at least one distinct seed per role assignment, else
  `inconclusive`. The combined readiness addendum gives
  `ready_for_opt_in_beta_review` only when the base is valid and inconclusive
  solely on C04 with knockback and overturn both observed and the supplement
  is `coverage_confirmed`; any hard failure gives `not_ready`; otherwise
  `inconclusive`.
- **Immutable supplemental bundle and root guard.** The root guard now
  includes `grid-readiness-supplement → data/readiness/grid-supplements` and
  rejects `data/readiness/grid`, normal match/series storage, both canary
  roots, other in-repository data roots, descendants, symlink/junction
  ancestry and external symlink roots. Each official supplement writes exactly
  ten regular files (manifest last) with complete read-back, exact inventory,
  SHA-256 digests, schema round trips and complete cross-artifact validation;
  no replay text is persisted and the official base directory is read-only and
  unchanged.
- **Actual official result.** Exactly one official supplement executed
  (`supplementId 4eca43e2-cc3d-41ee-bfad-73e18238ff61`, directory
  `data/readiness/grid-supplements/4eca43e2-cc3d-41ee-bfad-73e18238ff61/`):
  48/48 deterministic matches, 480 Grappler attempts / 204 hits / 276 misses,
  8 valid grapple-reposition events (4 per slot, 4 distinct seeds each), 186
  same-cell Grappler hits without reposition, 0 wrong-fighter and 0
  malformed/resolver-disagreeing events. Supplemental decision
  **`coverage_confirmed`**; combined readiness classification
  **`ready_for_opt_in_beta_review`** (a separate opt-in beta decision may now
  be considered — it is not an activation decision).
- **Constraints preserved.** No official v3 rerun or modification; no benchmark
  ran and no seed bank was opened; held-out/all remain sealed; C1/C2/AB2,
  constants and defaults unchanged with C2 default; the 24 seeds, seven
  readiness scenarios, thirteen assignments and 312-run plan unchanged; both
  canaries and legacy match/series unchanged; no provider or external API
  call; no tuning after results; no opt-in beta decision; no default
  activation; Milestone 0.2C remains incomplete.

### 9.25 Phase 3E2.1 — supplemental grapple evidence provenance hardening (2026-08-03)

Phase 3E2.1 hardens the provenance guarantees of the Phase 3E2 supplemental
grapple-reposition bundle (verifier-only; the official v3 evaluation and the
official Phase 3E2 supplement are unchanged and were not altered, replaced,
reinterpreted or rerun).

- **Causal grapple binding.** The strengthened evidence extractor keeps a
  per-round attack ledger: every Grappler `attack_attempted` by the attacker
  slot must resolve to exactly one `attack_hit`/`attack_missed` in the same
  round with canonical actor/target/weapon before `round_ended`; a
  `movement_resolved` grapple must consume an unmatched non-same-cell hit in
  the same round. A grapple without a preceding hit, a second grapple for one
  hit, an outcome without an attempt, a duplicate outcome, noncanonical
  actor/target, a same-cell-hit grapple, a false `from`/facing, `from === to`
  or a destination disagreeing with the canonical resolver are all malformed
  and never count as reposition coverage. The 50% reposition roll is never
  inferred: a non-same-cell hit without a movement event is allowed.
- **Canonical plan/scenario binding.** Each persisted run-index entry must
  equal the canonical plan run (run number, scenario ID, assignment ID, seed,
  role swap, competitors); the attacker slot is derived from the plan, never
  trusted from the persisted entry; record/report indices must match canonical
  run order; the run-index summary must agree with the authoritative record;
  the record configuration must exactly match the canonical supplemental
  scenario (machine name, chassis, mobility, weapon, utility, armour, policy,
  ruleset, catalogue; attacker weapon `grappler`, target weapon `hammer`);
  the grid runtime identity must be exactly `0.3.0 / grid-3x3-v1 / 0.2.0 / 1`;
  and every record must use the injected supplement timestamp.
- **Decision/addendum reconstruction.** The validator rebuilds the complete
  decision from the recomputed metrics and hard checks and requires full
  equality with the persisted decision; it rebuilds the complete combined
  readiness addendum from the anchored base reference and recomputed metrics
  and requires full equality with the persisted addendum; the combined
  classification is re-derived from the rebuilt addendum; the report is
  regenerated from the recomputed metrics, rebuilt decision, re-derived
  combined classification and rebuilt addendum.
- **Pinned official base hashes.** The base identity carries frozen SHA-256
  hashes of the official v3 manifest, decision and metrics
  (`46b1b888dd66021fc811451c1db8f22f21c912621fc85a90a4cc52980ff06f85`,
  `d4bf61e1e5c74bbb9181f95d22889fdae263e1520e58e8720e2bfe8cfeb07b9a`,
  `113bfa2cc66e364eab637f3d7c00b8f05602c355133fe21eb2aae6d79467eee4`) and
  anchoring requires every identity field plus these pinned hashes computed
  over the actual bytes. The service retains the exact start-of-run base bytes
  and re-checks them (plus the pinned hashes) immediately before publication:
  any change is an operational failure that prevents publication.
- **Official supplement preserved under the stronger validator.** The frozen
  official supplement (`4eca43e2-cc3d-41ee-bfad-73e18238ff61`) passes the
  complete strengthened bundle validator and the frozen official anchor
  unchanged: 480 attempts / 204 hits / 276 misses, 8 valid repositions (4 per
  fighter slot, 4 distinct seeds each), 186 same-cell hits, 0 wrong-fighter,
  0 malformed; decision `coverage_confirmed`; combined
  `ready_for_opt_in_beta_review`; all ten artifacts byte-for-byte unchanged.
- **Fully coherent corruption tests.** Nine corruption scenarios rebuild the
  whole bundle coherently (all downstream artifacts, digests and checksums
  consistent with the tamper) and are rejected by their intended provenance
  rule, never a stale digest: alternate run plan, alternate build, fake
  resolver-valid grapple without a hit, false grapple origin, second grapple
  for one hit, decision payload corruption with the label kept, addendum
  corruption with the combined label kept, cross-envelope supplement-ID
  disagreement, and a base-mutation race (base mutated after anchoring and
  before publication → operational failure, no supplement artifact published).
- **Constraints preserved.** No official v3 or supplement rerun or
  modification; no benchmark ran and no seed bank was opened; held-out/all
  remain sealed; C1/C2/AB2, constants and defaults unchanged with C2 default;
  both canaries and legacy match/series unchanged; no provider or external API
  call; no tuning; no opt-in beta decision; no default activation; Milestone
  0.2C remains incomplete.

### 9.20 Phase 3E1 status

- Development-only seed registry (`grid-readiness-development-v1`, 24 seeds,
  reserved range, canonical checksum): complete.
- Scenario registry (`grid-readiness-scenarios-v1`, 7 families, 13
  assignments, catalogue-valid builds, fresh clones, canonical checksum):
  complete.
- Exact 312-run plan with frozen ordering, uniqueness and suite checksum:
  complete.
- Pure execution core (direct `runGridMatch`, records v3 / reports v2, replay
  agreement, event validity, immutability, canonical per-run evidence):
  complete.
- Deterministic re-execution under fixed identities: complete.
- Envelope schemas (run index / match records / factual reports, exactly 312
  ordered items): complete.
- Metrics reducer (execution, movement, combat, results, slot-order, timing):
  complete.
- Frozen gates (H01–H10, C01–C06, S01–S03, P01–P02) and decision derivation:
  complete.
- Decision v1 and human-readable report: complete.
- Kind-aware root guard extended with `grid-readiness → data/readiness/grid`
  and readiness storage rejection: complete.
- Immutable nine-file evaluation bundle with manifest v1, digests and
  cross-agreement validation: complete.
- `runGridActivationReadiness` service and `readiness:grid` CLI (no
  arguments): complete.
- Full suite, typecheck, lint and CRLF formatting pass; no benchmark partition
  ran; no existing benchmark seed file opened; held-out and `all` remain
  sealed; seeds and fixtures unchanged; C1/C2/AB2 and qualification checksums
  unchanged with C2 default; simulator/ruleset constants `0.2.0 / 0.2.0`;
  catalogue `1`; normal match and series commands remain legacy; both canaries
  remain unchanged; no provider or external API call; no normal or canary
  storage modified; no tuning after results; no opt-in activation decision; no
  default activation: confirmed.

Status: Phase 1 geometry complete; Phase 2 persistence/replay complete; Phase
3A grid runtime core complete; Phase 3B activation hardening complete; Phase
3B.1 momentum correction complete; Phase 3C lateral/flank integration complete;
Phase 3D1 reporting/series compatibility foundation complete; Phase 3D1.1
reporting hardening complete; Phase 3D2A isolated grid match canary
**implemented**; Phase 3D2A.1 evidence and artifact verification **complete**;
Phase 3D2A.2 immutable publication hardening **complete**; Phase 3D2B isolated
grid adaptive-series canary **implemented**; Phase 3D2B.1 provenance and
immutability hardening **complete**; Phase 3E1 v1 evaluation **historical**
(`864991f7-d060-4669-beec-11e0d42b7e68`, `inconclusive`, C02 + C04); Phase 3E1.1
v2 evaluation **historical** (`d788284d-a795-4125-984c-9146261e271a`,
`inconclusive`, C04); Phase 3E1.2 v3 provenance finalisation **complete**;
Phase 3E1.2 v3 official evaluation **complete** (`0d8487a8-939d-4f9a-a16a-544b71eaa869`,
suite checksum `c3b8a16d407891d0a92966fb9d6ed20fe5e11776bf545624fb3dbcadb4e2503c`);
Phase 3E1.3 fatal-agreement hardening **complete** (verifier-only, no new
official run; report/final-state disagreement now invalidates current
evidence; round 0 permits only `competition_started`; official v3
evaluation+checksum unchanged); current readiness classification
**`inconclusive`** (coverage gate C04 inconclusive — no grapple reposition
observed; all hard, slot-order, progress and remaining coverage gates passed);
Phase 3E2 supplemental grapple tooling **complete**; Phase 3E2 official
supplement **complete** (`4eca43e2-cc3d-41ee-bfad-73e18238ff61`,
`coverage_confirmed`, 8 valid grapple-reposition events with both fighter
slots and distinct seeds observed); Phase 3E2.1 provenance hardening
**complete** (causal grapple binding, canonical plan/scenario binding,
decision/addendum reconstruction, pinned official base hashes, official
supplement passes the stronger validator unchanged); supplemental coverage
decision **`coverage_confirmed`**; combined readiness classification
**`ready_for_opt_in_beta_review`**; opt-in beta decision **not performed**;
default grid activation **not performed**; Milestone 0.2C **not complete**
pending a separately authorised activation-readiness decision.

## 10. Still out of scope

- **Authoritative migration**: the live simulator remains `0.2.0` legacy;
  `SIMULATOR_VERSION` / `RULESET_VERSION` remain `0.2.0`, catalogue `1`;
  normal persistence remains schema v2.
- **Translated lateral movement is grid-opt-in only**: translated
  `circle_left`/`circle_right` exist only in `runGridMatch`; the legacy runtime
  keeps turn-in-place circling. No new movement-action values or policy fields
  were added.
- **Grid reporting/series are grid-opt-in only**: factual-report v2 and series
  v2 are never produced by `runMatch`, `runSeries` or any normal application
  command; `runSeries` remains v1-only.
- **Grid canary is a single-match local check only**: `match:grid:canary`
  consumes only a direct `runGridMatch` result, requires an explicit seed,
  never accepts imported records or user-supplied event streams, and is not a
  benchmark; it produces no win rates, comparative performance or balance
  conclusions. Phase 3D2A.1 hardened its evidence and verification: manifest
  v2 is the only current passing manifest, exposure is reported through
  canonical flank bearings, every artifact carries a SHA-256 digest and is
  reread and cross-validated, protected normal storage roots are rejected, and
  pre-hardening manifest-v1 artifacts are superseded. Phase 3D2A.2 hardened
  publication immutability: the service root inside repository data must equal
  the canonical root exactly, final and temporary collisions are detected via
  `lstat`, temporary directories are created exclusively, cleanup applies only
  to invocation-owned paths, and both temporary and final directories must
  contain exactly seven regular files. A grid adaptive-series
  runner is still not implemented and produces no series-v2 record from any
  application path.
- **Live activation** of grid match production in the application/CLI/series.
- **Balance conclusions**: no grid-vs-legacy balance claims are made from
  Phase 3A through Phase 3D2A.2.
- **Grid activation-readiness is a development-only evaluation, not a
  decision**: the Phase 3E1 evaluation classifies the implementation as
  `ready_for_opt_in_beta_review`, `inconclusive` or `not_ready`; it does not
  activate grid, does not change defaults, does not qualify combat balance,
  does not authorise default migration and does not tune combat, builds,
  policies, seeds, thresholds or gates in response to its result. An opt-in
  beta decision and any default activation remain later, separately authorised
  decisions.
- Opponent suite and adaptation evaluation (0.2D/0.2E).

### 6.5 State reconstruction

`state-reconstructor.ts` accepts an explicit positioning model (defaulting to
legacy, preserving existing callers). In grid mode it reconstructs all nine
grid zones from initial state and `movement_resolved` events (including
knockback via `targetId`) and rejects legacy edge values; legacy mode is
unchanged. Human-readable zone formatting (`src/replay/zone-format.ts`)
handles both "North West" grid names and "North Edge" legacy names.

### 6.6 Record production

Current `0.2.0` matches still produce schema v2 records with legacy zones via
`matchResultToRecord`. No normal application path produces schema v3, and
`mapLegacyZoneToGridZone` is never used for automatic conversion.

## 7. Additional persistence/replay dependencies (Phase 1.5 inventory)

Beyond the Phase 1 inventory, Phase 2 inspection recorded:

| Module                                                                          | Role                                                                                                                   |
| ------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `src/persistence/match-converter.ts`                                            | `matchResultToRecord` chooses v2 when `SIMULATOR_VERSION` is `0.2.x`; the future v3 producer will be gated on `0.3.0`. |
| `src/persistence/json-match-repository.ts`                                      | `saveMatch`/`getMatch` dispatch through `validateMatchRecord`; supports all versions automatically.                    |
| `src/app/replay-match.ts`                                                       | Reconstructs a `MatchResult`-shaped object from a persisted record for text/ASCII replay.                              |
| `src/app/run-series.ts`                                                         | Persists matches via `matchResultToRecord` + `saveMatch`.                                                              |
| `src/replay/ascii/ascii-replay-renderer.ts`                                     | Adapts `MatchResult` to `AsciiReplayInput`; `adaptFighterVisual` reads v2 `comps`.                                     |
| `src/replay/ascii/ascii.types.ts`                                               | `FighterVisualState.zone: string` (legacy view; grid view is typed `GridZone`).                                        |
| `src/replay/ascii/moment-renderer.ts`                                           | Renders arena snapshots per positioning model (legacy default).                                                        |
| `src/replay/text-replay-renderer.ts`, `src/replay/ascii/state-reconstructor.ts` | Zone formatting and reconstruction (see 6.5).                                                                          |
| `tests/fixtures/v3-match-record.ts`                                             | Synthetic v3 record builder used only by tests.                                                                        |
