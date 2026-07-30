import { describe, expect, it } from "vitest";
import {
  DEFAULT_COMPONENT_QUALIFICATION_ID,
  getComponentQualificationConfig,
  getComponentQualificationConfigChecksum,
  getDefaultComponentQualificationConfig,
  listComponentQualificationConfigs,
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
  });

  it("produces stable distinct canonical checksums", () => {
    const c1 = getComponentQualificationConfig("component-impact-c1");
    const c2 = getComponentQualificationConfig("component-impact-c2");
    expect(getComponentQualificationConfigChecksum(c1)).toBe("2a40a56f97062ca3");
    expect(getComponentQualificationConfigChecksum(c2)).toBe("13548462df34a183");
    expect(getComponentQualificationConfigChecksum(c1)).not.toBe(
      getComponentQualificationConfigChecksum(c2),
    );
  });
});
