# ADR-002 Amendment: Component-Impact Qualification - Candidate Set B

**Status:** Accepted for Candidate C implementation
**Date:** 2026-07-29
**Amends:** ADR-002, Component Damage and Disable Lifecycle
**Decision scope:** Qualification signal only; Candidate C is not implemented by this amendment.

## 1. Context

ADR-002 accepted the lifecycle:

```text
healthy -> damaged -> disabled
```

Candidate Set A implemented qualification from post-armour integrity damage:

```text
(isCritical && effectiveDamage >= 10) || effectiveDamage >= 35
```

The fixed Bulwark mirror benchmark produced zero component state transitions under Candidate A. This is an expected result of the chosen signal, not evidence that the lifecycle, event extraction, or benchmark aggregation is broken. Candidate C must retain armour as internal protection while preserving enough impact variation to distinguish weak, strong, critical, and high-damage hits.

The accepted lifecycle, damaged-state penalties, explicit transition events, reinforced-drive guard, and Prototype 0.1 replay boundary remain unchanged.

## 2. Current implementation inspected

The following paths and functions were inspected before this amendment:

| Concern                       | Current implementation                                                                                                                                                                                                                                                                  |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Raw damage                    | `src/simulator/damage.ts`, `calculateAttack()`, `getWeaponBaseDamage()`. Damage starts from catalogue base damage, applies the damaged-weapon multiplier, random variance, ram momentum, and the hammer top/overturned bonus. `AttackResult.rawDamage` is the rounded pre-armour value. |
| Armour absorption             | `calculateAttack()` reads the selected zone's armour and applies `ARMOUR_ABSORPTION_FACTOR = 0.5`.                                                                                                                                                                                      |
| Integrity damage              | `effectiveDamage = max(1, round(rawDamageBeforeRounding - armourAtHitZone * 0.5))`. This is the Candidate A signal and is emitted on `attack_hit` and `integrity_damaged`.                                                                                                              |
| Critical hit                  | `calculateAttack()` calls `rng.chance(CRITICAL_HIT_THRESHOLD)` with `CRITICAL_HIT_THRESHOLD = 0.7`. The current critical flag does not modify raw damage.                                                                                                                               |
| Hit zone                      | `determineHitZone()` and `getExposedZones()` in `src/simulator/damage.ts`; policy targets and facing select among exposed zones, with front as the documented fallback.                                                                                                                 |
| Component candidate selection | `selectComponentForTransition()` in `src/simulator/component-state.ts`. It excludes disabled components and an absent utility, and applies the existing zone weights.                                                                                                                   |
| Qualification                 | `checkComponentQualification()` in `src/simulator/component-state.ts`; Candidate A receives only `isCritical` and `effectiveDamage`.                                                                                                                                                    |
| State transition              | `transitionComponentState()` and `applyTransition()` in `src/simulator/component-state.ts`. They implement healthy -> damaged -> disabled and reinforced-drive guard consumption.                                                                                                       |
| Transition events             | The two attack branches in `src/simulator/reducer.ts` emit `component_damaged`, `component_disabled`, and `component_damage_resisted`. Current v2 payloads contain component state, source attack, effective damage, hit zone, reason, and optional guard change.                       |
| Reinforced drive              | The mobility branch in `transitionComponentState()` consumes `reinforcedDriveGuard: "available" -> "spent"`; a utility transition loses an unused guard. The reducer emits `component_damage_resisted` or an atomic utility runtime change.                                             |
| Benchmark extraction          | `extractPerMatch()` in `src/bench/run-benchmark.ts` counts transition events, guard use/loss, and per-component transition counts from the event stream.                                                                                                                                |
| Benchmark aggregation         | `computeMetrics()` in `src/bench/metrics.ts` aggregates all simulations and reports transition totals, match incidence, damaged end states, and per-component counts.                                                                                                                   |
| Versions                      | `SIMULATOR_VERSION` and `RULESET_VERSION` are both `0.2.0` in `src/simulator/constants.ts`; catalogue version is `1`.                                                                                                                                                                   |

One implementation boundary is important for Candidate C: the current reducer selects a component before calling `transitionComponentState()`, which then discovers whether the hit qualifies. Candidate C must evaluate qualification first and select a component only after a hit qualifies. A non-qualifying hit must not consume component-selection randomness or produce a component event.

## 3. Candidate A evidence and root cause

The Bulwark fixture is defined in `src/agents/scripted/bulwark-agent.ts`:

```text
weapon: ram
front armour: 60
side armour: 15
rear/top armour: 0
policy: front primary and front secondary
```

Catalogue ram damage is 20 with a +/-20% variance. Advance momentum can add a small 1.05 multiplier in the current reducer. Therefore the normal front-hit raw range is approximately 16-25. With 60 front armour:

```text
max(1, round(rawDamage - 60 * 0.5)) = 1
```

Candidate A then evaluates `1 < 10` and `1 < 35`, so neither branch qualifies. The same test also confirms zero `component_damaged`, `component_disabled`, and `component_damage_resisted` events for the Bulwark mirror. The synthetic Glass Cannon fixture in `tests/integration/benchmark-v2-transitions.test.ts` produces and aggregates transitions, confirming that event detection and metrics work when the qualification signal is above threshold.

The failure is therefore the mechanical loss of information caused by reusing minimum-clamped integrity damage as component impact. It is not an event, reducer-lifecycle, or benchmark-detection defect.

## 4. Decision drivers

- More armour at the struck zone must reduce component impact.
- Weak and strong hits must remain distinguishable after armour.
- A critical flag must not make every hit qualify.
- Qualification must be deterministic, inexpensive, and replayable.
- Critical severity must not be double-counted.
- The model must work for zero armour and high armour without division edge cases.
- The same qualification result must drive normal transitions and reinforced-drive resistance.
- Benchmark tuning must use the fixed development/held-out seed bank without seed changes.
- Candidate A and Candidate C records must be distinguishable before a stable 0.2 release.

## 5. Options considered

### Option 1 - Raw-damage qualification

Use raw pre-armour damage for component qualification and post-armour damage for integrity.

This is simple and preserves weak/strong variation, but armour no longer protects components except indirectly through hit-zone selection. A 60-armour Bulwark and a lightly armoured target receive the same component impact from the same weapon and roll. It also over-rewards high raw-damage weapons and makes the internal-protection meaning of armour difficult to explain. Rejected.

### Option 2 - Separate component-impact calculation

Use a second post-armour signal with a weaker armour absorption factor:

```text
componentImpact = max(COMPONENT_MIN_IMPACT, round(rawDamage - armourAtHitZone * COMPONENT_ARMOUR_FACTOR))
```

Armour remains protective, but 60 armour does not collapse every ram hit to the same minimum. The formula is cheap, deterministic, readable, and uses the existing raw damage and hit-zone values. Selected, with the exact Candidate Set B rules in Section 7.

