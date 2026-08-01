import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { isSha256Hex, sha256Hex } from "../../src/canary/grid-canary-digest.js";

describe("grid canary SHA-256 digests (Phase 3D2A.1)", () => {
  it("produces a 64-char lowercase SHA-256 hex digest", () => {
    const digest = sha256Hex("hello canary");
    expect(digest).toMatch(/^[a-f0-9]{64}$/);
    expect(isSha256Hex(digest)).toBe(true);
  });

  it("matches the Node crypto reference", () => {
    const text = "exact UTF-8 artifact content";
    const expected = createHash("sha256").update(text, "utf-8").digest("hex");
    expect(sha256Hex(text)).toBe(expected);
  });

  it("is deterministic for the same content", () => {
    expect(sha256Hex("same")).toBe(sha256Hex("same"));
  });

  it("differs when the content differs", () => {
    expect(sha256Hex("a")).not.toBe(sha256Hex("b"));
  });

  it("is case-sensitive (digest of UTF-8 bytes)", () => {
    expect(sha256Hex("A")).not.toBe(sha256Hex("a"));
  });

  it("rejects non-digest strings via the guard", () => {
    expect(isSha256Hex("abc")).toBe(false);
    expect(isSha256Hex("A".repeat(64))).toBe(false);
    expect(isSha256Hex("")).toBe(false);
  });
});
