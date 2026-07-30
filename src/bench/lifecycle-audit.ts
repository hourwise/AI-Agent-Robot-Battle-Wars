import type { SimulationEvent } from "../simulator/types.js";
import type {
  BenchmarkExecution,
  LifecycleAudit,
  TransitionAuditRecord,
} from "./lifecycle-suite.types.js";
import {
  getDefaultComponentQualificationConfig,
  getComponentQualificationMetadata,
  type ComponentQualificationMetadata,
} from "../simulator/component-qualification-registry.js";

const COMPONENT_EVENT_TYPES = new Set([
  "component_damaged",
  "component_disabled",
  "component_damage_resisted",
]);

const REQUIRED_FACTS = [
  "componentQualificationId",
  "componentQualificationConfigChecksum",
  "componentQualificationModel",
  "rawDamage",
  "armourAtHitZone",
  "integrityEffectiveDamage",
  "componentImpact",
  "componentArmourFactor",
  "componentMinimumImpact",
  "criticalComponentImpactThreshold",
  "highComponentImpactThreshold",
  "qualificationReason",
  "hitZone",
  "previousState",
  "newState",
] as const;

function hasOwn(data: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(data, key);
}

function precedingAttack(
  events: readonly SimulationEvent[],
  componentEvent: SimulationEvent,
): SimulationEvent | undefined {
  return [...events]
    .reverse()
    .find(
      (event) =>
        event.type === "attack_hit" &&
        event.sequence < componentEvent.sequence &&
        event.round === componentEvent.round &&
        event.actorId === componentEvent.actorId &&
        event.targetId === componentEvent.targetId,
    );
}

function fighterKey(roleSwapped: boolean, fighterId: string): string {
  const competitor =
    fighterId === "fighter_a" ? (roleSwapped ? "y" : "x") : roleSwapped ? "x" : "y";
  return `${fighterId}:${competitor}`;
}

