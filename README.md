# Forge Arena

A deterministic text-based robot combat arena where an AI agent designs, builds and fights a combat robot under equal constraints.

**Status:** Prototype 0.1 — validated. See [`docs/PROTOTYPE-0.1-VALIDATION.md`](docs/PROTOTYPE-0.1-VALIDATION.md).

**Next:** Prototype 0.2 — planned. See [`docs/PROTOTYPE-0.2-EXPERIMENTAL-PLAN.md`](docs/PROTOTYPE-0.2-EXPERIMENTAL-PLAN.md).

## What works now

- Component catalogue (v1) and build validation
- Deterministic combat simulator with seeded RNG
- ASCII replay rendering with robot portraits and arena snapshots
- Text replay and match statistics
- DeepSeek design adapter with schema validation and bounded correction
- AI tactical policy selection
- Bulwark scripted opponent
- Post-match factual reports and AI review
- Best-of-five series with rebuild loop and comparative reports
- Provider-neutral agent interface
- Usage and cost tracking
- Atomic JSON persistence for matches and series

## Architecture

- **Authoritative deterministic engine** — the simulator decides all outcomes; no LLM-generated prose may alter results.
- **Provider-neutral agents** — DeepSeek is implemented through an `ArenaAgent` interface; core modules never import a provider directly.
- **Replay-first event architecture** — every meaningful state transition produces a typed event; the event log drives text replay, statistics and future visual clients.
- **No secrets in source control** — API keys are read from environment variables only.

See `docs/ARCHITECTURE.md` for details.

## Setup

### Prerequisites

- Node.js 22 or later
- npm
- A DeepSeek API key (for AI matches only)

### Install

```bash
npm install
```

### Environment

Copy `.env.example` to `.env` and fill in your API key. Only required for AI matches; scripted matches work without it.

```bash
cp .env.example .env
```

## Commands

### Development and testing

```bash
npm run check          # Type-check the project
npm test               # Run tests
npm run lint           # Lint with ESLint
npm run format:check   # Check formatting with Prettier
npm run format         # Auto-format with Prettier
```

### Matches

```bash
npm run match                          # Bulwark vs Bulwark (no API key needed)
npm run match -- --ai                  # AI vs Bulwark (requires API key)
npm run match -- --ai --review         # AI vs Bulwark with post-match review
npm run match -- --ai --seed 12345     # Fixed seed for reproducibility
```

### Series

```bash
npm run series                              # AI best-of-five series (requires API key)
npm run series -- --target-wins 3           # First to 3 wins
npm run series -- --maximum-matches 5       # Cap at 5 matches
```

### Replay

```bash
npm run replay -- --match <match-id>    # Replay a saved match from JSON
```

### Smoke test

```bash
npm run smoke:design    # Live test of DeepSeek design generation
```

## Output

- **Matches** are saved to `data/matches/<match-id>.json`
- **Series** are saved to `data/series/<series-id>.json`
- All saved data is gitignored

## Documentation

| Document                                                                             | Purpose                                               |
| ------------------------------------------------------------------------------------ | ----------------------------------------------------- |
| [`docs/PROTOTYPE-0.1-VALIDATION.md`](docs/PROTOTYPE-0.1-VALIDATION.md)               | 0.1 validation results, canonical series, limitations |
| [`docs/PROTOTYPE-0.2-EXPERIMENTAL-PLAN.md`](docs/PROTOTYPE-0.2-EXPERIMENTAL-PLAN.md) | 0.2 research questions, milestones, ADRs              |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)                                       | System architecture and design decisions              |
| [`docs/RULESET.md`](docs/RULESET.md)                                                 | Game rules and combat mechanics                       |
| [`docs/RELEASE-CHECKLIST.md`](docs/RELEASE-CHECKLIST.md)                             | Pre-release verification checklist                    |
| [`docs/DECISIONS.md`](docs/DECISIONS.md)                                             | Architecture Decision Records                         |

## Data directories

```
data/
  matches/    # Individual match JSON files
  series/     # Series JSON files
```

## Documentation

| File                   | Description                                      |
| ---------------------- | ------------------------------------------------ |
| `BUILDPLAN.md`         | Full scope and milestone definitions             |
| `docs/RULESET.md`      | All rules, catalogue values and combat mechanics |
| `docs/ARCHITECTURE.md` | Module boundaries, dependency rules, data flow   |
| `docs/SECURITY.md`     | Security baseline                                |
| `docs/EVENT_FORMAT.md` | Event envelope, types and versioning             |
| `docs/DECISIONS.md`    | Decision log (D1-D21)                            |

## License

UNLICENSED — private prototype.
