# Forge Arena — Text Prototype Build Plan

**Document status:** Implementation plan  
**Prototype version:** 0.1.0  
**Primary coding environment:** OpenCode using Big Pickle  
**Runtime AI provider:** DeepSeek API, initially `deepseek-v4-flash`  
**Primary platform:** Windows 11 desktop  
**Primary language:** TypeScript on Node.js  
**Initial interface:** Command-line interface  
**Initial persistence:** Local files or SQLite, behind a repository interface  
**Optional later persistence:** Supabase or another PostgreSQL service

---

## 1. Product statement

Forge Arena is a deterministic text-based competition in which an AI agent receives a fixed engineering budget, an approved component catalogue and competition rules. The agent designs a combat robot, chooses a tactical policy and competes against a server-controlled opponent.

The language model makes choices. It does not calculate costs, determine legality, apply damage, select random results, write executable combat code or decide who won.

The prototype exists to answer one question:

> Can an AI design, explain and improve a competitive machine under equal constraints in a way that produces coherent, entertaining and repeatable matches?

The prototype must produce a machine-readable match record that can later drive a browser animation or 3D replay without changing the authoritative simulator.

---

## 2. Prototype boundaries

### Included in version 0.1

- One DeepSeek-controlled competitor.
- One deterministic rule-based opponent.
- One fixed arena.
- A 100-point construction budget.
- A deliberately small component catalogue.
- AI-generated robot name and design summary.
- Build validation and bounded correction attempts.
- AI-selected pre-match tactical policy.
- Seeded, deterministic turn-based combat.
- Text commentary generated from authoritative events.
- A complete JSON match record.
- Best-of-five rematch series.
- Post-match AI review.
- Optional rebuild between matches under the same budget.
- Local persistence.
- Automated tests.
- Provider-neutral AI interface.
- Database-neutral persistence interface.
- Versioned rules, schemas and simulator.

### Explicitly excluded

- Two human users.
- Two remote API accounts.
- Matchmaking.
- Accounts or authentication.
- Payments, advertising or credits.
- MCP.
- 3D graphics.
- Real-time physics.
- Generative video.
- Voice commentary.
- User-created components.
- Unrestricted agent tools.
- Persistent autonomous memory.
- Tag teams or free-for-all matches.
- Public leaderboards.
- Cash prizes or betting.

Do not implement excluded features as placeholders with fake functionality. Preserve expansion points through interfaces, versioned data and clean module boundaries.

---

## 3. Non-negotiable engineering principles

### 3.1 Authoritative deterministic engine

The simulator is the sole authority for:

- build cost;
- build legality;
- mass and energy constraints;
- hit probability;
- damage;
- component failure;
- status effects;
- victory conditions;
- match termination;
- final result.

No LLM-generated prose may alter these results.

### 3.2 Provider-neutral agents

DeepSeek must be implemented through an `ArenaAgent` interface. Core game modules must not import the DeepSeek client directly.

Future adapters must be possible for:

- a second DeepSeek API key;
- another commercial provider;
- an OpenAI-compatible endpoint;
- Ollama;
- llama.cpp;
- MCP;
- a deterministic scripted bot.

### 3.3 Replay-first event architecture

Every meaningful state transition produces a typed event. The simulator must not print commentary directly.

The flow is:

```text
Agent decisions
      ↓
Validated commands
      ↓
Deterministic simulator
      ↓
Authoritative event log
      ├── text replay
      ├── statistics
      ├── future browser animation
      └── future 3D replay
```

### 3.4 No secrets in source control

- Read `DEEPSEEK_API_KEY` from environment variables.
- Commit `.env.example`, never `.env`.
- Add `.env` and local database files to `.gitignore`.
- Never print the full API key.
- Redact request headers and secrets from errors.
- Do not send the API key to a browser.
- Do not place provider calls in client-side code.

### 3.5 Bounded model use

Every model operation must have:

- a timeout;
- a maximum response size;
- a finite retry count;
- schema validation;
- a clear fallback;
- token-usage capture where available;
- price/cost capture where available;
- no unbounded agent loop.

### 3.6 Version everything replay-relevant

Each match record must include:

- `rulesetVersion`;
- `catalogueVersion`;
- `schemaVersion`;
- `simulatorVersion`;
- agent adapter version;
- model identifier;
- prompt version;
- random seed.

