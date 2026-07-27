# Prototype 0.1 Validation

## Purpose

**Hypothesis:** Can an AI design a legal combat robot, fight a deterministic opponent, receive a grounded review, revise its design or policy, and improve across a series?

**Answer:** Yes. The hypothesis passed.

## Result

| Metric            | Value                                 |
| ----------------- | ------------------------------------- |
| Series result     | DeepSeek AI **3** — The Bulwark **1** |
| Matches           | 4                                     |
| API calls         | 12 (4 design + 4 policy + 4 review)   |
| Input tokens      | 22,626                                |
| Output tokens     | 7,551                                 |
| Estimated cost    | $0.0082 USD                           |
| Simulator version | 0.1.2                                 |
| Ruleset version   | 0.1.0                                 |
| Catalogue version | 1                                     |

## Canonical Series

```
Series ID: 16eae0af-9ca5-4c63-acb1-aee54f41ee58
```

This series is preserved in `data/series/` as the authoritative Prototype 0.1 validation fixture. It demonstrates the complete `design → policy → simulation → factual report → review → redesign` loop working end-to-end across four matches.

Because the fixture contains provider metadata and token counts tied to a specific API account, a sanitised summary record is preferred for repository commits.

### Match Outcomes

| Match | Winner  | Method         | Rounds | AI Integrity | Bulwark Integrity |
| ----- | ------- | -------------- | ------ | ------------ | ----------------- |
| 1     | Bulwark | immobilisation | 4      | 96/100       | 150/150           |
| 2     | AI      | immobilisation | 1      | 100/100      | 107/150           |
| 3     | AI      | immobilisation | 7      | 147/150      | 116/150           |
| 4     | AI      | immobilisation | 13     | 144/150      | 35/150            |

### Seeds

```
Match 1: 299736961
Match 2: 386253148
Match 3: 856602425
Match 4: 337707035
```

## Adaptation Sequence

The AI lost Match 1, adapted, then won three consecutively.

### Meaningful Design Changes

| Change                                  | Match → Match | Rationale                                         |
| --------------------------------------- | ------------- | ------------------------------------------------- |
| front armour 30 → 40                    | 1 → 2         | Review identified front vulnerability             |
| policy secondaryTarget `right` → `left` | 1 → 2         | Focused secondary targeting                       |
| chassis medium → heavy                  | 2 → 3         | Review recommended durability increase            |
| utility cooling → none                  | 2 → 3         | Cooling deemed unnecessary for match length       |
| rear armour 10 → 20                     | 2 → 3         | Review noted rear exposure risk                   |
| top armour 10 → 0                       | 2 → 3         | Budget reallocated to front/rear                  |
| heatThreshold 70 → 80                   | 2 → 3         | Review suggested higher heat tolerance            |
| front armour 40 → 30                    | 3 → 4         | Budget reallocation after observing survivability |

The final redesign reduced front armour — the AI did not simply keep adding armour after every match. It reallocated budget after observing success.

### Policy Stability

The policy remained consistent throughout:

```
opening: flank
preferredRange: close
aggression: 80%
primaryTarget: rear
secondaryTarget: left (changed from right after Match 1)
```

The AI kept the spinner strategy but adopted Bulwark-like durability, producing a hybrid design — heavy chassis with horizontal spinner — rather than converging onto a ram clone.

### Design Evolution

```
Match 1: Backstabber — medium chassis, horizontal spinner
Match 2: Backstabber v2 — medium chassis, horizontal spinner, increased front armour
Match 3: The Bulwark v2 — heavy chassis, horizontal spinner
Match 4: The Bulwark v3 — heavy chassis, horizontal spinner, reduced front armour
```

## Capabilities Demonstrated

- [x] Live DeepSeek integration
- [x] Schema-valid structured robot designs
- [x] Tactical policy generation
- [x] Deterministic seeded simulation
- [x] Persistent match and series records (JSON)
- [x] Text and ASCII replay
- [x] Grounded factual reports (correct event-type mapping)
- [x] Bounded review correction (factual validation loop)
- [x] Catalogue-valid redesign suggestions (no invented components)
- [x] Cumulative adaptation (3 consecutive wins after initial loss)
- [x] Token and USD cost accounting
- [x] Successful target-three series victory

