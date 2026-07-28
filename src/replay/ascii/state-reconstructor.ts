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
      const data = event.data as { to: string; facing: string; action?: string };
      // For knockback events, the fighter whose zone changed is targetId (the one knocked back).
      // For normal movement, it is actorId.
      const isKnockback = data.action === "knockback";
      const fighterId = isKnockback ? event.targetId : event.actorId;
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
): HighlightMoment[] {
  return moments.map((moment) => {
    const lastEvent = moment.events[moment.events.length - 1];
    if (!lastEvent) {
      return { ...moment, stateAfter: getInitialState(input) };
    }

    const eventsUpTo = input.events.filter((e) => e.sequence <= lastEvent.sequence);

    const inputSequences = new Set(eventsUpTo.map((e) => e.sequence));
    const missingMomentEvents = moment.events.filter(
      (e) => !inputSequences.has(e.sequence),
    );

    const allEvents = [...eventsUpTo, ...missingMomentEvents].sort(
      (a, b) => a.sequence - b.sequence,
    );

    const stateAfter = getStateAfterEvents(input, allEvents);

    return { ...moment, stateAfter };
  });
}
