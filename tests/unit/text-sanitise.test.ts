import { describe, it, expect } from "vitest";
import { sanitizeTerminalText, sanitizeName } from "../../src/shared/text-sanitise.js";

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