## Limitations

Prototype 0.1 did **not** demonstrate:

- **True positional flanking** — the five-zone arena allows `edge → centre → hold/circle` but cannot express lateral movement or rear positioning once both fighters occupy centre. The AI's `flank` opening policy could not be executed as intended.
- **Generalisation across multiple opponents** — only The Bulwark was tested. No evidence that adapted designs would work against different archetypes.
- **Statistically significant design superiority** — 4 matches (3 wins) is insufficient to distinguish genuine improvement from favourable seeds.
- **Independence from critical component-disable luck** — Match 2 was decided by a Round 1 critical mobility disable. Match 4 disabled Bulwark's weapon early. Component disables were decisive in every win.
- **Long-term strategy diversity** — the AI converged on a heavy spinner hybrid. We do not know whether other strategies (light evasive, hammer-top, grappler-control) could also succeed.
- **Balanced viability of all weapons and chassis** — only ram and horizontal spinner were used. Hammer, grappler, and flipper remain untested in live adaptation.

## Known Simulator Limitations

### Five-Zone Arena

The current arena model:

```
        north_edge
            |
west_edge - center - east_edge
            |
        south_edge
```

Movement options:

- `advance`: move toward centre (edge → centre; centre → centre)
- `retreat`: move toward edge (centre → edge; edge → edge)
- `circle_left` / `circle_right`: rotate facing in place
- `hold`: stay in place

A fighter starting at an edge can only reach centre. Once both fighters occupy centre, the only options are hold or rotate. There is no lateral movement, no flanking path, and no way to position behind an opponent who is also at centre.

### Component-Disable Volatility

Critical hits can disable components in a single roll regardless of prior damage. A first-round critical can immobilise a full-integrity opponent (as occurred in Match 2). The `reinforced_drive` utility reduces mobility-disable probability, but other components have no analogous protection.

Component disables were decisive in every AI victory. We cannot separate genuine design improvement from critical-hit luck under the current rules.

## Repository Baseline

| Item                  | Value                                      |
| --------------------- | ------------------------------------------ |
| Commit SHA (tag)      | `9f9806562f45c994710821dae1e1b63a17d7ecc9` |
| Docs commit SHA       | `719d91cfac40ac13ccbe14c84ced02a492892366` |
| Final test count      | 447 (41 files)                             |
| Simulator version     | 0.1.2                                      |
| Ruleset version       | 0.1.0                                      |
| Catalogue version     | 1                                          |
| Design prompt version | design-v2                                  |
| Policy prompt version | policy-v2                                  |
| Review prompt version | review-v1                                  |
| Match schema version  | 1                                          |
| Series schema version | 1                                          |
| Release tag           | v0.1.0-prototype                           |

All static checks pass: format, lint, type-check. All 447 tests pass with zero failures.

## Tag Provenance

```
v0.1.0-prototype points to the validated executable code baseline:
9f9806562f45c994710821dae1e1b63a17d7ecc9

Release documentation and the Prototype 0.2 plan were added in:
719d91cfac40ac13ccbe14c84ced02a492892366
```

The tag is an immutable snapshot of the validated simulator. Documentation corrections exist after the tag. No simulator behaviour changed in the documentation commit.

**Recommended strategy: Option A — Keep the existing tag.** The `v0.1.0-prototype` tag correctly identifies the code baseline. Documentation lives on the default branch and can be updated without moving the tag. A second documentation-only tag would add complexity without improving clarity.

## Canonical Evidence Fixture

A sanitised, repository-safe summary is committed at:

```
tests/fixtures/prototype-0.1-canonical-series-summary.json
```

It contains only repository-safe data: series ID, match IDs, seeds, designs, policies, outcomes, final integrity, redesign diffs, usage totals, and version baselines. No API keys, request headers, or account identifiers are included.

The fixture is validated by `tests/unit/prototype-0.1-fixture.test.ts`, which asserts all critical values and verifies no sensitive metadata is present.
