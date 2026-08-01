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
  pre-hardening manifest-v1 artifacts are superseded. A grid adaptive-series
  runner is still not implemented and produces no series-v2 record from any
  application path.
- **Live activation** of grid match production in the application/CLI/series.
- **Balance conclusions**: no grid-vs-legacy balance claims are made from
  Phase 3A through Phase 3D2A.1.
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