A saved match should remain inspectable after later game changes.

---

## 4. Recommended technology

### Required

- Node.js 22 or current supported LTS.
- TypeScript with strict mode.
- `tsx` for development execution.
- `zod` for runtime schemas.
- `vitest` for tests.
- `dotenv` for local environment loading.
- A seeded PRNG package or a small audited internal implementation.
- Native `fetch` for the DeepSeek API.
- `pino` or another structured logger.

### Persistence choice

Start with a file-backed `MatchRepository` unless SQLite can be added cleanly without delaying the simulator.

Recommended progression:

1. JSON files for the first vertical slice.
2. SQLite adapter for local querying.
3. PostgreSQL/Supabase adapter after the prototype is enjoyable.

The domain and simulator must not depend on a particular database library.

### Avoid initially

- React.
- Electron.
- Docker as a mandatory requirement.
- ORMs.
- queues;
- Redis;
- WebSockets;
- game engines;
- microservices.

---

## 5. Repository structure

```text
forge-arena/
├─ src/
│  ├─ app/
│  │  ├─ run-match.ts
│  │  ├─ run-series.ts
│  │  └─ replay-match.ts
│  ├─ agents/
│  │  ├─ arena-agent.ts
│  │  ├─ deepseek/
│  │  │  ├─ deepseek-agent.ts
│  │  │  ├─ deepseek-client.ts
│  │  │  ├─ deepseek-config.ts
│  │  │  └─ deepseek-response.ts
│  │  └─ scripted/
│  │     └─ bulwark-agent.ts
│  ├─ catalogue/
│  │  ├─ catalogue.ts
│  │  ├─ catalogue.v1.ts
│  │  └─ catalogue.types.ts
│  ├─ domain/
│  │  ├─ build.ts
│  │  ├─ competition.ts
│  │  ├─ fighter.ts
│  │  ├─ policy.ts
│  │  ├─ state.ts
│  │  └─ result.ts
│  ├─ schemas/
│  │  ├─ build.schema.ts
│  │  ├─ policy.schema.ts
│  │  ├─ review.schema.ts
│  │  └─ match-record.schema.ts
│  ├─ validation/
│  │  ├─ build-validator.ts
│  │  └─ decision-validator.ts
│  ├─ simulator/
│  │  ├─ simulator.ts
│  │  ├─ reducer.ts
│  │  ├─ actions.ts
│  │  ├─ damage.ts
│  │  ├─ movement.ts
│  │  ├─ victory.ts
│  │  └─ seeded-random.ts
│  ├─ events/
│  │  ├─ battle-event.ts
│  │  └─ event-factory.ts
│  ├─ replay/
│  │  ├─ text-renderer.ts
│  │  └─ statistics.ts
│  ├─ persistence/
│  │  ├─ match-repository.ts
│  │  ├─ json-match-repository.ts
│  │  └─ sqlite-match-repository.ts
│  ├─ prompts/
│  │  ├─ design-prompt.v1.ts
│  │  ├─ policy-prompt.v1.ts
│  │  └─ review-prompt.v1.ts
│  ├─ config/
│  │  └─ env.ts
│  └─ index.ts
├─ tests/
│  ├─ unit/
│  ├─ integration/
│  ├─ fixtures/
│  └─ golden/
├─ data/
│  ├─ matches/
│  └─ series/
├─ docs/
│  ├─ ARCHITECTURE.md
│  ├─ RULESET.md
│  ├─ EVENT_FORMAT.md
│  ├─ SECURITY.md
│  └─ DECISIONS.md
├─ .env.example
├─ .gitignore
├─ package.json
├─ tsconfig.json
├─ vitest.config.ts
└─ README.md
```

Do not create empty directories merely to match this tree. Add modules as their milestone is implemented.

---

## 6. Core domain model

Use generic competition terminology where practical so future events do not require a rewrite.

Recommended core terms:

- `Competitor`
- `MachineBuild`
- `Competition`
- `CompetitionEnvironment`
- `Equipment`
- `ActionPolicy`
- `SimulationEvent`
- `VictoryCondition`

Combat-specific types may exist inside the first ruleset, but storage and orchestration should not assume all future competitions are one-on-one destruction matches.

### Required identifiers

Use stable string IDs, not display names, for rules:

```ts
type ChassisId = "light" | "medium" | "heavy";
type MobilityId = "wheels" | "tracks" | "legs";
type WeaponId = "ram" | "hammer" | "horizontal_spinner" | "grappler" | "flipper";
```

Display names can change without invalidating historical matches.

---

## 7. Initial catalogue

The catalogue is immutable for a given catalogue version.

### Budget

- Total engineering budget: 100 points.
- The server calculates all costs.
- Unspent budget is permitted.
- No paid or player-provided advantage exists.

### Chassis

| ID       | Cost | Integrity | Base mass | Agility | Stability |
| -------- | ---: | --------: | --------: | ------: | --------: |
| `light`  |   15 |        60 |        10 |       9 |         4 |
| `medium` |   25 |       100 |        20 |       6 |         6 |
| `heavy`  |   40 |       150 |        35 |       3 |         9 |

### Mobility

| ID       | Cost | Speed | Traction | Turning | Stability modifier |
| -------- | ---: | ----: | -------: | ------: | -----------------: |
| `wheels` |   12 |     9 |        6 |       9 |                  0 |
| `tracks` |   20 |     5 |        9 |       5 |                  2 |
| `legs`   |   25 |     6 |        7 |       7 |                  1 |

### Weapons

| ID                   | Cost | Base damage | Accuracy | Cooldown | Trait                  |
| -------------------- | ---: | ----------: | -------: | -------: | ---------------------- |
| `ram`                |   10 |          20 |       80 |        1 | scales with speed      |
| `hammer`             |   20 |          35 |       65 |        2 | strong top attacks     |
| `horizontal_spinner` |   30 |          50 |       55 |        3 | high knockback         |
| `grappler`           |   20 |          10 |       80 |        2 | control and reposition |
| `flipper`            |   25 |          25 |       65 |        3 | overturn chance        |

### Utilities

| ID                 | Cost | Effect                               |
| ------------------ | ---: | ------------------------------------ |
| `none`             |    0 | no utility                           |
| `cooling`          |   10 | improved heat recovery               |
| `traction_boost`   |   10 | improved movement and ram resistance |
| `reinforced_drive` |   15 | reduced mobility-component damage    |

### Armour

The agent allocates integer armour points to:

- front;
- left;
- right;
- rear;
- top.

Initial rule:

- 10 armour points cost 1 budget point, rounded up.
- Each zone maximum is 60.
- Total armour maximum is 120.
- Armour calculations must be documented and unit-tested.

Treat these values as version 0.1 balancing constants, not claims of physical accuracy.

---

## 8. Agent contract

```ts
interface ArenaAgent {
  readonly id: string;
  readonly displayName: string;
  readonly provider: string;
  readonly model: string;

  designMachine(request: DesignRequest): Promise<AgentResult<MachineBuildProposal>>;
  choosePolicy(request: PolicyRequest): Promise<AgentResult<ActionPolicy>>;
  reviewMatch(request: ReviewRequest): Promise<AgentResult<MatchReview>>;
}
```

`AgentResult<T>` should retain:

- validated value;
- raw response or a redacted diagnostic copy;
- provider request ID where available;
- model;
- input tokens;
- output tokens;
- cached tokens where available;
- reported or calculated cost where available;
- latency;
- attempt count;
- prompt version.

Do not expose private chain-of-thought. Store only the submitted decision, brief rationale and ordinary API metadata.

### DeepSeek configuration

Use environment variables:

```env
DEEPSEEK_API_KEY=
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-v4-flash
DEEPSEEK_THINKING_MODE=non-thinking
DEEPSEEK_TIMEOUT_MS=60000
DEEPSEEK_MAX_RETRIES=2
```

Use the explicit current model ID rather than retired aliases.

The adapter must allow the model ID and thinking mode to be changed without modifying domain code.

---

## 9. Structured-output policy

The model must return JSON matching a documented schema.

Required safeguards:

1. Request JSON output from the provider.
2. State in the prompt that JSON is required.
3. Parse with defensive error handling.
4. Validate with Zod.
5. Perform semantic validation after schema validation.
6. Return concise validation errors for a correction attempt.
7. Permit at most two correction attempts.
8. Fall back to a legal default build or fail the match cleanly.

Schema validity does not prove:

- the selected IDs exist in this catalogue version;
- the budget is legal;
- the combination is compatible;
- the decision is strategically meaningful.

