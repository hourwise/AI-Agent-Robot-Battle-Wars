# 0.2B Development Fixture and Protocol Contract v1

**Status:** Accepted by D76
**Contract ID:** `component-lifecycle-development-v1`
**Contract version:** `1`
**Contract checksum:** `a3fd0afdd8c35350`
**Purpose:** Freeze the next 0.2B development-only evidence contract after
the AB2 held-out failure and permanent seal of the original held-out
partition.

This is a documentation contract. It does not register a candidate, select
candidate constants, create fixture bytes, run a benchmark, open a held-out or
`all` partition, change simulator semantics, or begin 0.2E.

## Authority and fixed inputs

The canonical fixture authority is the existing committed file
`data/bench-fixtures/component-lifecycle-v1/suite.json`, parsed and validated
by `src/bench/lifecycle-fixture-schema.ts`. Its canonical suite identity is:

| Field                    | Frozen value             |
| ------------------------ | ------------------------ |
| `suiteId`                | `component-lifecycle-v1` |
| suite schema version     | `1`                      |
| simulator version        | `0.2.0`                  |
| ruleset version          | `0.2.0`                  |
| catalogue version        | `1`                      |
| seed partition           | `development`            |
| canonical suite checksum | `ffc11deb47e6049f`       |

The suite checksum is the first 16 hexadecimal characters of SHA-256 over the
repository's recursive sorted-key canonical serialization of the parsed suite
definition. The suite file, not a prose copy in this contract, is the exact
build/policy authority. Changing that file requires a new suite version and
checksum; this task makes no such change.

Qualification is deliberately not selected by the suite. Every future run
must bind a newly registered candidate ID and complete qualification
configuration checksum. The candidate binding is part of the run provenance,
but no candidate is registered by this contract.

## 1. Bounded development suite

The contract reuses the existing committed suite and selects all five existing
members in the exact JSON order below. The four mirror members each run once
per development seed. The role-swapped asymmetric member runs both role
assignments per development seed.

### Exact build and policy authority

The exact definitions are the entries selected by `competitorId` in
`data/bench-fixtures/component-lifecycle-v1/suite.json`. The checksums below
are contract identity checksums, not new fixture-file checksums:

```text
buildSpecChecksum = SHA-256(first 16 hex characters) of
  canonical({ build: competitor.build })
policySpecChecksum = SHA-256(first 16 hex characters) of
  canonical({ policy: competitor.policy })
competitorSpecChecksum = SHA-256(first 16 hex characters) of
  canonical(competitor)
```

The canonical function recursively sorts object keys, preserves array order,
and uses JSON scalar serialization. This binds the complete existing build and
policy object without creating a second prose authority.

| Competitor ID          | Existing source authority      | Build identity                            | Policy identity                                                   | Build checksum     | Policy checksum    | Competitor checksum |
| ---------------------- | ------------------------------ | ----------------------------------------- | ----------------------------------------------------------------- | ------------------ | ------------------ | ------------------- |
| `bulwark-guarded`      | `canonical-bulwark`            | `heavy / tracks / ram / reinforced_drive` | `rush / close / 85 / front / front / 10 / 90 / desperate_attack`  | `a53ba7f9351c3c92` | `b4c070a419938243` | `c3b13789a04a967d`  |
| `bulwark-unguarded`    | `benchmark-only`               | `heavy / tracks / ram / none`             | same policy as `bulwark-guarded`                                  | `931a60b28c779017` | `b4c070a419938243` | `d20dc18ebad067bf`  |
| `representative-light` | `benchmark-only`               | `light / wheels / ram / none`             | `rush / close / 50 / front / left / 30 / 75 / defend`             | `d8f391151c42d530` | `5adca6cc0409793d` | `8b61bb6fec24703c`  |
| `glass-cannon`         | `benchmark-v2-transition-test` | `light / wheels / ram / none`             | `rush / close / 100 / front / front / 0 / 100 / desperate_attack` | `f35a3f8ba23a5d17` | `10dc5a23ea49a7d6` | `744f0e6544a6efa6`  |

The compact build/policy descriptors in the table are identity labels only.
Armour values, design text, all policy fields and all other exact fields remain
authoritative only in the committed suite JSON entries.

## Canonical contract identity

The following identity object is the complete input to the contract checksum.
Its recursive sorted-key canonical JSON serialization is hashed with SHA-256,
and the first 16 hexadecimal characters are recorded above. The checksum is
not included in its own input. Any change to this object requires a new
contract version and checksum.