### Option 3 - Relative penetration ratio

Use:

```text
componentPenetration = rawDamage / max(1, armourAtHitZone)
```

This handles zero armour mathematically, but a small attack against a weakly armoured zone can qualify too easily. It is harder to explain in reports, requires ratio-specific tuning, and produces a discontinuity between zero/low armour and ordinary armour. Rejected for 0.2B.

### Option 4 - Hybrid impact and penetration

Require an absolute impact threshold plus a relative penetration threshold, or allow either condition.

This adds two interacting tuning levers and makes a transition harder to explain. The `or` form recreates low-armour over-sensitivity; the `and` form risks another Bulwark null result. Rejected until a single impact signal has benchmark evidence.

### Option 5 - Critical accumulation

Store trauma from critical hits and transition after a later trauma count.

This rewards repeated pressure, but trauma is hidden state unless every increment is persisted and replayed. It adds schema, event, reconstruction, and tuning complexity while conflicting with ADR-002's intentionally simple three-state lifecycle. Rejected for 0.2B.

## 6. Critical-hit accounting

The current simulator's critical roll is a boolean event flag. It does not multiply raw damage: raw damage is fully determined by weapon base damage, damaged-weapon state, variance, ram momentum, and hammer conditions before the critical roll is made.

Candidate C therefore uses the already-calculated raw damage exactly once. It adds no critical component multiplier. Critical severity is represented only by the lower critical impact threshold. This avoids the unsafe combination of a damage multiplier, a second component multiplier, and a lowered threshold.

## 7. Decision and exact component-impact formula

Adopt **Option 2: separate component-impact calculation**. The implementation-ready constants are selected in Section 7.2.

For a successful attack, Candidate C uses these authoritative values:

1. `rawDamage` is the integer raw damage after all existing weapon, damaged-weapon, variance, ram-momentum, and hammer adjustments, before armour.
2. `armourAtHitZone` is the defender's armour value at the `hitZone` returned by `determineHitZone()`.
3. Candidate C uses the canonical integer `rawDamage` for both integrity and component calculations. Integrity remains minimum-clamped at 1; component impact is not minimum-clamped at 1.

```text
integrityEffectiveDamage = max(1, round(rawDamage - armourAtHitZone * 0.50))
componentImpact = max(COMPONENT_MIN_IMPACT, round(rawDamage - armourAtHitZone * COMPONENT_ARMOUR_FACTOR))
```

The `round()` operation occurs after armour subtraction and before threshold comparison. Fractional component impacts are not retained. `COMPONENT_MIN_IMPACT = 0` is intentional: a weak hit can be completely stopped for component purposes while still dealing the existing minimum 1 integrity damage.

Qualification is evaluated only for a successful attack with a valid hit zone and an installed eligible component:

```text
criticalQualifies = isCritical && componentImpact >= CRITICAL_COMPONENT_IMPACT_THRESHOLD
highImpactQualifies = componentImpact >= HIGH_COMPONENT_IMPACT_THRESHOLD
qualifies = criticalQualifies || highImpactQualifies
```

Candidate C constants:

```text
COMPONENT_QUALIFICATION_ID = "component-impact-c1"
COMPONENT_ARMOUR_FACTOR = 0.20
COMPONENT_MIN_IMPACT = 0
CRITICAL_COMPONENT_IMPACT_THRESHOLD = 11
HIGH_COMPONENT_IMPACT_THRESHOLD = 13
```

The values are Candidate C implementation constants, not permanent balance constants. Both conditions may be true. When both are true, the recorded reason is `critical_component_impact`, preserving the existing critical-first precedence; otherwise the reason is `high_component_impact`. A non-qualifying hit has no qualification reason and creates no component event.

Qualification happens before component selection. If it is false, the reducer must not select a component. If it is true, the reducer selects one installed, non-disabled component with the existing hit-zone weights. A missing utility (`utilityId: "none"`) is never selected. If no eligible component remains, no state transition is emitted.

Control actions, misses, and hits with no integrity damage are not component-qualifying attacks. A successful attack with current minimum integrity damage of 1 can still qualify only if its separate component impact reaches a threshold; the integrity minimum does not substitute for component impact.

The current hit-zone type is a closed set. Candidate C must fail closed for missing or invalid runtime hit-zone data: no armour lookup, qualification, component selection, or transition is permitted. The existing documented front fallback remains a `determineHitZone()` decision for a valid attack, not a way to turn malformed event data into a component hit.

Reinforced drive evaluates this same `qualifies` result. It consumes its one guard only when mobility is selected, mobility is healthy, the utility is installed and healthy, and the guard is available. It does not alter `componentImpact`, thresholds, or component selection probabilities.

### 7.1 Pre-implementation Candidate B1 viability analysis

The frozen 80 development seeds were replayed with the current simulator and Bulwark build/policy. This analysis read existing `attack_hit` events only; it did not alter rules, consume a different random stream, inspect held-out seeds, or implement Candidate B. The current v2 Candidate A path produced no component transition events in this mirror, so all three installed components remained eligible for every successful hit.

| Zone      | Successful hits | Critical hits |   Armour encountered | Raw damage distribution                                                                         | B1 component impact |
| --------- | --------------: | ------------: | -------------------: | ----------------------------------------------------------------------------------------------- | ------------------- |
| front     |           1,280 |           908 |                   60 | 16-25, mean 19.95; `16:82, 17:148, 18:171, 19:175, 20:169, 21:152, 22:160, 23:137, 24:84, 25:2` | 0-7, mean 2.20      |
| left      |               0 |             0 |      not encountered | none                                                                                            | none                |
| right     |               0 |             0 |      not encountered | none                                                                                            | none                |
| rear      |               0 |             0 |      not encountered | none                                                                                            | none                |
| top       |               0 |             0 |      not encountered | none                                                                                            | none                |
| **Total** |       **1,280** |       **908** | **60 for every hit** | -                                                                                               | -                   |

Under B1 (`factor 0.30`, critical threshold `16`, high threshold `30`):

```text
critical-threshold hits: 0
high-impact-threshold hits: 0
qualifying hits: 0
matches with at least one qualifying hit: 0/80 (0%)
matches with at least two qualifying hits: 0/80 (0%)
```

Every successful hit had mobility, weapon, and installed reinforced-drive utility eligible under the current state. This is an eligibility observation, not a prediction of which component a future post-qualification weighted selection would choose. The qualifying-hit sample is empty, so no component-specific qualification distribution exists.

The same hit facts were evaluated analytically under the two limited alternatives named in the amendment request:

