# Project Knowledge Index

> This file routes agents to authoritative project information. It is an
> index, not a replacement for the referenced documents.

## Start here

1. Read [`AGENTS.md`](../AGENTS.md) for repository working rules.
2. Read [`docs/tasks/ACTIVE.md`](tasks/ACTIVE.md) for the current task boundary.
3. Read [`docs/SOURCE_OF_TRUTH.md`](SOURCE_OF_TRUTH.md) for the audited current
   state and the implementation/planning split.
4. For a decision or contract, follow the authority map below and inspect the
   source and tests named by that document.

`docs/ACTIVE.md` is a legacy duplicate of the active-task note. It predates
the `docs/tasks/` routing convention and is not the canonical task file.

## Authority map

| Need                                            | Start with                                                                                                                                                                       | Notes                                                                                                                           |
| ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Current product and implementation state        | [`docs/SOURCE_OF_TRUTH.md`](SOURCE_OF_TRUTH.md)                                                                                                                                  | Concise audit snapshot; links to detail instead of copying it.                                                                  |
| Current task and acceptance boundary            | [`docs/tasks/ACTIVE.md`](tasks/ACTIVE.md)                                                                                                                                        | Update this after each task; do not infer a later task from a plan.                                                             |
| Chronological accepted decisions                | [`docs/DECISIONS.md`](DECISIONS.md)                                                                                                                                              | Latest entries D61-D78 cover the current 0.2D closure, development protocol and candidate-registration correction.              |
| Positioning and grid runtime decisions          | [`docs/ADR-001-positioning-representation.md`](ADR-001-positioning-representation.md)                                                                                            | Long, phase-by-phase record; use the latest status entries and source/tests for implementation truth.                           |
| Component lifecycle and qualification decisions | [`docs/ADR-002-component-damage-lifecycle.md`](ADR-002-component-damage-lifecycle.md), [`docs/ADR-002-tuning-amendment-candidate-B.md`](ADR-002-tuning-amendment-candidate-B.md) | Includes unresolved qualification/balance outcomes and historical candidates.                                                   |
| Seed-bank governance                            | [`docs/ADR-003-seed-bank-evaluation.md`](ADR-003-seed-bank-evaluation.md)                                                                                                        | Protects development/held-out separation.                                                                                       |
| 0.2B replacement-evidence governance            | [`docs/ADR-005-0.2b-replacement-evidence-protocol.md`](ADR-005-0.2b-replacement-evidence-protocol.md)                                                                            | Governs future candidate stages, fixtures, whole-combat gates and fresh held-out custody; does not implement a candidate.       |
| 0.2B development fixture/protocol contract      | [`docs/PROTOCOL-0.2B-DEVELOPMENT-V1.md`](PROTOCOL-0.2B-DEVELOPMENT-V1.md)                                                                                                        | Freezes the existing development suite, member identities, deterministic execution and Stage 2/3 gates; registers no candidate. |
| 0.2B qualification registry                     | [`../src/simulator/component-qualification-registry.ts`](../src/simulator/component-qualification-registry.ts)                                                                   | Immutable D76 C1/C2/AB2 registry; C2 remains the default and unknown IDs fail closed.                                           |
| Opponent fixtures and 0.2D governance           | [`docs/ADR-004-multi-opponent-fixture-format.md`](ADR-004-multi-opponent-fixture-format.md), [`docs/OPPONENT-SUITE-V1-SELECTION.md`](OPPONENT-SUITE-V1-SELECTION.md)             | ADR-004 is the contract; the selection document freezes the six v1 identities.                                                  |
| Architecture and module boundaries              | [`docs/ARCHITECTURE.md`](ARCHITECTURE.md)                                                                                                                                        | Detailed map of legacy/grid runtimes, beta governance, persistence and replay.                                                  |
| Rules, events and security                      | [`docs/RULESET.md`](RULESET.md), [`docs/EVENT_FORMAT.md`](EVENT_FORMAT.md), [`docs/SECURITY.md`](SECURITY.md)                                                                    | Some of these are historical prototype documents; see the discrepancy section in the source-of-truth file.                      |
| Historical prototype validation                 | [`docs/PROTOTYPE-0.1-VALIDATION.md`](PROTOTYPE-0.1-VALIDATION.md), [`docs/PROTOTYPE-0.2-EXPERIMENTAL-PLAN.md`](PROTOTYPE-0.2-EXPERIMENTAL-PLAN.md)                               | Useful for rationale and evidence; the 0.2D section is behind the latest decision log.                                          |

