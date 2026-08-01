import type { SimulationEvent } from "../../simulator/types.js";
import { isGridZone } from "../../simulator/arena-grid.js";
import { getMovementEventSubjectId } from "../../events/battle-event.js";
import { POSITIONING_MODEL_LEGACY } from "../../schemas/positioning.schema.js";
import {
  isGridReplayPositioningModel,
  type ReplayPositioningModel,
} from "../positioning-model.js";
import type {
  AsciiReplayInput,
  CompetitionState,
  HighlightMoment,
} from "./ascii.types.js";

function assertGridZone(value: unknown, context: string): void {
  if (!isGridZone(value)) {
    throw new Error(
      `Grid reconstruction rejects non-grid zone in ${context}: ${String(value)}`,
    );
  }
}

export function getInitialState(
  input: AsciiReplayInput,
  positioningModel: ReplayPositioningModel = POSITIONING_MODEL_LEGACY,
): CompetitionState {
  if (isGridReplayPositioningModel(positioningModel)) {
    assertGridZone(input.initialState.fighterA.zone, "initial fighterA.zone");
    assertGridZone(input.initialState.fighterB.zone, "initial fighterB.zone");
  }
  return input.initialState;
}

export function getRoundEndState(
  input: AsciiReplayInput,
  round: number,
  positioningModel: ReplayPositioningModel = POSITIONING_MODEL_LEGACY,
): CompetitionState | null {
  let state = getInitialState(input, positioningModel);

  for (const event of input.events) {
    if (event.round === undefined || event.round > round) break;
    if (event.type === "round_started" && event.round === round) continue;

    state = applyEvent(state, event, positioningModel);
  }

  return state;
}

export function getStateAfterEvents(
  input: AsciiReplayInput,
  events: readonly SimulationEvent[],
  positioningModel: ReplayPositioningModel = POSITIONING_MODEL_LEGACY,
): CompetitionState {
  let state = getInitialState(input, positioningModel);

  for (const event of events) {
    state = applyEvent(state, event, positioningModel);
  }

  return state;
}