| Set | Factor | Critical threshold | High threshold | Impact range on observed hits | Qualifying hits | Matches with any | Matches with two or more |
| --- | -----: | -----------------: | -------------: | ----------------------------: | --------------: | ---------------: | -----------------------: |
| B1  |   0.30 |                 16 |             30 |                           0-7 |               0 |             0/80 |                     0/80 |
| B2  |   0.25 |                 14 |             28 |                          1-10 |               0 |             0/80 |                     0/80 |
| B3  |   0.20 |                 14 |             28 |                          4-13 |               0 |             0/80 |                     0/80 |

B1 is automatically unsuitable under the pre-implementation guideposts. B2 and B3 are also unsuitable at their proposed thresholds; even the lowest observed B3 impact is below its critical threshold and every observed impact is below its high threshold. The result is caused by the current fixture's complete front-hit concentration and 60 armour, not by an event-detection or lifecycle defect. The separate impact formula remains coherent because it preserves a monotonic armour relationship and a non-constant raw-damage signal; the selected thresholds are too conservative for the observed population.

**Decision: B. Candidate B1 requires revised constants before implementation.** The B1 values remain an analysed, rejected baseline, not an implementation approval. Candidate C is the revised implementation candidate selected in Section 7.2.

#### Random-consumption and checksum implications

The current 0.2B reducer calls `selectComponentForTransition()` before qualification on every successful hit, so the existing implementation consumes a weighted-selection PRNG draw even when Candidate A does not qualify. Candidate C requires qualification first; non-qualifying hits consume no component-selection draw, while qualifying hits consume one draw after qualification. Therefore Candidate C necessarily changes later random values and is expected to change outcome and report checksums, even if a particular match eventually has no component transition. This is acceptable within the pre-release 0.2.0 candidate boundary, provided the candidate identifier is persisted in benchmark/report/match metadata.

Persisted v1 and v2 replays remain unaffected because they replay stored events through their version-aware readers rather than rerunning the simulator. Re-running an old configuration under Candidate C is a new simulation and must not be expected to reproduce its old checksum.

### 7.2 Candidate C Constant Selection

The cross-tab below uses the immutable `attack_hit` facts from the 80 development-seed Bulwark mirror. It contains 1,280 successful hits, all against front armour 60. Critical and non-critical counts are shown for every observed raw-damage value.

| rawDamage | Critical hits | Non-critical hits | Total |
| --------: | ------------: | ----------------: | ----: |
|        16 |            59 |                23 |    82 |
|        17 |           101 |                47 |   148 |
|        18 |           128 |                43 |   171 |
|        19 |           120 |                55 |   175 |
|        20 |           117 |                52 |   169 |
|        21 |           106 |                46 |   152 |
|        22 |           116 |                44 |   160 |
|        23 |            96 |                41 |   137 |
|        24 |            63 |                21 |    84 |
|        25 |             2 |                 0 |     2 |

There are 7-22 successful hits per match (minimum 7, median 16, mean 16, maximum 22). Critical hits per match are 4-19 (minimum 4, median 12, mean 11.35, maximum 19). The aggregate critical rate is `908 / 1,280 = 70.9375%`.

The three bounded candidates were evaluated without component selection or altered simulation:

| Set | Factor | Critical threshold | High threshold | Qualifying hits | Critical-qualified | High-qualified | Both | Qualification rate | Matches >=1 | Matches >=2 | Matches >=3 | Mean/match | Median/match | Max/match |
| --- | -----: | -----------------: | -------------: | --------------: | -----------------: | -------------: | ---: | -----------------: | ----------: | ----------: | ----------: | ---------: | -----------: | --------: |
| C1  |   0.20 |                 11 |             13 |             161 |                161 |              2 |    2 |             12.58% |       70/80 |       52/80 |       25/80 |       2.01 |            2 |         5 |
| C2  |   0.20 |                 10 |             13 |             277 |                277 |              2 |    2 |             21.64% |       77/80 |       68/80 |       56/80 |       3.46 |            4 |         7 |
| C3  |   0.15 |                 14 |             16 |             161 |                161 |              2 |    2 |             12.58% |       70/80 |       52/80 |       25/80 |       2.01 |            2 |         5 |

For C1, qualification occurs only at raw damage 23-25: 96 hits at raw 23, 63 at raw 24, and 2 at raw 25. The two high-impact hits are the two raw-25 hits, and both are already critical; there are no high-only non-critical hits in this sample. This makes the high-impact path rare and diagnostic rather than a second routine qualification path.

C2 is rejected because its lower critical threshold raises qualification to 21.64% of attacks, gives a median of four qualifying hits per match, and puts 85% of matches at two or more qualifications. C3 has the same observed qualification outcome as C1 but uses a lower armour factor, so it provides less component protection without analytical benefit. C1 is selected because it produces 2.01 qualifying hits per match, meaningful repeats (65% of matches at two or more; 31.25% at three or more), and leaves 87.42% of successful hits non-qualifying while retaining the stronger armour factor of the two equivalent-incidence sets.

The current critical rate is intentional current simulator behaviour, not a Candidate C decision. `CRITICAL_HIT_THRESHOLD = 0.7` is passed to `SeededRandom.chance()`, which returns `next() < probability`; it therefore represents a nominal 70% probability, with the observed 70.94% being sampling variation. Raw variance is drawn before the critical roll, using separate calls on the same deterministic PRNG stream. The fields are not causally coupled, but they are not mathematically independent observations of a true random source because they share ordered PRNG state. No critical-rate change is included here; any concern about the high rate is a separate future balance issue.

### Component-selection probability analysis

All three Bulwark components start eligible, but the existing front-zone weights are mobility 50, weapon 50, utility 0. Normalised probabilities are therefore mobility 0.5, weapon 0.5, and reinforced-drive utility 0. The following are analytical estimates for an uninterrupted front-hit sequence, not benchmark outcomes:

| Question                                               | Estimate | Reason                                                                                                         |
| ------------------------------------------------------ | -------: | -------------------------------------------------------------------------------------------------------------- |
| Two qualifying hits select the same component          |     0.50 | Mobility/mobility or weapon/weapon.                                                                            |
| Three qualifying hits contain a repeat                 |     1.00 | Only two components have positive front weights.                                                               |
| Reinforced drive resists the first mobility transition |     0.50 | The first qualifying selection is mobility with probability 0.5.                                               |
| Terminal disable is possible by two qualifying hits    |     0.25 | The first two selections must be weapon/weapon; mobility/mobility spends the guard then only damages mobility. |
| Terminal disable is possible by three qualifying hits  |     0.50 | Under the same approximation, weapon selected at least twice or mobility selected three times.                 |

C1 supplies 52 matches with at least two qualifying hits and 25 with at least three, so repeated progression is analytically plausible. Actual component outcomes will change after implementation because qualification-before-selection changes PRNG consumption and because disabled components are removed from later eligibility. These estimates must not be treated as benchmark results.

**Selected implementation candidate:**

