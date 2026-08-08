# AI Robot Battle Arena - Source of Truth

> Audited 2026-08-08 from starting commit `2219ed6ccb95c609684baf9777559aa422b2e8f9`
> on `agent/0.2b-development-protocol-contract`. This file is a concise routing summary. The
> linked source, tests, ADRs and decision log remain the detailed authority.

## Product purpose

Forge Arena is a deterministic text-based robot combat arena. An AI agent may
design and control a robot under the same fixed catalogue and budget rules as
other fighters; the application validates proposals and the deterministic
simulator decides combat. Typed events are the factual record and drive text
replay, ASCII replay, statistics, factual reports and later review. The model
is an input source, not an authority over combat outcomes.

The current product is still a local prototype/development system. It is not a
public, ranked, tournament, matchmaking or monetised game. The original
prototype purpose and guardrails are described in [`BUILDPLAN.md`](../BUILDPLAN.md)
and [`FUTURE_BUILDS.md`](../FUTURE_BUILDS.md).

## Current architecture

- TypeScript ESM running on Node.js 22+, with Zod schemas, Vitest tests and
  atomic JSON repositories. The executable command and dependency boundary is
  [`package.json`](../package.json).
- The simulator is authoritative and seeded. The normal legacy runtime is
  `runMatch` with identity `0.2.0 / legacy-five-zone-v1`, five-zone positions,
  global ruleset `0.2.0`, catalogue `1`, and schema-v2 match persistence.
  Normal `match` and `series` paths remain on this runtime.
- The additive grid runtime is entered only through explicit grid paths. Its
  identity is `0.3.0 / grid-3x3-v1 / ruleset 0.2.0 / catalogue 1`; it supports
  grid movement, flank/lateral policy behaviour, grid schema-v3 records,
  version-aware replay and factual reports. The core entry point is
  [`src/simulator/grid-runtime.ts`](../src/simulator/grid-runtime.ts).
- Provider-neutral agents live under [`src/agents/`](../src/agents/). DeepSeek
  is an adapter behind the agent interface; model output is schema-validated,
  bounded and fallible. Scripted and development-only paths do not need a
  provider.
- Events, persistence, replay and reporting are separate layers. Important
  boundaries are documented in [`docs/ARCHITECTURE.md`](ARCHITECTURE.md) and
  implemented under `src/events/`, `src/persistence/`, `src/replay/` and
  `src/reports/`.
- Opponents are now fixed, versioned local fixtures. The fixed-root loader and
  canonical suite are under [`src/opponents/`](../src/opponents/); canonical
  v1 fixture bytes are tracked under [`data/opponents/`](../data/opponents/).

## Implemented state

### Legacy prototype and AI loop

The original catalogue/build validation, seeded five-zone simulator, typed
events, text/ASCII replay, deterministic reports, DeepSeek design/policy/review
adapter, fallback behaviour, Bulwark scripted opponent, best-of-five series,
usage tracking and atomic match/series persistence are implemented. Begin at
[`src/app/run-match.ts`](../src/app/run-match.ts),
[`src/app/run-series.ts`](../src/app/run-series.ts),
[`src/simulator/`](../src/simulator/), and the relevant tests.

The component lifecycle mechanism and qualification registry are implemented,
but its balance/acceptance milestone is not closed. C2
(`component-impact-c2`) is the experimental default; AB2 is retained for
historical reproducibility and is permanently ineligible for default
promotion. See [`docs/ADR-002-component-damage-lifecycle.md`](ADR-002-component-damage-lifecycle.md),
the amendment, and [`src/simulator/component-qualification-registry.ts`](../src/simulator/component-qualification-registry.ts).

### Grid progression and bounded beta

The accepted 0.2C progression is implemented through the bounded beta surface:

- grid geometry, schema-v3 persistence/replay, runtime hardening, lateral/flank
  behaviour, version-aware reports/series contracts, single-match and adaptive
  series canaries, readiness evaluation, grapple coverage, governance and
  provenance hardening are present in source and tests;
- `match:grid:beta` is an explicit, acknowledged, local scripted single-match
  beta with fixed roots, immutable ten-file bundles, a suspension/kill-switch
  boundary and read-only replay via `replay:grid:beta`;