```json
{
  "contractId": "component-lifecycle-development-v1",
  "contractVersion": "1",
  "suite": {
    "suiteId": "component-lifecycle-v1",
    "suiteSchemaVersion": "1",
    "suiteChecksum": "ffc11deb47e6049f",
    "simulatorVersion": "0.2.0",
    "rulesetVersion": "0.2.0",
    "catalogueVersion": "1",
    "seedPartition": "development"
  },
  "competitors": {
    "bulwark-guarded": {
      "buildChecksum": "a53ba7f9351c3c92",
      "policyChecksum": "b4c070a419938243",
      "competitorChecksum": "c3b13789a04a967d"
    },
    "bulwark-unguarded": {
      "buildChecksum": "931a60b28c779017",
      "policyChecksum": "b4c070a419938243",
      "competitorChecksum": "d20dc18ebad067bf"
    },
    "representative-light": {
      "buildChecksum": "d8f391151c42d530",
      "policyChecksum": "5adca6cc0409793d",
      "competitorChecksum": "8b61bb6fec24703c"
    },
    "glass-cannon": {
      "buildChecksum": "f35a3f8ba23a5d17",
      "policyChecksum": "10dc5a23ea49a7d6",
      "competitorChecksum": "744f0e6544a6efa6"
    }
  },
  "members": [
    {
      "memberId": "bulwark-guarded-mirror",
      "memberVersion": "1",
      "memberSpecChecksum": "a713b1e15f5730eb",
      "classification": "hard-acceptance",
      "sourceClassification": "hard",
      "roleAssignments": 1,
      "simulations": 80
    },
    {
      "memberId": "bulwark-unguarded-mirror",
      "memberVersion": "1",
      "memberSpecChecksum": "2ad826660516ea92",
      "classification": "hard-acceptance",
      "sourceClassification": "hard",
      "roleAssignments": 1,
      "simulations": 80
    },
    {
      "memberId": "representative-light-mirror",
      "memberVersion": "1",
      "memberSpecChecksum": "969b24090087c25b",
      "classification": "hard-acceptance",
      "sourceClassification": "hard",
      "roleAssignments": 1,
      "simulations": 80
    },
    {
      "memberId": "glass-cannon-mirror",
      "memberVersion": "1",
      "memberSpecChecksum": "fbb565ffd1008562",
      "classification": "diagnostic",
      "sourceClassification": "diagnostic-extreme",
      "roleAssignments": 1,
      "simulations": 80
    },
    {
      "memberId": "bulwark-vs-glass-cannon",
      "memberVersion": "1",
      "memberSpecChecksum": "0290f77353a407f4",
      "classification": "diagnostic",
      "sourceClassification": "diagnostic",
      "roleAssignments": 2,
      "simulations": 160
    }
  ],
  "development": {
    "seedBankId": "prototype-0.2-baseline-v1",
    "partition": "development",
    "seedCount": 80,
    "executionOrder": [
      "bulwark-guarded-mirror",
      "bulwark-unguarded-mirror",
      "representative-light-mirror",
      "glass-cannon-mirror",
      "bulwark-vs-glass-cannon"
    ],
    "totalSimulations": 480,
    "roleSwap": "forward-all-seeds-then-swapped-all-seeds"
  },
  "qualificationBinding": "registered-candidate-id-and-complete-configuration-checksum",
  "stage2": {
    "rateDenominator": "member.totalSimulations",
    "hardGates": {
      "qualifying-hits-positive": ">0 totalQualifyingHits",
      "healthy-to-damaged-positive": ">0 totalDamagedTransitions",
      "first-round-immobilisation": "<0.132 firstRoundImmobilisationRate",
      "terminal-disable-incidence": "<0.85 matchesWithAnyDisable",
      "valid-lifecycle-transitions": "0 invalid transition audit errors",
      "qualification-factual-completeness": "0 missing selected-qualification facts",
      "guard-event-semantics": "0 invalid guard transition errors",
      "non-qualifying-selection": "0 component selections linked to non-qualifying hits",
      "damaged-mobility-does-not-end": "0 immobilisations without disabled mobility",
      "disabled-mobility-ends": "every mobility disable occurs in ending round"
    },
    "specialGates": {
      "bulwark-guarded-mirror": ">0 resisted transitions",
      "bulwark-unguarded-mirror": "=0 resisted transitions",
      "representative-light-mirror": "<0.25 firstRoundTerminalDisableRate"
    },
    "suiteGates": {
      "damaged-to-disabled-positive": ">0 damaged-to-disabled transitions across hard members",
      "component-terminal-dominance": "hard-only denominator >=10 and max category share <=0.70; below 10 investigate/not-applicable"
    }
  },
  "stage3": {
    "aggregateScope": "hard-members-only",
    "hardSimulationDenominator": 240,
    "diagnosticsExcluded": true,
    "rules": {
      "drawRate": "<=0.10 pooled hard-member rate",
      "destructionRate": ">=0.10 pooled hard-member rate",
      "immobilisationRate": ">=0.40 and <=0.75 pooled hard-member rate",
      "judgesRate": "<0.45 pooled hard-member rate",
      "anyFinishMethodRate": "<0.85 pooled hard-member rate",
      "averageRounds": ">=4.0 and <=12.0 pooled hard-member mean",
      "roundCapIncidence": "<=0.10 pooled hard-member rate",
      "componentDominance": "denominator >=10 and max category share <=0.70; below 10 investigate/not-applicable"
    },
    "finalIntegrity": "finite factual values required; diagnostic-only; no numeric acceptance threshold",
    "asymmetricDiagnostic": "160 simulations; both role assignments; factual outcomes/checksums required; excluded from hard aggregates"
  }
}
```