export function auditLifecycleExecutions(
  fixtureId: string,
  executions: readonly BenchmarkExecution[],
  expectedQualification: ComponentQualificationMetadata = getComponentQualificationMetadata(
    getDefaultComponentQualificationConfig(),
  ),
): LifecycleAudit {
  const transitionRecords: TransitionAuditRecord[] = [];
  const invalidTransitions: string[] = [];
  const factualCompletenessErrors: string[] = [];
  const guardErrors: string[] = [];
  const nonQualifyingSelectionErrors: string[] = [];
  const mobilityDamagedEndingErrors: string[] = [];
  const mobilityDisabledEndingErrors: string[] = [];
  let firstRoundTerminalDisableCount = 0;

  for (const execution of executions) {
    const { match, perMatch } = execution;
    const matchKey = `${fixtureId}:${perMatch.seed}:${
      perMatch.roleSwapped ? "swapped" : "base"
    }`;
    const state = new Map<string, string>();
    const guard = new Map<string, string | undefined>();
    for (const fighterId of ["fighter_a", "fighter_b"] as const) {
      state.set(`${fighterId}:mobility`, "healthy");
      state.set(`${fighterId}:weapon`, "healthy");
      state.set(`${fighterId}:utility`, "healthy");
      const fighter =
        fighterId === "fighter_a"
          ? match.initialState.fighterA
          : match.initialState.fighterB;
      guard.set(fighterId, fighter.comps.utility.reinforcedDriveGuard);
    }

    const componentEvents = match.events.filter((event) =>
      COMPONENT_EVENT_TYPES.has(event.type),
    );
    if (
      componentEvents.some(
        (event) => event.type === "component_disabled" && event.round === 1,
      )
    ) {
      firstRoundTerminalDisableCount++;
    }

    for (const event of componentEvents) {
      const data = event.data;
      const component = String(data.component ?? "");
      const target = event.targetId ?? "unknown";
      const key = `${target}:${component}`;
      const before = String(data.previousState ?? "");
      const after = String(data.newState ?? "");
      const current = state.get(key);
      const label = `${matchKey}#${event.sequence}`;

      for (const field of REQUIRED_FACTS) {
        if (!hasOwn(data, field)) {
          factualCompletenessErrors.push(`${label} missing ${field}`);
        }
      }
      const sourceAttack = data.sourceAttack;
      if (
        typeof sourceAttack !== "object" ||
        sourceAttack === null ||
        !hasOwn(sourceAttack as Record<string, unknown>, "isCritical")
      ) {
        factualCompletenessErrors.push(`${label} missing sourceAttack.isCritical`);
      }
      if (data.componentQualificationId !== expectedQualification.id) {
        factualCompletenessErrors.push(
          `${label} has qualification identity ${String(data.componentQualificationId)}; expected ${expectedQualification.id}`,
        );
      }
      if (
        data.componentQualificationConfigChecksum !== expectedQualification.configChecksum
      ) {
        factualCompletenessErrors.push(
          `${label} has qualification checksum ${String(data.componentQualificationConfigChecksum)}; expected ${expectedQualification.configChecksum}`,
        );
      }
      if (data.componentQualificationModel !== expectedQualification.model) {
        factualCompletenessErrors.push(
          `${label} has qualification model ${String(data.componentQualificationModel)}; expected ${expectedQualification.model}`,
        );
      }

      const attack = precedingAttack(match.events, event);
      if (!attack || attack.data.qualificationReason === null) {
        nonQualifyingSelectionErrors.push(
          `${label} is not linked to a qualifying attack`,
        );
      }

      if (event.type === "component_damage_resisted") {
        if (component !== "mobility" || before !== "healthy" || after !== "healthy") {
          invalidTransitions.push(`${label} resistance must preserve healthy mobility`);
        }
        if (data.guardStateBefore !== "available" || data.guardStateAfter !== "spent") {
          guardErrors.push(`${label} guard must change available to spent`);
        }
        if (guard.get(target) !== "available") {
          guardErrors.push(`${label} spent a guard that was not available`);
        }
        guard.set(target, "spent");
      } else {
        const expectedAfter = event.type === "component_damaged" ? "damaged" : "disabled";
        const expectedBefore = event.type === "component_damaged" ? "healthy" : "damaged";
        if (
          before !== expectedBefore ||
          after !== expectedAfter ||
          current !== expectedBefore
        ) {
          invalidTransitions.push(
            `${label} invalid ${String(current)} -> ${after} for ${component}`,
          );
        }
        state.set(key, after);

        if (component === "utility" && guard.get(target) === "available") {
          const change = data.utilityRuntimeChange as Record<string, unknown> | undefined;
          if (
            !change ||
            change.reinforcedDriveGuardBefore !== "available" ||
            change.reinforcedDriveGuardAfter !== "lost"
          ) {
            guardErrors.push(
              `${label} utility transition must atomically lose an available guard`,
            );
          }
          guard.set(target, "lost");
        }
      }

      transitionRecords.push({
        matchKey,
        seed: perMatch.seed,
        roleSwapped: perMatch.roleSwapped,
        fighter: fighterKey(perMatch.roleSwapped, target),
        round: event.round,
        eventType: event.type as TransitionAuditRecord["eventType"],
        component,
        previousState: before,
        newState: after,
        qualificationReason: String(data.qualificationReason ?? ""),
        componentQualificationId: String(data.componentQualificationId ?? ""),
      });
    }

    const ended = match.events.find((event) => event.type === "competition_ended");
    if (match.result.method === "immobilisation") {
      const loser = match.result.loser;
      const hasTerminalMobility = componentEvents.some(
        (event) =>
          event.type === "component_disabled" &&
          event.data.component === "mobility" &&
          event.targetId === loser,
      );
      if (!hasTerminalMobility) {
        mobilityDamagedEndingErrors.push(
          `${matchKey} ended by immobilisation without disabled mobility`,
        );
      }
    }
    for (const event of componentEvents.filter(
      (candidate) =>
        candidate.type === "component_disabled" &&
        candidate.data.component === "mobility",
    )) {
      if (!ended || event.round !== ended.round) {
        mobilityDisabledEndingErrors.push(
          `${matchKey} mobility disable did not end the match`,
        );
      }
    }
  }

  return {
    transitionRecords,
    invalidTransitions,
    factualCompletenessErrors,
    guardErrors,
    nonQualifyingSelectionErrors,
    mobilityDamagedEndingErrors,
    mobilityDisabledEndingErrors,
    firstRoundTerminalDisableCount,
  };
}
