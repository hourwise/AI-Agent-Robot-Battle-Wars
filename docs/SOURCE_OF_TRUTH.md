# AI Robot Battle Arena - Source of Truth

> Audited 2026-08-08 against commit `a06be033a72800427603aa4bba037b6ef9379c93`
> on `agent/0.2d-opponent-suite-independent-graphs`. This file is a concise
> routing summary. The linked source, tests, ADRs and decision log remain the
> detailed authority.

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

### Milestone 0.2D opponent fixtures and runner

The current branch implements the following 0.2D work:

- ADR-004 governance and the six conceptual archetypes are accepted.
- The strict v1 fixture schema, canonical checksum/serialization, deep
  immutability and secure fixed-root loader are implemented.
- Six human-selected v1 fixture files (`bulwark`, `skirmisher`, `crusher`,
  `spinner`, `controller`, `generalist`) are tracked and frozen by
  [`docs/OPPONENT-SUITE-V1-SELECTION.md`](OPPONENT-SUITE-V1-SELECTION.md).
- Normal legacy Bulwark input is loaded from `bulwark.v1` and remains
  behaviourally equivalent to the historical configuration. The governed
  successor source baseline v2 protects the legacy/default boundary.
- The Phase 4 opponent-suite runner is implemented for `legacy` only. It loads
  all six canonical fixtures, exposes the two grid-only/incompatible fixtures
  factually without executing them, executes the four compatible opponents in
  twelve ordered role-aware matchups, and repeats each execution for a
  determinism check. It makes no provider calls, persists no report, opens no
  benchmark or held-out data, and has no package script; invoke it directly as
  `npx tsx src/app/run-opponent-suite.ts --runtime legacy --seed <N>`.

The runner implementation and its reference-isolation hardening are covered by
the opponent-suite unit tests. The audit found no Phase 5 factual cross-opponent
report implementation.

## Incomplete work and recommended ordering

- **Current next implementation task:** Milestone 0.2D Phase 5, a separate
  factual cross-opponent report over the runner's factual outputs. It should
  preserve the existing evidence firewall, avoid rankings/balance conclusions,
  define its own immutable/versioned report contract, and receive independent
  review before any later evaluation. This task is recommended only; it was
  not started by this audit.
- 0.2B qualification/balance acceptance remains unresolved. The held-out AB2
  result failed one strict gate, and the spent held-out partition must not be
  reused. Any further candidate or whole-combat balance evaluation needs a new
  separately authorised decision.
- Grid combat balance, fairness, slot advantage, performance and general
  opponent-suite behaviour are not established by the existing beta or runner
  evidence. No conclusion should be inferred from the stored operational
  outcomes.

## Accepted future plans

- Continue 0.2D only through separately reviewed fixture/report/evaluation
  phases. The accepted current 0.2D contract and evidence boundaries are in
  [`docs/ADR-004-multi-opponent-fixture-format.md`](ADR-004-multi-opponent-fixture-format.md),
  [`docs/OPPONENT-SUITE-V1-SELECTION.md`](OPPONENT-SUITE-V1-SELECTION.md) and
  decisions D61-D71.
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
  latest D61-D71 decision entries and the code supersede older phase snapshots.

## Confirmed documentation discrepancies

These are recorded rather than silently reconciled:

- The top of [`README.md`](../README.md) still labels the project Prototype 0.1
  and says 0.2 is planned. Its body documents work through the earlier 0.2C
  governance stage, but not the current 0.2D D61-D71 work. The source and latest
  decision entries establish the newer implementation state.
- The 0.2D section in [`docs/PROTOTYPE-0.2-EXPERIMENTAL-PLAN.md`](PROTOTYPE-0.2-EXPERIMENTAL-PLAN.md)
  still describes only Phase 0/Phase 1 and says fixtures/runner are absent;
  D64-D71 and the source show six fixtures, Bulwark migration, successor v2 and
  the Phase 4 runner are present.
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

- `npm.cmd run check`: passed.
- `npm.cmd run lint`: passed.
- Opponent/Bulwark targeted suite: 13 files, 143 tests passed, no type errors.
- Full `npm.cmd test -- --run`: 176 files, 2,057 tests passed, with no type
  errors (the command required a longer 300-second limit).
- Full `npm.cmd run format:check`: the command completes, but fails only on
  the unmodified pre-existing context files `AGENTS.MD` and `docs/ACTIVE.md`.
  The three documents created by this task pass a targeted formatting check.