### Members, classifications and checksums

Each member has a contract member version `1` and a canonical member identity
`component-lifecycle-v1/<fixtureId>`. The member checksum is computed over the
existing suite versions, partition, referenced complete competitor objects and
the complete fixture object using the canonical function above. It is a
contract-member checksum, not a claim that a separate fixture file exists.

| Order | Member identity                                      | Version | Purpose                                                         | Contract classification | Existing source classification | Fighter X              | Fighter Y              | Role assignments | Simulations | Member checksum    |
| ----: | ---------------------------------------------------- | ------- | --------------------------------------------------------------- | ----------------------- | ------------------------------ | ---------------------- | ---------------------- | ---------------: | ----------: | ------------------ |
|     1 | `component-lifecycle-v1/bulwark-guarded-mirror`      | `1`     | High-armour/reinforced-drive lifecycle stress                   | hard acceptance         | `hard`                         | `bulwark-guarded`      | `bulwark-guarded`      |                1 |          80 | `a713b1e15f5730eb` |
|     2 | `component-lifecycle-v1/bulwark-unguarded-mirror`    | `1`     | Unguarded/no-utility high-armour lifecycle progression          | hard acceptance         | `hard`                         | `bulwark-unguarded`    | `bulwark-unguarded`    |                1 |          80 | `2ad826660516ea92` |
|     3 | `component-lifecycle-v1/representative-light-mirror` | `1`     | Representative lower-armour combat and lifecycle coverage       | hard acceptance         | `hard`                         | `representative-light` | `representative-light` |                1 |          80 | `969b24090087c25b` |
|     4 | `component-lifecycle-v1/glass-cannon-mirror`         | `1`     | Upper-bound low-armour transition-density diagnostic            | diagnostic              | `diagnostic-extreme`           | `glass-cannon`         | `glass-cannon`         |                1 |          80 | `fbb565ffd1008562` |
|     5 | `component-lifecycle-v1/bulwark-vs-glass-cannon`     | `1`     | Armour differentiation and role-swapped whole-combat diagnostic | diagnostic              | `diagnostic`                   | `bulwark-guarded`      | `glass-cannon`         |                2 |         160 | `0290f77353a407f4` |

Diagnostic members are required to execute and report when the full contract
is run, but they are excluded from every hard acceptance aggregate and cannot
silently turn a diagnostic observation into a candidate pass or fail.

## 2. Development partition and execution protocol

### Partition authority

The development partition is the first 80 seeds of the historical
`prototype-0.2-baseline-v1` bank governed by ADR-003. The contract records only
the bank ID and count; it does not expose or copy seed values. The held-out
partition in that bank is permanently sealed and is not part of this contract's
execution surface.

| Field                                   | Frozen value                                                        |
| --------------------------------------- | ------------------------------------------------------------------- |
| seed bank ID                            | `prototype-0.2-baseline-v1`                                         |
| partition                               | `development` only                                                  |
| development seed count                  | 80                                                                  |
| simulations per mirror member           | 80                                                                  |
| simulations for role-swapped diagnostic | 160                                                                 |
| total simulations                       | 480                                                                 |
| role-swapped assignments                | `fighter_a = X, fighter_b = Y`, then `fighter_a = Y, fighter_b = X` |