```text
COMPONENT_QUALIFICATION_ID = "component-impact-c1"
COMPONENT_ARMOUR_FACTOR = 0.20
COMPONENT_MIN_IMPACT = 0
CRITICAL_COMPONENT_IMPACT_THRESHOLD = 11
HIGH_COMPONENT_IMPACT_THRESHOLD = 13
```

This candidate preserves the selected architecture: more armour lowers component impact, weak non-critical front hits remain below the high threshold, critical qualification is selective rather than automatic, and the accepted lifecycle has enough repeated qualification opportunities to make terminal disablement plausible. It is accepted for implementation, not declared permanently balanced; the unchanged development benchmark and then held-out confirmation remain mandatory.

## 8. Worked catalogue examples

These examples use the current catalogue ranges and the Candidate Set B formula. Critical status does not change raw damage. They are worked calculations, not new simulator output.

| Weapon/scenario                       | Raw damage | Armour | Integrity effective damage | Component impact | Critical | Result                                        |
| ------------------------------------- | ---------: | -----: | -------------------------: | ---------------: | :------: | --------------------------------------------- |
| Bulwark front ram, weak hit           |         16 |     60 |                          1 |                0 |    No    | No qualification                              |
| Bulwark front ram, strong hit         |         25 |     60 |                          1 |                7 |   Yes    | No qualification                              |
| Ram into lightly armoured zone        |         20 |      5 |                         18 |               19 |   Yes    | `critical_component_impact`                   |
| Weak ram into zero armour             |         16 |      0 |                         16 |               16 |    No    | No qualification; below high threshold        |
| Hammer top hit, no top armour         |         42 |      0 |                         42 |               42 |    No    | `high_component_impact`                       |
| Spinner into Bulwark front, high hit  |         60 |     60 |                         30 |               42 |   Yes    | Both true; record `critical_component_impact` |
| Spinner into Bulwark front, weak hit  |         40 |     60 |                         10 |               22 |    No    | No qualification                              |
| Flipper into 15-armour side, weak hit |         20 |     15 |                         13 |               16 |    No    | No qualification                              |

The catalogue gives approximate raw ranges of 16-24 for a normal ram, 17-25 with the current advance momentum, 28-42 for a hammer without its top bonus, 32-48 for a top hammer hit, 40-60 for a spinner, and 20-30 for a flipper. The examples show the required relationship: increasing armour lowers component impact, while weak and strong attacks remain distinct. A zero-armour zone does not make every weak non-critical attack qualify because the high threshold remains 30.

## 9. Event, replay, and report implications

Candidate C must extend v2 component transition facts so a transition is explainable without rerunning combat. The transition event payloads for `component_damaged`, `component_disabled`, and `component_damage_resisted` must include, directly or through a linked immutable attack fact:

```text
rawDamage
armourAtHitZone
integrityEffectiveDamage
componentImpact
criticalComponentImpactThreshold
highComponentImpactThreshold
qualificationReason
hitZone
critical status
```

The event must also retain the existing component state, source attack, and guard-state fields. `componentImpact` is the persisted factual value; consumers must not recompute it from a possibly different version of the formula. Non-qualifying `attack_hit` events should expose enough attack facts for reports, but must not emit a component transition event.

Replay reconstruction must apply explicit state transitions in event order. It must not infer a damaged state from `attack_hit`, infer a disable from critical status, or infer reinforced-drive use from catalogue identity. Benchmark extraction must count state transitions separately from resisted guard events; a resisted event is observable guard use, not a healthy-to-damaged or damaged-to-disabled transition.

## 10. Reinforced-drive implications

The accepted one-use guard remains unchanged in meaning. Candidate C changes only the shared qualification input:

- the guard is tested after `componentImpact` qualification;
- a guarded mobility hit emits `component_damage_resisted` with the same impact and thresholds;
- it consumes `available -> spent` without changing mobility state;
- it cannot resist damage to weapon or utility;
- it cannot resist a non-qualifying hit because no guard check occurs;
- an unused guard is still lost atomically if the utility itself transitions.

The benchmark must report guards spent and guards lost independently of state-transition incidence.

## 11. Candidate C tuning protocol

### Development phase

Use only `data/seeds/benchmark-100-v1.json` development seeds. The first Candidate C run is:

```text
Bulwark vs Bulwark
80 development seeds
one simulation per seed for the mirror pairing
```

Use the committed `Glass Cannon` fixture and aggressive policy in `tests/integration/benchmark-v2-transitions.test.ts` as the deterministic low-armour contrast. It must produce transitions in at least one controlled match so the implementation and metrics can be checked independently of the Bulwark distribution.

The run must report the fixed seed bank, candidate identifier, seed count, role assignments, total simulations, outcome checksum, report checksum, transition facts, finish distribution, and all acceptance metrics. No external AI agent, redesign loop, or random seed generation is permitted.

### Parameter discipline

Candidate Set B is the first documented set. At most three candidate sets may be evaluated before a design reassessment is required. Each attempted set must be recorded, including its complete constants and development results; failed candidates are retained.

Change one conceptual lever at a time in this order unless evidence requires a justified exception:

1. component armour factor;
2. critical impact threshold;
3. high-impact threshold;
4. component minimum impact only if the first three cannot produce a valid distribution.

Multiple constants may change together only in a new documented candidate record that explains why a one-lever change was insufficient. The seed fixture, policies, builds, and development/held-out partition cannot change. Held-out results cannot be inspected during development tuning.

### Held-out phase

Run the 20 held-out seeds only after a candidate passes the development gates. Held-out results are confirmation evidence, not a tuning dataset. If held-out results fail, return to development analysis, create a new candidate record, and rerun the fixed development set before another held-out confirmation. Do not change the held-out seeds or expose per-seed held-out outcomes to AI redesign prompts.

## 12. Development acceptance gates

The baseline is the frozen Prototype 0.1 Bulwark mirror result: first-round immobilisation 26.3%, overall immobilisation 92.5%, and matches with any terminal disable 100.0%. Candidate C must pass all hard gates below on the unchanged 80 development seeds:

| Metric                        | Candidate C development gate                                                                                           |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| First-round immobilisation    | `< 13.2%`                                                                                                              |
| Overall immobilisation        | `40% <= rate <= 75%`                                                                                                   |
| Matches with terminal disable | `< 85%`                                                                                                                |
| Structural destruction        | `>= 10%`                                                                                                               |
| Judges decisions              | `< 45%`; 100% judges is an automatic failure                                                                           |
| Draw rate                     | `<= 10%`                                                                                                               |
| Any finish method             | No single method may be `>= 85%`                                                                                       |
| Average rounds                | `4.0-12.0`, with no more than 50% or 2 rounds above the retained baseline allowance, whichever is greater              |
| Maximum rounds                | `<= 20`; any match at the engine cap is an investigation, and more than 10% at the cap fails the development candidate |

Component progression gates and diagnostics:

