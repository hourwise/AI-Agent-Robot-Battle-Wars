# AI Robot Battle Arena — Agent Instructions

## Start here

For substantial work:

1. Read `docs/INDEX.md`.
2. Read `docs/tasks/ACTIVE.md`.
3. Read only the source-of-truth documents, ADRs, plans, and code
   relevant to the active task.
4. Inspect the existing implementation before making changes.

Do not recursively read all repository documentation unless the task
requires it.

## Working rules

- Existing source-of-truth decisions and accepted ADRs override assumptions.
- Preserve existing working behaviour unless the active task explicitly
  requires changing it.
- Do not silently expand task scope.
- Do not begin a later phase or unrelated feature after completing the task.
- Prefer extending existing architecture over introducing parallel systems.
- Do not add production dependencies without a clear need.
- Never expose API keys, credentials, secrets, or private user data.
- Keep user-supplied AI credentials outside PCGsoft custody wherever the
  existing architecture requires this.
- Run relevant tests/checks after implementation.
- Fix failures caused by your changes before declaring completion.

## Completion

Before finishing:

1. Verify the acceptance criteria in `docs/tasks/ACTIVE.md`.
2. Run the relevant tests/checks.
3. Update `docs/tasks/ACTIVE.md` with:
   - work completed
   - tests/checks run
   - remaining issues
   - important decisions or deviations
4. Do not start another task.