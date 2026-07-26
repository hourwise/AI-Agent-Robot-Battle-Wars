# Forge Arena — Planned Future Builds

**Purpose:** Preserve expansion paths without enlarging prototype 0.1.  
**Rule:** These features are not authorised for implementation during the first prototype unless the active build plan is formally revised.

---

## 1. Architectural commitments to preserve now

The first prototype should preserve these future capabilities through interfaces and data contracts:

- multiple agent providers;
- multiple competitors;
- multiple teams;
- multiple competition types;
- multiple arenas;
- model-owned and player-owned identities;
- server-authoritative results;
- deterministic replays;
- database migration;
- live and asynchronous matches;
- tactical checkpoints;
- graphical replay clients;
- verified and unverified model categories.

Preserving an expansion point does not mean implementing it.

---

## 2. Build 0.2 — Two AI competitors on one machine

### Goal

Replace the scripted opponent with a second model-controlled competitor while retaining The Bulwark as a testing fixture.

### Planned features

- Two `ArenaAgent` instances.
- Separate DeepSeek API keys where desired.
- Separate provider usage and cost records.
- Equal engineering and decision budgets.
- Simultaneous build lock.
- Hidden opponent designs until both are committed.
- Independent validation and bounded retries.
- AI-versus-AI best-of series.
- Model and prompt metadata in match receipts.

### Important design

A second API key should be configuration, not a separate code path:

```env
ARENA_AGENT_A_PROVIDER=deepseek
ARENA_AGENT_A_API_KEY=
ARENA_AGENT_A_MODEL=deepseek-v4-flash

ARENA_AGENT_B_PROVIDER=deepseek
ARENA_AGENT_B_API_KEY=
ARENA_AGENT_B_MODEL=deepseek-v4-flash
```

The system must also permit both agents to use one account where provider terms and rate limits allow it.

### Fairness considerations

Record:

- model ID;
- thinking mode;
- prompt version;
- context supplied;
- token budget;
- number of retries;
- response latency.

Do not claim that an arbitrary endpoint is a verified model.

---

## 3. Build 0.3 — Local browser spectator view

### Goal

Make matches easier to understand without introducing 3D.

### Planned features

- Local server.
- Fighter cards.
- build comparison;
- health, armour, energy and heat displays;
- timeline;
- round-by-round replay;
- event inspector;
- match and series history;
- shareable exported match file.

### Boundary

The browser is a replay and control client. It does not calculate authoritative damage or call provider APIs directly.

---

## 4. Build 0.4 — Cloud persistence and accounts

### Goal

Move from a personal local prototype to private online testing.

### Planned features

- PostgreSQL or Supabase persistence.
- User accounts.
- encrypted provider credential storage or a local-key bridge;
- fighter stables;
- match history;
- private invitations;
- rudimentary ratings;
- server-side match execution;
- rate and spending limits;
- administrative audit log.

### Data model candidates

- users;
- provider_connections;
- competitors;
- machine_builds;
- matches;
- match_participants;
- event_logs;
- ratings;
- series;
- rulesets;
- catalogues.

Use append-only match records. Corrections should create metadata rather than rewriting historical results silently.

---

## 5. Build 0.5 — Matchmaking and ranked play

### Goal

Allow unrelated users to queue compatible agents.

### Planned features

- queue by competition ruleset;
- rating bands;
- verified and unverified categories;
- provider/model divisions;
- asynchronous matchmaking;
- match acceptance window;
- disconnect and provider-failure policies;
- season identifiers;
- anti-farming controls;
- public leaderboard.

### Rating separation

Potential ratings:

- stable rating;
- competitor rating;
- model/model-version rating;
- builder rating;
- pilot rating;
- uncoached benchmark rating.

Avoid one leaderboard that conceals major differences in compute and coaching.

---

## 6. Build 0.6 — Tactical checkpoints

### Goal

Allow models to alter tactics during a match without creating uncontrolled real-time agent loops.

### Planned features

- state snapshots at fixed rounds;
- constrained tactical action schema;
- strict response deadline;
- default action on timeout;
- fixed maximum call count;
- equal decision budget;
- event showing each accepted tactical change.

### Not planned

- unrestricted natural-language communication between agents;
- direct game-engine control;
- model-authored executable scripts;
- unlimited thinking loops.

---

## 7. Build 0.7 — Modular 2D or lightweight 3D replay

### Goal

Render saved event logs visually.

### Planned approach

- Godot replay client.
- Prebuilt modular robot parts.
- Known attachment points.
- pre-authored movement and attack animations;
- effects mapped to event types;
- automatic cameras;
- crowd sound;
- slow-motion highlights;
- local replay first.

### Critical rule

The graphical client consumes the authoritative event log. Physics or animation must not retroactively change the recorded result.

The first visual renderer may interpolate positions for presentation while preserving event order and outcome.

---

## 8. Build 0.8 — Public replay and clip service

### Goal

Allow completed matches to be watched and shared.

### Planned features

- public replay pages;
- replay privacy controls;
- match receipt;
- generated highlights;
- downloadable or shareable short clips;
- moderation of names and descriptions;
- storage expiry policies;
- optional server rendering.

### Cost control

Prefer client-side replay. Make server-rendered high-quality video an optional platform service rather than a requirement for every match.

---

## 9. Build 1.0 — Public duel platform

### Goal

Launch the core one-on-one competition.

### Required maturity

- stable ruleset;
- balance testing;
- provider credential security;
- account recovery;
- spending caps;
- moderation;
- fair matchmaking;
- replay integrity;
- abuse prevention;
- provider-terms review;
- privacy policy and terms;
- support and incident process.

### Potential revenue that does not buy power

- replay rendering;
- cosmetic parts and arenas;
- team branding;
- private competitions;
- longer replay storage;
- commentary packs;
- event sponsorship;
- creator tournament tools.

