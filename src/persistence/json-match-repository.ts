import { mkdir, readFile, writeFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import type { MatchRecord } from "../schemas/match-record.schema.js";
import {
  validateMatchRecord,
  serializeMatchRecord,
} from "../schemas/match-record.schema.js";

export interface MatchRepository {
  saveMatch(record: MatchRecord): Promise<void>;
  getMatch(matchId: string): Promise<MatchRecord | null>;
  listMatches(): Promise<Array<{ matchId: string; createdAt: string }>>;
}

export class JsonMatchRepository implements MatchRepository {
  private readonly dataDir: string;

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
    const validation = validateMatchRecord(record);
    if (!validation.ok) {
      throw new Error(`Invalid match record: ${validation.errors.message}`);
    }
    const json = serializeMatchRecord(record);
    await writeFile(this.getMatchPath(record.matchId), json, "utf-8");
  }

  async getMatch(matchId: string): Promise<MatchRecord | null> {
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
    const files = await readdir(this.dataDir);
    const matches: Array<{ matchId: string; createdAt: string }> = [];

    for (const file of files) {
      if (!file.endsWith(".json")) continue;
      const matchId = file.replace(".json", "");
      try {
        const match = await this.getMatch(matchId);
        if (match) {
          matches.push({
            matchId: match.matchId,
            createdAt: match.createdAt,
          });
        }
      } catch {
        // Skip invalid files
      }
    }

    return matches.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }
}
