# Prototype 0.2 Experimental Plan

This is an evidence-led plan, not a feature wishlist. Every proposed change is driven by a specific limitation observed in Prototype 0.1.

---

## 1. Research Questions

### Positioning

Prototype 0.1 proved the AI can adapt its **build** but could not test whether it can exploit positional weaknesses through tactical movement.

Questions:

- Can the simulator represent and reward lateral movement, genuine flank attempts, rear positioning, disengagement, pursuit, and facing advantage?
- Can a fighter meaningfully escape close range once both fighters occupy the same zone?
- Does the AI's policy system have enough expressive range to request positional manoeuvres?

### Component-Disable Volatility

Every AI victory in Prototype 0.1 was decided by a component disable. Match 2 ended in Round 1 due to a critical mobility disable. We cannot separate design quality from critical-hit luck.

Questions:

- Are component disables too frequent relative to structural destruction?
- Are they too decisive — can a single roll overwhelm design quality?
- Should disables require prior component damage rather than occurring on the first damaging hit?
- Should `reinforced_drive` provide broader protection, or should other utilities offer analogous defence?

### Generalisation

Prototype 0.1 tested against a single opponent. We do not know whether adaptation generalises.

Questions:

- Can an adaptive design improve against multiple fixed opponents with different weapons, chassis, and tactical archetypes?
- Does adaptation against one opponent harm performance against another?
- Can the system detect opponent-specific overfitting?

### Statistical Confidence

Four matches cannot distinguish genuine improvement from favourable seeds.

Questions:

- Can the system run batch evaluations against a fixed seed bank?
- What sample size is needed to detect a meaningful win-rate change?
- Can we measure held-out seed performance to detect overfitting?
- What threshold separates genuine improvement from noise?

---

## 2. Version Boundaries

Prototype 0.1 must remain replayable. Any 0.2 change that affects authoritative outcomes requires a version bump in the appropriate component:

| Change affects                                     | Version to bump             |
| -------------------------------------------------- | --------------------------- |
| Simulator logic (movement, damage, hit zones)      | `SIMULATOR_VERSION`         |
| Game rules (budget, armour cost, weapon stats)     | `RULESET_VERSION`           |
| Available components                               | `CATALOGUE_VERSION`         |
| Policy schema (new fields, changed constraints)    | Policy prompt version       |
| Event format (new event types, changed data shape) | Event schema version        |
| Match/series record shape                          | Match/series schema version |

Old Prototype 0.1 matches must replay under their original versions. Events must not be silently reinterpreted under new rules.

---

## 3. Positioning Models

Three candidate approaches. All must preserve deterministic resolution, ASCII rendering compatibility, and replay clarity.

### Option A — Expanded Discrete Arena (3×3 grid)

```
north_west | north | north_east
west       | centre | east
south_west | south | south_east
```

**Evaluation:**

| Criterion                 | Assessment                                                                                                           |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Implementation complexity | Medium — 9 zones, richer adjacency graph, pathfinding for advance/retreat                                            |
| Pathfinding requirements  | Low — still discrete; BFS or lookup table suffices                                                                   |
| Replay clarity            | Good — ASCII grid renders naturally                                                                                  |
| Tactical expressiveness   | Good — lateral movement, corner positioning, multiple approach paths                                                 |
| Deterministic resolution  | Straightforward — same zone-based model                                                                              |
| ASCII rendering           | Good — natural 3×3 grid with centre highlight                                                                        |
| Migration cost            | Medium — all zone references, movement logic, facing helpers, exposure checks, arena snapshot renderer need updating |

### Option B — Range + Relative Bearing

Track continuous concepts without discrete zones:

```
range: close | medium | far
bearing: front | left | right | rear
positional advantage: none | flanking | rear
```

Movement actions change range and bearing relative to the opponent. Facing is explicit.

**Evaluation:**

| Criterion                 | Assessment                                                                  |
| ------------------------- | --------------------------------------------------------------------------- |
| Implementation complexity | Low-medium — replace zone graph with range/bearing transitions              |
| Pathfinding requirements  | None — movement is relative, not absolute                                   |
| Replay clarity            | Medium — abstract; harder to visualise than a grid                          |
| Tactical expressiveness   | Medium — bearing captures relative position well; loses arena geometry feel |
| Deterministic resolution  | Straightforward — state-machine transitions                                 |
| ASCII rendering           | Difficult — no natural spatial layout; would need abstract position diagram |
| Migration cost            | High — fundamental model change; all zone-dependent code rewrites           |

