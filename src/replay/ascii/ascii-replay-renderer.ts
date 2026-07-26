import type { MatchResult } from "../../simulator/types.js";
import type {
  AsciiReplayInput,
  AsciiRenderOptions,
  CompetitionState,
} from "./ascii.types.js";
import { renderPortrait } from "./robot-portrait-renderer.js";
import { selectHighlights } from "./highlight-selector.js";
import { populateHighlightStates, getInitialState } from "./state-reconstructor.js";
import { renderMoment, renderOpeningFrame } from "./moment-renderer.js";
import { renderResultCard } from "./result-card-renderer.js";
import { SEPARATOR, padCenter, ARENA_WIDTH } from "./ascii-layout.js";

function adaptMatchResult(result: MatchResult): AsciiReplayInput {
  return {
    config: result.config,
    initialState: {
      fighterA: {
        fighterId: "fighter_a",
        build: result.initialState.fighterA.build,
        integrity: result.initialState.fighterA.integrity,
        maxIntegrity: result.initialState.fighterA.maxIntegrity,
        energy: result.initialState.fighterA.energy,
        heat: result.initialState.fighterA.heat,
        zone: result.initialState.fighterA.zone,
        facing: result.initialState.fighterA.facing,
        conditions: [...result.initialState.fighterA.conditions],
        components: { ...result.initialState.fighterA.components },
        armour: { ...result.initialState.fighterA.armour },
      },
      fighterB: {
        fighterId: "fighter_b",
        build: result.initialState.fighterB.build,
        integrity: result.initialState.fighterB.integrity,
        maxIntegrity: result.initialState.fighterB.maxIntegrity,
        energy: result.initialState.fighterB.energy,
        heat: result.initialState.fighterB.heat,
        zone: result.initialState.fighterB.zone,
        facing: result.initialState.fighterB.facing,
        conditions: [...result.initialState.fighterB.conditions],
        components: { ...result.initialState.fighterB.components },
        armour: { ...result.initialState.fighterB.armour },
      },
    },
    events: result.events,
    result: result.result,
    rounds: result.rounds,
  };
}

function renderFighterCards(state: CompetitionState): string {
  const lines: string[] = [];

  lines.push(SEPARATOR);
  lines.push(padCenter("FIGHTER PROFILES", ARENA_WIDTH));
  lines.push(SEPARATOR);
  lines.push("");

  lines.push(renderPortrait(state.fighterA.build, state.fighterA));
  lines.push("");
  lines.push(renderPortrait(state.fighterB.build, state.fighterB));
  lines.push("");

  return lines.join("\n");
}

export function renderAsciiReplay(
  input: MatchResult | AsciiReplayInput,
  options: AsciiRenderOptions = { mode: "ascii" },
): string {
  const replayInput = isAsciiReplayInput(input) ? input : adaptMatchResult(input);
  const maxHighlights = options.maxHighlights ?? 5;

  const lines: string[] = [];

  lines.push(padCenter("FORGE ARENA — ASCII REPLAY", ARENA_WIDTH));
  lines.push("");

  const initialState = getInitialState(replayInput);
  lines.push(renderFighterCards(initialState));

  lines.push(renderOpeningFrame(initialState, replayInput.config.seed));

  const combatHighlights = selectHighlights(
    replayInput.events,
    replayInput.result,
    maxHighlights,
  );
  const populatedHighlights = populateHighlightStates(replayInput, combatHighlights);

  for (const moment of populatedHighlights) {
    lines.push(renderMoment(moment));
  }

  lines.push(
    renderResultCard(
      replayInput.result,
      initialState,
      replayInput.events,
      replayInput.rounds,
      replayInput.config.seed,
    ),
  );

  return lines.join("\n");
}

function isAsciiReplayInput(
  input: MatchResult | AsciiReplayInput,
): input is AsciiReplayInput {
  return (
    "initialState" in input && "fighterA" in (input as AsciiReplayInput).initialState
  );
}