### Execution order and deterministic identity

The fixture execution order is exactly the member order in Section 1:

1. `bulwark-guarded-mirror`;
2. `bulwark-unguarded-mirror`;
3. `representative-light-mirror`;
4. `glass-cannon-mirror`;
5. `bulwark-vs-glass-cannon`.

For each member, the runner consumes the 80 development seeds in stored order.
For a `roleSwapped: false` member it executes the forward assignment once per
seed. For the asymmetric member it completes all forward assignments, then all
swapped assignments, once per seed. Report construction sorts factual match
records by seed and places the forward assignment before the swapped assignment
for the same seed, matching the existing benchmark report contract.

The deterministic run identity binds, at minimum:

- this contract ID/version/checksum;
- suite ID/schema/checksum and the ordered member/checksum list;
- simulator, ruleset and catalogue versions;
- seed bank ID and `development` partition;
- candidate ID, complete qualification configuration and configuration
  checksum;
- role assignments, execution order and expected simulation counts; and
- every exact match record, report checksum, gate result and final suite
  checksum.

### Failure and report rules

- Reject before simulation if any suite, member, version, candidate binding,
  partition, role assignment, order, count or checksum does not match this
  contract.
- A semantic, provenance, validation or report-integrity error fails the run;
  no partial report is accepted and no missing result is replaced by a
  fabricated or repeated result.
- An infrastructure interruption may be recorded and retried only as the same
  frozen candidate/contract/development run. It cannot authorize changing a
  gate, fixture, seed partition or candidate ID.
- A completed report must preserve the existing benchmark/lifecycle report
  provenance: contract and suite identity, candidate/qualification identity,
  seed bank and partition, fixture/member identity, role assignment, seed,
  exact match facts, metrics, gate results and deterministic checksums.
- No held-out or `all` partition is accepted by this protocol.

## 3. Stage 2 lifecycle qualification gates

Stage 2 answers only whether lifecycle behavior is legal, observable,
replayable and viable under the registered qualification configuration. Every
rate uses the member's `totalSimulations` as denominator. Counts use the exact
event/report fields from the existing lifecycle contracts.

### Hard-member gates

Every hard member must pass all of these rules:

| Gate                                 | Exact rule                                                                             |
| ------------------------------------ | -------------------------------------------------------------------------------------- |
| `qualifying-hits-positive`           | `totalQualifyingHits > 0`                                                              |
| `healthy-to-damaged-positive`        | `totalDamagedTransitions > 0`                                                          |
| `first-round-immobilisation`         | `firstRoundImmobilisationRate < 0.132`                                                 |
| `terminal-disable-incidence`         | `matchesWithAnyDisable < 0.85`                                                         |
| `valid-lifecycle-transitions`        | zero invalid transition audit errors, including zero `healthy -> disabled` transitions |
| `qualification-factual-completeness` | zero missing selected-qualification facts                                              |
| `guard-event-semantics`              | zero invalid guard transition errors                                                   |
| `non-qualifying-selection`           | zero component selections linked to non-qualifying hits                                |
| `damaged-mobility-does-not-end`      | zero immobilisations without disabled mobility                                         |
| `disabled-mobility-ends`             | every mobility disable occurs in the ending round                                      |

The two high-armour members have additional exact requirements:

- `bulwark-guarded-mirror`: `totalResistedTransitions > 0`;
- `bulwark-unguarded-mirror`: `totalResistedTransitions === 0`.

The representative-light member additionally requires
`firstRoundTerminalDisableRate < 0.25`, preserving the accepted
anti-instant-volatility ceiling.

### Suite lifecycle gates

The hard-member aggregate must satisfy:

- `totalDamagedTransitions + totalDisabledTransitions > 0`, with at least one
  damaged-to-disabled transition across hard members; and
- when hard-member terminal disables total at least 10, no component category
  may exceed `0.70` of that hard-only terminal-disable denominator. If the
  denominator is below 10, the result is `investigate/not-applicable`, not an
  automatic pass, and independent review is required before held-out
  confirmation.

Historical v1/v2 replay compatibility, event schema validity and report
reconstruction are Stage 1 semantic/unit requirements. They are prerequisites
for Stage 2 and are not balance gates.

### Diagnostic-member handling

The Glass Cannon diagnostic may report the existing first-round terminal-
disable ceiling `< 0.25` as a diagnostic observation. Its full-match terminal
incidence is diagnostic. The asymmetric diagnostic must report both role
assignments and factual competitor outcomes. Neither diagnostic member
contributes to any hard-member gate, denominator or candidate pass/fail result.

