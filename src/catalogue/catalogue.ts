import type { Catalogue } from "./catalogue.types.js";
import { CATALOGUE_V1 } from "./catalogue.v1.js";

const registry = new Map<string, Catalogue>([["1", CATALOGUE_V1]]);

export function getCatalogue(version: string): Catalogue | undefined {
  return registry.get(version);
}

export function latestCatalogueVersion(): string {
  return "1";
}
