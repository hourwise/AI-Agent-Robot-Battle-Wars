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

## 8. Still out of scope

- **Authoritative migration**: the live simulator remains `0.2.0` legacy;
  `SIMULATOR_VERSION` / `RULESET_VERSION` remain `0.2.0`, catalogue `1`;
  normal persistence remains schema v2.
- **Policy-driven lateral movement**: `circle_left`/`circle_right` remain
  in-place turns; no new lateral movement actions or policy fields exist.
- **Live activation** of grid match production in the application/CLI/series.
- **Balance conclusions**: no grid-vs-legacy balance claims are made from
  Phase 3A.
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
