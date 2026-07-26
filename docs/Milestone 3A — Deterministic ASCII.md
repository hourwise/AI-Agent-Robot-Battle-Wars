# Milestone 3A — Deterministic ASCII Battle Replay

## Purpose

Add a lightweight visual presentation layer to Forge Arena before any browser, 2D or 3D implementation.

The ASCII replay should make robot builds, positioning, damage and important match moments understandable and shareable while preserving the deterministic simulator and replay architecture.

The feature is a renderer of authoritative match records. It is not part of combat resolution.

---

## Product goal

A completed text match should feel like an illustrated battle report rather than a raw event log.

The replay should include:

- a visual fighter card for each machine;
- a top-down arena representation;
- a small number of static battle snapshots;
- a clear final result image;
- enough factual detail to understand why the match was won.

A saved match must be renderable later without:

- calling an LLM;
- contacting DeepSeek;
- rerunning the simulator;
- recalculating combat;
- changing the result.

---

## Architectural boundary

The dependency flow is:

```text
Validated machine builds
Authoritative fighter states
Authoritative simulation events
Completed MatchRecord
              ↓
      ASCII replay renderer
              ↓
       Terminal presentation
```

The ASCII layer must never influence:

- policies;
- legal actions;
- damage;
- movement;
- facing;
- random rolls;
- component failures;
- victory conditions;
- judges’ scores.

Simulator packages must not import replay presentation modules.

---

## Required modules

Suggested modules:

```text
src/replay/ascii/
├─ ascii-replay-renderer.ts
├─ robot-portrait-renderer.ts
├─ arena-snapshot-renderer.ts
├─ highlight-selector.ts
├─ moment-renderer.ts
├─ result-card-renderer.ts
├─ ascii-layout.ts
└─ ascii.types.ts
```

The final structure may be adapted to the repository, but responsibilities should remain separated.

### `RobotPortraitRenderer`

Produces a visual representation from a validated machine build and optional current damage state.

### `ArenaSnapshotRenderer`

Produces a top-down arena view from authoritative zones, facing and conditions.

### `HighlightSelector`

Groups related events and selects a bounded set of important moments.

### `MomentRenderer`

Combines a title, arena state and factual event description.

### `ResultCardRenderer`

Displays the final result and decisive event or judges’ score.

### `AsciiReplayRenderer`

Coordinates the complete ASCII replay without altering the match record.

---

## Robot portrait requirements

Each machine receives a deterministic compact portrait.

The portrait should visibly distinguish:

### Chassis

- light;
- medium;
- heavy.

### Mobility

- wheels;
- tracks;
- legs.

### Weapons

- ram;
- hammer;
- horizontal spinner;
- grappler;
- flipper.

### Damage states

Where available, the portrait may indicate:

- disabled mobility;
- disabled weapon;
- overturned condition;
- immobilisation;
- overheating.

The portrait must be generated from fixed templates or deterministic composable parts.

The language model must not generate artwork.

### Example fighter card

```text
IRON CICADA
Light chassis | Wheels | Horizontal spinner

        \===/
    ____|___|____
 __/             \__
O                   O

Utility: Traction boost
Cost: 98 / 100
Armour: F20 L15 R15 B10 T10
```

The precise artwork may differ, but it must remain portable and readable in a standard Windows terminal.

---

## Arena snapshot requirements

The first arena uses five zones:

- `north_edge`;
- `south_edge`;
- `east_edge`;
- `west_edge`;
- `center`.

The snapshot must show:

- each fighter’s current zone;
- facing;
- overturned or immobilised status;
- both fighters if they share a zone.

Suggested marker format:

```text
A^
Bv
Ax
B!
```

Where:

- `A` or `B` identifies the fighter;
- arrows show facing;
- `x` indicates immobilised or disabled;
- another documented marker may indicate overturned.

Example:

```text
                  NORTH
                    Bv

WEST               [C]               EAST

                    A^
                  SOUTH
```

Distance should be derived from zone state according to the ruleset. The ASCII renderer must not maintain or invent an independent position model.

---

## Highlight selection

The replay should show only meaningful moments.

Candidate highlights:

- opening positions;
- first successful damaging hit;
- first rear or side attack;
- first critical hit;
- first component damaged;
- first component disabled;
- first knockback;
- first overturn;
- first overheat;
- major recovery;
- final blow;
- immobilisation;
- double knockout;
- judges’ decision.

Related events from the same resolved action should be grouped.

Example group:

```text
attack_attempted
attack_hit
armour_damaged
component_damaged
component_disabled
```

This should normally become one illustrated moment.

### Limits

- always include an opening frame;
- always include a result frame;
- target four to seven frames per match;
- maximum eight frames by default;
- avoid near-duplicate frames.

Highlight selection must be deterministic.

---

## Battle moment format

A battle moment should contain:

1. round number;
2. factual heading;
3. arena map;
4. optional compact machine image;
5. factual event summary;
6. relevant state change.

Example:

