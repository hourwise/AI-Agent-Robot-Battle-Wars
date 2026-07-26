# Forge Arena — Sequential OpenCode Prompts

Run these prompts one at a time in OpenCode. Use **plan mode first** where specified, inspect the result, then switch to **build mode** only for the authorised milestone.

Do not paste every implementation prompt into one session. Commit after each accepted milestone.

---

# Prompt 0A — Repository inspection and implementation plan

```text
You are planning the initial Forge Arena text prototype in this repository.

Read these documents completely before proposing changes:

- BUILDPLAN.md
- FUTURE_BUILDS.md
- any existing README, AGENTS.md, package files and source files

The active scope is prototype 0.1 only. FUTURE_BUILDS.md is architectural context, not implementation permission.

Your task in this step is read-only:

1. Inspect the repository.
2. Compare its current state with Milestone 0 in BUILDPLAN.md.
3. Identify existing code worth retaining.
4. Identify missing foundation work.
5. Propose a concise implementation plan for Milestone 0 only.
6. List files you expect to create or modify.
7. Identify risks, ambiguities and any dependency you propose adding.
8. Confirm that no DeepSeek API key will be placed in source control.

Do not edit files. Do not implement game logic. Do not broaden scope. End with a Milestone 0 checklist and wait.
```

---

# Prompt 0B — Implement repository foundation

```text
Implement Milestone 0 from BUILDPLAN.md and only Milestone 0.

Requirements:

- Use TypeScript with strict compiler settings.
- Use a supported Node.js runtime.
- Add scripts for type checking, tests and development.
- Add Vitest.
- Add formatting/linting only if it remains lightweight.
- Add environment validation without requiring a live API key for tests.
- Add .env.example and a safe .gitignore.
- Add a clear README skeleton stating that the LLM is non-authoritative.
- Add initial docs/ARCHITECTURE.md, docs/SECURITY.md and docs/DECISIONS.md with only foundation-level content.
- Do not add React, a web server, an ORM, Docker, MCP, Supabase or game graphics.
- Do not implement catalogue, simulator or DeepSeek calls yet.
- Avoid unnecessary dependencies.

Before finishing:

1. Run type checking.
2. Run tests.
3. Review git diff for leaked secrets or unrelated changes.
4. Report exactly what changed, commands run, results and remaining Milestone 0 limitations.
5. Stop after Milestone 0.
```

---

# Prompt 1A — Plan catalogue and validation

```text
Read BUILDPLAN.md and inspect the completed Milestone 0 code.

Plan Milestone 1 only: versioned catalogue, machine-build schema, authoritative cost calculation and semantic validation.

The application must calculate legality. The AI must never be trusted to report cost or validity.

In read-only mode:

- propose the exact TypeScript domain types;
- propose the Zod schema;
- explain schema validation versus semantic validation;
- identify catalogue versioning;
- enumerate test cases;
- list files to create or modify;
- call out any inconsistency you find in BUILDPLAN.md.

Do not edit files. Do not implement simulator or provider code. End with an implementation checklist and wait.
```

---

# Prompt 1B — Implement catalogue and validation

```text
Implement Milestone 1 from BUILDPLAN.md and only Milestone 1.

Create:

- a typed, immutable versioned catalogue;
- stable component IDs;
- a MachineBuild proposal schema;
- authoritative cost calculation;
- semantic validation;
- clear validation errors suitable for returning to an agent;
- documentation in docs/RULESET.md;
- comprehensive unit tests.

Rules:

- Total build budget is 100.
- Cost is calculated exclusively by application code.
- Armour limits and costs must match BUILDPLAN.md.
- Reject unknown IDs, over-budget builds and invalid armour.
- Do not silently repair builds.
- Keep display text separate from stable IDs.
- Do not add DeepSeek, simulator, persistence or UI functionality.

Before finishing:

- run all checks and tests;
- inspect for accidental scope expansion;
- report representative legal and rejected builds;
- stop after Milestone 1.
```

---

# Prompt 2A — Plan deterministic simulator