## 4. Stage 3 whole-combat development gates

Stage 3 is separate from lifecycle qualification. Its hard aggregation scope
is the three hard members only: 240 simulations total, with each hard member
retaining its own 80-simulation report. Diagnostic members are excluded from
every Stage 3 acceptance aggregate; they are required coverage diagnostics.

### Outcome and finish rules

The following rules apply to the pooled hard-member denominator unless stated
otherwise. Wins and losses are recorded for named roles but are not ranked or
interpreted as strongest/best results.

| Category             | Metric and denominator                    | Acceptance rule                                                        |
| -------------------- | ----------------------------------------- | ---------------------------------------------------------------------- |
| Outcome distribution | draws / 240 hard-member simulations       | draw rate `<= 0.10`; wins and losses are factual only                  |
| Finish methods       | destruction / 240                         | destruction rate `>= 0.10`                                             |
| Finish methods       | immobilisation / 240                      | immobilisation rate `>= 0.40` and `<= 0.75`                            |
| Finish methods       | judges / 240                              | judges rate `< 0.45`                                                   |
| Finish methods       | any one finish method / 240               | no finish method rate `>= 0.85`                                        |
| Duration             | arithmetic mean of all hard-member rounds | `>= 4.0` and `<= 12.0` rounds                                          |
| Match cap            | matches at `MAX_ROUNDS` / 240             | round-cap incidence `<= 0.10`; every match must respect the engine cap |

These values are the existing 0.2B whole-combat objectives carried forward
from ADR-002, D27-D30 and the historical 0.2B plan. This contract does not
derive them from 0.2D, grid-beta or AB2 held-out outcomes.

### Integrity and component rules

- Final integrity A, final integrity B and integrity differential must be
  present and finite for every hard-member match and reported per member and
  pooled. No accepted numeric final-integrity threshold exists; these values
  are diagnostic-only and cannot independently pass or fail the candidate.
- Total damaged transitions, disabled transitions, resisted transitions and
  per-component damaged/disabled counts must be reported using event-derived
  counts. Stage 2's lifecycle rules remain the authority for transition
  legality and viability.
- Terminal-disable mix is reported as mobility/weapon/utility counts and
  proportions over hard-member terminal disables only. When the denominator is
  at least 10, the component-dominance gate is `max(category share) <= 0.70`.
  Below 10, the result is investigate/not-applicable and cannot authorize fresh
  held-out confirmation.
- Matches with damaged components at the end, qualification incidence,
  resistance rate, critical-hit rate and other existing metrics remain factual
  diagnostics unless explicitly listed as a gate here.

### Required asymmetric diagnostics

`bulwark-vs-glass-cannon` must execute all 80 seeds in both role assignments,
for exactly 160 simulations. The report must include role assignment counts,
competitor X/Y outcomes, finish methods, durations, integrity, transition
facts and deterministic checksums. Missing role coverage or malformed facts is
a protocol/report-integrity failure; the diagnostic outcome itself is not a
hard candidate gate and contributes no value to any hard denominator.

No Stage 3 result may name a best/worst/strongest/weakest opponent, infer slot
fairness, produce a tier/meta conclusion, recommend tuning, rank candidates or
authorize public play.

## 5. Candidate independence

The future candidate is evaluated against this contract unchanged. A candidate
record must bind a new immutable candidate ID, complete qualification
configuration/checksum and this contract ID/version/checksum. A candidate or
development result that fails a gate does not authorize changing gates,
fixtures, denominators or the candidate ID and retrying under the same
candidate identity. Any such change requires a new contract decision and a new
candidate record.

C2 remains the experimental default and is not mutated. AB2 remains frozen and
permanently ineligible for default promotion. This contract selects no future
candidate constants.

## 6. Future held-out boundary

This contract does not generate, identify, commit, inspect or execute a fresh
held-out partition. Any future confirmation must follow ADR-005's independent
custody, commitment, executor, aggregate-release and spent-partition rules.
The development contract never authorizes held-out or `all` access.

## 7. Next task

The contract is accepted. Recommend exactly one next task:

**Select and register one new immutable 0.2B candidate against this frozen
protocol, without benchmark execution.**

That task may record the complete candidate identity and configuration/checksum
for later Stage 1 verification. It must not execute the development suite,
open held-out or `all`, change this contract, select a second candidate, or
begin 0.2E.
