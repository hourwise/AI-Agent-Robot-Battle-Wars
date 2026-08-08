# Active Task

## Milestone 0.2B replacement-evidence governance - complete

Audit date: 2026-08-08
Starting commit: `23d4f32d3ba098e94be4e0126cde9866ea21a765`

The repository context workflow was followed. This governance-only task was
selected by D74 and accepts the replacement-evidence protocol for 0.2B after
AB2 failed its one-time held-out confirmation and the original held-out
partition became permanently spent. No candidate was implemented or
evaluated, 0.2E did not begin, and closed 0.2D was not reopened.

## Work completed

- Created and accepted [`docs/ADR-005-0.2b-replacement-evidence-protocol.md`](../ADR-005-0.2b-replacement-evidence-protocol.md), recorded as D75.
- Preserved ADR-003 as the historical authority for the original seed bank and
  D24-D32 as the historical candidate/gate/AB2 record.
- Defined separate authority for semantic/unit verification,
  development-only qualification evidence, whole-combat development
  acceptance and one-time fresh held-out confirmation.
- Required new immutable candidate IDs, complete versioned configuration and
  checksums, pre-freezing of candidates and all gates, no C2 mutation and
  permanent AB2 ineligibility. C2 remains the experimental default and is not
  final.
- Accepted a bounded, versioned multi-fixture development strategy using
  explicitly versioned canonical or dedicated inputs, with no single
  mechanically unrepresentative acceptance fixture and no new fixtures or
  constants created here.
- Defined whole-combat metric categories without inventing new numeric
  thresholds; thresholds, denominator rules and investigation rules must be
  frozen before candidate execution by a later protocol task.
- Defined independent fresh held-out custody using private high-entropy
  generation, non-revealing custodian commitments, sealed one-time execution,
  aggregate-only released results and spent semantics regardless of outcome.
- Allowed a separately governed 0.2E to use exact C2 as a frozen non-final
  baseline without implying 0.2B acceptance; 0.2E remains not started.

## 0.2B decision

0.2B continues at the governance stage. Candidate selection, implementation,
benchmark execution and held-out confirmation are postponed until the next
documentation-only task accepts the versioned replacement development-fixture
and protocol contract. No candidate constants were selected.

## Next task

Exactly one next task is recommended:

**Create and accept the versioned 0.2B replacement development-fixture and
protocol contract.** It must remain documentation-only: define fixture
identities/classifications/checksums, metric categories, denominator rules and
thresholds without creating or tuning fixture bytes, registering a candidate,
executing evaluation or beginning 0.2E.

## Boundaries and remaining work

- No product-code, simulator, fixture, candidate, benchmark, held-out, `all`,
  provider/API, grid-beta, opponent-suite, operational-beta or 0.2E changes or
  execution occurred.
- No prior 0.2D, grid-beta, AB2 held-out or spent-partition outcome was used as
  new qualification or balance evidence.
- 0.2B qualification/balance acceptance remains unresolved pending the
  versioned protocol contract and any later separately authorised cycle.
- 0.2E, general grid opponent-suite execution, later evaluation/adaptation,
  balance conclusions and ranking/public tournament work remain outside this
  task.

## Verification

- Relevant ADR-002/ADR-003 material, D24-D32, D74, historical 0.2B plans,
  current qualification source and authorization tests were inspected.
- `npm.cmd run check` passed.
- `npm.cmd run lint` passed.
- Changed-document Prettier check passed.
- `git diff --check` passed.
- No full test suite was required because this task made documentation-only
  governance changes; no benchmark or held-out command was run.

## Deviations

- No source, test, fixture, simulator, runtime or operational files changed.
- Historical ADRs and decisions were not rewritten; D75 and ADR-005 add the
  replacement-cycle authority and cross-reference the historical record.
