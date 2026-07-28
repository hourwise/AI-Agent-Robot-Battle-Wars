# ADR-002 Amendment: Component Lifecycle Qualification — Candidate Set B Planning

**Status**: draft (tuning not yet applied)
**Date**: 2026-07-28
**Amends**: ADR-002 (Component Damage Lifecycle)
**Author**: Copilot / tuning analysis

## Context

Candidate set A (`CRITICAL=10`, `HIGH_DAMAGE=35`) was benchmarked with 80 Bulwark-mirror matches and produced **zero component transitions**. The benchmark correctly reported this through the v2 metrics (see `synthetic-benchmark-v2-transitions.test.ts`).

## Diagnosis

The failure is not caused by a bug in the lifecycle logic. It is a **mechanical interaction** between two rules:

| Rule | Value |
|---|---|
| Bulwark front armour | 60 |
| Ram raw damage range | ~16–24 |
| Armour absorption factor | 0.5 → absorbs 30 |
| Effective damage (post-armour) | `max(1, raw − absorbed) ≥ 1` |
| Minimum damage constant | 1 |

**For all front hits**, effective damage collapses to 1:

```
weak hit   (raw ≈ 16): max(1, 16 − 30) = 1
strong hit (raw ≈ 24): max(1, 24 − 30) = 1
critical hit:         max(1, crit_raw − 30) = 1
```

Therefore:

- `1 < 10` → no critical qualification
- `1 < 35` → no high-damage qualification
- `1 < 10` → no reinforced-drive guard consumption

Lowering thresholds (e.g., `5/15`) would **still produce zero transitions** because `1` remains below both thresholds. Setting the critical threshold to `1` would make essentially every critical hit qualify, likely recreating the original over-dominance in a two-stage form.

## Confirmed Behaviour

The lifecycle code correctly:

1. Computes `effectiveDamage` from post-armour integrity damage
2. Compares it against qualification thresholds
3. Produces the **correct null result** for high-armour matchups

The benchmark v2 metrics correctly distinguish between "no transitions" (null result) and "undetected transitions" (would be a bug). This is confirmed by the synthetic glass-cannon test, which **does** produce transitions when effective damage exceeds thresholds.

## Decision Required

Lowering numeric thresholds (`5/15`) cannot solve this — `1` is below any threshold > 1. We must decide **what signal drives component qualification** before choosing numbers.

The following options are presented for the next tuning ADR. None has been selected yet.

### Option 1: Raw-damage qualification + post-armour integrity

```
component qualification uses raw damage (pre-armour)
integrity damage continues to use effective damage (post-armour)
```

**Pros**: Simple. Differentiable signal (16–24 range vs 1).  
**Cons**: Heavy armour does not protect components at all. A Bulwark with 60 front armour would see exactly the same component transitions as a Glass Cannon. This violates the design intent of armour protecting internals.

### Option 2: Separate component-impact calculation

```
componentImpact = rawDamage − armour × COMPONENT_ARMOUR_FACTOR
where COMPONENT_ARMOUR_FACTOR < ARMOUR_ABSORPTION_FACTOR (e.g., 0.3 vs 0.5)
```

Example with `COMPONENT_ARMOUR_FACTOR = 0.3`:

| Scenario | Raw | Armour | Component Impact |
|---|---|---|---|
| Bulwark front hit | 20 | 60 | max(1, 20 − 18) = 2 |
| Light front hit | 20 | 5 | max(1, 20 − 1.5) = 18.5 |

**Pros**: Armour still protects components, but less aggressively than for integrity. Produces differentiable signal.  
**Cons**: New constant to tune. Two damage numbers (integrity vs component) could confuse readers.

### Option 3: Relative penetration ratio

```
qualifyingRatio = rawDamage / armourProtection
qualifies if qualifyingRatio ≥ PENETRATION_THRESHOLD (e.g., 0.33)
```

**Pros**: Scales naturally with armour — a 60-damage hit on 60 armour and a 10-damage hit on 10 armour are treated equally.  
**Cons**: Harder to explain. Small absolute damage on weak armour qualifies (possibly too many transitions). Requires careful threshold tuning.

### Option 4: Critical accumulation (not recommended)

```
qualifying critical hit adds one component trauma point
two trauma points on same component → transition
```

**Pros**: Gradual damage, rewards sustained pressure.  
**Cons**: Hidden state not reflected in events. Conflicts with simple lifecycle ADR. Complexity cost.

## Recommendation

**Option 2 (separate component-impact calculation)** is the leading direction:

1. It preserves the design intent that armour protects components
2. It produces a differentiable signal where post-armour effective damage does not
3. It is still deterministic and understandable
4. It keeps the clean `healthy → damaged → disabled` lifecycle without hidden accumulation state

If Option 2 is selected, the next tuning ADR should specify:

- `COMPONENT_ARMOUR_FACTOR` (recommended starting point: 0.30)
- Revised qualification thresholds for candidate set B
- Benchmark acceptance gates for candidate set B

## Rejected Alternatives

- **Lowering thresholds alone (5/15)**: Cannot work — effective damage is constant at 1 for high-armour matchups.
- **Setting critical threshold to 1**: Would make every critical hit qualify, likely causing over-dominance similar to the pre-0.2B binary model.
- **Raw-damage-only qualification (Option 1)**: Removes armour's protective role for components.
- **Critical accumulation (Option 4)**: Too complex, conflicts with accepted simple lifecycle design.

## References

- [ADR-002: Component Damage Lifecycle](./ADR-002-component-damage-lifecycle.md) (or equivalent)
- [Milestone 3A — Deterministic ASCII](../Milestone%203A%20—%20Deterministic%20ASCII.md)
- `src/simulator/component-state.ts` — `checkComponentQualification()`
- `src/simulator/constants.ts` — current thresholds (candidate set A)
- `tests/integration/benchmark-v2-transitions.test.ts` — synthetic benchmark confirming detection
