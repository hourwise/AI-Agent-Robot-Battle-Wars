import type { SimulationEvent } from "../simulator/types.js";

export function createEvent(
  type: string,
  sequence: number,
  round: number,
  timestampMs: number,
  actorId?: string,
  targetId?: string,
  data: Record<string, unknown> = {},
): SimulationEvent {
  return {
    schemaVersion: "1",
    sequence,
    round,
    timestampMs,
    type,
    actorId,
    targetId,
    data,
  };
}
