import { createHash } from "node:crypto";

/**
 * SHA-256 artifact digests for the grid match canary (Milestone 0.2C Phase
 * 3D2A.1).
 *
 * Every non-manifest artifact digest is calculated from the exact UTF-8 string
 * written to disk using the Node standard cryptography library. No dependency
 * is added. `manifest.json` is intentionally never digested inside itself.
 */
export function sha256Hex(content: string): string {
  return createHash("sha256").update(content, "utf-8").digest("hex");
}

export function isSha256Hex(value: string): boolean {
  return /^[a-f0-9]{64}$/.test(value);
}
