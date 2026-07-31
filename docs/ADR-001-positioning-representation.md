# ADR-001: Positioning Representation — 3×3 Arena Grid

**Status:** Accepted for phased implementation
**Date:** 2026-07-31
**Scope:** Phase 1 freezes the 3×3 arena representation and provides a pure,
deterministically tested geometry module. No authoritative combat is switched
to the new arena in this phase.

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
- The new module `src/simulator/arena-grid.ts` is imported only by tests (and
  non-runtime documentation tooling), never by the authoritative simulator in
  this phase.
- The five-zone live simulator, event schema, match-record schemas, replay and
  ASCII rendering remain byte-for-byte unchanged.
- Simulator/ruleset/catalogue versions remain `0.2.0 / 0.2.0 / 1`.
- Component qualification (C1, C2, AB2) remains frozen and unchanged; C2
  remains the experimental runtime default.

## 5. Out of scope (later 0.2C phases)

- Authoritative simulator migration to the 3×3 arena (version `0.3.0`).
- Match-record schema v3.
- Replay migration and versioned replay dispatch.
- ASCII 3×3 rendering.
- Policy-driven lateral movement.
- Opponent suite and adaptation evaluation (0.2D/0.2E).