- Zero `healthy -> damaged` or `damaged -> disabled` state transitions in the Bulwark development benchmark is an automatic Candidate C failure.
- No `damaged -> disabled` transitions is a failure of lifecycle coverage and requires tuning or fixture analysis; a candidate must demonstrate both stages before held-out confirmation.
- A candidate with only damaged states and no disables is too conservative for implementation readiness, even if finish distribution passes.
- State-transition incidence is diagnostic, with a preferred investigation range of 10%-95% of matches. Below 10% requires analysis; above 95% requires analysis for renewed component over-dominance. The hard zero-transition rule remains in force.
- Resisted guard events are reported separately and do not count as a state transition. A controlled reinforced-drive fixture must produce at least one resisted event; zero guard events in the main Bulwark mirror alone is not a failure if no qualifying mobility hit occurs.
- Terminal-disable mix is reported by mobility, weapon, and utility. When at least ten terminal disables exist, mobility should be 35%-55%, weapon 25%-45%, utility 10%-30%, and no category may exceed 55%. Fewer than ten terminal disables requires count-based investigation rather than percentage acceptance.
- All matches going to judges, all matches containing multiple transitions, or first-round disables remaining common are aggressive/conservative failure signals even where a single headline metric passes.

If a candidate is too conservative, first inspect whether component impact is zero in the armoured fixture, whether only the critical threshold is unreachable, and whether high-impact transitions are absent. If a candidate is too aggressive, inspect first-round transition events, terminal-disable incidence, mobility share, and repeated transitions per match. Adjust only through the candidate protocol; never repair the result by changing seeds.

## 13. Versioning and candidate identification

Keep `SIMULATOR_VERSION = "0.2.0"` and `RULESET_VERSION = "0.2.0"` during pre-release tuning. Candidate A is an internal failed tuning candidate, not a public stable ruleset. A version bump would create unnecessary churn before 0.2 release.

Candidate A and Candidate C records must nevertheless be distinguishable. Future implementation must add an explicit immutable identifier such as:

```text
componentQualificationVersion: "candidate-a"
componentQualificationVersion: "component-impact-c1"
```

The identifier must be present in benchmark configuration/report metadata and persisted v2 match metadata or the equivalent existing versioned record convention. It must contribute to report identity/checksum where applicable. A report or replay must never present Candidate A and Candidate C as the same qualification rule merely because both use simulator/ruleset 0.2.0.

## 14. Consequences

Candidate C introduces one explicit derived fact, component impact, while preserving the accepted lifecycle and existing integrity damage. Armour remains useful against internal damage without making the high-armour Bulwark mirror mechanically constant. Critical hits remain meaningful but no longer receive an unbounded second multiplier.

The implementation must change the order of qualification and component selection, extend transition facts, add candidate identification, and update benchmark aggregation. Candidate A matches remain valid as internal v2 records when their candidate identifier is known. Prototype 0.1 records remain governed by the v1 replay boundary in ADR-002.

## 15. Risks and mitigations

| Risk                                             | Mitigation                                                                                                   |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| Factor 0.20 still suppresses Bulwark transitions | Treat zero development transitions as automatic failure and create a retained tuning record.                 |
| Low armour makes criticals too frequent          | Keep critical threshold 11, high threshold 13, and inspect critical-only transition counts.                  |
| High-damage weapons dominate                     | Report transition counts by weapon and component; defer weapon traits and broad rebalance to a separate ADR. |
| Integer rounding creates boundary sensitivity    | Persist raw damage, armour, impact, thresholds, and reason; test exact threshold boundaries.                 |
| Replays cannot explain transitions               | Store factual impact inputs/results in transition events or a linked immutable attack fact.                  |
| Candidate records become indistinguishable       | Require `componentQualificationVersion` in reports and persisted v2 metadata.                                |
| Guard use is mistaken for state transition       | Separate resisted-event and state-transition metrics.                                                        |

## 16. Rejected alternatives

- Candidate A's post-armour minimum-clamped integrity damage as the component signal: loses impact variation against high armour.
- Raw-damage-only qualification: removes armour protection for internal components.
- Relative penetration ratio: introduces low-armour discontinuities and harder tuning.
- Hybrid impact/penetration: unnecessary coupled thresholds.
- Critical accumulation: hidden trauma state and schema/replay cost.
- Additional critical multiplier: double-counts the existing critical flag without evidence.
- `COMPONENT_MIN_IMPACT = 1`: recreates the minimum-damage collapse that caused Candidate A's null result.

## 17. Future implementation scope

The separate Candidate C implementation task must inspect and likely update:

- `src/simulator/constants.ts` for Candidate C constants and identifier `component-impact-c1`;
- `src/simulator/damage.ts` for canonical raw/armour/impact facts;
- `src/simulator/component-state.ts` for qualification-before-selection and exact reason values;
- `src/simulator/reducer.ts` for event payloads and transition ordering;
- `src/events/battle-event.ts` and event schema/types;
- v2 match metadata/schema and persistence for candidate identification;
- `src/bench/run-benchmark.ts`, `src/bench/metrics.ts`, and report rendering for impact and separate state/resisted metrics;
- replay, factual reporting, and ASCII reconstruction consumers;
- unit, integration, deterministic replay, and benchmark tests;
- `docs/RULESET.md` and event documentation.

The implementation must preserve factual evidence sufficient to explain every transition:

```text
raw damage
armour at struck zone
integrity effective damage
component impact
critical component threshold
high impact threshold
qualification reason
```

These facts may be embedded in transition events or referenced through a same-match immutable attack fact, but they must not be reconstructed from catalogue identity or recomputed with current constants during replay.

## 18. Rollback plan

Candidate C implementation must be isolated behind the explicit candidate identifier and version-gated metadata. If development gates fail, retain the failed report and candidate record, select a new documented candidate set, and rerun the same 80 development seeds. Do not edit the seed bank or rewrite Candidate A records. If rollback is required before a stable 0.2 release, restore the prior Candidate A code path while preserving v1 replay behavior; no history rewrite is required. Candidate C must not be promoted to the default 0.2 ruleset until both development and held-out confirmation pass.

## 19. Resolution and approval boundary

This amendment accepts Candidate C for implementation. It does not declare the constants permanently balanced; the unchanged development benchmark and held-out confirmation remain required. The following are resolved:

1. Option 2 is selected.
2. Component impact is `max(COMPONENT_MIN_IMPACT, round(rawDamage - armourAtHitZone * COMPONENT_ARMOUR_FACTOR))`.
3. Candidate C1 is `component-impact-c1` with `0.20 / 0 / 11 / 13` for factor, minimum, critical threshold, and high threshold.
4. No additional critical damage multiplier is used.
5. Simulator/ruleset remain 0.2.0 during pre-release tuning, with an explicit candidate identifier.

Candidate C implementation, benchmark execution, and any later constant amendment require a separate approved task.

## 20. Candidate C implementation prompt scope

