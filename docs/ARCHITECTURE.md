# Architecture

## Principles

### Authoritative deterministic engine

The simulator is the sole authority for build cost, build legality, mass and energy constraints, hit probability, damage, component failure, status effects, victory conditions, match termination and final result. No LLM-generated prose may alter these results.

### Provider-neutral agents

All AI providers are accessed through an `ArenaAgent` interface. Core game modules must not import any provider client directly. Future adapters must be possible for other providers, local models, scripted bots and MCP.

### Replay-first event architecture

Every meaningful state transition produces a typed event. The simulator never prints commentary directly.

```
Agent decisions
      |
Validated commands
      |
Deterministic simulator
      |
Authoritative event log
      |-- text replay
      |-- statistics
      |-- future browser animation
      |-- future 3D replay
```

### Bounded model use

Every model operation must have a timeout, a maximum response size, a finite retry count, schema validation, a clear fallback and token-usage capture where available. No unbounded agent loops.

### No secrets in source control

API keys are read from environment variables. `.env` is gitignored. Provider calls are server/local only. The full API key is never printed or stored in match records.

## Module boundaries

```
src/
  config/         Environment validation and configuration
  shared/         Shared utilities (text sanitisation)
  catalogue/      Versioned component catalogue
  schemas/        Zod schemas (build, match record)
  validation/     Build and decision validators
  simulator/      Deterministic combat engine
  events/         Event types and factory
  replay/         Text renderer and statistics
  replay/ascii/   Presentation-only ASCII rendering layer
  persistence/    Match and series repositories
  agents/         ArenaAgent interface and provider adapters
  prompts/        Versioned prompt templates
  app/            CLI entry points
```

Each layer depends only on layers below it. The simulator never imports agents, persistence or replay. Agents never import the simulator.

### Shared utilities

The `shared/` directory contains cross-cutting utilities used by multiple modules. Currently:

- `text-sanitise.ts`: Terminal-safe text sanitisation (ANSI removal, control character filtering, name truncation). Used by ASCII replay, text replay, and statistics to prevent terminal injection.

### Persistence patterns

The JSON match repository uses:

- **Atomic writes**: Write to a temp file, then rename to final path. Prevents corruption on crash.
- **UUID validation**: Match IDs are validated as UUIDs before filesystem access.
- **Existing-ID rejection**: `saveMatch` throws if a match with the same ID already exists.
- **Corrupt entry tracking**: `listCorruptEntries()` reports files that failed validation.

### Presentation-only rendering boundary

The ASCII replay renderer is a presentation layer that consumes authoritative match records. It never influences:

- combat decisions
- action resolution
- damage calculations
- movement
- random rolls
- victory conditions
- event generation

The dependency direction is:

```
MatchRecord / authoritative events
              ↓
      replay presentation
              ↓
        ASCII output
```

Simulator packages must not import replay presentation modules. The ASCII layer receives only the specific data it needs through narrow interfaces.

## LLM non-authority

The language model submits proposals. The application validates them. The simulator resolves outcomes. The event log records what happened. The renderer describes it. At no point does model output bypass validation or override a deterministic result.
