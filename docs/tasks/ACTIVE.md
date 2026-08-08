# Active Task

## Milestone 0.2B candidate-registration correction - complete

Audit date: 2026-08-08
Starting commit: `4a9ca2b5433db2b7b62a1352492a12eadacb7be6`
Branch: `agent/0.2b-candidate-registration-correction`

## Closure verdict

Accepted. D78 rejects D77's unexecuted candidate registration for protocol
evaluation. The executable C1/C2/AB2 registry and schema surface is restored
exactly to D76. D77 remains preserved as historical decision history and is
superseded by D78; no candidate or evaluation was run.

## Work completed

- Recorded D78 explaining the independent pre-execution review: the guarded
  Bulwark's historical development-only impact range is `4–13`; C2's `13/15`
  thresholds therefore produced only two critical impact-13 qualifications,
  two resisted transitions and zero healthy-to-damaged transitions; changing
  only the unreachable high branch to `17` cannot satisfy D76's
  `totalDamagedTransitions > 0` hard gate.
- Removed `component-impact-replacement-v1` from the executable qualification
  registry, linear metadata type, match/report schema allow-lists and
  registration tests. The rejected ID now fails closed as unregistered.
- Verified the executable registry/schema files are byte-identical to the D76
  commit. C1, C2 and AB2 configurations/checksums were not changed, C2 remains
  the default and AB2 remains frozen/permanently ineligible.
- Updated `docs/SOURCE_OF_TRUTH.md`, `docs/INDEX.md` and this task record.

## Boundaries preserved

The D76 protocol, fixture bytes, seed bank, simulator/reducer/damage semantics,
runtime defaults and closed 0.2D contracts were not changed. No candidate,
benchmark, held-out, `all`, readiness, beta, provider or opponent-suite
execution was invoked. The next feasibility/design audit was not started.

## Verification

- Focused registry/schema/report tests: 5 files, 63 tests passed with no type
  errors.
- `npm.cmd run check` passed.
- `npm.cmd run lint` passed.
- Changed-file Prettier check passed.
- `git diff --check` passed.
- Executable registry/schema byte comparison against D76 passed.
- The full Vitest suite was not run because it includes prohibited benchmark,
  readiness, beta and opponent-suite evaluation surfaces.

## Remaining work and deviations

The exact next task is:

> **Perform a held-out-blind replacement-candidate feasibility/design audit
> against the frozen D76 protocol, without registering or executing a
> candidate.**

It was not started. 0.2B qualification/balance acceptance remains unresolved;
C2 is still the experimental default and AB2 remains permanently ineligible.
D77 is intentionally retained as superseded historical decision text. No
other deviations from the requested boundaries.
