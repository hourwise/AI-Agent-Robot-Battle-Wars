import type { SimulationEvent } from "../../simulator/types.js";
import type {
  AsciiReplayInput,
  CompetitionState,
  HighlightMoment,
} from "./ascii.types.js";

export function getInitialState(input: AsciiReplayInput): CompetitionState {
  return input.initialState;
}

export function getRoundEndState(
  input: AsciiReplayInput,
  round: number,
): CompetitionState | null {
  let state = getInitialState(input);

  for (const event of input.events) {
    if (event.round === undefined || event.round > round) break;
    if (event.type === "round_started" && event.round === round) continue;

    state = applyEvent(state, event);
  }

  return state;
}

export function getStateAfterEvents(
  input: AsciiReplayInput,
  events: readonly SimulationEvent[],
): CompetitionState {
  let state = getInitialState(input);

  for (const event of events) {
    state = applyEvent(state, event);
  }

  return state;
}

function applyEvent(state: CompetitionState, event: SimulationEvent): CompetitionState {
  switch (event.type) {
    case "movement_resolved": {
      const data = event.data as { to: string; facing: string };
      const fighterId = event.actorId;
      if (fighterId === "fighter_a") {
        return {
          ...state,
          fighterA: { ...state.fighterA, zone: data.to, facing: data.facing },
        };
      }
      if (fighterId === "fighter_b") {
        return {
          ...state,
          fighterB: { ...state.fighterB, zone: data.to, facing: data.facing },
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

    case "component_disabled": {
      const data = event.data as { component: string };
      const targetId = event.targetId;
      if (targetId !== "fighter_a" && targetId !== "fighter_b") return state;

      const key = targetId === "fighter_a" ? "fighterA" : "fighterB";
      const fighter = state[key];
      const newComponents = { ...fighter.components };

      if (data.component === "mobility") {
        newComponents.mobilityDisabled = true;
      } else if (data.component === "weapon") {
        newComponents.weaponDisabled = true;
      } else if (data.component === "utility") {
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
): HighlightMoment[] {
  return moments.map((moment, index) => {
    const previousState =
      index > 0 ? moments[index - 1]!.stateAfter : getInitialState(input);

    const stateAfter = getStateAfterEvents(input, moment.events);

    return {
      ...moment,
      stateAfter: stateAfter ?? previousState,
    };
  });
}
