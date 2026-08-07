import { dirname, join, resolve, sep } from "node:path";
import {
  defaultCanaryFs,
  fsEntryKind,
  type CanaryFileSystem,
} from "../canary/immutable-canary-bundle.js";
import {
  OPPONENT_FIXTURE_MAX_JSON_BYTES,
  OpponentFixtureError,
  assertOpponentFixtureIdentifier,
  opponentFixtureFileName,
  parseOpponentFixture,
  serializeOpponentFixture,
  type OpponentFixtureV1,
} from "./opponent-fixture.js";

/**
 * Secure fixed-root opponent fixture loader (Milestone 0.2D Phase 1).
 *
 * Public selection is identifier + version, never an arbitrary path. The
 * loader constructs only the canonical filename `<opponentId>.v<fixtureVersion>.json`
 * and resolves it under the fixed logical root `data/opponents`. It rejects
 * path escape, symbolic-link/junction ancestry (inspected with `lstat`), a
 * final entry that is not a regular file, oversized JSON, and any file that
 * changes (including a regular-file → symlink substitution) while being read.
 * The file must already equal the canonical persisted serialization
 * byte-for-byte (ADR-004 no-silent-mutation rule) and pass the complete
 * authoritative parse (strict schema, build validation, policy, catalogue/
 * ruleset/runtime compatibility, checksum). The returned fixture is deeply
 * frozen.
 *
 * All failures are `OpponentFixtureError` input/fixture validation failures.
 * There is no beta suspension marker involvement. Loading a fixture NEVER
 * activates a runtime and NEVER executes a match.
 */

/** Fixed canonical logical opponent fixture root. */
export const OPPONENT_FIXTURE_ROOT = join(process.cwd(), "data", "opponents");

export interface OpponentFixtureDependencies {
  /**
   * Injectable general filesystem for testability. Production loading uses
   * the default filesystem and the fixed `OPPONENT_FIXTURE_ROOT`; no
   * alternate opponent root is ever accepted as a caller-controlled input.
   */
  readonly fs?: CanaryFileSystem;
}

function isInsideOrEqual(child: string, parent: string): boolean {
  const c = resolve(child);
  const p = resolve(parent);
  if (c === p) return true;
  const prefix = p.endsWith(sep) ? p : `${p}${sep}`;
  return c.startsWith(prefix);
}

/** Every path from the filesystem root down to `absPath`, inclusive. */
function ancestryPaths(absPath: string): string[] {
  const paths: string[] = [];
  let current = resolve(absPath);
  for (;;) {
    paths.unshift(current);
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return paths;
}

/**
 * Inspects the complete fixture ancestry from the filesystem root through the
 * fixed fixture root down to (but excluding) the target file, using `lstat`
 * throughout so symbolic links and junctions are detected without being
 * followed. Rejects symbolic-link/junction ancestry and missing or
 * non-directory ancestry components. The target file itself is validated
 * separately as a regular file.
 */
async function assertNoSymlinkJunctionAncestry(
  fs: CanaryFileSystem,
  target: string,
): Promise<void> {
  const paths = ancestryPaths(resolve(target));
  const ancestry = paths.slice(0, -1);
  for (const path of ancestry) {
    const kind = await fsEntryKind(fs, path);
    if (kind === "symbolic link") {
      throw new OpponentFixtureError(
        `opponent fixture ancestry must not contain a symbolic link or junction: ${path}`,
      );
    }
    if (kind === "file" || kind === "other" || kind === null) {
      throw new OpponentFixtureError(
        `opponent fixture ancestry contains a missing or non-directory entry: ${path}`,
      );
    }
  }
}

/**
 * Loads an opponent fixture by identifier and version from the fixed logical
 * root `data/opponents`. Returns a deeply frozen validated fixture.
 */
export async function loadOpponentFixture(
  opponentId: string,
  fixtureVersion: number,
  dependencies: OpponentFixtureDependencies = {},
): Promise<OpponentFixtureV1> {
  const fs = dependencies.fs ?? defaultCanaryFs;

  // 1. Validate the opponent identifier.
  assertOpponentFixtureIdentifier(opponentId);

  // 2. Validate the fixture version.
  if (!Number.isInteger(fixtureVersion) || fixtureVersion <= 0) {
    throw new OpponentFixtureError(
      `opponent fixture version must be a positive integer; received ${JSON.stringify(fixtureVersion)}`,
    );
  }

  // 3. Construct only the canonical filename.
  const fileName = opponentFixtureFileName(opponentId, fixtureVersion);

  // 4. Resolve under the fixed logical root.
  const root = OPPONENT_FIXTURE_ROOT;
  const target = join(root, fileName);

  // 5. Reject path escape (defence in depth; the identifier pattern already
  // guarantees a safe basename).
  if (!isInsideOrEqual(target, root)) {
    throw new OpponentFixtureError(
      `opponent fixture path resolves outside the fixture root: ${resolve(target)}`,
    );
  }

  // 6/7. Inspect the ancestry with lstat and reject symlink/junction ancestry.
  await assertNoSymlinkJunctionAncestry(fs, target);

  // 8. The final entry must be a regular file.
  const kind = await fsEntryKind(fs, resolve(target));
  if (kind === null) {
    throw new OpponentFixtureError(`opponent fixture is missing: ${resolve(target)}`);
  }
  if (kind !== "file") {
    throw new OpponentFixtureError(
      `opponent fixture must be a regular file (found ${kind}): ${resolve(target)}`,
    );
  }

  // 10. Read the file.
  const text = await fs.readFile(resolve(target), "utf-8");

  // 9. Enforce a bounded JSON byte size.
  if (Buffer.byteLength(text, "utf-8") > OPPONENT_FIXTURE_MAX_JSON_BYTES) {
    throw new OpponentFixtureError(
      `opponent fixture exceeds the maximum size of ${OPPONENT_FIXTURE_MAX_JSON_BYTES} bytes`,
    );
  }

  // 11. Re-lstat the final entry after reading: a changed or replaced entry
  // (including a newly introduced symbolic link) fails closed.
  const afterReadKind = await fsEntryKind(fs, resolve(target));
  if (afterReadKind !== "file") {
    throw new OpponentFixtureError(
      `opponent fixture changed while being read (found ${afterReadKind ?? "nothing"}): ${resolve(target)}`,
    );
  }

  // 12. Parse JSON.
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (e) {
    throw new OpponentFixtureError(
      `opponent fixture is not valid JSON: ${e instanceof Error ? e.message : String(e)}`,
    );
  }

  // 13–19. Strict schema, build validation, policy, catalogue/ruleset/runtime
  // compatibility, checksum and deep freeze.
  const fixture = parseOpponentFixture(raw, opponentId);

  // Bind the requested fixture version to the internal declaration.
  if (fixture.fixtureVersion !== fixtureVersion) {
    throw new OpponentFixtureError(
      `opponent fixture fixtureVersion ${fixture.fixtureVersion} must equal the requested version ${fixtureVersion}`,
    );
  }

  // 14. Enforce exact canonical persisted bytes (no silent mutation, no
  // alternative key ordering, no extra whitespace, no CRLF, no trailing junk).
  if (serializeOpponentFixture(fixture) !== text) {
    throw new OpponentFixtureError(
      "opponent fixture persisted bytes must equal the canonical fixture serialization",
    );
  }

  return fixture;
}
