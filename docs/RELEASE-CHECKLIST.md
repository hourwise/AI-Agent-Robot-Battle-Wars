# Release Checklist — Prototype 0.1

Use this checklist before tagging `v0.1.0-prototype`.

## Pre-release Verification

- [x] `npm run format:check` — passes (no warnings)
- [x] `npm run lint` — passes (no errors)
- [x] `npm run check` — passes (no TypeScript errors)
- [x] `npm test` — 436 tests, 40 files, zero failures

## Repository Hygiene

- [x] `.env` is in `.gitignore` and not tracked
- [x] `.env.example` exists with placeholder values only
- [x] No API keys, tokens, or secrets in any committed file
- [x] No uncommitted source changes (`git status` is clean)
- [x] No sensitive provider metadata in committed fixtures
- [x] `git log` does not contain secrets in commit messages

## Documentation

- [x] `docs/PROTOTYPE-0.1-VALIDATION.md` — complete
- [x] `docs/PROTOTYPE-0.2-EXPERIMENTAL-PLAN.md` — complete
- [x] README updated with release status
- [x] Version baseline recorded in validation document

## Version Baseline

| Component     | Version   |
| ------------- | --------- |
| Simulator     | 0.1.2     |
| Ruleset       | 0.1.0     |
| Catalogue     | 1         |
| Design prompt | design-v2 |
| Policy prompt | policy-v2 |
| Review prompt | review-v1 |
| Match schema  | 1         |
| Series schema | 1         |

## Canonical Fixture

- [x] Series `16eae0af-9ca5-4c63-acb1-aee54f41ee58` preserved in `data/series/`
- [x] Sanitised summary committed at `tests/fixtures/prototype-0.1-canonical-series-summary.json`
- [x] Fixture validated by `tests/unit/prototype-0.1-fixture.test.ts`
- [x] Validation document records seeds, designs, policies, outcomes, and costs
- [x] No raw provider metadata committed

## Release Tag

- [x] Tag `v0.1.0-prototype` created on commit `9f98065`
- [x] Tag pushed to `origin`
- [x] Tag provenance documented: code baseline is `9f98065`, docs added in `719d91c`
- [x] Strategy: keep existing tag (Option A); documentation lives on default branch

## Post-release

- [ ] Freeze simulator, ruleset, and catalogue for 0.1
- [ ] Begin Prototype 0.2 Milestone 0.2A (Benchmark Harness)
- [ ] Resolve ADR-003 (Seed-bank evaluation) and ADR-004 (Opponent fixture format)
