# ADR-004: Multi-opponent fixture format

**Status:** Accepted for Milestone 0.2D Phase 0 (2026-08-07).
**Scope:** Definition/governance only — no implementation.
**Depends on:** ADR-001 (positioning representation, accepted), the bounded
grid-beta work (D54–D60), legacy default runtime `0.2.0` and opt-in grid
runtime `0.3.0 / grid-3x3-v1`.
**Related decisions:** D61 (Milestone 0.2D opponent-suite governance).

## 1. Problem

Milestone 0.2D needs a small, diverse set of fixed robot opponents as
immutable, versioned, deterministic local fixtures, executed and reported
against reproducibly — without changing combat semantics, performing
adaptation, or making balance claims. Opponent data must be stored and
versioned in a way that survives the coexistence of the legacy default
runtime (`0.2.0`) and the opt-in grid runtime (`0.3.0 / grid-3x3-v1`), and
must never silently belong to one runtime merely because the current
implementation happens to use it.

## 2. Authorised question

> Can the project represent a small, diverse set of fixed robot opponents as
> immutable, versioned, deterministic local fixtures and execute/report
> against them reproducibly without changing combat semantics, performing
> adaptation, or making balance claims?

Milestone 0.2D is NOT authorised to answer which build is best, which weapon
is strongest, whether the grid is balanced, whether slot A/B is fair, whether
any design should be tuned, whether C2 is final, whether grid should become
default, whether an AI redesign improved, or whether a public tournament is
ready.

## 3. Fixture contract

Every opponent fixture must carry immutable, versioned identity including at
minimum:

```
schemaVersion
opponentId
fixtureVersion
displayName
build
policy
catalogueVersion
rulesetCompatibility
runtimeCompatibility
description
archetypeIntent
```

`build` and `policy` are the authoritative build proposal/policy input carried
by the fixture. `catalogueVersion` binds the fixture to the catalogue the
build was defined against. `rulesetCompatibility` and `runtimeCompatibility`
declare which runtimes the fixture's build/policy semantics are valid across
(see §5).

### 3.1 Subjective balance labels are forbidden

Fixtures must NOT include subjective balance labels such as:

```
tier
powerLevel
difficultyRating
balanced
meta
optimal
```

unless a field is explicitly descriptive/non-authoritative. `archetypeIntent`
may describe intended behaviour such as:

```
frontal pressure
lateral skirmishing
control/repositioning
burst impact
cautious heavy attack
generalist
```

It must never assert that the fixture actually succeeds at that role until
later evidence exists. `archetypeIntent` describes intent, not measured
performance.

## 4. Canonical identity

Fixture identity is bound to a deterministic canonical serialization and a
SHA-256 fixture checksum over that canonical serialization. The checksum must
bind:

- the exact build proposal;
- the complete validated build (derived totals, not just the proposal);
- the policy;
- the schema version;
- the fixture version;
- the catalogue version;
- any runtime-compatibility declaration.

Changing any authoritative field requires a new fixture checksum and, where
semantically appropriate, a new fixture version. No silent fixture mutation is
permitted: a fixture whose persisted bytes do not match its canonical
serialization/checksum is invalid and must be rejected before any execution.
Validation must reuse the authoritative catalogue validator and policy schema
already used by the grid-beta fighter path.

## 5. Fixture/runtime relationship — runtime-neutral fixture, runtime-specific execution (chosen)

The project now has a legacy default runtime `0.2.0`, an opt-in grid runtime
`0.3.0 / grid-3x3-v1`, a bounded internal grid beta, and no default grid
activation. Opponent fixtures must NOT silently belong to one runtime merely
because the current implementation happens to use it.

**Chosen model: runtime-neutral fixture, runtime-specific execution.** The
fixture owns only build/policy/archetype identity where those semantics are
valid across runtimes. Runtime execution is chosen separately. Compatibility
is recorded explicitly, for example:

```
runtimeCompatibility:
  legacy: supported
  grid-3x3-v1: supported
```

or the equivalent typed structure. If a policy/build is not semantically
portable, it is declared incompatible rather than translated silently. No
fixture may cause a runtime change. No fixture may request grid activation.
Fixture identity must not embed an ambient runtime: the fixture carries only
declared compatibility, and the executor selects the runtime explicitly.

## 6. Initial six archetype definitions (conceptual envelopes only)

The historical plan proposed `bulwark`, `skirmisher`, `crusher`, `spinner`,
`controller`, `generalist`. These six IDs are retained (no duplicated
archetype or unsupported component was found). Phase 0 defines only the
intended design envelope for each — no fixture JSON, no final armour numbers,
aggression percentages or exact builds (except where a build is already a
canonical historical fixture). Exact fixture builds belong to a later
implementation phase and must be chosen without benchmark/held-out
optimisation.

### bulwark

- Intended chassis family: heavy (frontal bulk).
- Intended weapon family: frontal pressure (e.g. ram-style, close frontal).
- Intended policy style: cautious-to-moderate frontal advance.
- Intended tactical behaviour: frontal pressure.
- Compatibility questions: ram charge momentum differs between legacy and
  grid (grid momentum is granted only to translated `advance`); the fixture
  must declare how its ram intent maps across runtimes.
- Must NOT be inferred from the label: that it wins frontal engagements, that
  it is balanced, or that its armour numbers are tuned.

### skirmisher