- GRID-BETA-001 and observation window A are present as controlled operational
  evidence. They are explicitly not balance, readiness, held-out, adaptation or
  public-play evidence.

The legacy default remains unchanged. No normal command silently selects grid,
there is no mixed-runtime series, and default grid activation has not occurred.
The latest current decision entries are D52-D60 in
[`docs/DECISIONS.md`](DECISIONS.md); the detailed implementation map is in
[`docs/ARCHITECTURE.md`](ARCHITECTURE.md).

### Milestone 0.2D opponent fixtures, runner and report — complete

Milestone 0.2D is complete through the accepted Phase 0–5 endpoints:

- **Phase 0 (D61):** ADR-004 governance is accepted for immutable,
  versioned, runtime-neutral fixtures and explicitly bounded local execution;
  the six conceptual archetypes are descriptive identities, not performance
  claims.
- **Phase 1 (D62-D63):** the strict v1 fixture schema, complete canonical
  checksum/serialization, nested exact-key hardening, deep immutability and
  secure fixed-root loader are implemented and tested.
- **Phase 2 (D64-D65):** the human-selected six fixture identities and exact
  canonical bytes/checksums are frozen and tracked for `bulwark`, `skirmisher`,
  `crusher`, `spinner`, `controller` and `generalist`. Legacy compatibility is
  supported for four and explicitly incompatible for `skirmisher` and
  `controller`.
- **Phase 3 (D66-D69):** normal legacy Bulwark input loads only through the
  canonical `bulwark.v1` fixture and migration equivalence is tested. The
  successor-v2 source baseline and dual-authority preflight preserve the
  legacy/default boundary, canonical Bulwark bytes and explicit grid-beta
  governance.
- **Phase 4 (D70-D71):** the development runner is legacy-only, loads all six
  fixtures, exposes the two incompatible members without execution, executes
  the four compatible fixtures in twelve ordered role-aware matchups, and
  repeats each matchup with independent complete execution graphs. It makes no
  provider calls, persists no report, accesses no evaluation evidence and has
  no package command.
- **Phase 5 (D72):** the immutable/versioned `OpponentSuiteReportV1` preserves
  and validates the complete run provenance and exact match records, emits
  canonical-order factual W/L/D aggregates, keeps incompatible fixtures
  explicit and non-executed, and provides deterministic machine/text output.

The accepted Phase 0–5 implementation is covered by the relevant fixture,
migration, successor-governance, opponent-suite and report tests. No later
0.2D phase is pending.

## 0.2B development protocol contract

D75/ADR-005 established the replacement-evidence governance boundary, and D76
accepted the versioned development contract
[`docs/PROTOCOL-0.2B-DEVELOPMENT-V1.md`](PROTOCOL-0.2B-DEVELOPMENT-V1.md).
It binds contract `component-lifecycle-development-v1` version `1`, checksum
`a3fd0afdd8c35350`, to the existing `component-lifecycle-v1` suite,
checksum `ffc11deb47e6049f`. The suite contains five members in canonical
order: three hard acceptance mirrors (guarded Bulwark, unguarded Bulwark and
representative light) and two required diagnostics (Glass Cannon mirror and
role-swapped Bulwark-versus-Glass Cannon). It uses the development partition
of `prototype-0.2-baseline-v1`, 80 seeds, forward-then-swapped role execution
for the asymmetric member and 480 simulations total.

The contract freezes exact member/build/policy identities and checksums,
complete provenance and report bindings, fail-closed input/report validation,
the Stage 2 lifecycle gates and the Stage 3 whole-combat rules. Stage 3 pools
only the three hard members over 240 simulations. Diagnostics remain factual
coverage and contribute to no hard denominator or candidate pass/fail. Final
integrity is required and reported but has no accepted numeric threshold.
No candidate is registered or executed by D76, and no fixture bytes or
simulator behavior changed.

### 0.2B status and remaining authority gap

The healthy-to-damaged-to-disabled mechanism, versioned records, lifecycle
reports and qualification registry are implemented. C2
(`component-impact-c2`) remains the unchanged experimental runtime default and
is not an accepted final balance solution. AB2
(`component-impact-ab2`) passed its development lifecycle gates, but its one-
time held-out confirmation failed the strict representative-light terminal gate
at exactly `0.85`; D32 permanently sealed that result and made AB2 ineligible
for default promotion. The original held-out partition cannot validate another
candidate, and current source rejects held-out and `all` execution before seed
selection. The current development lifecycle suite remains an auditable
development contract whose selected C2 result is not a 0.2B acceptance.

