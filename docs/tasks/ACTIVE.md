# Active Task

## Milestone 0.2D Phase 5 - active

Audit date: 2026-08-08

The repository context workflow was followed before implementation. The Phase
4 legacy-only opponent-suite runner, its canonical suite identity, ADR-004,
the D61-D71 decisions and the existing factual-report/schema patterns were
reviewed. This task is limited to a factual report derived from
`OpponentSuiteRunV1`.

## Scope and acceptance boundary

Implement a deterministic, immutable, versioned factual cross-opponent report
over a valid Phase 4 `OpponentSuiteRunV1`. Preserve and validate the complete
runner provenance: suite identity/checksum, legacy runtime, seed, all six
fixture identities and compatibility declarations, and the exact twelve match
records. Add only factual per-opponent W/L/D aggregation in canonical suite
order; the two legacy-incompatible fixtures remain explicit non-executed
members with zero executed-match facts. A deterministic machine-readable
contract and human-readable renderer are in scope.

The report must not rank or score opponents, sort by outcomes, make balance,
difficulty, tier, meta or tuning claims, infer slot fairness, access
benchmark/held-out/`all`/readiness/operational-beta evidence, use a provider or
adaptation, create a grid suite runner, change fixtures/simulator/C2/runtime
defaults/grid governance, add persistence or add a package command. The
successor-v2 protected source boundary and canonical fixture bytes remain
unchanged.

## Work completed

- Added the strict `OpponentSuiteRunV1` input and `OpponentSuiteReportV1`
  machine-readable schemas.
- Added a fail-closed report builder/validator that binds suite identity and
  checksum, legacy runtime, seed, six fixture identities/compatibilities, the
  ordered runner plan, fighter identities, per-match IDs and exact reported
  facts.
- Added immutable canonical-order factual W/L/D aggregation and deterministic
  JSON/text renderers. The two incompatible fixtures remain visible as
  non-executed members with zero executed-match facts.
- Added focused Phase 5 tests and recorded the accepted contract in D72.

## Verification

- `npm.cmd test -- --run tests/unit/opponent-suite-report.test.ts` - passed,
  7 tests.
- Focused Phase 4/5 opponent-suite tests - passed, 6 files, 59 tests.
- `npm.cmd test -- --run` - passed, 177 files, 2,064 tests, no type errors.
- `npm.cmd run check` - passed.
- `npm.cmd run lint` - passed.
- Targeted Prettier check for changed source, tests and task docs - passed.
- `npm.cmd run format:check` - reports only the pre-existing unmodified
  `AGENTS.md`; all changed files pass formatting.

## Remaining issues

- No Phase 5 implementation issues remain. The repository-wide formatter
  still reports the pre-existing `AGENTS.md` style issue, which is outside
  this task and was not modified.
