import { describe, expect, it } from "vitest";
import {
  DEFAULT_COMPONENT_QUALIFICATION_ID,
  getComponentQualificationConfig,
  getComponentQualificationConfigChecksum,
  getDefaultComponentQualificationConfig,
  listComponentQualificationConfigs,
  resolveArmourBand,
  validateArmourBandQualificationConfig,
} from "../../src/simulator/component-qualification-registry.js";

describe("component qualification registry", () => {
  it("preserves the immutable historical C1 and C2 constants", () => {
    expect(getComponentQualificationConfig("component-impact-c1")).toEqual({
      schemaVersion: "1",
      id: "component-impact-c1",
      model: "linear-component-impact",
      armourFactor: 0.2,
      minimumImpact: 0,
      criticalThreshold: 11,
      highImpactThreshold: 13,
    });
    expect(getComponentQualificationConfig("component-impact-c2")).toEqual({
      schemaVersion: "1",
      id: "component-impact-c2",
      model: "linear-component-impact",
      armourFactor: 0.2,
      minimumImpact: 0,
      criticalThreshold: 13,
      highImpactThreshold: 15,
    });
    expect(getComponentQualificationConfig("component-impact-ab2")).toEqual({
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
    });
  });

  it("uses C2 as the explicit default", () => {
    expect(DEFAULT_COMPONENT_QUALIFICATION_ID).toBe("component-impact-c2");
    expect(getDefaultComponentQualificationConfig().id).toBe("component-impact-c2");
  });

  it("fails closed for unknown IDs", () => {
    expect(() => getComponentQualificationConfig("component-impact-unknown")).toThrow(
      "Unknown component qualification ID",
    );
  });

  it("returns immutable unique registry entries", () => {
    const configs = listComponentQualificationConfigs();
    expect(configs.map((config) => config.id)).toEqual([
      "component-impact-c1",
      "component-impact-c2",
      "component-impact-ab2",
    ]);
    expect(new Set(configs.map((config) => config.id)).size).toBe(configs.length);
    expect(Object.isFrozen(configs)).toBe(true);
    expect(configs.every((config) => Object.isFrozen(config))).toBe(true);
    expect(() => {
      (configs[0] as { criticalThreshold: number }).criticalThreshold = 99;
    }).toThrow();
    expect(getComponentQualificationConfig("component-impact-c1").criticalThreshold).toBe(
      11,
    );
    const ab2 = getComponentQualificationConfig("component-impact-ab2");
    expect(Object.isFrozen(ab2.bands)).toBe(true);
    expect(ab2.bands.every((band) => Object.isFrozen(band))).toBe(true);
    expect(() => {
      (ab2.bands[0] as { criticalThreshold: number }).criticalThreshold = 99;
    }).toThrow();
  });

  it("produces stable distinct canonical checksums", () => {
    const c1 = getComponentQualificationConfig("component-impact-c1");
    const c2 = getComponentQualificationConfig("component-impact-c2");
    expect(getComponentQualificationConfigChecksum(c1)).toBe("2a40a56f97062ca3");
    expect(getComponentQualificationConfigChecksum(c2)).toBe("13548462df34a183");
    expect(getComponentQualificationConfigChecksum(c1)).not.toBe(
      getComponentQualificationConfigChecksum(c2),
    );
    expect(
      getComponentQualificationConfigChecksum(
        getComponentQualificationConfig("component-impact-ab2"),
      ),
    ).toBe("6b9f70450d3f10b8");
  });

  it.each([
    [0, "exposed"],
    [9, "exposed"],
    [10, "light"],
    [24, "light"],
    [25, "protected"],
    [49, "protected"],
    [50, "heavy"],
    [60, "heavy"],
  ] as const)("resolves struck armour %i to %s", (armour, id) => {
    const config = getComponentQualificationConfig("component-impact-ab2");
    if (config.model !== "armour-band-component-impact") throw new Error("wrong model");
    expect(resolveArmourBand(config, armour).id).toBe(id);
  });

  it("rejects malformed armour-band definitions", () => {
    const config = getComponentQualificationConfig("component-impact-ab2");
    if (config.model !== "armour-band-component-impact") throw new Error("wrong model");
    expect(() =>
      validateArmourBandQualificationConfig({
        ...config,
        bands: [
          ...config.bands.slice(0, 1),
          { ...config.bands[2]! },
          { ...config.bands[3]! },
        ],
      }),
    ).toThrow("gap-free");
  });
});
