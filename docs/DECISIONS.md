# Decisions

## D24: Candidate C component-impact qualification

Accepted for Candidate C implementation. The separate component-impact architecture remains selected. Candidate B1-B3 were rejected analytically against the frozen 80-seed Bulwark mirror; Candidate C1 (`component-impact-c1`) is selected with `COMPONENT_ARMOUR_FACTOR = 0.20`, `COMPONENT_MIN_IMPACT = 0`, `CRITICAL_COMPONENT_IMPACT_THRESHOLD = 11`, and `HIGH_COMPONENT_IMPACT_THRESHOLD = 13`. Implementation is complete, but the development benchmark failed, so Milestone 0.2B is not complete.

Implementation is complete but development benchmark confirmation failed, so Milestone 0.2B is not complete and held-out confirmation remains prohibited.

### D25: Candidate C1 development result

Candidate C1 ran against the unchanged 80-seed development partition only. It produced 164 qualifying hits versus the analytical estimate of 161, 81 damaged transitions, 19 disabled transitions, 64 resisted events, 0% destruction, 95% judges, and 19.79 average rounds. The small qualification-count divergence is expected from live combat paths and qualification-before-selection PRNG consumption. Hard gates failed; no automatic tuning or held-out execution is authorised.

### D26: Candidate C1 Development Failure Diagnosis

**Decision outcome B:** Candidate C1 is viable, but the 0.2B gates must be split
or re-scoped before acceptance. Select the combined split-and-fixture-suite
strategy.

The development event stream supports this decision:

- 164 qualifying hits produced 64 reinforced-drive resistances, 81
  healthy-to-damaged transitions, and 19 damaged-to-disabled transitions;
- 4 mobility disables caused 4 immobilisations; 15 weapon disables and no
  utility disables completed the terminal mix;
- 160 guards started available, 64 were spent, none were lost, and 50 matches
  spent at least one;
- an analytical no-guard transformation of persisted selections suggests 21
  additional fighter mobility disables and 19 additional match outcomes, but
  is not a simulation;
- every one of 1,255 successful hits dealt the one-damage minimum. A fighter
  can receive at most 20 damage in 20 rounds against 150 starting integrity, so
  structural destruction is mathematically impossible in this fixture;
- 77/80 matches reached round 20. Moving judges below 45% requires 41
  additional match-ending mobility disables;
- the bounded incidence model reaches only 24.58% immobilisation at five
  qualifications per match. Reaching about 56% requires about 8.2 and predicts
  93.22% terminal-disable incidence, violating the `< 85%` gate;
- all 164 qualifications used the critical branch. The high-impact branch added
  zero exclusive qualifications, and a one-point critical-threshold change
  creates a large 259/164/59 qualification cliff.

Statements B and C are supported: the guarded high-armour mirror is unsuitable
as the sole acceptance fixture, and several finish-distribution gates require
whole-combat mechanics outside qualification-only 0.2B. Statement A is only
partially supported: C1 is conservative for guarded mobility finishes, but
tuning cannot make destruction possible or reconcile the judge and terminal
incidence gates.

Hard 0.2B gates should cover lifecycle semantics, non-zero damaged and terminal
transitions, first-round volatility, terminal-disable incidence,
reinforced-drive observability, gross component dominance, replay
compatibility, and factual reconstruction. Structural destruction, judges,
draws, finish dominance, and match length move to whole-combat or
fixture-dependent diagnostics.

Keep the Bulwark mirror as a hard guarded stress fixture. Add a benchmark-only
no-utility Bulwark fixture using the existing valid heavy/tracks/ram/`none`
configuration, retain the committed Glass Cannon mirror as a diagnostic, and
defer formal role-swapped heavy-versus-light acceptance to Milestone 0.2D.

C1 is retained pending revised gates and fixture diagnostics. It is not
permanently accepted or rejected. C2 is not justified, critical-rate review is
a separate future ADR/balance task, and Milestone 0.2B remains incomplete.

### D27: Split 0.2B gates and freeze lifecycle fixture suite

Accepted the combined split-and-fixture strategy from D26. Qualification-only
0.2B hard gates now cover lifecycle state legality, damaged/disabled mobility
semantics, non-zero qualification and both transition stages,
guarded/unguarded resistance, qualification-before-selection randomness,
historical replay, C1 factual completeness, first-round volatility,
per-hard-fixture terminal incidence below 85%, and suite component-terminal
dominance at or below 70% when at least ten disables exist.

