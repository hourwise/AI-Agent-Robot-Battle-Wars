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

| ID                   | Cost | Base damage | Accuracy | Cooldown | Trait                  |
| -------------------- | ---: | ----------: | -------: | -------: | ---------------------- |
| `ram`                |   10 |          20 |       80 |        1 | scales with speed      |
| `hammer`             |   20 |          35 |       65 |        2 | strong top attacks     |
| `horizontal_spinner` |   30 |          50 |       55 |        3 | high knockback         |
| `grappler`           |   20 |          10 |       80 |        2 | control and reposition |
| `flipper`            |   25 |          25 |       65 |        3 | overturn chance        |

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

Examples:

- 0 armour points = 0 budget points
- 1 armour point = 1 budget point
- 10 armour points = 1 budget point
- 11 armour points = 2 budget points
- 120 armour points = 12 budget points

### Limits

- Each zone maximum: **60 points**
- Total armour maximum: **120 points**

## Cost calculation order

1. Look up chassis cost from catalogue
2. Look up mobility cost from catalogue
3. Look up weapon cost from catalogue
4. Look up utility cost from catalogue
5. Sum armour points across all zones
6. Compute armour cost using the formula above
7. Sum all five costs
8. Compare total against budget

The application performs this calculation. The AI never reports its own cost.
