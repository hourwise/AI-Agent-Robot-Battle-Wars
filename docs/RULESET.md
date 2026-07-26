# Ruleset — Forge Arena v1

## Budget

- Total engineering budget: **100 points**.
- The server calculates all costs. The AI never reports cost.
- Unspent budget is permitted. No paid or player-provided advantage exists.

## Chassis

| ID       | Cost | Integrity | Base mass | Agility | Stability |
| -------- | ---: | --------: | --------: | ------: | --------: |
| `light`  |   15 |        60 |        10 |       9 |         4 |
| `medium` |   25 |       100 |        20 |       6 |         6 |
| `heavy`  |   40 |       150 |        35 |       3 |         9 |

## Mobility

| ID       | Cost | Speed | Traction | Turning | Stability modifier |
| -------- | ---: | ----: | -------: | ------: | -----------------: |
| `wheels` |   12 |     9 |        6 |       9 |                  0 |
| `tracks` |   20 |     5 |        9 |       5 |                  2 |
| `legs`   |   25 |     6 |        7 |       7 |                  1 |

## Weapons

| ID                   | Cost | Base damage | Accuracy | Cooldown | Trait                         |
| -------------------- | ---: | ----------: | -------: | -------: | ----------------------------- |
| `ram`                |   10 |          20 |       80 |        1 | scales with movement momentum |
| `hammer`             |   20 |          35 |       65 |        2 | strong top attacks            |
| `horizontal_spinner` |   30 |          50 |       55 |        3 | high knockback                |
| `grappler`           |   20 |          10 |       80 |        2 | control and reposition        |
| `flipper`            |   25 |          25 |       65 |        3 | overturn chance               |

## Utilities

| ID                 | Cost | Effect                               |
| ------------------ | ---: | ------------------------------------ |
| `none`             |    0 | no utility                           |
| `cooling`          |   10 | improved heat recovery               |
| `traction_boost`   |   10 | improved movement and ram resistance |
| `reinforced_drive` |   15 | reduced mobility-component damage    |

## Armour

The agent allocates integer armour points to five zones: front, left, right, rear, top.

### Cost formula

```
armourCost = ceil(totalArmourPoints / 10) * costPerTenPoints
```

Where `costPerTenPoints = 1`.

### Limits

- Each zone maximum: **60 points**
- Total armour maximum: **120 points**

### Armour behaviour

Armour is **static** in v0.1. It reduces incoming damage but does not degrade during a match.

---

## Arena

### Zones

The arena is a five-zone ring:

```
        north_edge
            |
west_edge - center - east_edge
            |
        south_edge
```

### Starting positions

- Fighter A: `south_edge`, facing `north`
- Fighter B: `north_edge`, facing `south`

Starting sides may be swapped using the match seed. The swap is recorded in the event log.

### Distance (derived from zones)

Distance is not stored independently. It is computed from the two fighters' zones:

| Relationship                              | Distance |
| ----------------------------------------- | -------- |
| Same zone                                 | `close`  |
| Center to any edge                        | `medium` |
| Opposing edges (north/south or east/west) | `far`    |
| Adjacent edges (e.g. north/east)          | `medium` |

---

## Combat

### Round structure

Rounds use simultaneous action selection with phased resolution:

1. **Policy evaluation:** Both fighters derive intended actions from their policy and current state.
2. **Movement resolution:** Movement resolves in speed order (faster fighter first). Positions and facing are locked.
3. **Attack calculation:** Both legal attacks are calculated from the same post-movement snapshot.
4. **Damage application:** Attack damage is applied simultaneously.
5. **Status resolution:** Component failures, overheating, recovery and victory conditions are evaluated.

### Maximum rounds

20 rounds. If no victory condition is met, judges decide.

---

## Movement

Each round, a fighter may:

- **Advance:** Move one zone toward the opponent (if possible).
- **Retreat:** Move one zone away from the opponent (if possible).
- **Circle left / Circle right:** Rotate facing while staying in the same zone.
- **Hold:** Stay in place.

### Movement constraints

- A fighter at an edge cannot advance beyond the arena boundary.
- A fighter at center can move to any edge.
- A fighter at an edge can move to center or to an adjacent edge.
- Opposing edges are not directly adjacent.

### Momentum

A fighter that advances during the current round gains `movementMomentum = 1`. A fighter that holds, retreats or circles gains `movementMomentum = 0`. This affects ram damage.

---

## Attacks

### Hit chance

```
hitChance = (weaponAccuracy / 100) * BASE_HIT_CHANCE * rangeModifier
```

Range modifiers:

| Distance | Modifier |
| -------- | -------- |
| close    | 1.0      |
| medium   | 0.8      |
| far      | 0.5      |

### Hit zone determination

The attacker's policy specifies a `primaryTarget` zone (front, rear, left, right, top). The hit lands on the primary target zone **if that zone is exposed** to the attacker based on relative facing. Otherwise it falls to `secondaryTarget`. If neither is exposed, it defaults to `front`.

A zone is exposed if the defender is facing toward the attacker or the zone is a side facing that the attacker can reach from their current position.

### Raw damage

```
rawDamage = weaponBaseDamage * (1 + randomVariance)
```

Where `randomVariance` is in the range `[-DAMAGE_VARIANCE, +DAMAGE_VARIANCE]`.

### Armour absorption

