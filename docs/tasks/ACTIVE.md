# Active Task

## Repository context audit - complete

Audit date: 2026-08-08

The repository context system was established without changing product code.
`docs/INDEX.md` now routes to authoritative documents and code areas, and
`docs/SOURCE_OF_TRUTH.md` records the implementation state, accepted direction,
deferred work, constraints, and known documentation discrepancies.

## Recommended next implementation task - not started

Milestone 0.2D Phase 5: implement a factual cross-opponent report over the
legacy-only opponent-suite runner output. Before implementation, review the
Phase 4 runner and its evidence boundary independently. The report must remain
factual, versioned and deterministic; it must not rank opponents, make balance
claims, tune fixtures, read benchmark/held-out data, or authorize grid/default
activation. Do not begin this task as part of the context audit.

## Audit checks

- `npm.cmd run check` - passed.
- `npm.cmd run lint` - passed.
- Targeted Bulwark/opponent-fixture/opponent-suite tests - 13 files, 143 tests
  passed, no type errors.
- Full test: 176 files, 2,057 tests passed with no type errors under a longer
  command limit. Targeted formatting for the three audit documents passed.

## Remaining issues

- Repository-wide `format:check` reports only the unmodified pre-existing
  context files `AGENTS.MD` and `docs/ACTIVE.md`; the three audit documents
  pass the targeted check.
- Existing `docs/ACTIVE.md` remains as an unmodified legacy duplicate; use this
  file for the active task route.
