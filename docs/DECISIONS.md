# Decisions

## D29: Armour-band Candidate AB2 development passage (2026-07-31)

`component-impact-ab2` is the sole new immutable candidate, checksum
`6b9f70450d3f10b8`, preserving C1/C2 and C2's default status. It uses fixed
struck-zone bands `0-9`, `10-24`, `25-49`, and `50+` with critical/high
thresholds `17/20`, `15/18`, `13/15`, and `11/13`. The temporary identity
`component-impact-ab1` and checksum `4ccfa5e666b0d4fb` were superseded.

Exactly one 480-simulation development suite ran against the unchanged fixture
manifest and seed bank. Fixture checksum remained `ffc11deb47e6049f`; suite
checksum was `951cdbe01132b06c`. Guarded and unguarded resistance were 64 and 0,
representative-light terminal incidence was 58.8%, all hard first-round
terminal rates were 0%, and maximum suite component-terminal share was 52.98%.
Factual, replay, guard, lifecycle, and qualification-before-selection gates
passed. Decision **A**: AB2 passes all revised development lifecycle gates.
Held-out execution is not part of this decision and remains separately
authorised work.

## D31: AB2 held-out confirmation failure (2026-07-31)

The separately authorised held-out command ran exactly once for AB2, using 20
held-out seeds and 120 simulations. Candidate checksum remained
`6b9f70450d3f10b8`, fixture checksum remained `ffc11deb47e6049f`, and the
held-out suite checksum was `4ea2fe4423a0de8c`. Guarded Bulwark had 18 damaged,
3 disabled, and 18 resisted events; unguarded Bulwark had 32 damaged, 6
disabled, and zero resistance. Representative light had 40 damaged and 19
disabled transitions with 85.0% terminal incidence.

All other hard and general gates passed, but the strict representative-light
terminal-disable requirement is `<85%`, so Decision **B** applies. AB2 remains
unchanged and C2 remains the runtime default. No tuning, default promotion, or
final Milestone 0.2B completion was performed. No individual held-out seed or
per-match result is recorded.

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

### D28: Candidate C2 bounded cross-fixture tuning result

Candidate C2-B was selected from three immutable-fact analyses: `COMPONENT_ARMOUR_FACTOR = 0.20`, `CRITICAL_COMPONENT_IMPACT_THRESHOLD = 13`, and `HIGH_COMPONENT_IMPACT_THRESHOLD = 15`. It reduced Glass Cannon analytical qualification from 97.2% to 87.9% while preserving positive qualification in both Bulwark fixtures. A factor-only alternative at 0.30 produced zero Bulwark qualifications and was rejected.

The implementation uses `component-impact-c2` and leaves damage, armour absorption, critical probability, selection, guard, lifecycle, match cap, fixtures, and seed bank unchanged. The development suite result was guarded `2` qualifying / `0` damaged / `2` resisted, unguarded `2` / `2` / `0`, and Glass Cannon `333` / `214` / `119` with 97.5% terminal incidence. The guarded progression and Glass Cannon terminal gates failed; factual completeness, lifecycle legality, guard semantics, first-round, dominance, and historical replay gates passed. Decision B: no C3 or automatic retuning; held-out confirmation remains prohibited. Suite checksum: `7c734547c93214f5`.

### D29: Cross-armour qualification architecture and fixture strategy

Preserve C1 (`component-impact-c1`, suite `04fe9aeb6cd48dbe`) and C2
(`component-impact-c2`, suite `7c734547c93214f5`) as auditable historical
configurations. Their fixture and seed-bank identities remain unchanged.

**Decision C:** both qualification shape and fixture strategy require
amendment. The current monotonic linear impact thresholds leave high-armour
Bulwark at impacts 4-13 and low-armour Glass Cannon at 11-24. The bounded
development-fact analysis identifies severe one-point cliffs but does not
authorise an unrestricted search or C3. An armour-sensitive qualification shape
requires a separate ADR amendment before implementation.

Glass Cannon remains evidence of over-aggression (C1 100%, C2 97.5% terminal
incidence), but its original guaranteed-transition, no-utility, 5-front-armour
mirror role makes it an extreme diagnostic rather than the sole representative
light-armour hard fixture. Future strategy: add a representative light-armour
hard fixture and retain Glass Cannon with an anti-instant-volatility diagnostic
gate; do not weaken current gates automatically.

Future configuration architecture is an immutable runtime registry selected by
ID, with fixture manifests describing only competitors and policies. The future
CLI shape is `benchmark:lifecycle --partition development --qualification
component-impact-c1`; reports must carry a canonical configuration checksum.
That work, fixture approval, and any later candidate are separate tasks.
Held-out execution remains prohibited and Milestone 0.2B remains incomplete.

### D30: Qualification registry, representative light fixture, and armour-band gate

Decision **A**: the architecture step is complete and a fixed struck-zone
armour-band model is implementation-ready for a separate future candidate.

The immutable registry preserves `component-impact-c1`
(`2a40a56f97062ca3`) and `component-impact-c2` (`13548462df34a183`), with C2
as the default. Fixture manifests are qualification-independent, while match
events and factual, benchmark, and suite reports carry the selected
configuration checksum. Unknown IDs fail before simulation.

The revised development fixture definition has checksum
`ffc11deb47e6049f`. It adds the hard, 80-match
`representative-light-mirror` fixture and reclassifies unchanged Glass Cannon
as an extreme diagnostic with a hard first-round anti-instant-volatility gate.
C1 and C2 each ran 480 development simulations. Their suite checksums are
`3289f1c9e4ab8398` and `801981a42474b5b6`; historical fixture outcome
checksums remain unchanged. Representative-light terminal incidence was 92.5%
under C1 and 87.5% under C2, so neither registered configuration passes.

The Proposed future shape uses inclusive struck-zone armour bands: exposed
`0-9`, light `10-24`, protected `25-49`, and heavy `50+`, with linear impact
inside each band and explicit per-band thresholds. It may not branch on
fixture, chassis, competitor, or build name. No banded runtime entry, C3,
automatic tuning, seed change, or held-out execution is authorised by this
decision. Milestone 0.2B remains incomplete.

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
