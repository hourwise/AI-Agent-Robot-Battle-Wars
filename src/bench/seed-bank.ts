import type { SeedBank, SeedPartition } from "./benchmark.types.js";

export function loadSeedBank(json: unknown): SeedBank {
  const data = json as Record<string, unknown>;

  if (!Array.isArray(data.developmentSeeds)) {
    throw new Error("Seed bank missing developmentSeeds array");
  }
  if (!Array.isArray(data.heldOutSeeds)) {
    throw new Error("Seed bank missing heldOutSeeds array");
  }

  const devSeeds = data.developmentSeeds.map(Number);
  const heldSeeds = data.heldOutSeeds.map(Number);

  const allSeeds = [...devSeeds, ...heldSeeds];
  if (new Set(allSeeds).size !== allSeeds.length) {
    throw new Error("Seed bank contains duplicate seeds across partitions");
  }

  return {
    schemaVersion: String(data.schemaVersion ?? "1"),
    bankId: String(data.bankId ?? "unknown"),
    generatorVersion: String(data.generatorVersion ?? "unknown"),
    simulatorVersion: String(data.simulatorVersion ?? "unknown"),
    rulesetVersion: String(data.rulesetVersion ?? "unknown"),
    catalogueVersion: String(data.catalogueVersion ?? "unknown"),
    developmentSeeds: devSeeds as readonly number[],
    heldOutSeeds: heldSeeds as readonly number[],
  };
}

export function getSeedsForPartition(
  bank: SeedBank,
  partition: SeedPartition,
): readonly number[] {
  switch (partition) {
    case "development":
      return bank.developmentSeeds;
    case "held-out":
      return bank.heldOutSeeds;
    case "all":
      return [...bank.developmentSeeds, ...bank.heldOutSeeds];
  }
}

export function validateSeedBank(bank: SeedBank): string[] {
  const errors: string[] = [];

  if (bank.developmentSeeds.length === 0) {
    errors.push("developmentSeeds must not be empty");
  }
  if (bank.heldOutSeeds.length === 0) {
    errors.push("heldOutSeeds must not be empty");
  }

  const devSet = new Set(bank.developmentSeeds);
  const heldSet = new Set(bank.heldOutSeeds);
  for (const s of bank.developmentSeeds) {
    if (heldSet.has(s)) {
      errors.push(`Seed ${s} appears in both partitions`);
      break;
    }
  }
  for (const s of bank.heldOutSeeds) {
    if (devSet.has(s)) {
      errors.push(`Seed ${s} appears in both partitions`);
      break;
    }
  }

  for (const s of bank.developmentSeeds) {
    if (!Number.isInteger(s) || s < 1) {
      errors.push(`Invalid seed in developmentSeeds: ${s}`);
      break;
    }
  }
  for (const s of bank.heldOutSeeds) {
    if (!Number.isInteger(s) || s < 1) {
      errors.push(`Invalid seed in heldOutSeeds: ${s}`);
      break;
    }
  }

  return errors;
}
