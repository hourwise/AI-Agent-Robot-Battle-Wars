# ADR-002: Component Damage and Disable Lifecycle

**Status:** Accepted — benchmark-tuned constants  
**Date:** 2026-07-28  
**Prototype:** 0.2B (decision prerequisite, ready for implementation)

## 1. Context

Prototype 0.1 represents each component as a terminal boolean and allows one critical hit to set that boolean immediately. A mobility disable also sets `immobilised`, which resolves the match after the round. The result is a component-failure system that is dramatic but too often decides a match before structural damage, build quality, or policy can be observed.

This ADR chooses the Prototype 0.2 component lifecycle only. It does not change arena positioning, add components, rebalance all weapons, add opponents, change AI prompts except for fields required to report component state, or implement voxel replay.

## 2. Current Implementation Evidence

The following source inventory is the factual baseline for this decision. Where rules documentation differs from source, the running source is authoritative for Prototype 0.1 records.

| Concern                             | Current behaviour and source                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Critical-hit probability            | `CRITICAL_HIT_THRESHOLD` is `0.7` in `src/simulator/constants.ts`; `calculateAttack()` calls `rng.chance(CRITICAL_HIT_THRESHOLD)` in `src/simulator/damage.ts`. `SeededRandom.chance()` is `next() < probability` in `src/simulator/seeded-random.ts`, so every successful hit makes a flat 70% critical roll, independent of damage.                                                                                                                                                                                                    |
| Damage, armour, and hit zones       | `calculateAttack()` in `src/simulator/damage.ts` derives raw damage, then `effectiveDamage = max(1, round(rawDamage - armour[hitZone] * 0.5))`. `determineHitZone()` and `getExposedZones()` use weapon, facing, arena zone, and policy target. Armour affects integrity damage only; effective damage does not currently affect disablement.                                                                                                                                                                                            |
| Component selection                 | `selectDamagedComponent(hitZone, components, rng)` in `src/simulator/damage.ts` selects a non-disabled component with zone weights: front 50/50/0 mobility/weapon/utility, rear 70/0/30, side 40/20/40, and top 30/30/40. It does not distinguish a missing utility (`utilityId: "none"`).                                                                                                                                                                                                                                               |
| Disable emission                    | The two critical-hit branches of `applyRound()` in `src/simulator/reducer.ts` call `selectDamagedComponent()`, `applyComponentDamage()`, and emit `component_disabled` immediately. The event payload is only `{ component }` (`src/events/battle-event.ts`).                                                                                                                                                                                                                                                                            |
| Component state and effects         | `ComponentState` in `src/simulator/types.ts` is three booleans. `applyComponentDamage()` in `src/simulator/reducer.ts` makes them terminal; weapon disable prevents attacking, utility disable prevents cooling, and mobility disable adds `immobilised`. Mobility-disabled action handling is in `src/simulator/actions.ts`.                                                                                                                                                                                                            |
| Immobilisation and judging          | `checkVictory()` in `src/simulator/victory.ts` checks destruction first, then immediate mobility disable; mutual mobility disable goes to judges. The judge score also treats disabled mobility and weapon as zero.                                                                                                                                                                                                                                                                                                                      |
| Reinforced drive                    | The catalogue describes `reinforced_drive` as reduced mobility-component damage (`src/catalogue/catalogue.v1.ts`), but there is no runtime branch for it. The only utility-specific runtime effect is cooling in `applyHeatAndEnergy()` in `src/simulator/reducer.ts`. It currently changes no disable probability or state transition.                                                                                                                                                                                                  |
| Event, record, and version baseline | Events are schema version `"1"` in `src/events/event-factory.ts` and the simulator emitter. `SIMULATOR_VERSION` is `0.1.2` and `RULESET_VERSION` is `0.1.0` in `src/simulator/constants.ts`; `competition_started` records them in `src/simulator/simulator.ts`. `MatchRecordSchema` is literal schema `"1"` and persists the three booleans in `src/schemas/match-record.schema.ts`.                                                                                                                                                    |
| Consumers                           | Text replay (`src/replay/text-replay-renderer.ts`), ASCII reconstruction/rendering (`src/replay/ascii/state-reconstructor.ts`, `ascii.types.ts`, `arena-snapshot-renderer.ts`, `highlight-selector.ts`, and `result-card-renderer.ts`), factual reporting (`src/reports/factual-match-report.ts`, `review-formatter.ts`), statistics (`src/replay/statistics.ts`), benchmark reconstruction and metrics (`src/bench/run-benchmark.ts`, `metrics.ts`, `benchmark.types.ts`), and factual-report schemas all assume binary disabled state. |

