# Opponent Suite v1 — Canonical Selection (FROZEN)

**Status:** FROZEN by D64 (2026-08-07). The complete human-selected values below
are authoritative and immutable for suite v1. They were frozen in Git **before**
any canonical fixture file was generated and before any opponent execution.
They must not be amended because of fixture validation or future match results.
Any future semantic change requires a new fixture version, never an edit of
these v1 identities.

**Depends on:** ADR-004 (multi-opponent fixture format, accepted), the reviewed
opponent-fixture foundation (Milestone 0.2D Phase 1 + Phase 1.1), `CATALOGUE_V1`,
the authoritative build validator and policy schema, and the historical
`BULWARK_BUILD_PROPOSAL` / `BULWARK_POLICY` for the sole migration candidate.

## 1. Selection method

The five new fixtures (`skirmisher`, `crusher`, `spinner`, `controller`,
`generalist`) were selected **structurally** from:

- ADR-004's conceptual archetype envelopes;
- public catalogue component semantics (`CATALOGUE_V1`);
- the public policy schema (`actionPolicySchema`);
- deliberately simple human-readable armour distributions;
- no performance data of any kind.

They are **diversity fixtures** — they exercise different chassis/weapon/policy
combinations — not difficulty tiers and not purportedly balanced opponents.
No balance, strength, fairness or ranking claim is made or implied.

`bulwark` is the sole historical migration candidate and must reproduce its
existing authoritative build/policy exactly (`BULWARK_BUILD_PROPOSAL`,
`BULWARK_POLICY`). It is not reinterpreted or improved.

## 2. Shared fixture identity (all six)

```
schemaVersion:        "1"
fixtureVersion:       1
catalogueVersion:     "1"
rulesetCompatibility:
  rulesetVersion:     "0.2.0"
  status:             "supported"
```

Runtime identity values use the canonical frozen runtime identities defined in
source (`LEGACY_RUNTIME_IDENTITY`, `GRID_RUNTIME_IDENTITY`).

## 3. Frozen selections

### 3.1 bulwark.v1

```
opponentId:             bulwark
displayName/machineName: The Bulwark

build:
  chassisId:            heavy
  mobilityId:           tracks
  weaponId:             ram
  utilityId:            reinforced_drive
  armour:               front 60, left 15, right 15, rear 0, top 0
  designSummary:        An unstoppable forward assault machine with heavy frontal armour.
  designRationale:      Maximise frontal protection and close-range ram damage. Accept rear vulnerability.

policy:
  opening:              rush
  preferredRange:       close
  aggression:           85
  primaryTarget:        front
  secondaryTarget:      front
  retreatThreshold:     10
  heatThreshold:        90
  fallback:             desperate_attack

runtime compatibility:
  legacy:               supported
  grid:                 supported

description:            Historical heavy frontal-pressure scripted opponent migrated without changing its build or policy.
archetypeIntent:        Frontal pressure with a deliberate rear-armour weakness; descriptive intent only.
```

This build/policy MUST exactly equal the historical `BULWARK_BUILD_PROPOSAL`
and `BULWARK_POLICY`. Structural arithmetic only (the authoritative validator
remains decisive): armour points 90, armour cost 9, total build cost 94.

### 3.2 skirmisher.v1

```
opponentId:             skirmisher
displayName/machineName: Iron Cicada

build:
  chassisId:            light
  mobilityId:           wheels
  weaponId:             grappler
  utilityId:            traction_boost
  armour:               front 20, left 10, right 10, rear 10, top 10
  designSummary:        A light mobile control machine built to seek lateral angles.
  designRationale:      Use wheels and a grappler to pursue lateral pressure without relying on heavy armour.

policy:
  opening:              flank
  preferredRange:       close
  aggression:           70
  primaryTarget:        rear
  secondaryTarget:      left
  retreatThreshold:     35
  heatThreshold:        80
  fallback:             retreat

runtime compatibility:
  legacy:               incompatible
  grid:                 supported

description:            Light mobile grappler fixture intended to exercise lateral policy semantics.
archetypeIntent:        Lateral skirmishing and rear-angle pressure; descriptive intent only.
```

Legacy is deliberately incompatible because the fixture's defining lateral
intent depends on translated grid circling rather than legacy turn-in-place
circling. Structural arithmetic: armour points 60, armour cost 6, total build
cost 63.

### 3.3 crusher.v1

```
opponentId:             crusher
displayName/machineName: Hammerfall

build:
  chassisId:            heavy
  mobilityId:           tracks
  weaponId:             hammer
  utilityId:            cooling
  armour:               front 30, left 20, right 20, rear 15, top 15
  designSummary:        A heavy hammer platform built around deliberate high-impact attacks.
  designRationale:      Use a heavy chassis, tracks, hammer and cooling with broad armour coverage for a cautious impact-focused profile.

policy:
  opening:              cautious
  preferredRange:       medium
  aggression:           55
  primaryTarget:        top
  secondaryTarget:      front
  retreatThreshold:     20
  heatThreshold:        70
  fallback:             defend

runtime compatibility:
  legacy:               supported
  grid:                 supported

description:            Heavy hammer fixture intended to represent cautious high-impact attacks.
archetypeIntent:        Cautious heavy impact and top-target pressure; descriptive intent only.
```

Structural arithmetic: armour points 100, armour cost 10, total build cost 100.
Reaching the budget limit is a consequence of the frozen structural choice, not
an optimisation result.

### 3.4 spinner.v1

