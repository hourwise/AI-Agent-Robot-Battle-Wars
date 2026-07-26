# Forge Arena

A deterministic text-based robot combat arena where an AI agent designs, builds and fights a combat robot under equal constraints.

**Status:** Prototype 0.1 — repository foundation only.

## Current scope

Forge Arena is an experiment: can an AI design, explain and improve a competitive machine under equal constraints in a way that produces coherent, entertaining and repeatable matches?

The language model makes choices. It does not calculate costs, determine legality, apply damage, select random results or decide who won. The authoritative simulator decides all outcomes.

## What works now

- TypeScript project with strict compiler settings
- Environment validation with Zod
- Vitest test runner
- ESLint and Prettier
- Component catalogue (v1) and build validation
- Deterministic combat simulator with seeded RNG
- ASCII replay rendering with robot portraits and arena snapshots

## What does not work yet

- Component catalogue and build validation
- Deterministic simulator
- Text replay and persistence
- DeepSeek integration
- AI-vs-opponent matches
- Best-of-five series

See `BUILDPLAN.md` for the full milestone roadmap.

## Setup

### Prerequisites

- Node.js 22 or later
- npm

### Install

```bash
npm install
```

### Environment

Copy `.env.example` to `.env` and fill in your values. The DeepSeek API key is required from Milestone 4 onwards.

```bash
cp .env.example .env
```

### Commands

```bash
npm run check          # Type-check the project
npm test               # Run tests
npm run lint           # Lint with ESLint
npm run format:check   # Check formatting with Prettier
npm run format         # Auto-format with Prettier
npm run dev            # Run the application (currently a placeholder)
```

### ASCII Replay

The ASCII replay renderer produces deterministic visual battle reports from saved match results.

```typescript
import { renderAsciiReplay } from "./src/replay/ascii/ascii-replay-renderer.js";
import { runMatch } from "./src/simulator/simulator.js";

const match = runMatch(config);
const asciiReplay = renderAsciiReplay(match);
console.log(asciiReplay);
```

The renderer produces:
- Fighter profiles with chassis, mobility, weapon and utility details
- Arena snapshots showing positions and facing
- Selected battle moments (4-7 highlights per match)
- Final result card with winner, method and decisive event

All output is deterministic and reproducible from the same seed.

## Architecture

The project follows these principles:

- **Authoritative deterministic engine** — the simulator decides all outcomes; no LLM-generated prose may alter results.
- **Provider-neutral agents** — DeepSeek is implemented through an `ArenaAgent` interface; core modules never import a provider directly.
- **Replay-first event architecture** — every meaningful state transition produces a typed event; the event log drives text replay, statistics and future visual clients.
- **No secrets in source control** — API keys are read from environment variables only.

See `docs/ARCHITECTURE.md` for details.

## Security

See `docs/SECURITY.md` for the security baseline.

## License

UNLICENSED — private prototype.
