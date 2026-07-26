# Event Format — Forge Arena v1

## Event envelope

Every simulation event includes:

```ts
interface SimulationEvent {
  schemaVersion: string; // "1"
  sequence: number; // monotonically increasing within match
  round: number; // 1-20, or 0 for competition-level events
  timestampMs: number; // monotonic counter, not wall clock
  type: string; // event type identifier
  actorId?: string; // fighter performing the action
  targetId?: string; // fighter affected by the action
  data: Record<string, unknown>; // event-specific payload
}
```

## Event types

| Type                  | Description                               | actorId  | targetId |
| --------------------- | ----------------------------------------- | -------- | -------- |
| `competition_started` | Match begins with seed and version info   | —        | —        |
| `round_started`       | Round begins                              | —        | —        |
| `movement_resolved`   | Fighter moved or repositioned             | fighter  | —        |
| `attack_attempted`    | Fighter initiated an attack               | attacker | defender |
| `attack_missed`       | Attack missed                             | attacker | defender |
| `attack_hit`          | Attack hit and dealt damage               | attacker | defender |
| `integrity_damaged`   | Fighter lost integrity                    | attacker | defender |
| `component_disabled`  | A component was destroyed by critical hit | attacker | defender |
| `robot_overturned`    | Fighter was flipped or overturned         | attacker | defender |
| `robot_overheated`    | Fighter exceeded heat threshold           | fighter  | —        |
| `robot_recovered`     | Fighter recovered from overheating        | fighter  | —        |
| `policy_triggered`    | Derived action from policy                | fighter  | —        |
| `round_ended`         | Round summary with both fighter states    | —        | —        |
| `competition_ended`   | Match result                              | —        | —        |

## Replay guarantees

- Every statement in a text replay must map to one or more authoritative events.
- The event log is append-only during a match.
- No rendered commentary appears in event data.
- Same seed + same inputs = identical event log.
- Events are sufficient to reconstruct the full match state at any round.

## Versioning

- `schemaVersion` is bumped when the event envelope changes.
- `type` values are stable within a schema version.
- New event types may be added in later schema versions.
- Removed event types are deprecated, not deleted.