Those are application responsibilities.

---

## 10. Initial AI decisions

### Design phase

The AI submits:

- machine name;
- chassis ID;
- mobility ID;
- weapon ID;
- utility ID;
- armour distribution;
- design summary;
- short design rationale.

### Policy phase

The AI submits a bounded pre-match policy containing:

- opening behaviour;
- preferred range;
- aggression from 0 to 100;
- primary target;
- secondary target;
- retreat threshold;
- heat threshold;
- fallback behaviour;
- arena-hazard preference.

The model does not write executable scripts. All values come from enums or bounded numbers.

### Review phase

After each match, the AI receives a compact factual report and submits:

- diagnosed cause of victory or defeat;
- successful choices;
- failed choices;
- whether to retain or revise the build;
- proposed changes;
- short public statement.

The review cannot modify the completed match.

---

## 11. Initial opponent

Create a deterministic scripted opponent named **The Bulwark**.

Characteristics:

- heavy chassis;
- tracks;
- ram;
- reinforced drive;
- strong front armour;
- weak rear armour;
- aggressive forward policy;
- predictable weakness to circling and rear attacks.

Its purpose is to test whether the AI can:

- infer a weakness;
- build against it;
- alter tactics after defeat;
- preserve successful choices.

The Bulwark must use the same catalogue and budget validation as the AI.

---

## 12. Simulator design

### Combat format

- Maximum 20 rounds.
- Both agents submit policies before the match.
- The simulator derives legal actions from state and policy.
- No LLM calls occur during the first simulator implementation.
- Later tactical checkpoints may be added behind a separate interface.

### Suggested state

```ts
interface FighterState {
  fighterId: string;
  integrity: number;
  energy: number;
  heat: number;
  zone: ArenaZone;
  facing: Direction;
  distance: DistanceBand;
  weaponCooldown: number;
  utilityCooldown: number;
  armour: ArmourState;
  components: ComponentState;
  conditions: Condition[];
}
```

### Suggested victory conditions

In order:

1. opponent immobilised;
2. opponent integrity reaches zero;
3. opponent cannot perform a legal recovery;
4. round limit reached and judges award a decision.

Judges’ decision should use deterministic documented scoring:

- damage inflicted;
- mobility remaining;
- weapon functionality;
- objective control or aggression;
- remaining integrity.

Do not add hidden rubber-banding.

### Randomness

- Use a seeded PRNG.
- Never use `Math.random()` in simulator logic.
- Record the seed.
- Isolate random draws in named functions.
- Include random rolls in diagnostic events where appropriate.
- Same inputs and seed must produce the same event log.

---

## 13. Event model

Every event must include:

```ts
interface BaseSimulationEvent {
  schemaVersion: string;
  sequence: number;
  round: number;
  timestampMs: number;
  type: string;
  actorId?: string;
  targetId?: string;
  data: Record<string, unknown>;
}
```

Initial event types:

- `competition_started`
- `round_started`
- `movement_attempted`
- `movement_resolved`
- `attack_attempted`
- `attack_missed`
- `attack_hit`
- `armour_damaged`
- `integrity_damaged`
- `component_damaged`
- `component_disabled`
- `robot_overturned`
- `robot_recovered`
- `robot_immobilised`
- `heat_changed`
- `energy_changed`
- `policy_triggered`
- `round_ended`
- `competition_ended`

The event log is append-only during a match.

Do not put rendered commentary in authoritative event data.

---

## 14. Match record

A saved match contains:

```ts
interface MatchRecord {
  schemaVersion: string;
  matchId: string;
  createdAt: string;
  rulesetVersion: string;
  catalogueVersion: string;
  simulatorVersion: string;
  seed: number;
  environment: CompetitionEnvironment;
  competitors: CompetitorRecord[];
  builds: ValidatedBuild[];
  policies: ValidatedPolicy[];
  agentUsage: AgentUsageRecord[];
  events: SimulationEvent[];
  result: CompetitionResult;
  integrityHash?: string;
}
```

Add an optional integrity hash after the basic implementation is stable.

Avoid storing environment secrets or full request headers.

---

## 15. Text replay

The text renderer consumes events and produces:

- round headings;
- readable movements;
- attacks and misses;
- critical hits;
- component failures;
- tactical turning points;
- result;
- match statistics.