Ranked engineering budgets must remain equal.

---

## 10. Build 1.x — Tag-team competitions

### Goal

Each AI creates and coordinates two distinct fighters.

### Formats

- relay tag;
- doubles;
- elimination tag;
- free substitution zones.

### Required architecture

- `Team` as a first-class participant;
- shared team engineering budget;
- multiple active and reserve competitors;
- switch events;
- teammate-targeting restrictions;
- team victory conditions;
- coordinated policy schema.

### Strategic questions

- specialist pair versus balanced pair;
- starting fighter;
- protection and sacrifice;
- substitution timing;
- shared or separate damage/energy resources.

---

## 11. Build 1.x — Mob brawl

### Goal

Four to eight separate AI fighters compete until one remains or wins by score.

### Required work

- efficient multi-participant simulator;
- target-selection policies;
- visibility and threat systems;
- anti-dogpiling balance;
- simultaneous action resolution;
- collision conflict rules;
- performance tests;
- free-for-all ranking adjustments.

### Constrained social actions

Possible later actions:

- propose truce;
- accept;
- reject;
- identify common target;
- request assistance;
- disengage;
- betray.

Do not provide an unrestricted agent chat channel without a dedicated security design.

---

## 12. Build 2.x — Engineering Games

Combat remains the launch focus, but the generic competition architecture may support other events.

### Candidate events

#### Sprint

Optimise acceleration, speed, traction, energy and stability.

#### Endurance

Balance performance against heat, battery use and component wear.

#### Obstacle course

Test adaptability across ramps, debris, narrow paths and changing surfaces.

#### Hill climb

Optimise torque, traction, centre of mass and cooling.

#### Long jump

Balance acceleration, launch geometry, mass and landing survival.

#### Tug-of-war

Optimise traction, anchoring, torque and heat management.

#### Capture the flag

Create roles for speed, defence, interception and control.

#### Rescue trial

Move fragile payloads through hazards with precision.

#### Demolition trial

Destroy fixed targets efficiently without self-disabling.

### Why preserve this

Different events could expose different forms of model reasoning and reduce the risk that one combat build dominates the entire platform.

---

## 13. Constructors’ Championship

A later season could combine several event types.

Potential scoring categories:

- combat tactics;
- construction efficiency;
- mobility;
- endurance;
- adaptation;
- teamwork;
- precision;
- resource management.

This could become both entertainment and an informal model-behaviour benchmark, provided claims remain carefully qualified.

---

## 14. Boss and cooperative modes

Potential modes:

- several AI fighters against a scripted boss;
- asymmetric fortress raid;
- escort mission;
- survival waves;
- cooperative rescue;
- team capture objectives.

These require team policy and shared-objective contracts but can reuse the event and replay architecture.

---

## 15. Persistent fighter development

A future competitor may retain:

- build history;
- match summaries;
- opponent notes;
- trophies;
- rivalry records;
- public personality;
- coaching history.

### Safety and fairness

- memory must have provenance;
- ranked modes must define what history is permitted;
- users must be able to inspect or reset stored competitive memory;
- private user data must not appear in public commentary;
- memory must not silently alter engineering budgets.

---

## 16. MCP and the Fates

MCP is not required for the prototype.

A later integration might expose narrow tools:

- inspect catalogue;
- propose build;
- submit build;
- inspect battle snapshot;
- submit tactical action;
- review result.

Potential Fates roles:

- Runtime Contracts: portable agent and event envelopes.
- Ananke: validate and govern permitted actions.
- Horae: orchestrate build, match, commentary and replay workflows.
- Mnemosyne: governed persistent fighter history.

The game must not block on completion of the Fates. Integrate only when the standalone contracts are stable and the benefit is concrete.

---

## 17. Verified model matches

Future official model leaderboards require a trustworthy request path.

### Verified category

The platform makes the request through an approved integration and records available provider metadata.

### Unverified/open category

A user connects an arbitrary compatible endpoint. It may compete but cannot be asserted to be a particular model merely because it reports a name.

Match receipts should preserve:

- provider;
- model identifier;
- adapter;
- prompt hash;
- ruleset;
- catalogue;
- simulator;
- seed;
- usage;
- response hashes where appropriate.

---

## 18. Features to avoid or approach cautiously

### Paying for stronger equipment

Do not permit in ranked competition.

### Mandatory paid repairs after losing

Likely to feel punitive and undermine experimentation. Prefer automatic ranked restoration, earned salvage or optional cosmetic persistence.

### Cash wagering

Avoid without specialist legal advice.

### Random paid component packs

Avoid. They could create pay-to-win and gambling-like concerns.

### Unrestricted model networking or tools

Do not allow agents to fetch arbitrary URLs, run code or contact each other.

### Generative video as the authoritative replay

Do not use it. It is expensive, inconsistent and cannot reliably reproduce exact events.

---

## 19. Expansion checklist

Before approving a future feature, ask:

1. Does it reuse the authoritative simulator and event log?
2. Does it preserve equal competitive resources?
3. Can it be versioned and replayed?
4. Does it introduce new provider or security risk?
5. Does it require secrets in a client?
6. Does it create unbounded model cost?
7. Does it require a data migration?
8. Can old matches still be replayed?
9. Does it require moderation?
10. Is it fun in text or simple visuals before expensive presentation work?

---

## 20. Roadmap principle

Build outward from a proven loop:

```text
valid constrained choice
        ↓
interesting deterministic result
        ↓
readable event history
        ↓
adaptation over rematches
        ↓
second AI
        ↓
online competition
        ↓
visual replay
        ↓
additional formats
```

Do not reverse that order by building graphics, accounts or monetisation before the constrained competition itself is enjoyable.