`COMPONENT_DAMAGE_CHANCE` and `isComponentDamageTriggered()` exist in `src/simulator/constants.ts` and `src/simulator/damage.ts`, but no reducer path calls them. The existing rules prose also describes a different critical/extra-roll model. Milestone 0.2B must update rules documentation and catalogue wording to match the implemented 0.2 rule; it must not preserve this discrepancy.

## 3. Benchmark Evidence

The frozen comparison baseline is the deterministic Bulwark mirror benchmark over the 80 development seeds in `data/seeds/benchmark-100-v1.json` (`bankId: prototype-0.2-baseline-v1`). It uses simulator `0.1.2`, ruleset `0.1.0`, and catalogue `1`.

| Measure                                | Prototype 0.1 result |
| -------------------------------------- | -------------------: |
| Fighter A wins                         |                   39 |
| Fighter B wins                         |                   37 |
| Draws                                  |                    4 |
| Matches containing a component disable |               100.0% |
| Immobilisation finishes                |                92.5% |
| First-round immobilisation finishes    |                26.3% |
| Mobility disables                      |                   78 |
| Critical hits                          |                  127 |

The observed 2.5 percentage-point difference between fighter A and fighter B is small relative to the uncertainty at this sample size and does not currently justify changing turn order. Wilson intervals are reported for slot win rate. No formal paired significance test for slot advantage has yet been adopted. This ADR therefore leaves turn order unchanged because the measured component volatility is far more material.

The disable results are undesirable because one critical roll can overwhelm build quality, a full-integrity robot can lose immediately, and favourable seeds can dominate adaptation results. Structural integrity becomes secondary, mobility disablement is disproportionately decisive, and the simulator cannot reliably distinguish design quality from component luck.

## 4. Decision Drivers

- Reduce first-round immobilisation and the dominance of terminal disables.
- Preserve deterministic resolution, explicit causal events, and replay reconstruction.
- Keep component targeting, armour investment, and `reinforced_drive` tactically meaningful.
- Preserve dramatic failures without a common healthy-to-disabled shortcut.
- Keep the state model understandable in text, ASCII, and a future voxel renderer.
- Replay every Prototype 0.1 record with its original terminal-event semantics.
- Avoid hidden durability pools, random impairment rolls, and a broad weapon rebalance in 0.2B.

## 5. Options Considered

| Option                                           | Summary                                                                               | Strengths                                                                                                    | Material weaknesses                                                                                                        |
| ------------------------------------------------ | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| A. Healthy -> damaged -> disabled                | A qualifying hit creates a persistent damaged state; a later qualifying hit disables. | Directly removes the normal first-hit disable path, retains targeting, and has a readable three-state story. | Requires state, penalties, events, and compatibility work.                                                                 |
| B. Component durability points                   | Components receive individual health pools.                                           | Fine-grained tuning and weapon/component differentiation.                                                    | Adds hidden counters, component-specific balance work, schema weight, and less readable replay for the present simulator.  |
| C. Damage-scaled binary probability              | Components remain binary; effective damage changes disable probability.               | Smallest data-model change and tunable frequency.                                                            | Keeps first-hit knockout risk and makes the outcome depend on another opaque roll.                                         |
| D. Temporary impairment before disable           | An impairment precedes a disable, potentially with recovery.                          | Rich tactical recovery decisions.                                                                            | It is Option A plus recovery timers and more policy/replay complexity; recovery is not needed to solve the measured fault. |
| E. Critical hit marks damage, later hit disables | Criticals create a marker instead of a terminal disable.                              | Simple transition from the current model.                                                                    | It is a restricted form of Option A and does not define a meaningful damaged-state effect or high-damage normal-hit path.  |

