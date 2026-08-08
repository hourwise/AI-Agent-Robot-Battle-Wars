# Active Task

## Milestone 0.2B candidate registration - complete

Audit date: 2026-08-08
Starting commit: `eb2ab9998f3f8797d63ec384d3e7958029d78c21`
Branch: `agent/0.2b-candidate-registration`

## Closure verdict

Accepted. Exactly one new immutable dormant candidate is registered against the
frozen `component-lifecycle-development-v1` protocol. No candidate execution
or evaluation was performed.

## Work completed

- Selected and registered `component-impact-replacement-v1` using the existing
  `linear-component-impact` model, with complete configuration and checksum
  `6356363911710657`.
- Preserved C2's armour factor `0.20`, minimum impact `0` and critical
  threshold `13`; changed only the high-impact threshold to `17` as a bounded,
  held-out-blind development probe.
- Extended the immutable qualification registry and its existing match/report
  metadata unions without changing simulator, reducer, damage, fixture,
  seed-bank or runtime default behavior.
- Added focused registration coverage for exact config resolution, stable
  checksum, runtime immutability, unknown-ID fail-closed behavior, C2 default
  preservation and unchanged C1/C2/AB2 identities/checksums.
- Recorded D77 and aligned `docs/SOURCE_OF_TRUTH.md` and `docs/INDEX.md`.

The rationale used only permitted development-stage/analytical history. D31
quantitative held-out results, 0.2D outcomes, grid-beta/readiness evidence and
operational matches were not used. D31/D32 were used only for AB2 rejection,
freeze/ineligibility and spent-partition governance facts.

## Boundaries preserved

The frozen protocol, fixture bytes, seed bank, simulator/reducer/damage
semantics, runtime defaults, C2 default, AB2 identity and closed 0.2D
contracts were not changed. The candidate remains dormant unless explicitly
selected by ID. No benchmark, held-out, `all`, readiness, beta, opponent-suite
or operational evaluation was invoked.

## Verification

- Focused registry/schema/report tests: 5 files, 63 tests passed with no type
  errors.
- `npm.cmd run check` passed.
- `npm.cmd run lint` passed.
- Changed-file Prettier check passed.
- `git diff --check` passed.
- The full Vitest suite was not run because it includes prohibited benchmark,
  readiness, beta and opponent-suite evaluation surfaces.

## Remaining work and deviations

The exact next task is:

> **Stage 1 semantic/unit verification of the registered candidate and frozen
> protocol, without development benchmark execution.**

It was not started. 0.2B qualification/balance acceptance remains open; C2 is
still the experimental default and AB2 remains permanently ineligible. No
deviations from the requested boundaries.