### Option C — Abstract Positional States

```
engaged        — fighters in contact, front-on
flanking       — attacker has side advantage
rear-advantage — attacker behind defender
disengaged     — fighters separated
pinned         — defender cannot retreat
```

Transitions governed by speed, facing, and movement choices.

**Evaluation:**

| Criterion                 | Assessment                                                              |
| ------------------------- | ----------------------------------------------------------------------- |
| Implementation complexity | Low — few states, clear transitions                                     |
| Pathfinding requirements  | None                                                                    |
| Replay clarity            | Low — visually abstract; hard to narrate spatially                      |
| Tactical expressiveness   | Low — too coarse; flattening all positions into 4–5 states loses nuance |
| Deterministic resolution  | Straightforward                                                         |
| ASCII rendering           | Difficult — no meaningful spatial layout                                |
| Migration cost            | Medium                                                                  |

### Recommendation: Option A (3×3 grid)

The 3×3 grid preserves the spirit of the current arena while adding the missing lateral dimension. It enables true flanking, corner positioning, and multiple approach paths. ASCII rendering is natural. Migration cost is moderate but contained — zone references, movement helpers, facing/exposure checks, and the arena snapshot renderer are the primary touch points.

Options B and C are preserved as fallbacks if the 3×3 grid proves too complex to balance or too expensive to render in ASCII.

---

## 4. Volatility Study

Before changing critical-hit or component-disable rules, we must measure current behaviour.

### Benchmark Protocol

Run each design pairing against a **fixed seed bank of 100+ predefined seeds**. The seed bank must be versioned and committed so results are reproducible.

Measure for each pairing:

| Metric                          | Purpose                |
| ------------------------------- | ---------------------- |
| Win rate                        | Primary outcome        |
| Average rounds                  | Match duration         |
| Integrity differential          | Damage balance         |
| Component-disable rate          | Volatility indicator   |
| First-round immobilisation rate | Early-luck indicator   |
| Critical-hit rate               | Raw critical frequency |
| Damage dealt per fighter        | Offence balance        |
| Outcome variance across seeds   | Seed sensitivity       |
| Winner integrity distribution   | Decisiveness measure   |

### Candidate Rule Changes

Do not select a rule merely because it reduces randomness. Preserve combat drama while reducing single-roll dominance.

| Proposal                                                                                                                     | Rationale                                                | Risk                                                 |
| ---------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- | ---------------------------------------------------- |
| Component disable requires prior component damage ("damaged" state before "disabled")                                        | No first-hit disable; damage must accumulate             | Adds state complexity                                |
| Disable probability scales with effective damage dealt in that hit                                                           | Big hits more likely to disable; chip damage less so     | May favour high-damage weapons further               |
| Armour zone value influences component exposure (e.g., 0 armour = higher disable chance)                                     | Rewards armour investment                                | May already be partially true via damage calculation |
| Critical hits always deal damage; component disable is a separate subsequent roll                                            | Separates "big hit" from "permanent consequence"         | Adds a roll; slightly more complex                   |
| `reinforced_drive` reduces mobility-disable probability by a fixed factor                                                    | Existing utility becomes more meaningful                 | May become mandatory pick                            |
| First-round disable protection (cannot disable in round 1)                                                                   | Eliminates most egregious luck case                      | Feels arbitrary; masks design flaws                  |
| Repairable "damaged" state: damaged component functions at reduced effectiveness for 1 round, then recovers unless hit again | Adds tactical depth; disables require sustained pressure | Complexity; unclear UI/replay impact                 |

### Recommended Evaluation Order

1. Run benchmark on current rules against the seed bank. Establish baseline.
2. Prototype "damaged before disabled" as the smallest change that directly addresses first-hit disables.
3. Re-run benchmark. Compare distributions.
4. If insufficient, add scaling with effective damage.
5. Evaluate `reinforced_drive` interaction last (utility balance is secondary to core mechanic).

---

## 5. Opponent Archetypes

A small deterministic opponent suite. Every opponent must have a canonical build, canonical policy, intended strength, intended weakness, versioned fixture, and no model API dependency.