## Important code areas

| Area                        | Code                                                                                                                                                                       | What it owns                                                                                                          |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Deterministic combat        | [`src/simulator/`](../src/simulator/)                                                                                                                                      | Legacy five-zone `runMatch`, opt-in grid `runGridMatch`, movement, damage, components, seeded randomness and victory. |
| Contracts and validation    | [`src/schemas/`](../src/schemas/), [`src/validation/`](../src/validation/), [`src/catalogue/`](../src/catalogue/)                                                          | Zod schemas, build legality, versioned records, policies and catalogue v1.                                            |
| Events and replay           | [`src/events/`](../src/events/), [`src/replay/`](../src/replay/)                                                                                                           | Typed event stream, text replay, statistics, legacy/grid positioning dispatch and ASCII renderers.                    |
| Persistence and reports     | [`src/persistence/`](../src/persistence/), [`src/reports/`](../src/reports/)                                                                                               | Atomic JSON repositories, factual reports, reviews, final-state projection and series reports.                        |
| Agents and prompts          | [`src/agents/`](../src/agents/), [`src/prompts/`](../src/prompts/)                                                                                                         | Provider-neutral agent contract, DeepSeek adapter, scripted Bulwark and bounded fallback/review flows.                |
| Grid canary/readiness/beta  | [`src/canary/`](../src/canary/), [`src/readiness/`](../src/readiness/), [`src/beta/`](../src/beta/), [`src/app/run-grid-beta-match.ts`](../src/app/run-grid-beta-match.ts) | Explicit, isolated grid evidence and governed internal beta paths; these do not change the legacy default.            |
| Opponent fixtures and suite | [`src/opponents/`](../src/opponents/), [`src/app/run-opponent-suite.ts`](../src/app/run-opponent-suite.ts)                                                                 | Fixed-root immutable fixture loading, canonical suite identity and the legacy-only development runner.                |
| Application entry points    | [`src/app/`](../src/app/)                                                                                                                                                  | Normal match/series commands plus explicit canary, readiness, beta and replay commands.                               |
| Tests                       | [`tests/unit/`](../tests/unit/), [`tests/integration/`](../tests/integration/)                                                                                             | Contract, regression, provenance, filesystem and end-to-end coverage.                                                 |

## Repository configuration and data

- [`package.json`](../package.json) is the executable command/dependency map;
  Node.js 22+ and TypeScript ESM are required.
- [`tsconfig.json`](../tsconfig.json), [`vitest.config.ts`](../vitest.config.ts),
  [`eslint.config.js`](../eslint.config.js), and
  [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) define local and CI
  verification.
- Tracked canonical data includes [`data/opponents/`](../data/opponents/) and
  [`data/bench-fixtures/`](../data/bench-fixtures/). Match, canary, readiness,
  beta, and series outputs are ignored by `.gitignore`; their schemas,
  validators, hashes and governance identities live in source/docs.

## Historical planning material

[`README.md`](../README.md), [`README_FIRST.md`](../README_FIRST.md),
[`BUILDPLAN.md`](../BUILDPLAN.md), [`FUTURE_BUILDS.md`](../FUTURE_BUILDS.md),
[`OPENCODE_PROMPTS.md`](../OPENCODE_PROMPTS.md), and
[`docs/RELEASE-CHECKLIST.md`](RELEASE-CHECKLIST.md) explain the original
prototype and roadmap. They are useful context, but do not override accepted
decisions, current source, tests, or `docs/SOURCE_OF_TRUTH.md`.