```text
Read BUILDPLAN.md, docs/RULESET.md and the current implementation.

Plan Milestone 2 only.

The simulator must run with two hard-coded validated builds and no LLM or database. It must be deterministic for identical inputs and seed.

In read-only mode, propose:

- fighter state;
- policy type;
- legal simulator actions;
- round resolution order;
- attack and damage rules;
- component damage;
- heat and energy changes;
- victory conditions;
- judges’ decision;
- event types;
- seeded randomness implementation;
- invariants and failure conditions;
- tests, including a 1,000-match batch.

Prefer understandable game rules over physical realism. Identify any balance constants that should be isolated. List files to create or modify. Do not edit files. End with a checklist and wait.
```

---

# Prompt 2B — Implement deterministic simulator

```text
Implement Milestone 2 from BUILDPLAN.md and only Milestone 2.

Requirements:

- no LLM calls;
- no database;
- no Math.random() in simulation;
- every match uses an explicit seed;
- identical validated inputs plus seed produce equivalent authoritative events and result;
- simulator is independent of CLI rendering;
- all state transitions are typed;
- every meaningful transition emits an event;
- maximum 20 rounds;
- documented deterministic judges’ decision;
- no hidden rubber-banding;
- invariant violations fail loudly.

Add two hard-coded valid competitors for development tests, including The Bulwark using the same build validator.

Add:

- unit tests;
- deterministic replay test;
- victory-condition tests;
- 1,000-match simulation smoke/balance test;
- documentation updates for rules and event format.

Do not add DeepSeek, persistence, browser UI or future modes.

Run all checks. Report any obvious dominant or broken strategy found in batch testing, but do not perform a major rebalance outside the documented rules without explaining it. Stop after Milestone 2.
```

---

# Prompt 3A — Plan event replay and persistence

```text
Read the current implementation and BUILDPLAN.md.

Plan Milestone 3 only: deterministic text replay, statistics, versioned match records and local persistence.

In read-only mode:

- inspect the event model;
- propose the MatchRecord schema;
- propose repository interfaces;
- choose JSON-file persistence first unless SQLite is clearly justified;
- explain atomic writes and corrupt-file handling;
- map each event type to text rendering;
- ensure commentary cannot invent facts;
- define CLI commands for run, save, inspect and replay;
- list tests and files.

Do not edit files. Do not add DeepSeek or a web interface. End with a checklist and wait.
```

---

# Prompt 3B — Implement event replay and local persistence

```text
Implement Milestone 3 from BUILDPLAN.md and only Milestone 3.

Deliver:

- versioned MatchRecord schema;
- MatchRepository interface;
- safe local JSON repository;
- deterministic template-based text renderer;
- match statistics;
- CLI command to run a scripted match;
- CLI command to replay a saved match without simulation or API calls;
- CLI command to inspect match metadata;
- tests for save/load, corrupt files and renderer accuracy.

Requirements:

- event data remains authoritative;
- text rendering does not add unsupported actions;
- saved records contain ruleset, catalogue, schema and simulator versions plus seed;
- no secret or provider header is stored;
- file names do not use untrusted model-provided text;
- writes should avoid leaving a completed-looking partial file.

Update README with exact commands and sample output.

Do not add DeepSeek, SQLite, Supabase, a browser UI or graphics.

Run all checks and demonstrate that a saved match can be replayed. Stop after Milestone 3.
```

---

# Prompt 4A — Plan DeepSeek adapter

```text
Read BUILDPLAN.md, the current source and official DeepSeek API assumptions encoded in the project.

Plan Milestone 4 only: a DeepSeek V4 Flash adapter for the design phase.

Constraints:

- model ID is configurable and defaults to deepseek-v4-flash;
- API calls are server/local Node only;
- API key is read from DEEPSEEK_API_KEY;
- use JSON output;
- parse and validate with Zod;
- perform semantic build validation;
- at most two bounded correction attempts;
- timeout and response-size limits;
- capture ordinary usage, latency and reported/calculated cost metadata where available;
- do not store hidden reasoning;
- tests must use fixtures/mocks and make no paid API calls by default;
- core domain and simulator may not import DeepSeek modules.

In read-only mode, inspect DeepSeek’s current OpenAI-compatible request shape already expected by the repository, propose the client boundary, error taxonomy, retry policy, redaction policy, prompts and tests.

Do not edit files. Do not add live tactical calls or post-match review yet. End with a checklist and wait.
```

---