The former destruction, overall immobilisation, judges, finish dominance,
average-round, and round-cap gates remain in the audit trail but are superseded
for 0.2B lifecycle acceptance. They are retained as future whole-combat balance
objectives.

Frozen benchmark-only suite `component-lifecycle-v1`:

- guarded Bulwark mirror: hard, 80 development simulations;
- unguarded Bulwark mirror: hard, 80;
- Glass Cannon mirror: hard, 80;
- guarded Bulwark versus Glass Cannon: diagnostic, role-swapped, 160.

The 400-simulation development run passed every event invariant, factual,
compatibility, guard, first-round, and dominance gate. Guarded and unguarded
terminal incidence were 22.5% and 42.5%. Glass Cannon qualified 345/355 hits and
had terminal disables in 80/80 matches. Its 100% incidence fails the strict
`<85%` gate, although first-round terminal incidence was zero.

Decision outcome:

> **B. Candidate C1 fails revised lifecycle gates and requires one bounded
> tuning candidate.**

Candidate C1 is not development-passed. No new candidate is created by this
decision. Held-out confirmation remains prohibited and Milestone 0.2B remains
incomplete. Suite checksum: `04fe9aeb6cd48dbe`.

| Date       | Decision                                                                              | Rationale                                                                                                                                                                                                                                   | Alternatives considered                                                                                                                                        |
| ---------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-07-26 | D1: Five-zone ring arena with derived distance                                        | Positional play, circling, flanking and knockback are core to the concept. Distance derived from zones prevents state contradictions.                                                                                                       | Distance-bands only (simpler but removes spatial tactics)                                                                                                      |
| 2026-07-26 | D2: Fighters start at opposing edges, facing each other                               | Clear readable layout, both fighters one round from engagement. Starting sides may be swapped by seed.                                                                                                                                      | Starting in center (too close for tactical opening)                                                                                                            |
| 2026-07-26 | D3: Simultaneous action selection, speed-ordered movement, simultaneous attack damage | Speed affects positioning without granting first-strike kill. Fair and readable.                                                                                                                                                            | Fully sequential attacks (speed too dominant), fully simultaneous (no speed advantage at all)                                                                  |
| 2026-07-26 | D4: Static armour in v0.1                                                             | Component damage and integrity loss provide sufficient degradation. Simplifies first simulator.                                                                                                                                             | Degrading armour (deferred to future ruleset)                                                                                                                  |
| 2026-07-26 | D5: Weapon traits with momentum-based ram, stat-derived grappler/flipper              | Traits should scale with build stats, not be flat probabilities. Ram bonus only on movement rounds.                                                                                                                                         | Flat trait probabilities (simpler but less interesting)                                                                                                        |
| 2026-07-26 | D6: Component damage only on critical hits, zone-weighted                             | Normal hits should not always damage components. Critical-hit threshold adds tactical depth.                                                                                                                                                | Every hit rolls component damage (too frequent)                                                                                                                |
| 2026-07-26 | D7: Overheat forces defence, no integrity damage                                      | Heat penalty is tempo loss, not arbitrary self-damage. Makes heat management meaningful without being punishing.                                                                                                                            | Overheat + 5 damage (too punishing before balance is understood)                                                                                               |
| 2026-07-26 | D8: Normalised judges scoring with documented tie-break                               | Raw values in different ranges must be normalised before weighting. Tie-break order is deterministic.                                                                                                                                       | Unnormalised scoring (unfair across categories)                                                                                                                |
| 2026-07-26 | D9: Minimum 1 damage on successful damaging hit                                       | Prevents invulnerability and endless matches. Non-damaging control actions excluded.                                                                                                                                                        | Minimum 0 (allows full armour absorption)                                                                                                                      |
| 2026-07-26 | D10: Remove arenaHazardPreference from v0.1 policy                                    | Do not retain unused schema fields. Add when at least one real hazard exists.                                                                                                                                                               | Keep unused field (premature forward compatibility)                                                                                                            |
| 2026-07-26 | D11: Bulwark build validated through same validator                                   | Deliberately understandable, not perfectly optimised. 0 rear armour is the exploitable weakness.                                                                                                                                            | Heavily optimised build (hides the weakness)                                                                                                                   |
| 2026-07-26 | D12: Deterministic template-based ASCII visuals                                       | LLM-generated ASCII is excluded because it would be inconsistent, non-replayable and capable of depicting events that did not occur.                                                                                                        | LLM-generated art (inconsistent, non-deterministic), procedural generation (unpredictable)                                                                     |
| 2026-07-26 | D13: Review is advisory only, never alters a completed match                          | Separates deterministic facts from AI interpretation. A completed match is immutable.                                                                                                                                                       | Modifying match results based on review (breaks determinism)                                                                                                   |
| 2026-07-26 | D14: Rebuild reuses designMachine() with structured DesignRequest                     | Prior build and review context passed as structured fields, not unstructured text. Cleaner and more reliable.                                                                                                                               | Unstructured text prompts (unreliable, harder to validate)                                                                                                     |
| 2026-07-26 | D15: AI policy regenerated after every rebuild                                        | Policy should reflect the updated design and review context, not the previous design.                                                                                                                                                       | Reusing old policy (mismatched with new design)                                                                                                                |
| 2026-07-26 | D16: Max 5 matches, draws consume a match, series may end drawn                       | Clear win condition without excessive matches. Draws count as a full match.                                                                                                                                                                 | Best-of-7 (too many matches), no draw limit (could go indefinitely)                                                                                            |
| 2026-07-26 | D17: Comparative report computed from structured DesignDiff data                      | Deterministic diff calculation produces reproducible comparative reports.                                                                                                                                                                   | AI-generated diff (non-deterministic, could hallucinate differences)                                                                                           |
| 2026-07-26 | D18: Deterministic facts before AI interpretation — FactualMatchReport                | Pure code produces objective data; AI interprets it. Ensures reproducibility.                                                                                                                                                               | AI-only reporting (could misrepresent events)                                                                                                                  |
| 2026-07-26 | D19: Entry-oriented series records — each SeriesMatchEntry owns its data              | Each entry owns its match, report, review, design, policy, usage. Simpler data model, easier to serialize.                                                                                                                                  | Match-centric records (more complex, harder to serialize)                                                                                                      |
| 2026-07-26 | D20: Checkpoint persistence — atomic save after every stage                           | Prevents data loss on crash. Atomic writes ensure file integrity.                                                                                                                                                                           | Batch saves (risk of losing multiple stages on crash)                                                                                                          |
| 2026-07-26 | D21: Review and rebuild failure behaviour — fallback review, retain previous build    | Deterministic fallback ensures forward progress even when AI fails. Previous build reused on design failure.                                                                                                                                | Crashing on failure (blocks progress), using fallback design (too unpredictable)                                                                               |
| 2026-07-27 | D22: Deterministic seed-bank evaluation — committed 100-seed fixture, 80/20 split     | Fixed seeds make benchmarks reproducible. 80 dev / 20 held-out gives reasonable statistical power while keeping confirmation seeds isolated from AI context. Role-swapped evaluation for non-identical designs. Wilson 95% CI on win rates. | Random seeds per run (non-reproducible), larger bank (diminishing returns for 100-match benchmarks), 50/50 split (too few dev seeds for meaningful statistics) |     | 2026-07-28 | D23: Component damage lifecycle — healthy→damaged→disabled with qualification thresholds | ADR-002 accepted. Component lifecycles replace binary disabled state. Critical hits with effectiveDamage ≥ 10 OR normal hits ≥ 35 qualify for a state transition. No direct healthy→disabled path. Reinforced drive becomes a one-use mobility guard with explicit events. Central effective-stat helpers. Simulator/ruleset version 0.2.0. Thresholds 10/35 are candidate set A — benchmark-tuned, not permanent. Milestone 0.2B ready for implementation. | Binary disable on critical hit (too volatile), damage-scaled probability (retains one-roll risk), component durability points (premature for 3-component simulator), temporary repair (adds timer complexity before data justifies it) |     | 2026-07-28 | D23 (Proposed): ADR-002 component damage lifecycle — healthy → damaged → disabled | A two-transition lifecycle with deterministic damaged penalties and post-armour qualification directly addresses measured single-hit volatility while retaining targeting, armour value, and immobilisation. Awaiting approval before 0.2B implementation. | Component durability points, binary damage-scaled disable chance, temporary recovery, round-one immunity, and direct healthy-to-disabled catastrophes |