It must not invent events.

A dramatic renderer may vary wording, but every statement must map to one or more authoritative events.

The initial renderer should be deterministic and template-based. LLM-generated commentary is a later optional layer.

---

## 16. Series mode

A best-of-five series should:

1. create or load an AI competitor identity;
2. run match one with no previous results;
3. send a compact report to the AI;
4. allow the AI to retain or revise its build;
5. validate the revised build under the same budget;
6. vary the seed for each match;
7. preserve every match independently;
8. save a series summary.

The scripted opponent remains unchanged initially.

The series report should show:

- wins and losses;
- builds used;
- changes between matches;
- average match length;
- damage dealt and received;
- component failures;
- API token use and cost;
- whether adaptations improved results.

---

## 17. Persistence abstraction

```ts
interface MatchRepository {
  saveMatch(record: MatchRecord): Promise<void>;
  getMatch(matchId: string): Promise<MatchRecord | null>;
  listMatches(query?: MatchQuery): Promise<MatchSummary[]>;
}

interface SeriesRepository {
  saveSeries(record: SeriesRecord): Promise<void>;
  getSeries(seriesId: string): Promise<SeriesRecord | null>;
}
```

The first implementation may save atomic JSON files.

Requirements:

- validate before saving;
- write atomically where possible;
- never silently overwrite another match;
- use stable IDs;
- handle corrupt files clearly;
- keep persistence outside simulator logic.

---

## 18. CLI commands

Recommended commands:

```bash
npm run check
npm test
npm run match
npm run series
npm run replay -- --match <match-id>
npm run inspect -- --match <match-id>
```

Optional flags:

```text
--seed
--model
--thinking
--matches
--data-dir
--verbose
```

Do not accept an API key as a command-line flag because it may be retained in shell history.

---

## 19. Error handling

Distinguish at least:

- configuration error;
- provider authentication error;
- provider timeout;
- provider rate limit;
- invalid model JSON;
- schema violation;
- illegal build;
- illegal policy;
- simulator invariant failure;
- persistence failure.

A provider failure must not leave a partially saved match marked as complete.

Use explicit match states:

- `created`
- `awaiting_build`
- `validated`
- `simulating`
- `completed`
- `failed`

---

## 20. Security baseline

Create `docs/SECURITY.md` covering:

- environment-secret handling;
- server-side provider calls only;
- dependency pinning;
- input length limits;
- output length limits;
- schema validation;
- prompt injection boundaries;
- no arbitrary code execution;
- no shell commands derived from model output;
- no file paths derived directly from model output;
- no remote URLs fetched because a model requested them;
- log redaction;
- bounded retries;
- safe error messages.

The AI may choose only data values from schemas. It receives no filesystem, terminal, network or database tool.

---

## 21. Test strategy

### Unit tests

- catalogue IDs are unique;
- costs are correct;
- legal builds pass;
- over-budget builds fail;
- armour limits work;
- illegal enum values fail;
- policy bounds work;
- damage mitigation works;
- component failure rules work;
- victory conditions work;
- seeded random output is repeatable;
- text renderer never refers to absent events.

### Integration tests

- scripted agent versus scripted agent completes;
- identical match inputs and seed produce byte-equivalent events;
- DeepSeek response fixture parses correctly;
- malformed response triggers bounded correction;
- provider timeout fails cleanly;
- match JSON round-trips through repository;
- series permits legal rebuilds and rejects illegal rebuilds.

### Simulation tests

Run at least 1,000 scripted matches across representative builds to find:

- impossible-to-defeat combinations;
- perpetual draws;
- crashes;
- invalid state transitions;
- excessive first-round kills;
- weapons that never succeed;
- strategies that dominate regardless of build.

### Golden fixtures

Keep a small set of versioned match inputs and expected results. Changes to them must be intentional and documented.

---

## 22. Documentation requirements

Maintain:

### `README.md`

- project purpose;
- current scope;
- setup;
- environment variables;
- commands;
- sample output;
- known limitations.

### `docs/ARCHITECTURE.md`

- module boundaries;
- data flow;
- why the LLM is non-authoritative;
- extension interfaces.

### `docs/RULESET.md`

- all catalogue values;
- budget;
- combat rules;
- victory conditions;
- judging formula.

