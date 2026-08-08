# Active Task

## Milestone 0.2B development protocol contract - complete

Audit date: 2026-08-08
Starting commit: `2219ed6ccb95c609684baf9777559aa422b2e8f9`

## Closure verdict

Accepted. D76 accepts the documentation-only contract
`component-lifecycle-development-v1`, version `1`, checksum
`a3fd0afdd8c35350`. The contract freezes the existing
`component-lifecycle-v1` suite and does not register or execute a candidate.

## Work completed

- Followed `AGENTS.md` → `docs/INDEX.md` → the relevant current source of
  truth, ADR-005, ADR-002/ADR-003 material, D24-D32/D75, historical 0.2B
  plans, fixture/benchmark/metric/qualification contracts and tests.
- Added [`docs/PROTOCOL-0.2B-DEVELOPMENT-V1.md`](../PROTOCOL-0.2B-DEVELOPMENT-V1.md),
  freezing the existing suite checksum, exact build/policy/member identities
  and checksums, canonical member order, classifications and provenance.
- Preserved the existing five-member suite: three hard acceptance mirrors
  (guarded Bulwark, unguarded Bulwark and representative light) and two
  required diagnostics (Glass Cannon mirror and role-swapped
  Bulwark-versus-Glass Cannon). No dedicated fixture bytes were created.
- Froze the development-only `prototype-0.2-baseline-v1` partition, 80 seeds,
  forward-then-swapped role execution and 480 total simulations, with
  fail-closed input/report integrity rules.
- Froze exact Stage 2 lifecycle gates and Stage 3 whole-combat rules. Stage 3
  pools only the three hard members over 240 simulations; diagnostics remain
  factual and excluded from hard denominators and candidate pass/fail.
  Final-integrity values are required factual diagnostics without an accepted
  numeric threshold.
- Recorded D76 in `docs/DECISIONS.md`, routed the contract from
  `docs/INDEX.md`, and updated `docs/SOURCE_OF_TRUTH.md` to agree.

## Boundaries and remaining work

No source, test, simulator, fixture-byte, candidate, benchmark, held-out,
`all`, provider, beta, grid opponent-suite, operational-beta or 0.2E work was
performed. C2 remains the experimental non-final default; AB2 remains
permanently ineligible for default promotion; the spent held-out partition
remains sealed under ADR-005.

The single next task is:

> **Select and register one new immutable 0.2B candidate against this frozen
> protocol, without benchmark execution.**

That task must not change this contract, select a second candidate, execute
evaluation or begin 0.2E. 0.2B qualification/balance acceptance remains open.
0.2E, general grid opponent-suite execution, later evaluation, ranking/public
tournament work and operational beta expansion remain outside this task.

## Verification

- `npm.cmd run check`
- `npm.cmd run lint`
- targeted Prettier check for changed documentation
- `git diff --check`
- Full tests were not run because this was documentation-only; the accepted
  Phase 4/5 and lifecycle regression evidence remains unchanged.

## Deviations

None. The contract reuses the existing committed suite and makes no fixture
or production-code changes.