The future implementation task must:

- add the Candidate C constants and `component-impact-c1` identifier;
- calculate component impact from canonical raw damage and struck-zone armour;
- qualify before component selection;
- persist raw damage, struck-zone armour, integrity effective damage, component impact, thresholds, reason, and candidate identifier in relevant events or linked immutable attack facts;
- persist the candidate identifier in match and benchmark metadata;
- update replay and factual-report consumers;
- update benchmark extraction and metrics where required, including state transitions separately from resisted guard events;
- run the unchanged 80 development seeds;
- inspect held-out seeds only after the development gates pass.

This amendment does not implement any of these changes.

## 21. Candidate C1 implementation result (2026-07-29)

Candidate C1 is implemented under `component-impact-c1`. The authoritative calculation in `src/simulator/component-state.ts` is `max(0, round(rawDamage - armourAtHitZone * 0.20))`; integrity effective damage remains separate. Qualification now precedes weighted component selection, so non-qualifying hits consume no component-selection PRNG draw.

Transition events persist raw damage, struck-zone armour, integrity damage, component impact, constants, thresholds, reason, hit facts, and candidate identity. Match records and benchmark reports persist the identity. Historical records without it remain compatible and are not interpreted as C1; unknown identifiers are rejected by the strict match-record schema.

The unchanged development partition produced 80 Bulwark mirror matches, 1,255 successful hits, 164 qualifying hits, 164 critical-qualified hits, 2 high-impact-qualified hits, 2 hits satisfying both conditions, 81 damaged transitions, 19 disabled transitions, and 64 resisted events. Checksums: outcomes `6d5ccc01ddc76064`; report `2df267be422b70ab`.

C1 fails development hard gates: destruction 0%, judges 95%, average rounds 19.79, and round-cap incidence exceeds the limit. No tuning or C2 was attempted, held-out seeds remain untouched, and Milestone 0.2B remains incomplete.

## 22. Candidate C1 Development Failure Diagnosis

### 22.1 Evidence boundary

This diagnosis reran the unchanged Candidate C1 Bulwark mirror on the 80
development seeds at commit `5ea09edf8cc948ec86161c1da0bcf6791f6739df`.
It reconstructed facts from the authoritative event stream. It did not run or
inspect held-out matches, alter constants, or simulate another candidate.

The benchmark contains 80 matches and 160 reinforced-drive-equipped fighters.
All component hits were front-zone hits, where the deterministic selection
weights are mobility 50, weapon 50, and utility 0. Counts described below as
counterfactual are analytical transformations of persisted selections, not
combat simulations.

### 22.2 Outcome funnel

Resistance, healthy-to-damaged, and damaged-to-disabled are mutually exclusive
outcomes of a selected qualifying hit. They are branches, not three consecutive
steps for the same hit.

| Stage                           | Count |                                                                  Conversion |
| ------------------------------- | ----: | --------------------------------------------------------------------------: |
| Successful attacks              | 1,255 |                                                                  Population |
| Qualifying hits                 |   164 |                                                13.07% of successful attacks |
| Component selections            |   164 |                                                  100.00% of qualifying hits |
| Reinforced-drive resistances    |    64 |                                                        39.02% of selections |
| Healthy-to-damaged transitions  |    81 |                                                        49.39% of selections |
| Damaged-to-disabled transitions |    19 | 11.59% of selections; 23.46% relative to the healthy-to-damaged event count |
| Mobility disables               |     4 |                                                 21.05% of terminal disables |
| Weapon disables                 |    15 |                                                 78.95% of terminal disables |
| Utility disables                |     0 |                                                  0.00% of terminal disables |
| Immobilisation outcomes         |     4 |                              100.00% of mobility disables; 5.00% of matches |

The requested headline conversions are:

- qualification to state transition: `100 / 164 = 60.98%`;
- qualification to resistance: `64 / 164 = 39.02%`;
- qualification to terminal disable: `19 / 164 = 11.59%`;
- terminal mobility disable to immobilisation: `4 / 4 = 100.00%`.

Per-match distributions are shown as `events in a match: number of matches`:

| Stage                          | Distribution                                                                                  | Min / median / mean / max |
| ------------------------------ | --------------------------------------------------------------------------------------------- | ------------------------- |
| Successful attacks             | `6:1, 10:2, 11:2, 12:11, 13:5, 14:10, 15:6, 16:11, 17:7, 18:10, 19:7, 20:2, 21:3, 22:2, 25:1` | 6 / 16 / 15.69 / 25       |
| Qualifying hits and selections | `0:4, 1:28, 2:20, 3:18, 4:8, 5:2`                                                             | 0 / 2 / 2.05 / 5          |
| Resistances                    | `0:30, 1:36, 2:14`                                                                            | 0 / 1 / 0.80 / 2          |
| Healthy-to-damaged             | `0:14, 1:52, 2:13, 3:1`                                                                       | 0 / 1 / 1.01 / 3          |
| Damaged-to-disabled            | `0:62, 1:17, 2:1`                                                                             | 0 / 0 / 0.24 / 2          |
| Mobility disables              | `0:76, 1:4`                                                                                   | 0 / 0 / 0.05 / 1          |
| Weapon disables                | `0:65, 1:15`                                                                                  | 0 / 0 / 0.19 / 1          |
| Utility disables               | `0:80`                                                                                        | 0 / 0 / 0 / 0             |

Selection facts are complete for this run:

- mobility was selected 93 times and weapon 71 times; utility was never
  selected because its front-zone weight is zero;
- per match, mobility selections were
  `0:30, 1:20, 2:19, 3:9, 4:2`; weapon selections were
  `0:25, 1:39, 2:16`;
- 145 selections saw a healthy component: 64 were resisted mobility
  selections and 81 became damaged;
- 19 selections saw an already-damaged component and all 19 became disabled;
- there were 64 resisted mobility selections;
- no qualifying hit lacked an eligible component and no qualifying hit lacked
  a selection.

Component event rounds were:

- healthy-to-damaged:
  `1:2, 2:3, 3:5, 4:5, 5:5, 6:9, 7:7, 8:3, 9:2, 10:2, 11:1, 12:8, 13:3, 14:4, 15:6, 16:7, 17:2, 18:3, 19:2, 20:2`;
- resistance:
  `1:10, 2:3, 3:4, 4:7, 5:1, 6:8, 7:1, 8:2, 9:3, 10:1, 11:6, 12:6, 13:2, 14:3, 16:1, 17:3, 19:2, 20:1`;
- damaged-to-disabled:
  `6:1, 9:1, 10:3, 11:1, 12:3, 13:2, 14:1, 15:1, 16:1, 17:2, 19:2, 20:1`.

