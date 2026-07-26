import { mkdir, readFile, writeFile, readdir, rename, unlink } from "node:fs/promises";
import { join } from "node:path";
import type { MatchRecord } from "../schemas/match-record.schema.js";
import {
  validateMatchRecord,
  serializeMatchRecord,
} from "../schemas/match-record.schema.js";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface CorruptEntry {
  fileName: string;
  reason: string;
}

export interface MatchRepository {
  saveMatch(record: MatchRecord): Promise<void>;
  getMatch(matchId: string): Promise<MatchRecord | null>;
  listMatches(): Promise<Array<{ matchId: string; createdAt: string }>>;
  listCorruptEntries(): Promise<CorruptEntry[]>;
}

export class JsonMatchRepository implements MatchRepository {
  private readonly dataDir: string;
  private _corruptEntries: CorruptEntry[] = [];

  constructor(dataDir: string) {
    this.dataDir = dataDir;
  }

  private async ensureDataDir(): Promise<void> {
    await mkdir(this.dataDir, { recursive: true });
  }

  private getMatchPath(matchId: string): string {
    return join(this.dataDir, `${matchId}.json`);
  }

  async saveMatch(record: MatchRecord): Promise<void> {
    await this.ensureDataDir();

    if (!UUID_RE.test(record.matchId)) {
      throw new Error(`Invalid match ID format: ${record.matchId}`);
    }

    const existing = await this.getMatch(record.matchId);
    if (existing) {
      throw new Error(`Match ${record.matchId} already exists`);
    }

    const validation = validateMatchRecord(record);
    if (!validation.ok) {
      throw new Error(`Invalid match record: ${validation.errors.message}`);
    }

    const json = serializeMatchRecord(record);
    const targetPath = this.getMatchPath(record.matchId);
    const tempPath = `${targetPath}.tmp.${Date.now()}`;

    try {
      await writeFile(tempPath, json, "utf-8");
      await rename(tempPath, targetPath);
    } catch (e) {
      try {
        await unlink(tempPath);
      } catch {
        // temp file may not exist, ignore
      }
      throw e;
    }
  }

  async getMatch(matchId: string): Promise<MatchRecord | null> {
    if (!UUID_RE.test(matchId)) {
      return null;
    }

    try {
      const json = await readFile(this.getMatchPath(matchId), "utf-8");
      const validation = validateMatchRecord(JSON.parse(json));
      if (!validation.ok) {
        throw new Error(`Invalid match record: ${validation.errors.message}`);
      }
      return validation.record;
    } catch (e: unknown) {
      if (
        e instanceof Error &&
        "code" in e &&
        (e as { code: string }).code === "ENOENT"
      ) {
        return null;
      }
      throw e;
    }
  }

  async listMatches(): Promise<Array<{ matchId: string; createdAt: string }>> {
    await this.ensureDataDir();
    this._corruptEntries = [];
    const files = await readdir(this.dataDir);
    const matches: Array<{ matchId: string; createdAt: string }> = [];

    for (const file of files) {
      if (!file.endsWith(".json")) continue;
      if (file.includes(".tmp.")) continue;
      const matchId = file.replace(".json", "");

      if (!UUID_RE.test(matchId)) {
        this._corruptEntries.push({
          fileName: file,
          reason: "Invalid UUID format",
        });
        continue;
      }

      try {
        const match = await this.getMatch(matchId);
        if (match) {
          matches.push({
            matchId: match.matchId,
            createdAt: match.createdAt,
          });
        }
      } catch (e) {
        this._corruptEntries.push({
          fileName: file,
          reason: e instanceof Error ? e.message : "Unknown error",
        });
      }
    }

    return matches.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }

  async listCorruptEntries(): Promise<CorruptEntry[]> {
    if (this._corruptEntries.length === 0) {
      await this.listMatches();
    }
    return [...this._corruptEntries];
  }
}