function applyEvent(
  state: CompetitionState,
  event: SimulationEvent,
  positioningModel: ReplayPositioningModel,
): CompetitionState {
  switch (event.type) {
    case "movement_resolved": {
      const data = event.data as {
        from?: string;
        to: string;
        facing: string;
        action?: string;
      };
      if (isGridReplayPositioningModel(positioningModel)) {
        if (data.from !== undefined) {
          assertGridZone(data.from, "movement_resolved.data.from");
        }
        assertGridZone(data.to, "movement_resolved.data.to");
      }
      // The canonical movement-event subject: knockback and grapple reposition
      // the target fighter; all normal movement repositions the actor. A
      // malformed event with no subject id moves nothing.
      const fighterId = getMovementEventSubjectId(event);
      const facing =
        data.facing ??
        (fighterId === "fighter_a" ? state.fighterA.facing : state.fighterB.facing);
      if (fighterId === "fighter_a") {
        return {
          ...state,
          fighterA: { ...state.fighterA, zone: data.to, facing },
        };
      }
      if (fighterId === "fighter_b") {
        return {
          ...state,
          fighterB: { ...state.fighterB, zone: data.to, facing },
        };
      }
      return state;
    }

    case "integrity_damaged": {
      const data = event.data as { remaining: number };
      const targetId = event.targetId;
      if (targetId === "fighter_a") {
        return {
          ...state,
          fighterA: { ...state.fighterA, integrity: data.remaining },
        };
      }
      if (targetId === "fighter_b") {
        return {
          ...state,
          fighterB: { ...state.fighterB, integrity: data.remaining },
        };
      }
      return state;
    }

    case "robot_overturned": {
      const targetId = event.targetId;
      if (targetId === "fighter_a") {
        return {
          ...state,
          fighterA: {
            ...state.fighterA,
            conditions: [...state.fighterA.conditions, "overturned"],
          },
        };
      }
      if (targetId === "fighter_b") {
        return {
          ...state,
          fighterB: {
            ...state.fighterB,
            conditions: [...state.fighterB.conditions, "overturned"],
          },
        };
      }
      return state;
    }

    case "component_damaged": {
      const data = event.data as { component: string };
      const targetId = event.targetId;
      if (targetId !== "fighter_a" && targetId !== "fighter_b") return state;

      const key = targetId === "fighter_a" ? "fighterA" : "fighterB";
      const fighter = state[key];
      const newComponents = { ...fighter.components };

      if (data.component === "mobility") {
        newComponents.mobilityDamaged = true;
      } else if (data.component === "weapon") {
        newComponents.weaponDamaged = true;
      } else if (data.component === "utility") {
        newComponents.utilityDamaged = true;
      }

      return {
        ...state,
        [key]: {
          ...fighter,
          components: newComponents,
        },
      };
    }

    case "component_damage_resisted": {
      // Guard was consumed — no component state change, but guard is spent.
      // The event data records guardStateBefore/After for factual reporting.
      // No visual component state change needed for ASCII replay.
      return state;
    }

    case "component_disabled": {
      const data = event.data as { component: string };
      const targetId = event.targetId;
      if (targetId !== "fighter_a" && targetId !== "fighter_b") return state;

      const key = targetId === "fighter_a" ? "fighterA" : "fighterB";
      const fighter = state[key];
      const newComponents = { ...fighter.components };

      if (data.component === "mobility") {
        newComponents.mobilityDamaged = true;
        newComponents.mobilityDisabled = true;
      } else if (data.component === "weapon") {
        newComponents.weaponDamaged = true;
        newComponents.weaponDisabled = true;
      } else if (data.component === "utility") {
        newComponents.utilityDamaged = true;
        newComponents.utilityDisabled = true;
      }

      const newConditions = [...fighter.conditions];
      if (data.component === "mobility" && !newConditions.includes("immobilised")) {
        newConditions.push("immobilised");
      }

      return {
        ...state,
        [key]: {
          ...fighter,
          components: newComponents,
          conditions: newConditions,
        },
      };
    }

    case "robot_overheated": {
      const actorId = event.actorId;
      if (actorId === "fighter_a") {
        return {
          ...state,
          fighterA: {
            ...state.fighterA,
            conditions: [...state.fighterA.conditions, "overheated"],
          },
        };
      }
      if (actorId === "fighter_b") {
        return {
          ...state,
          fighterB: {
            ...state.fighterB,
            conditions: [...state.fighterB.conditions, "overheated"],
          },
        };
      }
      return state;
    }

    case "robot_recovered": {
      const actorId = event.actorId;
      if (actorId === "fighter_a") {
        return {
          ...state,
          fighterA: {
            ...state.fighterA,
            conditions: state.fighterA.conditions.filter((c) => c !== "overheated"),
            heat: (event.data.heatAfterRecovery as number) ?? state.fighterA.heat,
          },
        };
      }
      if (actorId === "fighter_b") {
        return {
          ...state,
          fighterB: {
            ...state.fighterB,
            conditions: state.fighterB.conditions.filter((c) => c !== "overheated"),
            heat: (event.data.heatAfterRecovery as number) ?? state.fighterB.heat,
          },
        };
      }
      return state;
    }

    default:
      return state;
  }
}

export function populateHighlightStates(
  input: AsciiReplayInput,
  moments: HighlightMoment[],
  positioningModel: ReplayPositioningModel = POSITIONING_MODEL_LEGACY,
): HighlightMoment[] {
  return moments.map((moment) => {
    const lastEvent = moment.events[moment.events.length - 1];
    if (!lastEvent) {
      return { ...moment, stateAfter: getInitialState(input, positioningModel) };
    }

    const eventsUpTo = input.events.filter((e) => e.sequence <= lastEvent.sequence);

    const inputSequences = new Set(eventsUpTo.map((e) => e.sequence));
    const missingMomentEvents = moment.events.filter(
      (e) => !inputSequences.has(e.sequence),
    );

    const allEvents = [...eventsUpTo, ...missingMomentEvents].sort(
      (a, b) => a.sequence - b.sequence,
    );

    const stateAfter = getStateAfterEvents(input, allEvents, positioningModel);

    return { ...moment, stateAfter };
  });
}
