import type { MachineBuildProposal } from "../validation/validation.types.js";
import type { ActionPolicy } from "../simulator/types.js";

export interface ComponentChange {
  readonly component: string;
  readonly from: string;
  readonly to: string;
}

export interface ArmourChange {
  readonly zone: string;
  readonly from: number;
  readonly to: number;
  readonly delta: number;
}

export interface PolicyChange {
  readonly field: string;
  readonly from: string | number;
  readonly to: string | number;
}

export interface DesignDiff {
  fromMatch: number;
  toMatch: number;
  componentChanges: ComponentChange[];
  armourChanges: ArmourChange[];
  policyChanges: PolicyChange[];
}

export function buildDesignDiff(
  fromDesign: MachineBuildProposal,
  toDesign: MachineBuildProposal,
  fromPolicy: ActionPolicy,
  toPolicy: ActionPolicy,
  fromMatch: number,
  toMatch: number,
): DesignDiff {
  return {
    fromMatch,
    toMatch,
    componentChanges: findComponentChanges(fromDesign, toDesign),
    armourChanges: findArmourChanges(fromDesign, toDesign),
    policyChanges: findPolicyChanges(fromPolicy, toPolicy),
  };
}

function findComponentChanges(
  from: MachineBuildProposal,
  to: MachineBuildProposal,
): ComponentChange[] {
  const changes: ComponentChange[] = [];

  if (from.chassisId !== to.chassisId) {
    changes.push({ component: "chassis", from: from.chassisId, to: to.chassisId });
  }
  if (from.mobilityId !== to.mobilityId) {
    changes.push({ component: "mobility", from: from.mobilityId, to: to.mobilityId });
  }
  if (from.weaponId !== to.weaponId) {
    changes.push({ component: "weapon", from: from.weaponId, to: to.weaponId });
  }
  if (from.utilityId !== to.utilityId) {
    changes.push({ component: "utility", from: from.utilityId, to: to.utilityId });
  }

  return changes;
}

function findArmourChanges(
  from: MachineBuildProposal,
  to: MachineBuildProposal,
): ArmourChange[] {
  const zones = ["front", "left", "right", "rear", "top"] as const;
  const changes: ArmourChange[] = [];

  for (const zone of zones) {
    const fromVal = from.armour[zone];
    const toVal = to.armour[zone];
    if (fromVal !== toVal) {
      changes.push({
        zone,
        from: fromVal,
        to: toVal,
        delta: toVal - fromVal,
      });
    }
  }

  return changes;
}

function findPolicyChanges(from: ActionPolicy, to: ActionPolicy): PolicyChange[] {
  const changes: PolicyChange[] = [];
  const fields = [
    "opening",
    "preferredRange",
    "aggression",
    "primaryTarget",
    "secondaryTarget",
    "retreatThreshold",
    "heatThreshold",
    "fallback",
  ] as const;

  for (const field of fields) {
    if (from[field] !== to[field]) {
      changes.push({ field, from: from[field], to: to[field] });
    }
  }

  return changes;
}

export function hasChanges(diff: DesignDiff): boolean {
  return (
    diff.componentChanges.length > 0 ||
    diff.armourChanges.length > 0 ||
    diff.policyChanges.length > 0
  );
}

export function formatDesignDiff(diff: DesignDiff): string {
  const lines: string[] = [];

  lines.push(`Match ${diff.fromMatch} → ${diff.toMatch}:`);

  if (diff.componentChanges.length > 0) {
    for (const c of diff.componentChanges) {
      lines.push(`  ${c.component}: ${c.from} → ${c.to}`);
    }
  }

  if (diff.armourChanges.length > 0) {
    for (const a of diff.armourChanges) {
      const sign = a.delta > 0 ? "+" : "";
      lines.push(`  armour ${a.zone}: ${a.from} → ${a.to} (${sign}${a.delta})`);
    }
  }

  if (diff.policyChanges.length > 0) {
    for (const p of diff.policyChanges) {
      lines.push(`  policy ${p.field}: ${p.from} → ${p.to}`);
    }
  }

  if (!hasChanges(diff)) {
    lines.push("  (no changes)");
  }

  return lines.join("\n");
}