Four disables occurred on their match's last round. All four were mobility
disables and caused the four immobilisation results, so zero recorded disables
are provably too late to affect the result. The stream can identify a
non-mobility disable after the final attack at the cap, but it cannot prove a
broader causal claim such as whether an earlier weapon disable changed the
eventual judge decision without a counterfactual simulation. No such final-cap
non-mobility disable occurred.

### 22.3 Reinforced-drive effect

| Guard fact                               | Count |
| ---------------------------------------- | ----: |
| Guards available at match start          |   160 |
| Guards spent                             |    64 |
| Guards lost through a utility transition |     0 |
| Guards still available at match end      |    96 |
| Matches spending no guard                |    30 |
| Matches spending one guard               |    36 |
| Matches spending both guards             |    14 |
| Qualifying mobility selections blocked   |    64 |

Every resistance replaced what would otherwise have been a healthy-to-damaged
mobility transition, so 64 immediate mobility-damaged transitions were blocked.
From the persisted selection sequences, 64 fighters received at least one
mobility selection, 25 received at least two, and 4 received the three required
under reinforced drive.

If the same selections are replayed analytically with the guard removed, 21
additional fighters would reach mobility disabled and 19 additional matches
would acquire a mobility-disable outcome. Together with the four observed
outcomes, at most 23/80 (28.75%) matches would contain a mobility disable on the
persisted paths. That is not a guaranteed immobilisation rate: simultaneous
double disables and earlier match endings can change the method. The four
observed mobility disables would have happened 2, 5, 5, and 6 rounds earlier.
This is not a simulated no-utility benchmark because an earlier ending would
change later events and PRNG consumption.

The Bulwark mirror therefore tests the component lifecycle plus two defensive
utilities, not the component lifecycle alone. A fixed no-utility Bulwark mirror
is required as a separate lifecycle diagnostic. The already-valid
heavy/tracks/ram/`none` configuration in the simulation-batch fixtures can be
the basis; no public opponent is needed.

### 22.4 Structural-destruction feasibility

Both fighters start at 150 integrity. Across all 1,255 successful attacks:

- raw damage was 12 minimum, 19 median, 19.253 mean, and 25 maximum;
- effective integrity damage was exactly 1 on all 1,255 hits;
- per-fighter total integrity damage was 3 minimum, 8 median, 7.844 mean, and
  14 maximum;
- final integrity was 136 minimum, 142 median, 142.156 mean, and 147 maximum.

No match had either fighter within 10, 25, or 50 integrity of destruction. With
at most one attack per fighter per round, even 20 successful maximum-raw-damage
hits deal only 20 integrity damage to a Bulwark: `25 - 60 * 0.5` is still below
the one-damage clamp. The pairing can therefore deal at most 20 damage to each
fighter, or 40 combined, within 20 rounds.

Structural destruction is mathematically impossible in this fixture under the
frozen damage, armour, build, policy, and round cap. It is not merely
statistically unlikely. The minimum-one-damage clamp dominates 100% of
successful hits. The `structural destruction >= 10%` gate cannot be repaired by
component qualification tuning.

### 22.5 Round cap and judges

Match-ending rounds were `10:1, 14:1, 19:1, 20:77`. Thus 77/80 (96.25%) reached
round 20. Of those, 76 ended with judges and one ended by immobilisation; the
other three immobilisations occurred in rounds 10, 14, and 19.

The following categories overlap but isolate the mechanisms:

- 52 matches had fewer than three total qualifying hits, the absolute minimum
  needed to disable one guarded mobility component;
- 48 matches produced at least one damaged component but no disabled component;
- 50 matches spent at least one guard and therefore had lifecycle progression
  delayed;
- 55 matches damaged a weapon, and 53 of those had a later successful hit by
  that fighter;
- damaged weapons made 205 successful hits in later rounds and none qualified;
  integrity damage nevertheless remained one because the minimum clamp was
  already dominant;
- all 80 matches were structurally unable to remove 150 integrity within the
  cap;
- zero terminal disables were provably too late to affect the result.

Judges must be below 45%, so at most 35 of 80 matches may go to judges. With
destruction impossible, 41 currently judged matches would need a new
match-ending mobility disable. This would raise immobilisation from 4 to 45
matches (56.25%), inside the 40%-75% range. The immobilisation lower bound alone
would require 28 additional matches.

Qualification-only tuning cannot reach the judge target safely. The bounded
model in the next section estimates about 8.2 qualifying hits per match are
needed for 56% immobilisation, but that produces about 93% terminal-disable
incidence and violates the `< 85%` gate. First-round immobilisation remains
structurally zero in this mirror because each fighter can receive at most one
component selection in round one and no healthy-to-disabled transition exists.
The limiting conflict is renewed terminal-component dominance, not the
first-round gate.

### 22.6 Bounded qualification-incidence sensitivity

This analytical model treats qualifying hits per match as Poisson with mean
`lambda`. Front hits are independently split across the two target fighters and
the two selectable components, giving each target/component stream mean
`lambda / 4`. Mobility needs three selections (resisted, damaged, disabled);
weapon needs two (damaged, disabled). The model does not rerun combat, model
state-dependent weight renormalisation, or change constants.

It is well calibrated at the current incidence: for `lambda = 2`, it estimates
0.79 resistances, 0.97 damaged transitions, 0.21 terminal disables, 2.86%
immobilisation, and 19.59% terminal-disable incidence per match. Observed values
at 2.05 qualifications per match are 0.80, 1.01, 0.24, 5.00%, and 22.50%.

| Qualifying hits/match | Resistances/match | Damaged/match | Terminal disables/match | Mobility disables/match | Likely immobilisation | Any terminal disable | Any qualification |
| --------------------: | ----------------: | ------------: | ----------------------: | ----------------------: | --------------------: | -------------------: | ----------------: |
|                   2.0 |              0.79 |          0.97 |                    0.21 |                    0.03 |                 2.86% |               19.59% |            86.47% |
|                   3.0 |              1.06 |          1.40 |                    0.43 |                    0.08 |                 7.94% |               37.09% |            95.02% |
|                   4.0 |              1.26 |          1.79 |                    0.69 |                    0.16 |                15.42% |               54.21% |            98.17% |
|                   5.0 |              1.43 |          2.14 |                    0.97 |                    0.26 |                24.58% |               68.66% |            99.33% |

Even five qualifying hits per match does not reach the 40% immobilisation
floor or the judge gate, while almost every match already contains a lifecycle
event. Extending the same model only to locate the conflict gives about 8.2
qualifications per match for 56.02% immobilisation and 93.22% terminal-disable
incidence. No reasonable incidence in the bounded range satisfies all current
gates simultaneously. Because first-round immobilisation is structurally zero,
the growing risks are near-universal lifecycle incidence and terminal-disable
dominance.

### 22.7 Critical-rate separation

The observed critical rate was 907/1,255 (72.27%), close to the nominal 70%.
All 164 qualifying hits were critical-qualified. Only two were also
high-impact-qualified, and there were zero high-only qualifications. The
high-impact branch therefore added no qualifying hits in this fixture.

