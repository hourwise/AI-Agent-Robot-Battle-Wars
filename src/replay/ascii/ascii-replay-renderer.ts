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
import { SEPARATOR, padCenter, ARENA_WIDTH, resolveDisplayName } from "./ascii-layout.js";

function adaptFighterVisual(fighter: MatchResult["initialState"]["fighterA"]): {
  fighterId: string;
  build: typeof fighter.build;
  integrity: number;
  maxIntegrity: number;
  energy: number;
  heat: number;
  zone: string;
  facing: string;
  conditions: string[];
  components: {
    mobilityDisabled: boolean;
    weaponDisabled: boolean;
    utilityDisabled: boolean;
    mobilityDamaged: boolean;
    weaponDamaged: boolean;
    utilityDamaged: boolean;
  };
  armour: typeof fighter.armour;
} {
  return {
    fighterId: fighter.fighterId,
    build: fighter.build,
    integrity: fighter.integrity,
    maxIntegrity: fighter.maxIntegrity,
    energy: fighter.energy,
    heat: fighter.heat,
    zone: fighter.zone,
    facing: fighter.facing,
    conditions: [...fighter.conditions],
    components: {
      mobilityDisabled: fighter.components.mobilityDisabled,
      weaponDisabled: fighter.components.weaponDisabled,
      utilityDisabled: fighter.components.utilityDisabled,
      mobilityDamaged: fighter.comps.mobility.state === "damaged",
      weaponDamaged: fighter.comps.weapon.state === "damaged",
      utilityDamaged: fighter.comps.utility.state === "damaged",
    },
    armour: { ...fighter.armour },
  };
}

function adaptMatchResult(result: MatchResult): AsciiReplayInput {
  return {
    config: result.config,
    initialState: {
      fighterA: adaptFighterVisual(result.initialState.fighterA),
      fighterB: adaptFighterVisual(result.initialState.fighterB),
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

  const nameA = resolveDisplayName(
    "fighter_a",
    state.fighterA.build.proposal.machineName,
    state.fighterB.build.proposal.machineName,
  );
  const nameB = resolveDisplayName(
    "fighter_b",
    state.fighterA.build.proposal.machineName,
    state.fighterB.build.proposal.machineName,
  );

  lines.push(renderPortrait(state.fighterA.build, state.fighterA, nameA));
  lines.push("");
  lines.push(renderPortrait(state.fighterB.build, state.fighterB, nameB));
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