# Prompt 4B — Implement DeepSeek design adapter

```text
Implement Milestone 4 from BUILDPLAN.md and only the machine-design portion of the DeepSeek adapter.

Deliver:

- DeepSeek config validation;
- redacted structured logging;
- HTTP client using native fetch;
- ArenaAgent interface if not already present;
- DeepSeekArenaAgent designMachine implementation;
- versioned design prompt;
- JSON-mode request;
- defensive parsing;
- Zod validation;
- authoritative semantic validation;
- at most two correction attempts with concise error feedback;
- provider timeout and rate/auth error handling;
- usage, latency, model and cost metadata where available;
- mocked/fixture tests;
- an opt-in live smoke command that refuses to run without an environment key.

Security requirements:

- never print or save the API key;
- never accept an API key as a CLI argument;
- never send provider requests from browser code;
- never execute or fetch anything requested by model output;
- do not store private chain-of-thought.

Do not add policy selection, match review, Supabase, UI or graphics yet.

Run all non-live checks. Do not make a paid API request unless the operator explicitly runs the opt-in smoke command. Stop after Milestone 4.
```

---

# Prompt 5A — Plan complete AI-versus-Bulwark match

```text
Read BUILDPLAN.md and inspect all completed milestones.

Plan Milestone 5 only.

The target vertical slice is:

DeepSeek designs a machine -> application validates it -> DeepSeek selects a bounded pre-match policy -> The Bulwark submits its scripted legal build and policy -> deterministic simulator resolves the match -> event renderer displays it -> record is saved.

In read-only mode:

- define the policy schema;
- define the policy prompt;
- show how policy maps to simulator actions without executable model code;
- define fallback behaviour;
- define CLI flow;
- define provider usage display;
- identify integration tests;
- list files to create or modify.

Do not edit files. Do not add mid-match model calls, review/rebuild, web UI or multiplayer. End with a checklist and wait.
```

---

# Prompt 5B — Implement complete AI-versus-Bulwark match

```text
Implement Milestone 5 from BUILDPLAN.md and only Milestone 5.

Deliver the first complete vertical slice:

1. Load local configuration.
2. Ask DeepSeek to design a robot.
3. Validate and, if needed, request bounded correction.
4. Ask DeepSeek for a constrained pre-match policy.
5. Validate the policy.
6. Build The Bulwark through the same authoritative validator.
7. Run the seeded deterministic simulator.
8. Render the text replay.
9. Display result, statistics, token usage, latency and available cost metadata.
10. Save the complete match record.

Requirements:

- no model call during combat;
- no AI authority over outcomes;
- no unrestricted scripts;
- fallback policy on provider or policy failure must be explicit;
- support --seed and --model but never --api-key;
- match can be replayed later without an API call;
- tests mock provider responses;
- CLI errors are actionable and secrets are redacted.

Update README and docs accurately.

Run all checks. Provide one fixture-based example match in tests. Do not automatically run a paid live match. Stop after Milestone 5.
```

---

# Prompt 6A — Plan review, adaptation and series

```text
Read BUILDPLAN.md and inspect the working vertical slice.

Plan Milestone 6 only: factual match review, legal rebuilds and best-of-five series.

In read-only mode:

- define the compact factual report supplied to DeepSeek;
- define MatchReview schema;
- define how the AI chooses retain versus revise;
- define how revised builds pass the same validator;
- define handling when a revision is invalid;
- define series persistence and statistics;
- define seed scheduling;
- define tests that distinguish adaptation from random changes;
- list files.

The completed match must remain immutable. The review cannot rewrite events or result.

Do not edit files. Do not add a second live AI, browser UI, cloud database or graphics. End with a checklist and wait.
```

---

# Prompt 6B — Implement review and best-of-five series

```text
Implement Milestone 6 from BUILDPLAN.md and only Milestone 6.

Deliver:

- compact factual MatchReport derived only from authoritative events;
- versioned review prompt;
- MatchReview schema;
- DeepSeek review implementation;
- retain-or-revise decision;
- revised build validation under the unchanged 100-point budget;
- bounded correction/fallback;
- best-of-five series command;
- independent saved MatchRecord for every match;
- saved SeriesRecord and final comparison;
- token, cost and latency totals;
- tests with mocked reviews and rebuilds.

The series summary must show:

- wins/losses;
- seeds;
- builds and changes;
- damage;
- match length;
- component failures;
- provider usage;
- whether changes improved outcomes across the series.

Do not infer genuine learning from one result. Use careful wording such as “adapted its submitted build” rather than claiming long-term learning.

Run all checks. Do not add multiplayer or future features. Stop after Milestone 6.
```

