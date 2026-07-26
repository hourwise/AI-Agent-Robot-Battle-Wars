import type { SimulationEvent } from "../../simulator/types.js";
import type {
  AsciiReplayInput,
  CompetitionState,
  FighterVisualState,
  HighlightMoment,
} from "./ascii.types.js";

function createFighterStateFromBuild(
  fighterId: string,
  build: CompetitionState["fighterA"]["build"],
  zone: string,
  facing: string,
): FighterVisualState {
  const chassisIntegrity =
    build.proposal.chassisId === "heavy"
      ? 150
      : build.proposal.chassisId === "medium"
        ? 100
        : 60;

  return {
    fighterId,
    build,
    integrity: chassisIntegrity,
    maxIntegrity: chassisIntegrity,
    energy: 100,
    heat: 0,
    zone,
    facing,
    conditions: [],
    components: {
      mobilityDisabled: false,
      weaponDisabled: false,
      utilityDisabled: false,
    },
    armour: {
      front: build.proposal.armour.front,
      left: build.proposal.armour.left,
      right: build.proposal.armour.right,
      rear: build.proposal.armour.rear,
      top: build.proposal.armour.top,
    },
  };
}

export function getInitialState(input: AsciiReplayInput): CompetitionState {
  return input.initialState;
}

export function getRoundEndState(
  input: AsciiReplayInput,
  round: number,
): CompetitionState | null {
  for (let i = input.events.length - 1; i >= 0; i--) {
    const event = input.events[i]!;
    if (event.type === "round_ended" && event.round === round) {
      const data = event.data as {
        fighterA: {
          integrity: number;
          energy: number;
          heat: number;
          zone: string;
          conditions: string[];
        };
        fighterB: {
          integrity: number;
          energy: number;
          heat: number;
          zone: string;
          conditions: string[];
        };
      };

      return {
        fighterA: createFighterStateFromBuild(
          "fighter_a",
          input.initialState.fighterA.build,
          data.fighterA.zone,
          input.initialState.fighterA.facing,
        ),
        fighterB: createFighterStateFromBuild(
          "fighter_b",
          input.initialState.fighterB.build,
          data.fighterB.zone,
          input.initialState.fighterB.facing,
        ),
      };
    }
  }
  return null;
}

export function getStateAfterEvents(
  input: AsciiReplayInput,
  events: readonly SimulationEvent[],
): CompetitionState {
  if (events.length === 0) {
    return getInitialState(input);
  }

  const lastEvent = events[events.length - 1]!;
  const roundEndState = getRoundEndState(input, lastEvent.round);

  if (roundEndState) {
    return applyEventsToState(roundEndState, events);
  }

  return applyEventsToState(getInitialState(input), events);
}

function applyEventsToState(
  state: CompetitionState,
  events: readonly SimulationEvent[],
): CompetitionState {
  let result = { ...state };

  for (const event of events) {
    result = applyEvent(result, event);
  }

  return result;
}

function applyEvent(state: CompetitionState, event: SimulationEvent): CompetitionState {
  const actorIsA = event.actorId === "fighter_a";

  switch (event.type) {
    case "movement_resolved": {
      const data = event.data as { to: string; facing: string };
      if (actorIsA) {
        return {
          ...state,
          fighterA: { ...state.fighterA, zone: data.to, facing: data.facing },
        };
      }
      return {
        ...state,
        fighterB: { ...state.fighterB, zone: data.to, facing: data.facing },
      };
    }

    case "integrity_damaged": {
      const data = event.data as { remaining: number };
      if (actorIsA) {
        return {
          ...state,
          fighterA: { ...state.fighterA, integrity: data.remaining },
        };
      }
      return {
        ...state,
        fighterB: { ...state.fighterB, integrity: data.remaining },
      };
    }

    case "robot_overturned": {
      if (actorIsA) {
        return {
          ...state,
          fighterA: {
            ...state.fighterA,
            conditions: [...state.fighterA.conditions, "overturned"],
          },
        };
      }
      return {
        ...state,
        fighterB: {
          ...state.fighterB,
          conditions: [...state.fighterB.conditions, "overturned"],
        },
      };
    }

    case "component_disabled": {
      const data = event.data as { component: string };
      const target = actorIsA ? "fighterB" : "fighterA";
      const fighter = state[target];
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
        [target]: {
          ...fighter,
          components: newComponents,
          conditions: newConditions,
        },
      };
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
