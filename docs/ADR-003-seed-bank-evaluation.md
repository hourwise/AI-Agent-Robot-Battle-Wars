# ADR-003: Deterministic Seed-Bank Evaluation Protocol

**Status:** Accepted
**Date:** 2026-07-27
**Prototype:** 0.2A

## Decision Questions

| Question                        | Resolution                                                                                                                                                              |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Seed-bank size                  | 100 seeds total                                                                                                                                                         |
| Seed-generation algorithm       | Fixed master seed fed through the simulator's `SeededRandom` to produce unique 32-bit integers                                                                          |
| Duplicate prevention            | Generation loop discards collisions; fixture validated for uniqueness                                                                                                   |
| Fixture versioning              | `bankId: "prototype-0.2-baseline-v1"`; new generator versions create new bank IDs                                                                                       |
| Development vs held-out split   | 80 development / 20 held-out                                                                                                                                            |
| Ordering guarantees             | Seeds stored in generation order; stable within a fixture version                                                                                                       |
| Benchmark pairing identity      | Defined by canonical JSON fingerprints of build + policy                                                                                                                |
| Report schema                   | Versioned schema with per-match condensed outcomes + aggregate metrics                                                                                                  |
| Statistical metrics             | Win rates with Wilson 95% CI; mean/median rounds; integrity differentials; result-method rates; component-disable counts; critical-hit counts; first-round finish rates |
| Reproducibility                 | Byte-for-byte deterministic output for same inputs (builds, policies, seed bank, simulator version)                                                                     |
| Treatment of failed simulations | Simulations should not fail under frozen 0.1.2; any failure is reported as an error                                                                                     |
| Held-out seeds in AI context    | **Never.** Held-out seed results must not appear in model review or redesign prompts                                                                                    |

## Seed Bank

```
schemaVersion: "1"
bankId: "prototype-0.2-baseline-v1"
generatorVersion: "seed-bank-v1"
simulatorVersion: "0.1.2"
developmentSeeds: 80 unique 32-bit integers
heldOutSeeds: 20 unique 32-bit integers
```

### Generation Algorithm

1. Start with master seed `20260727` (ISO date of ADR acceptance).
2. Create a `SeededRandom` instance with the master seed.
3. Generate candidates by calling `rng.int(1, 2147483647)` repeatedly.
4. Discard duplicates until 100 unique values are collected.
5. Sort into deterministic order.
6. Assign first 80 to development, last 20 to held-out.
7. Commit the fixture. It becomes authoritative.

### Rationale for 80/20

- 80 development seeds give reasonable statistical power for win-rate estimation (Wilson 95% CI width ~±11% at 50% win rate).
- 20 held-out seeds are sufficient to detect large regressions (>25 percentage points) while keeping them genuinely unseen by the AI.
- 100 total is practical to run in seconds with the frozen 0.1.2 simulator.

## Standard Benchmark

For a pairing of design X (build + policy) vs design Y (build + policy):

- **100 simulations** if X === Y (mirror match, role-swap is redundant).
- **200 simulations** if X !== Y: 100 seeds × 2 role assignments (X as fighter_a, Y as fighter_b; then swapped).
- Role-swapped evaluation surfaces first-player advantage and ensures fairness.

For non-identical designs, the canonical benchmark is **role-swapped** (200 simulations). For mirror matches, 100 simulations suffice.

## Statistical Definitions

### Match Outcomes

| Metric         | Definition               |
| -------------- | ------------------------ |
| Matches        | Total simulations run    |
| Fighter A wins | `winner === "fighter_a"` |
| Fighter B wins | `winner === "fighter_b"` |
| Draws          | `winner === null`        |
| Win rate (A)   | `fighterAWins / matches` |
| Win rate (B)   | `fighterBWins / matches` |

### Duration

| Metric         | Definition                                     |
| -------------- | ---------------------------------------------- |
| Average rounds | Arithmetic mean of `rounds` across all matches |
| Median rounds  | Median of `rounds`                             |
| Min/max rounds | Minimum and maximum `rounds` observed          |

### Integrity

| Metric                         | Definition                               |
| ------------------------------ | ---------------------------------------- |
| Average final integrity (A)    | Mean of `finalStates.fighterA.integrity` |
| Average final integrity (B)    | Mean of `finalStates.fighterB.integrity` |
| Average integrity differential | Mean of `(integrityA - integrityB)`      |

### Finish Methods

| Metric                          | Definition                                                   |
| ------------------------------- | ------------------------------------------------------------ |
| Destruction rate                | Fraction of matches ending in `destruction`                  |
| Immobilisation rate             | Fraction of matches ending in `immobilisation`               |
| Judges-decision rate            | Fraction of matches ending in `judges`                       |
| First-round finish rate         | Fraction where `rounds === 1`                                |
| First-round immobilisation rate | Fraction where `rounds === 1 && method === "immobilisation"` |

### Component Disables

| Metric                   | Definition                                                         |
| ------------------------ | ------------------------------------------------------------------ |
| Matches with any disable | Fraction of matches containing ≥1 `component_disabled` event       |
| Mobility disables        | Total `component_disabled` events where `component === "mobility"` |
| Weapon disables          | Total `component_disabled` events where `component === "weapon"`   |
| Utility disables         | Total `component_disabled` events where `component === "utility"`  |

### Critical Hits

| Metric             | Definition                                            |
| ------------------ | ----------------------------------------------------- |
| Critical-hit count | Total `attack_hit` events where `isCritical === true` |
| Critical-hit rate  | Critical hits / total hits                            |

### Attack Statistics

| Metric        | Definition                      |
| ------------- | ------------------------------- |
| Total attacks | Total `attack_attempted` events |
| Total hits    | Total `attack_hit` events       |
| Hit rate      | Total hits / total attacks      |

### Confidence Intervals

Wilson 95% confidence interval for win rates:

```
p = wins / matches
z = 1.96
denom = 1 + z²/n
centre = (p + z²/(2n)) / denom
margin = z * sqrt((p*(1-p) + z²/(4n)) / n) / denom
lower = centre - margin
upper = centre + margin
```

Clamped to [0, 1].

## Held-Out Policy

- Held-out seed results are never included in AI review or redesign prompt context.
- Application code must check the seed partition before exposing results to AI agents.
- A violation of this policy is a bug, not a security issue — the seeds are not cryptographically secret.

## Future Changes

- Increasing seed-bank size requires a new bank ID and fixture.
- Changing the generation algorithm requires a new `generatorVersion`.
- Benchmark protocol changes require a new ADR or ADR amendment.
