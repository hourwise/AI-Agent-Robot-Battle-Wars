# Active Task

## Post-0.2D next-milestone selection audit - complete

Audit date: 2026-08-08
Starting commit: `356a73fee705a378f065fb4c5b40c4b24d59f91e`

The repository context workflow is being followed. This is a documentation-only
audit to determine the best next engineering milestone after the accepted
Milestone 0.2D closure in D73. Compare the unfinished 0.2B
component-qualification/balance work, the definition of Milestone 0.2E, and any
smaller prerequisite or governance task. Do not implement the recommendation
or begin another milestone.

## Audit boundary

Follow `AGENTS.md`, `docs/INDEX.md`, `docs/SOURCE_OF_TRUTH.md` and only the
relevant current decisions, plans, source and tests. Assess 0.2B and 0.2E from
current repository state and accepted evidence, not roadmap intent alone.

No product-code, simulator, fixture, runtime, beta-governance,
opponent-suite or report behaviour changes are authorised. No provider/API
calls, benchmark/held-out/`all`/readiness or operational-beta execution, grid
opponent-suite execution, balance conclusions from operational grid evidence,
public tournament/ranking/matchmaking work or 0.2E implementation is
authorised. Do not reopen closed 0.2D.

## Audit findings

- Milestone 0.2D remains closed under D73. This audit does not reopen or
  reinterpret its fixture, runner or factual-report contracts.
- 0.2B's lifecycle mechanism and qualification registry are implemented, but
  qualification/balance acceptance remains unresolved. C2 is the unchanged
  experimental default, not an accepted final solution. AB2 passed its
  development gates but failed the strict representative-light held-out gate
  at exactly `0.85`; it is permanently ineligible for default promotion.
- The original held-out partition is spent and cannot validate another
  candidate. The current source rejects held-out and `all` execution before
  seed selection. Useful work is still possible as governance, contract and
  non-evaluation test design, but no new qualification or balance claim can
  be made without a new authorized protocol and genuinely fresh held-out
  partition.
- Historical 0.2E is described as baseline-versus-redesign adaptation
  evaluation with held-out confirmation, overfitting detection and confidence
  reporting. It is not adequately defined as a current implementation
  milestone and remains not started.

## 0.2B status

0.2B needs a new governance decision before implementation or evaluation. That
decision must choose whether to continue or postpone 0.2B, define any
replacement development fixtures and protocol, separate lifecycle gates from
whole-combat acceptance criteria, and specify external custody and one-time use
of a genuinely fresh held-out partition. It must not reuse the spent partition,
promote AB2, infer balance from grid-beta or 0.2D factual reports, or silently
change C2, fixtures or simulator semantics.

## 0.2E status and concise definition

0.2E's purpose would be a separately governed, deterministic baseline-versus-
redesign evaluation that detects development overfitting while preserving the
held-out evidence firewall. Its value is reproducible evidence for safe agent
iteration, not ranking or public play.

Prerequisites are a current qualification/baseline decision, ADR-003-compatible
fresh seed-bank custody and one-time held-out protocol, explicit adaptation and
confidence metrics, versioned baseline/redesign identities, and a reviewed
report/review boundary. Defining 0.2E does not require 0.2B to be marked
complete, but implementation/evaluation should wait for the 0.2B decision or an
explicit decision to evaluate a frozen C2 baseline without calling it final.

Likely phases are governance and metrics; immutable baseline/redesign protocol;
development-only comparison; fresh held-out confirmation; and deterministic
confidence/overfitting reporting. Non-goals are gameplay changes, fixture
tuning, provider calls without separate authorization, held-out exposure to an
AI reviewer, grid opponent-suite execution, balance/ranking conclusions,
public tournament work and persistence or operational beta expansion.

## Recommended next task

**Create and accept a governance-only 0.2B replacement-evidence decision or
ADR.** Do not implement a candidate or run evaluation in that task until the
decision freezes the candidate protocol, replacement fixture strategy,
whole-combat acceptance boundary, fresh held-out custody and sequencing with
0.2E.

This is the smallest task that materially advances the project: it resolves
the evidence and authority gap created by the spent held-out partition before
any simulator, fixture, benchmark or adaptation work. 0.2E should follow that
decision rather than be started from the historical roadmap definition.

## Verification

- Documentation/context review completed using `AGENTS.md`, `docs/INDEX.md`,
  `docs/SOURCE_OF_TRUTH.md`, relevant ADRs, D29-D32, D61-D74, current plans,
  source and tests. No benchmark, held-out, `all`, readiness, beta or provider
  execution occurred.
- `npm.cmd run check` passed.
- `npm.cmd run lint` passed.
- Formatting checks for changed documentation files passed.
- No full test suite was required because this audit made documentation-only
  changes.

## Remaining issues

- The recommended governance task is not started by this audit.
- Outside the selected next task, 0.2B implementation/evaluation, 0.2E,
  general grid opponent-suite execution, later evaluation/adaptation, balance
  conclusions, ranking/public tournament work and any later milestone remain
  deferred or separately governed.

## Deviations

- No source, test, fixture, simulator, runtime or operational files changed.
- D74 records this selection audit as a new planning decision; historical
  decisions and the closed 0.2D implementation were not rewritten.