Useful work remains possible without violating the evidence restrictions:
selecting and registering one candidate against the accepted immutable
development contract, later semantic/unit verification, and ordinary
non-evaluation tests. No new qualification or balance conclusion is valid
until a candidate completes the frozen development stages and a genuinely
fresh held-out partition is independently held and used for one-time
confirmation. The spent partition, AB2 result, grid-beta outcomes and 0.2D
factual reports cannot supply that evidence.

ADR-005 and D76 now govern the future replacement cycle. Together they accept
the four-stage evidence model (semantic/unit, development qualification,
whole-combat development acceptance and one-time fresh held-out confirmation),
immutable candidate authority, bounded versioned multi-fixture development
evidence, predeclared whole-combat metric categories and independent fresh
held-out custody. D76 selects no candidate constants, creates no fixtures and
changes no simulator behavior.

### 0.2E status and current definition

The historical plan defines 0.2E as baseline-versus-redesign adaptation
evaluation with held-out confirmation, overfitting detection and confidence
reporting. D61, D73, D75 and D76 leave it not started; the historical dependency
from 0.2D does not automatically authorize it, and the plan is not a
sufficient current implementation contract.

A concise current definition would be: a separately governed deterministic
evaluation that compares explicitly versioned baseline and redesign inputs,
uses development evidence only for development decisions, protects a fresh
held-out partition from the AI review context, detects development/held-out
regression and emits factual confidence/overfitting results. Its value is safe,
reproducible agent iteration, not ranking, public play or an automatic balance
verdict.

Prerequisites are a current component-qualification/baseline decision,
ADR-003-compatible fresh seed-bank custody and one-time held-out protocol,
explicit adaptation and confidence metrics, versioned baseline/redesign
identities, and a reviewed report/review boundary. D76 does not authorize 0.2E
implementation or evaluation; those require a separate 0.2E governance
decision and must preserve the 0.2B evidence boundary. Likely phases are
governance and metrics;
immutable baseline/redesign protocol; development-only comparison; fresh
held-out confirmation; and deterministic confidence/overfitting reporting.
Non-goals are gameplay or fixture changes, unreviewed provider/adaptation
calls, held-out exposure to an AI reviewer, grid opponent-suite execution,
balance/ranking conclusions, public tournament work and operational beta
expansion.

### Recommended ordering

0.2B continues at the candidate-registration stage, while candidate
implementation, benchmark execution and held-out confirmation are postponed.
The next task is
**to select and register one new immutable 0.2B candidate against the frozen
development protocol, without benchmark execution**. That task must preserve
the accepted contract and may not select a second candidate or begin 0.2E.

Milestone 0.2D is closed. Any later opponent evaluation, adaptation or broader
runtime work requires a separately authorised task and must not be inferred
from the factual fixture, runner or report endpoints. General grid
opponent-suite execution is not authorised; grid combat balance, fairness, slot
advantage, performance and general opponent-suite behaviour are not established
by existing beta or legacy runner evidence. Ranking/public tournament work,
operational beta expansion and later milestones remain outside the current
authorization.

## Accepted future plans

- Preserve the closed 0.2D fixture, runner and report contracts. Any future
  evaluation or runtime expansion requires a new reviewed decision; the
  accepted 0.2D boundaries are in ADR-004, the frozen selection document and
  decisions D61-D76.
- Keep the grid beta explicitly selected and internal while gathering only
  governed evidence. Any broader grid use, default migration or public play
  requires a new review/decision; the existing beta approval is not such
  permission.
- Preserve versioned replay/persistence and the legacy path while later work
  considers adaptation, public replay, online competition and additional game
  formats. Those are roadmap items in [`FUTURE_BUILDS.md`](../FUTURE_BUILDS.md),
  not implementation authorization.

## Explicitly deferred or prohibited

- No default grid activation, silent runtime selection, automatic migration of
  legacy records, mixed-runtime series, public/ranked/tournament play,
  matchmaking, prizes or monetisation.
