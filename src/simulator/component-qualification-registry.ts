import { createHash } from "node:crypto";

export type ComponentQualificationId =
  | "component-impact-c1"
  | "component-impact-c2"
  | "component-impact-ab2"
  | "component-impact-replacement-v1";

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
  readonly id:
    "component-impact-c1" | "component-impact-c2" | "component-impact-replacement-v1";
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
 * Immutable configuration shape for the frozen AB2 armour-band candidate.
 * AB2 passed the development lifecycle suite but was rejected by its one-time
 * held-out confirmation. It is permanently ineligible for default promotion
 * and is retained only for historical reproducibility. The original held-out
 * partition is spent and cannot validate another candidate. Further
 * armour-band candidates require a separately authorised task.
 */
export interface ArmourBandComponentQualificationConfig extends ComponentQualificationConfigBase {
  readonly id: "component-impact-ab2";
  readonly model: "armour-band-component-impact";
  readonly bands: readonly ArmourBandDefinition[];
}

export type ComponentQualificationConfig =
  LinearComponentQualificationConfig | ArmourBandComponentQualificationConfig;

export interface LinearComponentQualificationMetadata {
  readonly id:
    "component-impact-c1" | "component-impact-c2" | "component-impact-replacement-v1";
  readonly configChecksum: string;
  readonly model: "linear-component-impact";
}

export interface ArmourBandComponentQualificationMetadata {
  readonly id: "component-impact-ab2";
  readonly configChecksum: string;
  readonly model: "armour-band-component-impact";
  readonly bands: readonly ArmourBandDefinition[];
}

export type ComponentQualificationMetadata =
  LinearComponentQualificationMetadata | ArmourBandComponentQualificationMetadata;

export const DEFAULT_COMPONENT_QUALIFICATION_ID =
  "component-impact-c2" as const satisfies ComponentQualificationId;

function freezeLinear(
  config: LinearComponentQualificationConfig,
): LinearComponentQualificationConfig {
  return Object.freeze({ ...config });
}

function freezeArmourBand(
  config: ArmourBandComponentQualificationConfig,
): ArmourBandComponentQualificationConfig {
  validateArmourBandQualificationConfig(config);
  return Object.freeze({
    ...config,
    bands: Object.freeze(config.bands.map((band) => Object.freeze({ ...band }))),
  });
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
  "component-impact-replacement-v1": freezeLinear({
    schemaVersion: "1",
    id: "component-impact-replacement-v1",
    model: "linear-component-impact",
    armourFactor: 0.2,
    minimumImpact: 0,
    criticalThreshold: 13,
    highImpactThreshold: 17,
  }),
  "component-impact-ab2": freezeArmourBand({
    schemaVersion: "1",
    id: "component-impact-ab2",
    model: "armour-band-component-impact",
    armourFactor: 0.2,
    minimumImpact: 0,
    bands: [
      {
        id: "exposed",
        minArmourInclusive: 0,
        maxArmourInclusive: 9,
        criticalThreshold: 17,
        highImpactThreshold: 20,
      },
      {
        id: "light",
        minArmourInclusive: 10,
        maxArmourInclusive: 24,
        criticalThreshold: 15,
        highImpactThreshold: 18,
      },
      {
        id: "protected",
        minArmourInclusive: 25,
        maxArmourInclusive: 49,
        criticalThreshold: 13,
        highImpactThreshold: 15,
      },
      {
        id: "heavy",
        minArmourInclusive: 50,
        maxArmourInclusive: null,
        criticalThreshold: 11,
        highImpactThreshold: 13,
      },
    ],
  }),
} satisfies Record<ComponentQualificationId, ComponentQualificationConfig>);

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
): ComponentQualificationConfig {
  if (!isComponentQualificationId(id)) {
    throw new Error(`Unknown component qualification ID: ${id}`);
  }
  return REGISTRY[id];
}

export function getDefaultComponentQualificationConfig(): LinearComponentQualificationConfig {
  const config = getComponentQualificationConfig(DEFAULT_COMPONENT_QUALIFICATION_ID);
  if (config.model !== "linear-component-impact") {
    throw new Error("The default component qualification must be linear");
  }
  return config;
}

export function getComponentQualificationMetadata(
  config: ComponentQualificationConfig,
): ComponentQualificationMetadata {
  if (config.model === "armour-band-component-impact") {
    return Object.freeze({
      id: config.id,
      configChecksum: getComponentQualificationConfigChecksum(config),
      model: config.model,
      bands: config.bands,
    });
  }
  return Object.freeze({
    id: config.id,
    configChecksum: getComponentQualificationConfigChecksum(config),
    model: config.model,
  });
}

export function listComponentQualificationConfigs(): readonly ComponentQualificationConfig[] {
  return Object.freeze(IDS.map((id) => REGISTRY[id]));
}

export function resolveArmourBand(
  config: ArmourBandComponentQualificationConfig,
  armourAtHitZone: number,
): ArmourBandDefinition {
  if (!Number.isInteger(armourAtHitZone) || armourAtHitZone < 0) {
    throw new Error("armourAtHitZone must be a finite non-negative integer");
  }
  const band = config.bands.find(
    (candidate) =>
      armourAtHitZone >= candidate.minArmourInclusive &&
      (candidate.maxArmourInclusive === null ||
        armourAtHitZone <= candidate.maxArmourInclusive),
  );
  if (!band) {
    throw new Error(`No armour band contains struck armour ${armourAtHitZone}`);
  }
  return band;
}