---

# Prompt 7A — Prototype audit plan

```text
Perform a read-only audit of the repository against Milestone 7 and the complete prototype 0.1 Definition of Done in BUILDPLAN.md.

Inspect:

- architecture boundaries;
- DeepSeek isolation;
- secret handling;
- deterministic guarantees;
- schema and semantic validation;
- bounded retries;
- error handling;
- event completeness;
- replay accuracy;
- persistence;
- documentation;
- tests;
- dependency necessity;
- accidental future-scope implementation.

Produce:

1. findings ordered by severity;
2. exact file references;
3. proposed minimal fixes;
4. tests needed;
5. a release checklist.

Do not edit files. Do not praise generally; focus on concrete gaps. Wait after presenting the audit.
```

---

# Prompt 7B — Harden and prepare prototype release

```text
Apply the accepted findings from the Milestone 7 audit and complete prototype 0.1.

Constraints:

- make minimal targeted corrections;
- preserve deterministic compatibility unless a documented version bump is necessary;
- do not add future features;
- do not introduce a frontend;
- remove dead code and unnecessary dependencies;
- update documentation to match reality;
- ensure a fresh clone can be configured from README;
- ensure live API use remains explicit and opt-in;
- ensure tests make no paid calls;
- ensure .env and data files cannot be committed accidentally.

Run:

- formatting/linting if configured;
- type checking;
- unit tests;
- integration tests;
- deterministic golden tests;
- simulation batch tests;
- build command if present.

Then report:

- final architecture;
- completed Definition of Done items;
- commands and results;
- known limitations;
- deferred items explicitly mapped to FUTURE_BUILDS.md;
- suggested commit message.

Stop after prototype 0.1.
```

---

# Optional prompt — Analyse a live five-match experiment

Use only after prototype 0.1 is working and you have intentionally run a paid series.

```text
Inspect the supplied completed five-match SeriesRecord and its MatchRecords.

Do not alter code or results.

Analyse:

- build changes between matches;
- whether each change addressed an observed weakness;
- whether performance improved across different seeds;
- repeated tactical failures;
- catalogue balance concerns;
- simulator artefacts;
- API token and cost totals;
- malformed or low-quality model responses;
- whether the text replay remained faithful and understandable.

Separate facts from interpretations. Do not call ordinary within-series adaptation “learning” without qualification.

Produce:

1. concise series narrative;
2. build-by-build comparison;
3. evidence of useful or ineffective adaptation;
4. simulator/balance findings;
5. recommended prototype 0.2 changes ranked by value and effort.

Do not implement anything.
```

---

# Emergency correction prompt — Stop scope drift

```text
Stop implementation and inspect the current diff.

The active task is limited to the current milestone in BUILDPLAN.md. FUTURE_BUILDS.md is not implementation permission.

Identify and revert or isolate any work involving:

- browser UI;
- multiplayer;
- second live agent;
- Supabase/cloud database;
- accounts;
- MCP;
- 3D;
- payments;
- advertising;
- tag teams;
- free-for-all;
- sporting events;
- unrestricted tools;
- unrelated refactors.

Do not discard valid work from the authorised milestone. Explain every removed or retained change, run the milestone tests, and stop.
```

---

# Emergency security-review prompt

```text
Perform a focused security review of the current Forge Arena repository.

Check specifically for:

- committed API keys or secrets;
- secrets printed in logs or errors;
- API calls from browser/client code;
- unbounded retries or loops;
- missing request timeouts;
- oversized model responses;
- unsafe JSON parsing;
- missing schema or semantic validation;
- model-controlled file paths;
- model-controlled shell commands;
- arbitrary URL fetching;
- storage of private reasoning;
- prompt injection crossing into executable behaviour;
- unsafe dependency additions;
- incomplete match state after provider failure.

First report findings with file references and severity. Do not edit until the operator accepts the findings.
```