## 6. Option Comparison

Scores are 1 (poor) through 5 (strong) against the stated objective. Schema/migration score means lower disruption; structural-balance score means lower risk of making destruction the only common finish.

| Criterion                          |   A |   B |   C |   D |   E |
| ---------------------------------- | --: | --: | --: | --: | --: |
| Reduces first-round immobilisation |   5 |   5 |   2 |   5 |   5 |
| Reduces disable dominance          |   4 |   5 |   2 |   4 |   3 |
| Preserves dramatic failures        |   4 |   4 |   4 |   4 |   3 |
| Determinism and testability        |   5 |   5 |   5 |   4 |   5 |
| Balancing control                  |   4 |   5 |   3 |   3 |   3 |
| Targeting and tactical value       |   5 |   5 |   3 |   5 |   4 |
| Replay/readability                 |   5 |   3 |   3 |   4 |   4 |
| Schema/migration impact            |   3 |   2 |   5 |   2 |   4 |
| Performance cost                   |   5 |   4 |   5 |   4 |   5 |
| Structural-balance risk            |   4 |   3 |   2 |   3 |   3 |

Option A has the best overall fit. Option D is adopted only as Option A's deterministic damaged-state penalties, with no repair or timer. Option E is subsumed by the selected qualifying-hit rule. Option B is deferred until the simulator needs component-specific durability beyond a three-state lifecycle. Option C is rejected because it leaves the benchmark's one-roll failure mechanism intact.

## 7. Decision

Adopt **Option A: healthy -> damaged -> disabled**, with deterministic state penalties and no direct healthy-to-disabled path in Prototype 0.2B.

Critical hits remain important: a critical hit with meaningful post-armour damage qualifies for a state transition. A sufficiently high-damage normal hit also qualifies. The transition itself adds no new random roll. This makes armour and damage matter, keeps criticals dramatic, and guarantees that a healthy component normally survives its first qualifying hit.

No repair, timed recovery, component health points, redundant drive systems, or weapon-specific component-damage traits are introduced in 0.2B.

## 8. Detailed Rules

### 8.1 Authoritative lifecycle

Every installed component uses the same terminal lifecycle for the match:

```text
healthy -> damaged -> disabled
```

- States are persistent; `disabled` is terminal and no repair occurs in 0.2B.
- A component with `utilityId: "none"` is absent and cannot be selected or transitioned.
- A damaged component remains eligible for component selection, so sustained pressure on the same exposed system can disable it.
- `overturned` remains a separate condition. It neither causes nor clears a component state transition.

### 8.2 Qualifying component damage

For a successful attack, calculate hit zone, raw damage, and post-armour `effectiveDamage` exactly once using the normal deterministic attack pipeline. The hit qualifies for component progression when either condition is true:

```text
(isCritical && effectiveDamage >= CRITICAL_COMPONENT_DAMAGE_THRESHOLD)
|| effectiveDamage >= HIGH_DAMAGE_COMPONENT_THRESHOLD
```

**0.2B qualification candidate set A:**

```
CRITICAL_COMPONENT_DAMAGE_THRESHOLD = 10
HIGH_DAMAGE_COMPONENT_THRESHOLD = 35
```

There is no subsequent probability roll. A qualifying hit selects one installed, non-disabled component using the existing zone-weighted selection model; 0.2B must make the candidate list exclude absent utilities. The qualification reason is `critical_effective_damage` for the first clause and `high_effective_damage` for the second.

The lifecycle and deterministic qualification model are accepted. The values `10` and `35` are the initial implementation values for candidate set A. They must be evaluated against the fixed development seed bank. They are not permanent balance constants until the acceptance benchmark passes. Tuning these constants after the first implementation run requires an ADR amendment or documented tuning record. The seed bank must not be changed to make the thresholds pass. Held-out seeds are used only after development tuning is complete.

### 8.3 State transitions and direct disablement

```text
healthy + qualifying hit  -> damaged
damaged + qualifying hit  -> disabled
disabled + qualifying hit -> no transition and no component event
```