- No general grid cross-opponent matrix runner is authorized by ADR-004; the
  current 0.2D runner is legacy-only. The bounded grid beta is not a substitute
  for that runner.
- No provider calls, adaptation, learning between matches, benchmark/held-out/
  `all` access, AB2 optimization, or use of GRID-BETA-001-005 outcomes for
  fixture tuning or balance claims.
- The older public-roadmap features in `FUTURE_BUILDS.md` remain deferred until
  the deterministic local loop and its governance justify them.

## Important constraints

- Preserve the authoritative simulator/event log boundary: model prose,
  reviews, reports and renderers cannot alter combat facts.
- Keep user AI credentials outside project custody. `DEEPSEEK_API_KEY` is read
  from environment configuration only; secrets must not enter source, data,
  prompts, logs or commits. See [`docs/SECURITY.md`](SECURITY.md).
- Preserve explicit runtime identities, schema versions, immutable canonical
  fixtures, fixed filesystem roots, atomic publication and fail-closed
  validation. Source-governance changes require the reviewed successor
  baseline process described in decisions D66-D69.
- Do not tune from forbidden evidence or change a frozen fixture in place;
  semantic fixture changes require a new fixture version.
- Prefer the current source/tests over stale summaries. In particular, the
  latest D61-D76 decision entries and the code supersede older phase snapshots.

## Confirmed documentation discrepancies

These are recorded rather than silently reconciled:

- The top of [`README.md`](../README.md) still labels the project Prototype 0.1
  and says 0.2 is planned. Its body documents work through the earlier 0.2C
  governance stage, but not the current 0.2D D61-D76 work. The source and latest
  decision entries establish the newer implementation state.
- The 0.2D section in [`docs/PROTOTYPE-0.2-EXPERIMENTAL-PLAN.md`](PROTOTYPE-0.2-EXPERIMENTAL-PLAN.md)
  still describes only Phase 0/Phase 1 and says fixtures/runner are absent;
  D64-D76 and the source show six fixtures, Bulwark migration, successor v2,
  the Phase 4 runner and the Phase 5 report are present.
- [`docs/RULESET.md`](RULESET.md) retains the earlier v1 prose, including the
  old critical/component wording and binary component description. The running
  simulator and ADR-002 lifecycle/qualification documents are the more current
  implementation evidence.
- [`docs/RELEASE-CHECKLIST.md`](RELEASE-CHECKLIST.md) is a historical Prototype
  0.1 release checklist with old version/test-count claims; it is not a current
  release gate.
- `docs/tasks/ACTIVE.md` was missing at audit start. The existing
  [`docs/ACTIVE.md`](ACTIVE.md) is a legacy duplicate, so the requested
  `docs/tasks/ACTIVE.md` is now the canonical active-task file.
- `package.json` remains version `0.1.0` and intentionally has no package
  script for the Phase 4 opponent-suite CLI; this matches the current runner
  design but differs from the broader maturity implied by the roadmap.

## Audit verification

- D76 contract audit: AGENTS.md, docs/INDEX.md, the current source of truth,
  ADR-005, ADR-002/ADR-003 material, D24-D32/D75, historical 0.2B plans,
  current fixture/benchmark/metric/qualification contracts and relevant tests
  were inspected without benchmark, held-out, `all`, readiness, beta or
  provider execution. No source, test or fixture-byte files changed.
- D76 verification: `npm.cmd run check`, `npm.cmd run lint`, targeted
  documentation formatting and `git diff --check` passed.
- The full test suite was not required because this task makes documentation-
  only governance changes; the accepted 0.2D closure regression evidence
  remains the current implementation evidence.
- Closure audit relevant Phase 0-5 regression suite: 16 files, 158 tests
  passed, no type errors. The sandbox supplied a repository-local Git safety
  configuration to the test process so successor source-object checks could
  read the committed historical baseline; no source or test files changed.
- Previous Phase 5 full verification at the unchanged starting commit:
  177 files, 2,064 tests passed, no type errors; `npm.cmd run check` and
  `npm.cmd run lint` passed.
- Closure audit documentation formatting and context checks pass for changed
  files. Repository-wide `format:check` remains limited by the pre-existing
  untouched `AGENTS.md` style issue.
