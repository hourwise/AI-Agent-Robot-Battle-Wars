import { mkdir, readFile, writeFile, readdir, rename, unlink } from "node:fs/promises";
import { join } from "node:path";
import type { AnySeriesRecord } from "../schemas/series.schema.js";
import { validateSeriesRecord, serializeSeriesRecord } from "../schemas/series.schema.js";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface SeriesRepository {
  saveSeries(record: AnySeriesRecord): Promise<void>;
  getSeries(seriesId: string): Promise<AnySeriesRecord | null>;
  listSeries(): Promise<Array<{ seriesId: string; createdAt: string; status: string }>>;
}

export class JsonSeriesRepository implements SeriesRepository {
  private readonly dataDir: string;

  constructor(dataDir: string) {
    this.dataDir = dataDir;
  }

  private async ensureDataDir(): Promise<void> {
    await mkdir(this.dataDir, { recursive: true });
  }

  private getSeriesPath(seriesId: string): string {
    return join(this.dataDir, `${seriesId}.json`);
  }

  async saveSeries(record: AnySeriesRecord): Promise<void> {
    await this.ensureDataDir();

    if (!UUID_RE.test(record.seriesId)) {
      throw new Error(`Invalid series ID format: ${record.seriesId}`);
    }

    const validation = validateSeriesRecord(record);
    if (!validation.ok) {
      throw new Error(`Invalid series record: ${validation.errors}`);
    }

    const json = serializeSeriesRecord(record);
    const targetPath = this.getSeriesPath(record.seriesId);
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

  async getSeries(seriesId: string): Promise<AnySeriesRecord | null> {
    if (!UUID_RE.test(seriesId)) {
      return null;
    }

    try {
      const json = await readFile(this.getSeriesPath(seriesId), "utf-8");
      const validation = validateSeriesRecord(JSON.parse(json));
      if (!validation.ok) {
        throw new Error(`Invalid series record: ${validation.errors}`);
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

  async listSeries(): Promise<
    Array<{ seriesId: string; createdAt: string; status: string }>
  > {
    await this.ensureDataDir();
    const files = await readdir(this.dataDir);
    const series: Array<{ seriesId: string; createdAt: string; status: string }> = [];

    for (const file of files) {
      if (!file.endsWith(".json")) continue;
      if (file.includes(".tmp.")) continue;
      const seriesId = file.replace(".json", "");

      if (!UUID_RE.test(seriesId)) {
        continue;
      }

      try {
        const record = await this.getSeries(seriesId);
        if (record) {
          series.push({
            seriesId: record.seriesId,
            createdAt: record.createdAt,
            status: record.status,
          });
        }
      } catch {
        // skip corrupt entries
      }
    }

    return series.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }
}