Prototype 0.2B permits **no** healthy-to-disabled transition, including on a critical hit, spinner hit, zero-armour hit, or overturned target. This is stricter than a rare catastrophic exception because the current catalogue has no validated catastrophic-damage distribution. A future ruleset may introduce a direct path only through a new ADR with an explicit post-armour threshold, weapon trait, and benchmark cap; it must never be an unlogged automatic critical effect.

### 8.4 Damaged-state penalties

All penalties are deterministic and take effect from the state transition onward; they add no failure rolls.

| Component | `damaged` effect                                                                                                                                                                                           | `disabled` effect                                  |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| Mobility  | Effective speed is `max(1, baseSpeed - 2)` for initiative and movement calculations.                                                                                                                       | Existing immobilisation behaviour.                 |
| Weapon    | Multiply raw weapon damage by `0.75` before armour absorption, rounding by the normal attack calculation. Cooldown is unchanged.                                                                           | Cannot attack.                                     |
| Utility   | Cooling bonus becomes `2` rather than `5`; `reinforced_drive` loses an unused protection token; `traction_boost` has no additional 0.2B effect because its baseline runtime effect is not yet implemented. | Existing utility-off behaviour; no utility effect. |

The damaged mobility penalty is sufficient to influence movement without introducing redundant motors or a separate failed-movement roll. A damaged, overturned fighter uses the existing overturned rules plus the speed penalty; it is not immobilised until mobility becomes disabled.

### 8.4.1 Central effective-stat helpers

Damaged-state penalties must be implemented through shared pure functions rather than duplicated conditionals across modules:

```
getEffectiveSpeed(fighter)     → baseSpeed − 2 if mobility damaged, min 1
getEffectiveWeaponDamage(fighter, baseDamage) → baseDamage × 0.75 if weapon damaged
getEffectiveCoolingBonus(fighter) → 2 if cooling damaged, else 5 (if installed)
```

These are the single authoritative calculation for each effective stat. Movement, initiative, attack resolution, reports, and tests must use the same helpers. Consumers must not independently reproduce the penalty formula. Replay reconstruction records state transitions but does not rerun combat calculations. Presentation code may display derived values but must use shared helpers or persisted facts where appropriate.

This is an implementation boundary, not a request to create the helpers in this task.

### 8.5 Mobility and immobilisation

There is one mobility component per fighter. A disabled mobility state still means immobilisation. Resolution remains after the full round: both already-eligible simultaneous attacks resolve, then normal victory evaluation detects the disabled mobility component. No extra confirmation round is added.

This retains immobilisation as a meaningful victory condition while requiring sustained qualifying pressure in the normal case.

### 8.6 Reinforced drive

`reinforced_drive` is redefined as one deterministic, once-per-match mobility-transition guard:

```text
first qualifying healthy -> damaged mobility transition
while reinforced_drive is healthy and unspent
    => remain healthy; consume the guard; emit component_damage_resisted
```

- It protects only the first healthy-to-damaged mobility transition.
- It does not prevent a damaged-to-disabled transition, direct damage to other components, or non-component integrity damage.
- If the utility component becomes damaged or disabled before the guard is used, the unused guard is lost atomically with the utility component transition. A `utilityRuntimeChange` field on the `component_damaged` or `component_disabled` event captures the guard-state change so consumers can reconstruct the guard state without inferring it from catalogue identity.
- It is not a probability modifier, so it is auditable and cannot silently become mandatory through a hidden multiplier.

Future protective utilities may use the same explicit one-transition pattern for their own named component, but 0.2B adds no catalogue entries.

#### Guard-state representation

The guard state belongs with the utility runtime state:

```ts
reinforcedDriveGuard: "available" | "spent" | "lost";
```

Present only when `utilityId === "reinforced_drive"` and `utility.state !== "disabled"`. This is visible state, not an implicit counter.

#### Guard transition events

For `component_damage_resisted`, the event includes:

```json
{
  "component": "mobility",
  "previousState": "healthy",
  "newState": "healthy",
  "sourceAttack": { "weapon": "ram", "isCritical": true },
  "effectiveDamage": 12,
  "hitZone": "front",
  "reason": "reinforced_drive",
  "guardStateBefore": "available",
  "guardStateAfter": "spent"
}
```