Each armour point on the hit zone absorbs `ARMOUR_ABSORPTION_FACTOR` damage:

```
absorbedDamage = armourZone * ARMOUR_ABSORPTION_FACTOR
effectiveDamage = max(1, rawDamage - absorbedDamage)
```

Minimum 1 damage on any successful damaging hit.

### Critical hits

A hit qualifies for a component-damage roll when:

```
rawDamage * rng.next() > CRITICAL_HIT_THRESHOLD
```

Normal hits deal integrity damage only. Critical hits additionally roll for component damage.

---

## Weapon traits

### Ram — momentum scaling

```
ramMultiplier = min(1.5, 1 + movementMomentum / 20)
effectiveDamage = rawDamage * ramMultiplier
```

A stationary or already-close ram attack receives no momentum bonus (`movementMomentum = 0`).

### Hammer — top attacks

- Hammer attacks preferentially target **top armour**.
- Against an **overturned** target: +20% accuracy, +15% damage.

### Horizontal Spinner — knockback

- **50% base knockback chance** (modified by stability).
- On knockback: target is moved one valid zone away from the attacker.
- If no valid retreat zone exists, the target holds position.

### Grappler — control and reposition

On a successful grapple:

1. Deal 10 base damage (subject to variance and armour).
2. **Stability check:** `grappleStrength = weaponAccuracy / 100 * attackerAgility`. Defender passes if `defenderStability > roll * grappleStrength`.
3. On success: rotate target to expose a side or rear facing.
4. Optionally pull target from `medium` to `close` if zone relationship permits.

### Flipper — overturn

On a successful flip:

1. **Overturn check:** `flipOverturnChance = FLIPPER_BASE_CHANCE * (attackerPower / defenderStability)`. Capped at `MAX_OVERTURN_CHANCE`.
2. On success: target gains `overturned` condition.

An overturned fighter:

- Cannot attack normally.
- Must attempt recovery (one round) or use an allowed overturned action.
- Takes **+20% accuracy** and **+15% damage** from hammer attacks.
- Has **reduced evasion** (effective accuracy halved for incoming attacks).

---

## Component damage

### Trigger

Component damage is only rolled on **critical hits** (see Critical hits above).

### Zone weights

| Hit zone   | Mobility | Weapon | Utility |
| ---------- | -------: | -----: | ------: |
| Front      |      50% |    50% |      0% |
| Rear       |      70% |     0% |     30% |
| Left/right |      40% |    20% |     40% |
| Top        |      30% |    30% |     40% |

### Rules

- If the selected component is already disabled or does not exist (e.g. `utility: none`), no redirect occurs. The critical hit deals integrity damage only.
- A component can only be damaged once. It is either working or disabled.
- **Mobility disabled** → fighter gains `immobilised` condition.
- **Weapon disabled** → weapon cannot fire (all attacks fail).
- **Utility disabled** → utility has no effect.

---

## Heat and energy

### Starting values

- Energy: 100
- Heat: 0

### Per-round changes

- **Energy regen:** `min(100, energy + ENERGY_REGEN_PER_ROUND)`
- **Heat dissipation:** `max(0, heat - HEAT_DISSIPATION_PER_ROUND)`
- **Attack cost:** `energy -= ATTACK_ENERGY_COST`, `heat += ATTACK_HEAT_GAIN`
- **Defend cost:** `heat += DEFEND_HEAT_GAIN`

### Cooling utility

With `cooling` utility: `heat dissipation += COOLING_BONUS`.

### Energy insufficient

If `energy < ATTACK_ENERGY_COST` when attack is attempted → forced defend.

### Overheating

When `heat >= MAX_HEAT`:

- Fighter gains `overheated` condition.
- Cannot attack during its next action.
- Must defend or recover.
- Heat is reduced by `OVERHEAT_RECOVERY_AMOUNT`.
- Explicit overheat and recovery events are emitted.

---

## Victory conditions

Checked after each round, in order:

1. **Integrity zero** → opponent wins by destruction.
2. **Immobilised** (mobility component disabled) → opponent wins by immobilisation.
3. **Round limit reached** (20 rounds) → judges' decision.

### Mutual destruction

If both fighters reach integrity zero in the same round → judges decide.

### Judges' decision

Each category is normalised to a 0–100 range before weighting:

| Category             | Weight | Normalisation                                  |
| -------------------- | -----: | ---------------------------------------------- |
| Damage inflicted     |      3 | `min(100, damage / MAX_EXPECTED_DAMAGE * 100)` |
| Mobility remaining   |      2 | `speed * 10` (0–90, capped at 100)             |
| Weapon functionality |      2 | 100 if functional, 0 if disabled               |
| Aggression           |      1 | `roundsAttacked / roundsAvailable * 100`       |
| Integrity remaining  |      2 | `integrity / maxIntegrity * 100`               |

```
score = (damageNormalised * 3) + (mobilityNormalised * 2) + (weaponNormalised * 2)
      + (aggressionNormalised * 1) + (integrityNormalised * 2)
```

### Tie-break order

1. Greater remaining mobility.
2. Functional primary weapon.
3. Greater remaining integrity.
4. More damage inflicted.
5. Seeded deterministic tie-break as final fallback.

---

## Event format

Every meaningful state transition produces a typed event. Events are append-only during a match. No rendered commentary appears in authoritative event data.

See `docs/EVENT_FORMAT.md` for the full event reference.
