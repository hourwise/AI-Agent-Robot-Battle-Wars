import { createHash } from "node:crypto";

export type ComponentQualificationId = "component-impact-c1" | "component-impact-c2";

export type ComponentQualificationModel =
  "linear-component-impact" | "armour-band-component-impact";

interface ComponentQualificationConfigBase {
  readonly id: string;
  readonly model: ComponentQualificationModel;
  readonly armourFactor: number;
  readonly minimumImpact: number;
  readonly schemaVersion: "1";
}

export interface LinearComponentQualificationConfig extends ComponentQualificationConfigBase {
  readonly id: ComponentQualificationId;
  readonly model: "linear-component-impact";
  readonly criticalThreshold: number;
  readonly highImpactThreshold: number;
}

export interface ArmourBandDefinition {
  readonly id: string;
  readonly minArmourInclusive: number;
  readonly maxArmourInclusive: number | null;
  readonly criticalThreshold: number;
  readonly highImpactThreshold: number;
}

/**
 * Reserved configuration shape for a future ADR-approved model family.
 * No armour-band entry is registered or active in Milestone 0.2B.
 */
export interface ArmourBandComponentQualificationConfig extends ComponentQualificationConfigBase {
  readonly model: "armour-band-component-impact";
  readonly bands: readonly ArmourBandDefinition[];
}

export type ComponentQualificationConfig =
  LinearComponentQualificationConfig | ArmourBandComponentQualificationConfig;

export interface ComponentQualificationMetadata {
  readonly id: ComponentQualificationId;
  readonly configChecksum: string;
  readonly model: "linear-component-impact";
}

export const DEFAULT_COMPONENT_QUALIFICATION_ID =
  "component-impact-c2" as const satisfies ComponentQualificationId;

function freezeLinear(
  config: LinearComponentQualificationConfig,
): LinearComponentQualificationConfig {
  return Object.freeze({ ...config });
}

const REGISTRY = Object.freeze({
  "component-impact-c1": freezeLinear({
    schemaVersion: "1",
    id: "component-impact-c1",
    model: "linear-component-impact",
    armourFactor: 0.2,
    minimumImpact: 0,
    criticalThreshold: 11,
    highImpactThreshold: 13,
  }),
  "component-impact-c2": freezeLinear({
    schemaVersion: "1",
    id: "component-impact-c2",
    model: "linear-component-impact",
    armourFactor: 0.2,
    minimumImpact: 0,
    criticalThreshold: 13,
    highImpactThreshold: 15,
  }),
} satisfies Record<ComponentQualificationId, LinearComponentQualificationConfig>);

const IDS = Object.freeze(Object.keys(REGISTRY) as ComponentQualificationId[]);

if (new Set(IDS).size !== IDS.length) {
  throw new Error("Component qualification registry IDs must be unique");
}

export function canonicalStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((entry) => canonicalStringify(entry)).join(",")}]`;
  }
  if (value !== null && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalStringify(record[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export function getComponentQualificationConfigChecksum(
  config: ComponentQualificationConfig,
): string {
  const canonical =
    config.model === "linear-component-impact"
      ? {
          schemaVersion: config.schemaVersion,
          id: config.id,
          model: config.model,
          armourFactor: config.armourFactor,
          minimumImpact: config.minimumImpact,
          criticalThreshold: config.criticalThreshold,
          highImpactThreshold: config.highImpactThreshold,
        }
      : {
          schemaVersion: config.schemaVersion,
          id: config.id,
          model: config.model,
          armourFactor: config.armourFactor,
          minimumImpact: config.minimumImpact,
          bands: config.bands.map((band) => ({
            id: band.id,
            minArmourInclusive: band.minArmourInclusive,
            maxArmourInclusive: band.maxArmourInclusive,
            criticalThreshold: band.criticalThreshold,
            highImpactThreshold: band.highImpactThreshold,
          })),
        };
  return createHash("sha256")
    .update(canonicalStringify(canonical))
    .digest("hex")
    .slice(0, 16);
}

export function validateArmourBandQualificationConfig(
  config: ArmourBandComponentQualificationConfig,
): void {
  if (config.bands.length === 0) {
    throw new Error("Armour-band qualification requires at least one band");
  }
  if (new Set(config.bands.map((band) => band.id)).size !== config.bands.length) {
    throw new Error("Armour-band IDs must be unique");
  }
  let expectedMinimum = 0;
  for (const [index, band] of config.bands.entries()) {
    if (
      !Number.isInteger(band.minArmourInclusive) ||
      band.minArmourInclusive !== expectedMinimum
    ) {
      throw new Error("Armour bands must be ordered, gap-free, and start at zero");
    }
    if (
      band.maxArmourInclusive !== null &&
      (!Number.isInteger(band.maxArmourInclusive) ||
        band.maxArmourInclusive < band.minArmourInclusive)
    ) {
      throw new Error("Armour-band maximum must be null or a valid inclusive integer");
    }
    if (
      !Number.isFinite(band.criticalThreshold) ||
      !Number.isFinite(band.highImpactThreshold) ||
      band.criticalThreshold < 0 ||
      band.highImpactThreshold < band.criticalThreshold
    ) {
      throw new Error(
        "Armour-band thresholds must be non-negative with high not below critical",
      );
    }
    const isLast = index === config.bands.length - 1;
    if (isLast !== (band.maxArmourInclusive === null)) {
      throw new Error("Only the final armour band may have an open maximum");
    }
    if (band.maxArmourInclusive !== null) {
      expectedMinimum = band.maxArmourInclusive + 1;
    }
  }
}

export function isComponentQualificationId(
  value: string,
): value is ComponentQualificationId {
  return Object.prototype.hasOwnProperty.call(REGISTRY, value);
}

export function getComponentQualificationConfig(
  id: ComponentQualificationId | string,
): LinearComponentQualificationConfig {
  if (!isComponentQualificationId(id)) {
    throw new Error(`Unknown component qualification ID: ${id}`);
  }
  return REGISTRY[id];
}

export function getDefaultComponentQualificationConfig(): LinearComponentQualificationConfig {
  return getComponentQualificationConfig(DEFAULT_COMPONENT_QUALIFICATION_ID);
}

export function getComponentQualificationMetadata(
  config: LinearComponentQualificationConfig,
): ComponentQualificationMetadata {
  return Object.freeze({
    id: config.id,
    configChecksum: getComponentQualificationConfigChecksum(config),
    model: config.model,
  });
}

export function listComponentQualificationConfigs(): readonly LinearComponentQualificationConfig[] {
  return Object.freeze(IDS.map((id) => REGISTRY[id]));
}