```
opponentId:             spinner
displayName/machineName: Whirlwind

build:
  chassisId:            medium
  mobilityId:           wheels
  weaponId:             horizontal_spinner
  utilityId:            cooling
  armour:               front 25, left 15, right 15, rear 10, top 15
  designSummary:        A medium mobile spinner platform built for aggressive burst pressure.
  designRationale:      Pair a horizontal spinner with wheels and cooling, using moderate distributed armour without asserting balance.

policy:
  opening:              rush
  preferredRange:       close
  aggression:           75
  primaryTarget:        front
  secondaryTarget:      left
  retreatThreshold:     20
  heatThreshold:        75
  fallback:             desperate_attack

runtime compatibility:
  legacy:               supported
  grid:                 supported

description:            Medium spinner fixture intended to represent aggressive burst and knockback behaviour.
archetypeIntent:        Aggressive burst and knockback pressure; descriptive intent only.
```

Structural arithmetic: armour points 80, armour cost 8, total build cost 85.

### 3.5 controller.v1

```
opponentId:             controller
displayName/machineName: Lockdown

build:
  chassisId:            medium
  mobilityId:           legs
  weaponId:             grappler
  utilityId:            traction_boost
  armour:               front 20, left 15, right 15, rear 10, top 10
  designSummary:        A medium grappler platform built around control and repositioning intent.
  designRationale:      Pair legs and traction support with a grappler to express grid control intent; no performance claim is implied.

policy:
  opening:              cautious
  preferredRange:       close
  aggression:           60
  primaryTarget:        rear
  secondaryTarget:      left
  retreatThreshold:     30
  heatThreshold:        80
  fallback:             defend

runtime compatibility:
  legacy:               incompatible
  grid:                 supported

description:            Medium grappler fixture intended to represent grid-specific control and repositioning.
archetypeIntent:        Control and repositioning on the grid; descriptive intent only.
```

Legacy is deliberately incompatible under ADR-004's controller definition
(grapple repositioning exists only in the grid runtime). Structural arithmetic:
armour points 70, armour cost 7, total build cost 87.

### 3.6 generalist.v1

```
opponentId:             generalist
displayName/machineName: Sentinel

build:
  chassisId:            medium
  mobilityId:           wheels
  weaponId:             flipper
  utilityId:            cooling
  armour:               front 20, left 15, right 15, rear 15, top 15
  designSummary:        A medium mixed-purpose platform with no extreme component choice.
  designRationale:      Use a moderate chassis, mobility, flipper, cooling and distributed armour as a descriptive generalist, not a balance baseline.

policy:
  opening:              hold
  preferredRange:       medium
  aggression:           65
  primaryTarget:        front
  secondaryTarget:      top
  retreatThreshold:     30
  heatThreshold:        80
  fallback:             defend

runtime compatibility:
  legacy:               supported
  grid:                 supported

description:            Medium mixed-purpose fixture with deliberately non-extreme component choices.
archetypeIntent:        Generalist mixed-purpose intent without fairness or balance claims.
```

Structural arithmetic: armour points 80, armour cost 8, total build cost 80.

## 4. Evidence firewall

Only the following were used: `CATALOGUE_V1`; the authoritative build schema/
validator; the authoritative policy schema; ADR-004 conceptual envelopes; the
historical `BULWARK_BUILD_PROPOSAL` / `BULWARK_POLICY`; ordinary unit-test
mechanics; and the reviewed opponent-fixture foundation. Nothing was inspected
or used from: benchmark seeds or results, held-out seeds or results, `all`,
readiness execution results, grapple-supplement results, GRID-BETA-001–005
outcomes, previous AI redesign performance, adaptation results, or any
provider/model optimisation. No simulator was run. No opponent match exists.

## 5. Immutable v1 evidence anchors

Recorded after canonical fixture creation (D65). These are immutable evidence
anchors: `fixtureChecksum` (over the canonical identity serialization) and the
SHA-256 of the exact canonical persisted file bytes. Any future semantic change
requires a new fixture version rather than editing these v1 identities.

| fixture    | fixtureChecksum                                                    | persisted-file SHA-256                                             |
| ---------- | ------------------------------------------------------------------ | ------------------------------------------------------------------ |
| bulwark    | `053e61e867d00015371e852dbe571af666cc8ac99a514b2364be323d54a8d987` | `d109c73a2f0880a5298fa6784abe4644f10c6ec395d4f4007179cc2d4e50256a` |
| skirmisher | `86e05148c57cabad2e9cf916475462acf7b132d1686904c0e5e197db9c1129cc` | `c078b792cc46aaaf30f9ed34ae5e7f772d99d65bd8745018ac969657bf8cd0b7` |
| crusher    | `754f8c3a70106f320483f74d52626b56b451885dfc16c777ca8442ceb7f60b6c` | `42f0397595dc88fd8edb12d7e8aba155f179fcb5feea84c3ff93f797903099a0` |
| spinner    | `4bde756805abfc9152cd5b64c76fefd26cbc1a2aae9db7ff7a96675b734783b5` | `ea9319b3fd4df6610c24e60bff23e4add73717092688063c2f53c69b5e1521f6` |
| controller | `d4940517943b440cc68bc7822c85051ff2d864530a13281d16a15ad770bece23` | `82a1235ecd85a891169841e15051d30ffdd026acf0197a58c2ecc5ced3a43773` |
| generalist | `07c2f77237bcf868e8297c2e5be12c67cd848f9def48c486ee40a58222908172` | `c887ef2ac1d9201753539d57b036c56e4f3a0b56a4da9ded42b1305a79b8fa50` |

The six canonical files were created from the frozen selection through the
reviewed foundation (`validateBuild` → complete `ValidatedBuild` → identity →
`opponentFixtureChecksum` → `parseOpponentFixture` → `serializeOpponentFixture`),
written byte-exactly to `data/opponents/<id>.v1.json`. No production generator,
no package script and no `src/` change were made. `data/opponents/` contains
exactly these six files.
