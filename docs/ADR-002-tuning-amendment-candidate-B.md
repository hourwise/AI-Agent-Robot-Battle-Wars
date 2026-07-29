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