For a utility component transition that causes an unused guard to be lost, the `component_damaged` or `component_disabled` event carries the guard change atomically:

```json
{
  "component": "utility",
  "previousState": "healthy",
  "newState": "damaged",
  "sourceAttack": { "weapon": "hammer", "isCritical": false },
  "effectiveDamage": 38,
  "hitZone": "top",
  "reason": "high_effective_damage",
  "utilityRuntimeChange": {
    "reinforcedDriveGuardBefore": "available",
    "reinforcedDriveGuardAfter": "lost"
  }
}
```

No separate `utility_guard_lost` event is required. One atomic event carries both the component transition and the associated guard-state change.

Consumers — text replay, ASCII reconstruction, factual reports, benchmark aggregation, and future voxel replay — must reconstruct guard state from these explicit events. They must not infer guard changes from catalogue identity alone.

### 8.7 Armour, hit zones, and weapons

Post-armour effective damage is authoritative for qualification. Hit zone decides component selection using the existing weight table; target/facing rules continue to determine the zone. This rewards armour investment without making components invulnerable, because meaningful post-armour hits can still qualify.

0.2B adds no weapon-specific component-damage traits. Existing differences remain indirect and deterministic: hammer can access top armour, ram can gain momentum damage, spinner can deliver high effective damage and knockback, grappler controls position, and flipper can overturn. Any explicit spinner/hammer/ram component trait is deferred to a weapon-balance ADR after lifecycle data exists.

## 9. State Model

The authoritative 0.2 representation is a component map, not parallel booleans:

```ts
type ComponentKind = "mobility" | "weapon" | "utility";
type ComponentStatus = "healthy" | "damaged" | "disabled";

components: {
  mobility: {
    state: ComponentStatus;
  }
  weapon: {
    state: ComponentStatus;
  }
  utility: {
    state: ComponentStatus;
    installed: boolean;
  }
}
```

The map is explicit, type-safe, extensible, and directly reconstructible from transitions. During migration, consumers that need terminal compatibility may derive `mobilityDisabled`, `weaponDisabled`, and `utilityDisabled` from `state === "disabled"`; they are projections, never a second authoritative state.

The 0.2 initial state must include every component state and the reinforced-drive guard state needed for deterministic reconstruction. The latter belongs with the utility runtime state, for example `reinforcedDriveGuard: "available" | "spent" | "lost"`, and is only present for that installed utility. This is visible state, not an implicit counter.

## 10. Event Model

Schema-version-2 events must make state transitions explicit. Do not overload `component_disabled` to mean damage, and do not emit a duplicate generic `component_state_changed` event.

| Event                       | When emitted                        | Required data                                                                                                                         |
| --------------------------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `component_damaged`         | `healthy -> damaged`                | `component`, `previousState`, `newState`, `sourceAttack`, `effectiveDamage`, `hitZone`, `reason`                                      |
| `component_disabled`        | `damaged -> disabled`               | the same fields                                                                                                                       |
| `component_damage_resisted` | Reinforced drive consumes its guard | `component`, `previousState`, `newState` (both `healthy`), `sourceAttack`, `effectiveDamage`, `hitZone`, `reason: "reinforced_drive"` |

`targetId` is the affected fighter and `actorId` is the attacker in the existing event envelope. `sourceAttack` is the weapon identifier plus `isCritical`; it must agree with the preceding `attack_hit`. `reason` is one of `critical_effective_damage`, `high_effective_damage`, or `reinforced_drive`. `previousState` and `newState` are mandatory so text replay, ASCII replay, future voxel highlights, reports, benchmark aggregation, and state reconstruction can rely on facts rather than infer intent.

Non-qualifying hits remain represented by `attack_hit` and `integrity_damaged`; they do not create noisy component-resistance events. Legacy schema-version-1 `component_disabled` continues to mean an immediate terminal disable with its original `{ component }` payload.

## 11. Versioning and Old Replays

0.2B changes simulator semantics, rules, event types/payloads, and initial-state shape. It therefore proposes:

| Artifact            | Version                                             |
| ------------------- | --------------------------------------------------- |
| `SIMULATOR_VERSION` | `0.2.0`                                             |
| `RULESET_VERSION`   | `0.2.0`                                             |
| Event schema        | `2`                                                 |
| Match record schema | `2`                                                 |
| Catalogue           | remains `1` (no item, cost, or availability change) |

Record readers must use a discriminated v1/v2 decoder and dispatch by record/event schema plus recorded simulator version. Version 1 keeps its boolean component state and immediate `component_disabled` semantics; it is neither migrated in place nor replayed through the 0.2 reducer. Version 2 stores the map above and uses the new event semantics. Separate version-aware reconstruction/rendering adapters may share presentation code, but no legacy event may be silently reinterpreted as damage.

This decision establishes the required boundary for ADR-005: 0.2B can specify the data contract, while ADR-005 may choose the concrete replay registry/module layout. Existing records remain valid input and replay exactly as before.

## 12. Benchmark Acceptance Criteria

Use the unchanged `prototype-0.2-baseline-v1` seed bank, same Bulwark mirror build and policies, and the same 80 development seeds:

```text
0.1.2 baseline versus 0.2B candidate rules
same builds, same policies, same seeds
compare distributions; do not require per-seed identity
```

The candidate passes the development gate only if all of the following are true:

| Measure                                        |                           0.1 baseline | 0.2B acceptance target                                                                                                                                                                                                                                                                                                                                                                      |
| ---------------------------------------------- | -------------------------------------: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| First-round immobilisation                     |                                  26.3% | below 13.2% (at least 50% reduction)                                                                                                                                                                                                                                                                                                                                                        |
| Matches with any terminal disable              |                                 100.0% | below 85%                                                                                                                                                                                                                                                                                                                                                                                   |
| Overall immobilisation                         |                                  92.5% | 40% to 75%                                                                                                                                                                                                                                                                                                                                                                                  |
| Structural destruction                         |         not the dominant observed path | at least 10% of matches                                                                                                                                                                                                                                                                                                                                                                     |
| Judges decisions                               |                                      — | below 45%                                                                                                                                                                                                                                                                                                                                                                                   |
| Any one finish method                          |                   immobilisation 92.5% | below 85%                                                                                                                                                                                                                                                                                                                                                                                   |
| Component damage (healthy-to-damaged or later) |                           not measured | **Diagnostic:** report the percentage of matches containing at least one healthy→damaged or damaged→disabled transition. Exploratory preferred range: 50% to 95%. Below 50% requires investigation but is not an automatic failure if finish distribution, match length, and volatility targets are otherwise met. Above 95% requires investigation for continued component over-dominance. |
| Draws                                          |                                   5.0% | at or below 10%                                                                                                                                                                                                                                                                                                                                                                             |
| Average match length                           | compare from retained benchmark report | 4.0 to 12.0 rounds and no more than 50% or 2.0 rounds above baseline, whichever allowance is greater                                                                                                                                                                                                                                                                                        |

Terminal-disable mix is a diagnostic guardrail: mobility should be 35% to 55% of terminal disables, weapon 25% to 45%, and utility 10% to 30%; no component category may exceed 55%. If fewer than ten terminal disables occur, report the counts and investigate rather than treating percentage noise as a pass.

The held-out 20 seeds are a confirmation report after the development gate; they must not be shown to an AI redesign prompt. A result outside these bounds requires threshold/rule adjustment and a rerun on the same bank, not a seed-bank change. The report must include transition counts, resisted transitions, terminal-disable counts by component, finish distribution, mean/median/min/max rounds, integrity distribution, critical-hit count, and the existing checksum.

## 13. Consequences

The normal path to immobilisation requires at least two qualifying transitions against mobility, or three when a healthy reinforced drive spends its guard. This deliberately increases the value of repeated targeting, armour, and tactical pressure.

The change adds a small fixed state surface but avoids per-component hit points, hidden state, timer recovery, and stochastic impairment. It also exposes current documentation/runtime mismatches and requires version-aware report/replay/schema work. Future visual replays benefit from explicit transition events without dictating a voxel implementation.

## 14. Risks and Mitigations