- Intended chassis family: light/mobile.
- Intended weapon family: fast low-cooldown weapons.
- Intended policy style: lateral/flank pressure.
- Intended tactical behaviour: lateral skirmishing.
- Compatibility questions: `circle_left`/`circle_right` are translated
  lateral movement only in the grid runtime; legacy turns in place. The
  fixture's lateral policy must be declared compatible or incompatible per
  runtime, never silently translated.
- Must NOT be inferred from the label: that it is faster in legacy, that
  lateral play is balanced, or that it succeeds at flanking.

### crusher

- Intended chassis family: heavy.
- Intended weapon family: high-damage/high-cooldown impact weapons.
- Intended policy style: cautious heavy attack.
- Intended tactical behaviour: burst impact through heavy hits.
- Compatibility questions: cooldown/damage semantics must be verified against
  both runtimes' shared combat core.
- Must NOT be inferred from the label: that heavy attacks are optimal or that
  the archetype is strong.

### spinner

- Intended chassis family: medium/heavy.
- Intended weapon family: high-knockback/high-burst weapons (e.g. horizontal
  spinner-style).
- Intended policy style: aggressive burst.
- Intended tactical behaviour: knockback/burst.
- Compatibility questions: knockback resolution differs between runtimes; the
  fixture must declare compatibility.
- Must NOT be inferred from the label: that knockback is overpowered or that
  the archetype wins.

### controller

- Intended chassis family: medium.
- Intended weapon family: grapple/reposition weapons.
- Intended policy style: control/repositioning.
- Intended tactical behaviour: control/repositioning.
- Compatibility questions: grapple repositioning exists only in the grid
  runtime; a legacy controller fixture must declare `legacy:
incompatible` rather than silently losing its core mechanic.
- Must NOT be inferred from the label: that control is fair, that grapple is
  strong, or that repositioning is balanced.

### generalist

- Intended chassis family: medium.
- Intended weapon family: balanced, non-extreme.
- Intended policy style: non-extreme baseline.
- Intended tactical behaviour: generalist baseline.
- Compatibility questions: expected to be broadly portable, but portability is
  declared per runtime, not assumed.
- Must NOT be inferred from the label: that it is the fair baseline, that it
  is balanced, or that it represents an optimal default.

## 7. Bulwark migration rule

The historical roadmap states "Bulwark behaviour unchanged from 0.1". This
ADR distinguishes:

1. canonical fixture identity — the fixture's build/policy intent, preserved
   exactly by migration;
2. runtime-specific movement semantics — intentionally different between
   legacy and grid.

The fixture migration must preserve its canonical build/policy intent. It must
NOT promise byte-identical event streams across legacy and grid, because the
runtimes intentionally have different positioning semantics. For legacy
compatibility, a future regression (Phase 3) proves that replacing
hard-coded Bulwark data with the fixture does not change the relevant legacy
deterministic behaviour. This must NOT be proven by running the benchmark seed
bank; it uses bounded ordinary unit fixtures or existing canonical
non-held-out regression cases.

## 8. Execution governance

Future 0.2D execution must be deterministic and local-scripted. No opponent
fixture may: call an external model; call a provider API; adapt during a
match; learn between matches; mutate itself; read prior match outcomes; read
benchmark results; read held-out results. A future opponent-suite runner must
require explicit runtime selection (`--runtime legacy` or an explicitly
authorised grid development mode). Absent runtime selection must NOT silently
switch the application default to grid. This design phase does NOT authorise a
general grid cross-opponent runner: grid execution requires a separate
implementation/execution authorisation, because the bounded grid-beta
governance currently covers explicit internal beta matches, not an unlimited
matrix runner. Legacy remains default.

## 9. Evidence firewall

Fixture design may use: public catalogue definitions; the public policy
schema; deterministic simulator contracts; existing unit-test fixtures; the
historical Bulwark implementation for compatibility; grid geometry/policy
semantics for compatibility analysis; GRID-BETA-001–005 only as evidence that
the beta infrastructure operates safely. It must NOT use for fixture tuning or
selection: development benchmark outcomes; benchmark seed identities;
held-out seeds; held-out per-match results; `all`; AB2 held-out outcome
details as optimisation guidance; GRID-BETA-001–005 winners/scores/round
patterns; provider/model-generated optimisation; adaptation results. The five
beta smoke outcomes remain uninterpreted.

## 10. Runner output boundaries

The future opponent-suite runner may report factual values: opponent ID;
fixture checksum; runtime identity; caller-supplied seed; match IDs;
win/loss/draw; method; rounds; deterministic result checksum. It must NOT
produce automatic conclusions: strongest/weakest opponent; best build;
optimal weapon; balance score; tier list; recommended tuning. Raw factual
aggregation is allowed later; interpretation requires separate governance.

## 11. Consequences

- Fixtures are immutable, versioned, deterministic local data with a
  canonical SHA-256 identity; no silent mutation is possible.
- Opponents never select or activate a runtime; runtime is an explicit
  executor concern.
- Subjective balance labels are excluded; `archetypeIntent` is descriptive
  only.
- "Tournament runner" terminology is retired in favour of the local
  development **opponent-suite runner** (cross-opponent matrix runner), which
  is explicitly not the public Arena tournament system, does not create
  rankings, award prizes, perform matchmaking, or authorise public/ranked
  play.
- No seed bank, held-out partition, `all`, or statistical sample is consumed
  or created by 0.2D.
- Each later 0.2D phase requires independent review before proceeding.