| ID           | Name        | Chassis | Weapon             | Strength                             | Weakness                       | Policy                           |
| ------------ | ----------- | ------- | ------------------ | ------------------------------------ | ------------------------------ | -------------------------------- |
| `bulwark`    | The Bulwark | heavy   | ram                | Frontal assault durability           | Zero rear armour, slow turning | rush, close, 85% aggression      |
| `skirmisher` | Iron Cicada | light   | grappler           | Speed, flanking, rear targeting      | Low integrity, fragile         | flank, close, 70% aggression     |
| `crusher`    | Hammerfall  | heavy   | hammer             | Top-armour damage, overturn threat   | Slow, cooldown-reliant         | cautious, medium, 55% aggression |
| `spinner`    | Whirlwind   | medium  | horizontal_spinner | High knockback, burst damage         | High heat, long cooldown       | rush, close, 75% aggression      |
| `controller` | Lockdown    | medium  | grappler           | Control, reposition, forced exposure | Low base damage                | cautious, close, 60% aggression  |
| `generalist` | Sentinel    | medium  | flipper            | Balanced stats, overturn threat      | No extreme specialisation      | hold, medium, 65% aggression     |

Each archetype should be stored as a versioned fixture (e.g., `data/opponents/bulwark.v1.json`) with its canonical build and policy. The existing Bulwark scripted agent should be adapted to load from the fixture rather than hardcoded.

---

## 6. Evaluation Protocol

For each AI design generation:

1. Evaluate the original design against the seed bank (100+ fixed seeds) against **each** opponent archetype.
2. Generate grounded review context from the aggregate results (not a single match).
3. Redesign once.
4. Evaluate the redesign against the **same** seed bank (training seeds).
5. Evaluate the redesign against **held-out** seeds (different fixed bank, never shown to the AI).
6. Compare statistically: win-rate change, integrity differential change, disable-rate change.
7. Record adaptation cost (API calls, tokens, USD).
8. Measure design diversity (is the AI converging on one dominant design?).
9. Detect opponent overfitting (does improvement against one opponent harm another?).

### Acceptance Criteria (Proposed)

A redesign counts as improved when:

- Minimum **+10 percentage-point** win-rate improvement on training seeds against at least one opponent.
- No greater than **5-point regression** on held-out seeds for any opponent.
- Improvement demonstrated against **at least two opponent archetypes**.
- Win-rate change exceeds the standard deviation of the baseline.

These thresholds are proposals to be reviewed after baseline data is collected. They may be adjusted if they prove too strict or too lenient.

### Statistical Notes

- 100 seeds per pairing give ~±10% confidence interval for win rate.
- Held-out seeds must be fixed and versioned — never regenerated.
- A single match (Prototype 0.1 style) is insufficient evidence of improvement.
- Design diversity should be tracked: if the AI always converges to heavy+spinner, the system may be rewarding a single dominant strategy rather than adaptation.

---

## 7. Implementation Milestones

### Milestone 0.2A — Benchmark Harness ✅ COMPLETED (2026-07-27)

**Scope:** Fixed seed bank, batch simulation runner, statistical report generator. No gameplay changes.

**Deliverables:**

- ADR-003: Deterministic Seed-Bank Evaluation Protocol (`docs/ADR-003-seed-bank-evaluation.md`)
- Seed fixture: `data/seeds/benchmark-100-v1.json` (80 dev / 20 held-out)
- Benchmark module: `src/bench/` (types, seed-bank, runner, metrics, report renderer)
- CLI: `npm run benchmark -- --partition development|held-out|all`
- Tests: `tests/unit/seed-bank.test.ts`, `tests/unit/benchmark.test.ts`

**Exclusions:** Arena changes, rule changes, new opponents, adaptation loop changes.

**Affected modules:** New `src/bench/` module; `src/app/run-benchmark.ts`.

**Schema implications:** New benchmark result schema.

**Version implications:** None — no gameplay changes.

**Tests:** Seed bank determinism, batch output consistency, statistical calculation correctness.

**Acceptance criteria:**

- 100 seeds stored in versioned fixture.
- Batch run completes all pairings without error.
- Statistical report includes all metrics from §4.
- Report is deterministic for same inputs.

**Rollback:** Remove `src/bench/` directory. No effect on gameplay.

---

### Milestone 0.2A.1 — Benchmark Correctness Hardening ✅ COMPLETED (2026-07-28)

**Scope:** Correctness hardening for the deterministic benchmark harness. The completed work fixes canonical mirror outcome accounting, role-slot metric calculation, and result checksum coverage without changing gameplay.

**Version implications:** None — simulator, ruleset, catalogue, and seed-bank fixture remain frozen.