### `docs/EVENT_FORMAT.md`

- event envelope;
- event types;
- replay guarantees;
- versioning.

### `docs/DECISIONS.md`

A lightweight decision log. Record decisions that would otherwise be rediscovered.

---

## 23. Milestones

### Milestone 0 — Repository foundation

Deliver:

- TypeScript project;
- strict compiler configuration;
- formatting and linting;
- Vitest;
- environment validation;
- README skeleton;
- no game functionality yet.

Exit criteria:

- `npm run check` passes;
- `npm test` passes;
- no secrets are committed.

### Milestone 1 — Catalogue and build validation

Deliver:

- versioned catalogue;
- build schema;
- cost calculator;
- semantic validator;
- tests;
- documented rules.

Exit criteria:

- representative legal and illegal builds are tested;
- the application, not the AI, computes cost.

### Milestone 2 — Deterministic simulator

Deliver:

- two hard-coded legal builds;
- policies;
- seeded combat;
- events;
- result;
- 1,000-match simulation test.

Exit criteria:

- identical input plus seed produces identical output;
- simulator completes without any LLM or database.

### Milestone 3 — Text replay and local persistence

Deliver:

- event-to-text renderer;
- statistics;
- match JSON;
- repository;
- replay command.

Exit criteria:

- a saved match can be reloaded and replayed;
- commentary contains no invented facts.

### Milestone 4 — DeepSeek design adapter

Deliver:

- DeepSeek client;
- `ArenaAgent` adapter;
- JSON mode;
- schemas;
- semantic validation;
- two correction attempts;
- usage/cost metadata;
- fixtures and mocked tests.

Exit criteria:

- DeepSeek can submit a valid robot;
- API failures are handled cleanly;
- no core module depends on DeepSeek.

### Milestone 5 — AI policy and match

Deliver:

- policy prompt and schema;
- Bulwark agent;
- one complete AI-versus-scripted match;
- terminal presentation.

Exit criteria:

- one command produces build, validation, simulation, result and saved replay.

### Milestone 6 — Review and best-of-five

Deliver:

- factual post-match report;
- AI review;
- legal rebuild;
- series storage;
- comparative report.

Exit criteria:

- the system can show what changed and whether performance improved.

### Milestone 7 — Hardening and prototype release

Deliver:

- clean installation path;
- robust errors;
- security documentation;
- balancing report;
- sample matches;
- architecture review;
- backlog for version 0.2.

Exit criteria:

- a fresh clone can be configured and run from README instructions;
- all tests pass;
- excluded features have not leaked into scope.

---

## 24. Definition of done for prototype 0.1

Prototype 0.1 is complete only when:

- a user can configure a DeepSeek API key locally;
- DeepSeek designs a legal machine or receives bounded correction;
- The Bulwark uses the same budget rules;
- the match is resolved by a seeded deterministic engine;
- a text replay is displayed;
- the match is saved;
- the replay can be regenerated without calling DeepSeek;
- a best-of-five series can include AI review and rebuilds;
- provider usage and cost metadata are displayed when available;
- tests prove deterministic behaviour;
- architecture allows a second agent provider without modifying the simulator;
- documentation accurately reflects the implementation.

---

## 25. Guardrails for OpenCode

OpenCode must:

- inspect existing files before editing;
- work one milestone at a time;
- state assumptions in documentation;
- run tests after each meaningful change;
- avoid broad unrelated refactors;
- not install unnecessary packages;
- not replace deterministic rules with LLM judgement;
- not expose the DeepSeek key;
- not add a frontend before the CLI vertical slice works;
- not implement future modes during prototype 0.1;
- stop and report when a milestone is complete.

The operator should commit after each accepted milestone.

---

## 26. First success experiment

Run a five-match series:

1. DeepSeek has no match history.
2. It receives the factual result of match one.
3. It may revise the design.
4. The Bulwark remains unchanged.
5. Every match receives a new seed.

The final report must answer:

- Did the AI identify the Bulwark’s rear weakness?
- Did it choose equipment capable of exploiting it?
- Did it shift armour or mobility after a defeat?
- Did its changes improve expected performance over multiple seeds?
- Did it retain good choices rather than changing randomly?
- Was the text replay understandable?
- Was the API cost acceptably low?

Do not interpret one win as proof. Compare repeated outcomes across seeds.