Component impact had a boundary cliff: 135 hits had impact 10, 126 had impact
11, 78 had impact 12, and 2 had impact 13. Holding the high threshold at 13,
lowering only the critical threshold from 11 to 10 would raise qualifications
from 164 to 259; raising it from 11 to 12 would lower them to 59. Moving both
thresholds down one point to 10/12 would produce 280 qualifications, a 70.73%
jump. This is strong one-point sensitivity caused by discrete damage and the
high critical rate.

The critical probability is frozen for 0.2B. Its interaction with discrete
impact thresholds should become a separate future ADR or balance task, not part
of C1 completion.

### 22.8 Gate classification

| Current hard gate          | Classification                  | Reason                                                                                                                   |
| -------------------------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| First-round immobilisation | Component-lifecycle gate        | Directly guards against healthy-to-disabled volatility; structurally zero under the accepted two-stage mirror lifecycle. |
| Overall immobilisation     | Opponent-fixture-dependent gate | Depends on component weights, utility, armour, policies, and pairing.                                                    |
| Terminal-disable incidence | Component-lifecycle gate        | Directly measures whether lifecycle terminals dominate matches.                                                          |
| Structural destruction     | Whole-combat-balance gate       | Controlled by integrity, armour absorption, weapon damage, attack cadence, and cap; impossible here.                     |
| Judges decisions           | Whole-combat-balance gate       | Remainder of all finish mechanics and the match cap.                                                                     |
| Draw rate                  | Opponent-fixture-dependent gate | Especially sensitive to an identical mirror and judge tie-break symmetry.                                                |
| Finish-method dominance    | Whole-combat-balance gate       | Couples destruction, immobilisation, judges, and cap mechanics.                                                          |
| Average rounds             | Whole-combat-balance gate       | Depends on every finish path and attack cadence.                                                                         |
| Maximum rounds             | Whole-combat-balance gate       | Primarily the engine cap and non-component finish paths.                                                                 |
| Round-cap incidence        | Opponent-fixture-dependent gate | Measures whether this build/policy pairing can finish under the global cap.                                              |

A component-lifecycle milestone must not fail solely because an unrelated
integrity finish is impossible. Option A, keeping the gates unchanged, is
rejected. Option C, changing only the fixture suite, still makes lifecycle
acceptance depend on whole-combat balance. Option B correctly separates scope,
but does not by itself expose guard interference or low-armour over-aggression.

Select **Option D: combined split and fixture suite**. Apply hard lifecycle gates
to fixed lifecycle fixtures and retain whole-combat finish-distribution metrics
as diagnostics until a later balance milestone evaluates a representative
suite.

### 22.9 Proposed 0.2B lifecycle acceptance and diagnostics

Proposed hard gates:

- first-round immobilisation remains below 13.2%;
- matches with any terminal disable remain below 85%;
- zero state transitions is failure and zero terminal disables is failure;
- no event may transition healthy directly to disabled;
- damaged mobility does not end a match and disabled mobility does;
- damaged mobility and weapon penalties are observable in deterministic facts
  or focused tests;
- reinforced-drive resistance occurs at least once but on fewer than 100% of
  qualifying mobility selections;
- in the front-zone Bulwark stress fixture, neither selectable component may
  exceed 85% of terminal disables once at least ten exist; broader component
  mix remains a pooled-suite diagnostic until multi-zone fixtures exist;
- historical v1/v2 replay compatibility and deterministic checksums pass;
- every transition is factually reconstructable without current constants or
  catalogue inference.

Provisional investigation bands, not hard gates:

| Diagnostic                               | Investigation band                         |              C1 Bulwark mirror |
| ---------------------------------------- | ------------------------------------------ | -----------------------------: |
| Qualifying hits/match                    | 1-5; 2-4 preferred                         |                           2.05 |
| Matches with any lifecycle event         | 50%-99%                                    |                         95.00% |
| Matches with a state transition          | 25%-95%                                    |                         82.50% |
| Healthy-to-damaged transitions/match     | 0.5-2.5                                    |                           1.01 |
| Damaged-to-disabled transitions/match    | 0.1-0.8                                    |                           0.24 |
| Resistance/qualifying mobility selection | 10%-75%                                    |                         68.82% |
| Terminal mix in the front stress fixture | each selectable category 15%-85%           | mobility 21.05%, weapon 78.95% |
| Immobilisation                           | 0%-35% in the guarded stress fixture       |                          5.00% |
| Average match length                     | 12-20 rounds in the guarded stress fixture |                          19.79 |

These bands identify null, universal, or sharply skewed behaviour. They are not
substitutes for later whole-combat finish targets.

### 22.10 Fixture strategy

| Fixture                          | Role in 0.2B                                       | Recommendation                                                                                                                                                                                       |
| -------------------------------- | -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Bulwark mirror                   | High-armour plus reinforced-drive stress           | Hard lifecycle acceptance fixture. Do not use its destruction or judge rate as a lifecycle gate.                                                                                                     |
| Bulwark without reinforced drive | High-armour progression without guard interference | Add as a benchmark-only fixture using the existing valid heavy/tracks/ram/`none` configuration; make its transition semantics hard after the fixture is frozen and keep its finish rates diagnostic. |
| Glass Cannon mirror              | Low-armour transition and over-aggression check    | Diagnostic fixture using the committed integration-test build and policy.                                                                                                                            |
| Role-swapped heavy versus light  | Armour differentiation and fairness                | Defer formal acceptance to Milestone 0.2D; it may be explored diagnostically only after a fixed benchmark fixture is documented.                                                                     |

Fixture expansion is required before a permanent constants decision, but no new
public opponent is required for 0.2B.

### 22.11 Decision

Supported statements:

- **A is partially supported:** C1 is conservative for match-ending mobility in
  a guarded Bulwark mirror, but the observed lifecycle is neither null nor
  universally dominant. This does not justify C2 because qualification tuning
  cannot repair the destruction gate and the judge target conflicts with the
  terminal-disable gate.
- **B is supported:** the Bulwark mirror is a stress fixture combining high
  armour with two defensive utilities and is unsuitable as the sole acceptance
  fixture.
- **C is supported:** structural destruction, judges, finish dominance, average
  rounds, and cap incidence require mechanics or balance inputs outside
  qualification-only 0.2B scope.

The required outcome is:

> **B. Candidate C1 is viable, but the 0.2B gates must be split or re-scoped
> before acceptance.**

C1 is retained pending revised gates and fixed diagnostic fixtures. It is not
permanently accepted or rejected. Another constant candidate is not justified
by this evidence. The next task is a documentation/benchmark-fixture task to
approve the split gates and freeze the no-utility and Glass Cannon diagnostics;
it must not combine critical-rate review or C2 tuning. Milestone 0.2B remains
incomplete.
