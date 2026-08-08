# AI Robot Battle Arena - Source of Truth

> Audited 2026-08-08 from starting commit `8ff5bf2cd0bb0a5f17cd09555fa18f2ab5af3331`
> on `agent/0.2d-closure-audit`. This file is a concise routing summary. The
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

## Incomplete work and recommended ordering

- Milestone 0.2D is closed. Any later opponent evaluation, adaptation or
  broader runtime work requires a separately authorised task and must not be
  inferred from the factual fixture, runner or report endpoints.
- 0.2B qualification/balance acceptance remains unresolved. The held-out AB2
  result failed one strict gate, and the spent held-out partition must not be
  reused. Any further candidate or whole-combat balance evaluation needs a new
  separately authorised decision.
- General grid opponent-suite execution is not authorised. Grid combat balance,
  fairness, slot advantage, performance and general opponent-suite behaviour
  are not established by the existing beta or legacy runner evidence.
- Later evaluation, ranking/public tournament work and Milestone 0.2E remain
  outside this closure and are not started.

## Accepted future plans

- Preserve the closed 0.2D fixture, runner and report contracts. Any future
  evaluation or runtime expansion requires a new reviewed decision; the
  accepted 0.2D boundaries are in ADR-004, the frozen selection document and
  decisions D61-D73.
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
  latest D61-D73 decision entries and the code supersede older phase snapshots.

## Confirmed documentation discrepancies

These are recorded rather than silently reconciled:

- The top of [`README.md`](../README.md) still labels the project Prototype 0.1
  and says 0.2 is planned. Its body documents work through the earlier 0.2C
  governance stage, but not the current 0.2D D61-D73 work. The source and latest
  decision entries establish the newer implementation state.
- The 0.2D section in [`docs/PROTOTYPE-0.2-EXPERIMENTAL-PLAN.md`](PROTOTYPE-0.2-EXPERIMENTAL-PLAN.md)
  still describes only Phase 0/Phase 1 and says fixtures/runner are absent;
  D64-D73 and the source show six fixtures, Bulwark migration, successor v2,
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