---

### ADR-002 — Component Damage and Disable Lifecycle ✅ ACCEPTED (2026-07-28)

- Decision record: `docs/ADR-002-component-damage-lifecycle.md`
- Candidate threshold set A: `10` critical / `35` normal (benchmark-tuned, not permanent).
- The accepted 0.2B lifecycle implementation is complete in the current repository.
- Candidate Set A failed qualification in the Bulwark mirror benchmark: zero component state transitions.
- Candidate B1-B3 rejected analytically; Candidate C selected in `docs/ADR-002-tuning-amendment-candidate-B.md` (Accepted for Candidate C implementation; implementation not started).

---

### Milestone 0.2B — Component-State Refinement ⚠️ CANDIDATE C IMPLEMENTATION PENDING

**Scope:** Damaged vs disabled states, revised critical logic, simulator/ruleset version bump, benchmark comparison against 0.1 baseline.

**State:** Core `healthy → damaged → disabled` lifecycle, v2 match schema, replay, reporting, and benchmark measurement support are implemented. Candidate Set A and Candidate B1-B3 failed analytically. Candidate C is selected but not implemented.

**Completion gate:** Separate Candidate C implementation, development benchmark gates, and held-out confirmation remain outstanding. This milestone is not complete.

**Exclusions:** Positioning changes, new opponents.

**Affected modules:** `src/simulator/damage.ts`, `src/simulator/reducer.ts`, `src/simulator/types.ts`, `src/simulator/constants.ts`, `src/replay/` (new event types).

**Schema implications:** New event types for component damage, possible new conditions.

**Version implications:** `SIMULATOR_VERSION` → 0.2.0, `RULESET_VERSION` → 0.2.0.

**Tests:** Component lifecycle unit tests, regression against 0.1 seed bank (comparing distributions, not exact outcomes), benchmark report comparison.

**Acceptance criteria:**

- First-round disable rate reduced by ≥50% vs 0.1 baseline.
- Component disables still possible (game retains drama).
- No design wins ≥90% of matches against any opponent (balance check).
- All 0.1 matches remain replayable under their original versions.

**Rollback:** Restore 0.1 damage/component logic. Drop new event types or version-gate them.

---

### Milestone 0.2C — Positioning Model (3×3 Grid)

**Scope:** New arena representation, movement events, facing and rear advantage, replay updates, policy updates.

**Exclusions:** Opponent suite, evaluation protocol changes.

**Affected modules:** `src/simulator/types.ts` (zone enum), `src/simulator/movement.ts`, `src/simulator/damage.ts` (exposure), `src/simulator/actions.ts` (policy-driven movement), `src/replay/ascii/arena-snapshot-renderer.ts`, `src/replay/text-replay-renderer.ts`, `src/replay/ascii/state-reconstructor.ts`.

**Schema implications:** New zone values, possible new movement event fields.

**Version implications:** `SIMULATOR_VERSION` → 0.3.0.

**Tests:** Movement resolution for all 9 zones, exposure computation for all relative positions, ASCII grid rendering, policy action derivation with new movement options.

**Acceptance criteria:**

- Lateral movement (east/west edges) reaches centre or adjacent edges.
- Fighter can reach a position behind opponent in ≥3 moves from starting edge.
- ASCII grid renders all 9 zones clearly.
- Flank policy produces lateral movement when tactically appropriate.

**Rollback:** Restore 5-zone arena. Version-gate new zone values.

---

### Milestone 0.2D — Opponent Suite

**Scope:** Versioned deterministic archetypes, tournament runner, cross-opponent reports.

**Exclusions:** Adaptation evaluation, rule changes.

**Affected modules:** New `data/opponents/` fixtures, `src/agents/scripted/` (refactor Bulwark to load from fixture), new `src/app/run-tournament.ts`.

**Schema implications:** Opponent fixture schema.

**Version implications:** New fixture version field.

**Tests:** Each opponent produces deterministic behaviour; tournament runner produces correct cross-table; no opponent calls external API.

**Acceptance criteria:**

- 6 opponents available as versioned fixtures.
- Tournament runner evaluates one design against all 6 opponents.
- Cross-opponent report shows win/loss/draw per opponent.
- Bulwark behaviour unchanged from 0.1 (validated against canonical series).

**Rollback:** Remove new fixtures and tournament runner. Bulwark agent unchanged.

---

### Milestone 0.2E — Adaptation Evaluation