| Risk                                                   | Mitigation                                                                                                                                     |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Criticals remain too frequent to meet disable targets. | Use the fixed 80-seed comparison; adjust the explicit qualification constants only through an ADR amendment, not ad hoc rolls.                 |
| Matches become too long or judges dominate.            | Enforce the duration, destruction, judges, and draw gates together.                                                                            |
| Reinforced drive becomes a mandatory choice.           | It provides one visible guard, not a multiplier or immunity; compare its selection and outcome value in the benchmark.                         |
| High-damage weapons dominate component progression.    | Keep traits out of 0.2B, inspect per-weapon effective-damage and transition distributions, then address in a focused balance ADR if needed.    |
| Legacy replay breaks.                                  | Retain v1 schema/event semantics, use version dispatch, and add v1 fixture regression tests before enabling v2 persistence.                    |
| Reports and visuals disagree.                          | Require every rendering/reporting consumer to reconstruct from the same explicit transition events and include state-transition test fixtures. |

## 15. Rejected Alternatives

- Binary damage-scaled disable probability: reduces neither the one-hit narrative nor randomness sufficiently.
- Component durability points: valuable only when component-specific tuning is justified; premature for the current three-component simulator.
- Temporary repair/recovery: adds timer state and policy implications before lifecycle data justifies it.
- Round-one disable immunity: masks the cause rather than making component damage legible and sustained.
- Rare direct healthy-to-disabled exception in 0.2B: rejected until there is evidence and an explicit, bounded weapon/threshold rule.
- Multiple motors/tracks or mobility redundancy: exceeds the component-detail justified by the current simulator.

## 16. Implementation Boundaries for 0.2B

Included after ADR approval:

- The state map, deterministic qualification/transition logic, damaged penalties, reinforced-drive guard, event/schema/replay/report/benchmark compatibility work, and distribution comparison.
- Version-gated preservation of Prototype 0.1 records.

Excluded:

- 3x3 movement or other positioning work.
- Multi-opponent fixtures or suite work.
- AI prompt redesign except state fields strictly needed for factual reporting.
- Voxel replay implementation.
- Broad weapon rebalance or new catalogue components.
- Multiplayer, matchmaking, or VS Code extension work.

## 17. Resolution

All follow-up questions resolved:

1. ✅ Thresholds `10` and `35` accepted as 0.2B qualification candidate set A. They must be evaluated against the fixed development seed bank and may be tuned through documented amendment after the first benchmark run.
2. ✅ No direct healthy-to-disabled path for 0.2B. A catastrophic exception remains intentionally deferred.
3. ✅ `reinforced_drive` accepted as a one-use healthy-to-damaged mobility guard with explicit `component_damage_resisted` events and atomic `utilityRuntimeChange` on utility transitions.
4. ✅ v1/v2 replay boundary accepted. ADR-005 retains responsibility for the concrete version-dispatch architecture.

## 18. Source Files Inspected

Gameplay and versioning: `src/simulator/constants.ts`, `damage.ts`, `reducer.ts`, `actions.ts`, `victory.ts`, `types.ts`, `simulator.ts`, `seeded-random.ts`, and `src/catalogue/catalogue.v1.ts`.

Events, persistence, schemas, and reports: `src/events/battle-event.ts`, `event-factory.ts`, `src/schemas/match-record.schema.ts`, `factual-report.schema.ts`, `src/persistence/match-converter.ts`, `json-match-repository.ts`, `src/reports/factual-match-report.ts`, and `review-formatter.ts`.

Replay and benchmark consumers: `src/replay/text-replay-renderer.ts`, `statistics.ts`, `src/replay/ascii/state-reconstructor.ts`, `ascii.types.ts`, `arena-snapshot-renderer.ts`, `highlight-selector.ts`, `result-card-renderer.ts`, `src/bench/run-benchmark.ts`, `metrics.ts`, and `benchmark.types.ts`.

Documentation and records: `docs/PROTOTYPE-0.1-VALIDATION.md`, `docs/PROTOTYPE-0.2-EXPERIMENTAL-PLAN.md`, `docs/ADR-003-seed-bank-evaluation.md`, `docs/EVENT_FORMAT.md`, `docs/RULESET.md`, `docs/DECISIONS.md`, and `data/seeds/benchmark-100-v1.json`.