```text
==================================================
ROUND 8 — FLANKING STRIKE
==================================================

                  NORTH
                    .

WEST            A> Bx               EAST

                    .
                  SOUTH

Iron Cicada attacks The Bulwark's rear armour.
The Bulwark's right drive is disabled.
The Bulwark can no longer turn effectively.
```

The renderer may make factual prose more dramatic, but it must not invent actions, effects or reactions.

---

## Final result card

Every completed replay ends with a result card.

Support:

- integrity defeat;
- immobilisation;
- unrecoverable overturn;
- double knockout;
- judges’ decision;
- failed or incomplete match.

Example:

```text
##################################################
                  MATCH RESULT
##################################################

WINNER: IRON CICADA

Defeated: THE BULWARK
Method: Immobilisation
Round: 11
Decisive event: Right drive disabled
Seed: 739104
```

For judges’ decisions, include normalised category scores and weighted totals.

---

## Replay modes

Add presentation modes behind the existing replay command.

Recommended modes:

```text
text
ascii
full
```

### `text`

Existing prose replay only.

### `ascii`

Fighter cards, selected snapshots and concise factual captions.

### `full`

Existing detailed prose plus selected ASCII visuals.

Suggested CLI:

```bash
npm run replay -- --match <match-id> --format text
npm run replay -- --match <match-id> --format ascii
npm run replay -- --match <match-id> --format full
```

The current replay behaviour should remain the default unless explicitly changed and documented.

---

## Determinism

The same `MatchRecord` and replay options must produce byte-identical output.

The renderer must not depend on:

- current time;
- random word selection;
- network requests;
- model responses;
- mutable global state;
- `Math.random()`.

Where several visual templates could be used, select one using stable build attributes or the saved match seed.

---

## Terminal compatibility

Version 0.1 ASCII output should:

- remain readable at roughly 80 columns;
- use portable plain-text characters;
- avoid required colour support;
- avoid terminal escape sequences;
- safely handle Windows terminals;
- sanitise machine names;
- remove embedded control characters;
- prevent multiline names from breaking layouts;
- truncate excessively long display names predictably.

Unicode enhancements may be considered later behind a compatible rendering option.

---

## Data requirements

The renderer should consume existing saved fields wherever possible:

- validated builds;
- competitor IDs and names;
- round;
- zones;
- facing;
- conditions;
- component state;
- events;
- result;
- seed.

Do not add simulation events solely to make the artwork more dramatic.

Where a historical record lacks sufficient state for a detailed image, render a simpler truthful representation.

---

## Error handling

ASCII rendering failure must not invalidate or alter a completed match.

Possible outcomes:

- complete ASCII replay;
- partial replay with a factual fallback;
- text-only fallback;
- clear rendering error.

Do not suppress corrupt authoritative match data. Match-schema errors remain separate from presentation limitations.

---

## Testing requirements

### Portrait tests

Test:

- light chassis;
- medium chassis;
- heavy chassis;
- wheels;
- tracks;
- legs;
- all five weapons;
- disabled weapon;
- disabled mobility;
- overturned machine;
- immobilised machine.

### Arena tests

Test:

- every zone;
- every facing;
- both competitors in one zone;
- opposite edges;
- adjacent edges;
- centre versus edge;
- overturned and immobilised markers.

### Highlight tests

Test:

- event grouping;
- duplicate suppression;
- opening-frame inclusion;
- result-frame inclusion;
- maximum frame count;
- final blow selection;
- judges’ decision;
- double knockout.

### Safety and determinism tests

Test:

- long names;
- newlines in names;
- terminal control characters;
- identical input produces identical output;
- rendering does not mutate the match record;
- replay makes no provider call;
- replay does not rerun the simulator.

### Regression tests

Existing:

- simulator tests;
- event fixtures;
- persistence tests;
- text replay tests;

must continue to pass unchanged unless a deliberate presentation-interface update is documented.

---

## Documentation

Update:

### `README.md`

Add:

- ASCII replay overview;
- CLI usage;
- example output;
- limitations.

### `docs/ARCHITECTURE.md`

Document the one-way presentation dependency.

### `docs/EVENT_FORMAT.md`

Document highlight grouping only where necessary. Do not redefine event authority.

### `docs/DECISIONS.md`

Record:

> ASCII visuals are produced from deterministic templates and authoritative match records. LLM-generated ASCII is excluded because it would be inconsistent, non-replayable and capable of depicting events that did not occur.

---

## Excluded from this milestone

Do not add:

- animated ASCII playback;
- terminal colour;
- sound;
- voice;
- browser rendering;
- image files;
- generative images;
- generative video;
- Godot;
- 2D physics;
- 3D models;
- new combat mechanics;
- arena hazards;
- crowds;
- model-generated battle narration;
- user-supplied artwork.

---

## Exit criteria

Milestone 3A is complete when:

- every machine receives a recognisable deterministic fighter card;
- a saved match can be replayed with arena snapshots;
- four to seven significant moments are normally selected;
- a final result card is always shown for completed matches;
- output can be regenerated without DeepSeek;
- output is deterministic;
- no simulator event or result changes;
- malformed display names cannot break the terminal;
- all existing and new tests pass;
- documentation matches the implementation.
