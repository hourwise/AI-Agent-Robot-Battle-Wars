import { describe, it, expect } from "vitest";
import {
  sanitizeName,
  formatArmourLine,
  formatConditionList,
  formatComponentStatus,
  padCenter,
  padRight,
  padLeft,
} from "../../src/replay/ascii/ascii-layout.js";

describe("sanitizeName", () => {
  it("removes control characters", () => {
    expect(sanitizeName("Test\x00Name")).toBe("TestName");
    expect(sanitizeName("Test\x07Name")).toBe("TestName");
    expect(sanitizeName("Test\x1B[31mName")).toBe("TestName");
  });

  it("removes newlines and tabs", () => {
    expect(sanitizeName("Test\nName")).toBe("Test Name");
    expect(sanitizeName("Test\r\nName")).toBe("Test Name");
    expect(sanitizeName("Test\tName")).toBe("Test Name");
  });

  it("truncates long names", () => {
    const longName = "A".repeat(30);
    const result = sanitizeName(longName, 20);
    expect(result.length).toBe(20);
    expect(result.endsWith("~")).toBe(true);
  });

  it("returns UNKNOWN for empty names", () => {
    expect(sanitizeName("")).toBe("UNKNOWN");
    expect(sanitizeName("\x00\x07")).toBe("UNKNOWN");
  });

  it("preserves short names", () => {
    expect(sanitizeName("Test")).toBe("Test");
  });
});

describe("formatArmourLine", () => {
  it("formats armour distribution", () => {
    const armour = { front: 20, left: 15, right: 15, rear: 10, top: 5 };
    expect(formatArmourLine(armour)).toBe("F20 L15 R15 RE10 T5");
  });

  it("handles zero armour", () => {
    const armour = { front: 0, left: 0, right: 0, rear: 0, top: 0 };
    expect(formatArmourLine(armour)).toBe("F0 L0 R0 RE0 T0");
  });
});

describe("formatConditionList", () => {
  it("returns none for empty conditions", () => {
    expect(formatConditionList([])).toBe("none");
  });

  it("formats single condition", () => {
    expect(formatConditionList(["overturned"])).toBe("overturned");
  });

  it("formats multiple conditions", () => {
    expect(formatConditionList(["overturned", "overheated"])).toBe(
      "overturned, overheated",
    );
  });
});

describe("formatComponentStatus", () => {
  it("returns all functional for no disabled components", () => {
    expect(
      formatComponentStatus({
        mobilityDisabled: false,
        weaponDisabled: false,
        utilityDisabled: false,
      }),
    ).toBe("all functional");
  });

  it("formats disabled components", () => {
    expect(
      formatComponentStatus({
        mobilityDisabled: true,
        weaponDisabled: false,
        utilityDisabled: false,
      }),
    ).toBe("mobility disabled");
  });

  it("formats multiple disabled components", () => {
    expect(
      formatComponentStatus({
        mobilityDisabled: true,
        weaponDisabled: true,
        utilityDisabled: false,
      }),
    ).toBe("mobility disabled, weapon disabled");
  });
});

describe("padCenter", () => {
  it("centers text within width", () => {
    expect(padCenter("Hi", 6)).toBe("  Hi  ");
  });

  it("returns original if too long", () => {
    expect(padCenter("Hello", 3)).toBe("Hello");
  });
});

describe("padRight", () => {
  it("pads text on the right", () => {
    expect(padRight("Hi", 5)).toBe("Hi   ");
  });
});

describe("padLeft", () => {
  it("pads text on the left", () => {
    expect(padLeft("Hi", 5)).toBe("   Hi");
  });
});
