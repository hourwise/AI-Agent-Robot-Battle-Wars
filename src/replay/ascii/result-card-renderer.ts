import type { CompetitionResult, SimulationEvent } from "../../simulator/types.js";
import type { CompetitionState } from "./ascii.types.js";
import {
  sanitizeName,
  RESULT_SEPARATOR,
  padCenter,
  ARENA_WIDTH,
} from "./ascii-layout.js";

function formatMethod(method: string): string {
  switch (method) {
    case "destruction":
      return "Integrity Defeat";
    case "immobilisation":
      return "Immobilisation";
    case "judges":
      return "Judges' Decision";
    case "draw":
      return "Draw";
    default:
      return method.charAt(0).toUpperCase() + method.slice(1);
  }
}

function findDecisiveEvent(
  events: readonly SimulationEvent[],
  result: CompetitionResult,
): SimulationEvent | null {
  if (!result.winner) return null;

  for (let i = events.length - 1; i >= 0; i--) {
    const event = events[i]!;
    if (event.type === "component_disabled" && event.data.component === "mobility") {
      return event;
    }
    if (event.type === "integrity_damaged" && event.data.remaining === 0) {
      return event;
    }
  }

  for (let i = events.length - 1; i >= 0; i--) {
    const event = events[i]!;
    if (event.type === "component_disabled") {
      return event;
    }
  }

  return null;
}

function getDecisiveEventDescription(
  event: SimulationEvent | null,
  state: CompetitionState,
): string {
  if (!event) return "No single finishing event";

  const targetName = getFighterName(event.targetId, state);

  switch (event.type) {
    case "component_disabled": {
      const component = event.data.component as string;
      return `${targetName}'s ${component} disabled`;
    }
    case "integrity_damaged":
      return `${targetName} integrity depleted`;
    default:
      return "Match concluded";
  }
}

function getFighterName(
  fighterId: string | null | undefined,
  state: CompetitionState,
): string {
  if (!fighterId) return "Unknown";
  const fighter = fighterId === "fighter_a" ? state.fighterA : state.fighterB;
  return sanitizeName(fighter.build.proposal.machineName, 16);
}

function renderJudgeScores(
  scores: {
    fighterA: {
      normalised: {
        damage: number;
        mobility: number;
        weapon: number;
        aggression: number;
        integrity: number;
        total: number;
      };
    };
    fighterB: {
      normalised: {
        damage: number;
        mobility: number;
        weapon: number;
        aggression: number;
        integrity: number;
        total: number;
      };
    };
  },
  state: CompetitionState,
): string {
  const lines: string[] = [];
  const nameA = sanitizeName(state.fighterA.build.proposal.machineName, 16);
  const nameB = sanitizeName(state.fighterB.build.proposal.machineName, 16);

  lines.push(padCenter("JUDGES' SCORES", ARENA_WIDTH));
  lines.push("");
  lines.push(`${padLeft("Category", 14)} ${padLeft(nameA, 16)} ${padLeft(nameB, 16)}`);
  lines.push("-".repeat(50));

  const categories = [
    "damage",
    "mobility",
    "weapon",
    "aggression",
    "integrity",
    "total",
  ] as const;
  for (const cat of categories) {
    const valA = scores.fighterA.normalised[cat];
    const valB = scores.fighterB.normalised[cat];
    const label = cat.charAt(0).toUpperCase() + cat.slice(1);
    lines.push(
      `${padLeft(label, 14)} ${padLeft(valA.toFixed(2), 16)} ${padLeft(valB.toFixed(2), 16)}`,
    );
  }

  return lines.join("\n");
}

function padLeft(text: string, width: number): string {
  if (text.length >= width) return text;
  return " ".repeat(width - text.length) + text;
}

export function renderResultCard(
  result: CompetitionResult,
  state: CompetitionState,
  events: readonly SimulationEvent[],
  rounds: number,
  seed: number,
): string {
  const lines: string[] = [];

  lines.push(RESULT_SEPARATOR);
  lines.push(padCenter("MATCH RESULT", ARENA_WIDTH));
  lines.push(RESULT_SEPARATOR);
  lines.push("");

  if (result.method === "draw") {
    lines.push(padCenter("DRAW", ARENA_WIDTH));
    lines.push("");
    lines.push(`Rounds: ${rounds}`);
    lines.push(`Seed: ${seed}`);
    return lines.join("\n");
  }

  const winnerName = getFighterName(result.winner, state);
  const loserName = getFighterName(result.loser, state);

  lines.push(`WINNER: ${winnerName.toUpperCase()}`);
  lines.push("");
  lines.push(`Defeated: ${loserName.toUpperCase()}`);
  lines.push(`Method: ${formatMethod(result.method)}`);
  lines.push(`Round: ${rounds}`);

  const decisiveEvent = findDecisiveEvent(events, result);
  lines.push(`Decisive event: ${getDecisiveEventDescription(decisiveEvent, state)}`);
  lines.push(`Seed: ${seed}`);

  if (result.method === "judges" && result.judgeScores) {
    lines.push("");
    lines.push(renderJudgeScores(result.judgeScores, state));
  }

  lines.push("");
  return lines.join("\n");
}