**Scope:** Baseline vs redesign comparison, held-out seeds, overfitting detection, confidence report.

**Exclusions:** New gameplay mechanics.

**Affected modules:** `src/bench/` (extended), `src/reports/` (adaptation report).

**Schema implications:** Adaptation evaluation report schema.

**Version implications:** None if no gameplay changes.

**Tests:** Held-out seed independence, overfitting detection correctness, statistical threshold validation.

**Acceptance criteria:**

- System can run full evaluation protocol from §6.
- Held-out seed results are never exposed to AI review context.
- Overfitting detection flags designs that improve on training but regress on held-out.
- Report includes confidence intervals for all metrics.

**Rollback:** Remove adaptation report module.

---

## 8. Architecture Decision Records (ADRs)

Decision questions to resolve before implementation. Recommended order reflects dependencies.

| #       | ADR                                | Question                                                                                                                                                                | Depends on                  |
| ------- | ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- |
| ADR-001 | Positioning representation         | Which arena model (3×3 grid, range+bearing, or abstract states)?                                                                                                        | Nothing                     |
| ADR-002 | Component damage lifecycle         | **Accepted:** healthy→damaged→disabled. Core 0.2B implementation complete. Candidate A and B1-B3 failed analytically; Candidate C selected, implementation not started. | Volatility benchmark (0.2A) |
| ADR-003 | Deterministic seed-bank evaluation | Fixed seeds, sample size, held-out protocol?                                                                                                                            | Nothing                     |
| ADR-004 | Multi-opponent fixture format      | How are opponent builds and policies stored and versioned?                                                                                                              | Nothing                     |
| ADR-005 | Simulator version compatibility    | How do old matches replay under new rules? Version-gating vs separate code paths?                                                                                       | ADR-001, ADR-002            |
| ADR-006 | Adaptation success metrics         | What thresholds define improvement? How is overfitting detected?                                                                                                        | ADR-003                     |

Recommended order: ADR-003 and ADR-004 can be resolved immediately (they are independent). ADR-001 should follow soon after. ADR-002's lifecycle and Candidate C qualification decision are accepted; Candidate C implementation and benchmark confirmation remain outstanding. ADR-005 depends on decisions made in ADR-001 and ADR-002. ADR-006 is last — it needs the evaluation protocol defined.

---

## Candidate C1 implementation status (2026-07-29)

Candidate C1 (`component-impact-c1`) is implemented with armour factor `0.20`, minimum impact `0`, critical threshold `11`, and high-impact threshold `13`. Qualification uses canonical raw damage and struck-zone armour before component selection. Facts are persisted in attack/component events, match metadata, replay/report output, and benchmark metadata.

The unchanged development partition produced 80 simulations, 1,255 successful hits, 164 qualifying hits, 81 damaged transitions, 19 disabled transitions, 64 resisted events, 0% destruction, 5% immobilisation, 95% judges, 15 draws, 19.79 average rounds, and a 20-round maximum. It fails the destruction, judges, average-round, and round-cap hard gates. No constants were tuned, no C2 was created, and held-out seeds were not inspected. Milestone 0.2B remains incomplete.

## 9. Final Recommendation

### First Milestone: 0.2A — Benchmark Harness

**Why first:** Rules should not be changed before their current behaviour is measured. The benchmark harness gives us a quantitative baseline for every subsequent change. Without it, we cannot distinguish genuine improvement from placebo — the exact problem that limits Prototype 0.1's conclusions.

**What must remain frozen:**

- Simulator logic (0.1.2)
- Ruleset (0.1.0)
- Catalogue (v1)
- All Prototype 0.1 match and series records
- The canonical validation series `16eae0af`

**What evidence is required before changing movement or critical-hit rules:**

- Baseline win-rate distribution across ≥100 seeds for each design pairing.
- Component-disable rate, first-round disable rate, and integrity differential distributions.
- Confirmation that observed Prototype 0.1 outcomes (3–1 series win) fall within expected variance for the seed set.
- If the benchmark shows that the AI's 3–1 result is a ≥2σ outlier, design changes may be less significant than they appear — which would strengthen the case for reducing volatility.

**Expected 0.2A output:**

- A `data/seeds/benchmark-100.json` fixture.
- A batch runner producing a `bench-results.json` report.
- Statistical summary: win rates, disable rates, round distributions, integrity differentials.
- Comparison of Bulwark vs Bulwark (mirror match baseline) against AI vs Bulwark.
