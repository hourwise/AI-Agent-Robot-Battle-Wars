import { describe, it, expect } from "vitest";
import {
  sanitizeTerminalText,
  sanitizeName,
  resolveDisplayName,
} from "../../src/shared/text-sanitise.js";

describe("sanitizeTerminalText", () => {
  it("removes ANSI escape sequences", () => {
    const input = "\x1B[31mred text\x1B[0m";
    expect(sanitizeTerminalText(input)).toBe("red text");
  });

  it("removes control characters except tab, newline, carriage return", () => {
    const input = "hello\x00\x01\x02world";
    expect(sanitizeTerminalText(input)).toBe("helloworld");
  });

  it("collapses whitespace", () => {
    const input = "  hello   world  ";
    expect(sanitizeTerminalText(input)).toBe("hello world");
  });

  it("handles empty string", () => {
    expect(sanitizeTerminalText("")).toBe("");
  });

  it("preserves normal text", () => {
    expect(sanitizeTerminalText("Hello World")).toBe("Hello World");
  });
});

describe("sanitizeName", () => {
  it("truncates long names with ~", () => {
    const result = sanitizeName("A Very Long Robot Name Here", 10);
    expect(result.length).toBe(10);
    expect(result.endsWith("~")).toBe(true);
  });

  it("returns UNKNOWN for empty names", () => {
    expect(sanitizeName("")).toBe("UNKNOWN");
  });

  it("returns UNKNOWN for names with only control chars", () => {
    expect(sanitizeName("\x00\x01\x02")).toBe("UNKNOWN");
  });

  it("preserves short names", () => {
    expect(sanitizeName("Bot")).toBe("Bot");
  });

  it("removes ANSI from names", () => {
    expect(sanitizeName("\x1B[31mRedBot\x1B[0m")).toBe("RedBot");
  });

  it("applies default max length of 20", () => {
    const result = sanitizeName("A".repeat(25));
    expect(result.length).toBe(20);
    expect(result.endsWith("~")).toBe(true);
  });
});

describe("resolveDisplayName", () => {
  it("returns bare name when names differ", () => {
    expect(resolveDisplayName("fighter_a", "Iron Cicada", "The Bulwark")).toBe(
      "Iron Cicada",
    );
    expect(resolveDisplayName("fighter_b", "Iron Cicada", "The Bulwark")).toBe(
      "The Bulwark",
    );
  });

  it("appends [A] and [B] when both fighters share the same name", () => {
    expect(resolveDisplayName("fighter_a", "The Bulwark", "The Bulwark")).toBe(
      "The Bulwark [A]",
    );
    expect(resolveDisplayName("fighter_b", "The Bulwark", "The Bulwark")).toBe(
      "The Bulwark [B]",
    );
  });

  it("preserves distinct names without suffixes", () => {
    const resultA = resolveDisplayName("fighter_a", "Alpha", "Beta");
    const resultB = resolveDisplayName("fighter_b", "Alpha", "Beta");
    expect(resultA).toBe("Alpha");
    expect(resultB).toBe("Beta");
    expect(resultA).not.toContain("[");
    expect(resultB).not.toContain("[");
  });

  it("handles same name with different case", () => {
    // Case-sensitive comparison — different case means different names
    expect(resolveDisplayName("fighter_a", "The Bulwark", "the bulwark")).toBe(
      "The Bulwark",
    );
    expect(resolveDisplayName("fighter_b", "The Bulwark", "the bulwark")).toBe(
      "the bulwark",
    );
  });

  it("always returns fighter_a name for fighter_a and fighter_b name for fighter_b", () => {
    // Even when names are the same, fighter_a gets [A] and fighter_b gets [B]
    const nameA = resolveDisplayName("fighter_a", "Bot", "Bot");
    const nameB = resolveDisplayName("fighter_b", "Bot", "Bot");
    expect(nameA).toBe("Bot [A]");
    expect(nameB).toBe("Bot [B]");
    expect(nameA).not.toBe(nameB);
  });
});
