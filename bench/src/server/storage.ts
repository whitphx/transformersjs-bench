import fs from "fs/promises";
import path from "path";
import { QueuedBenchmark } from "./queue.js";

export class BenchmarkStorage {
  private filePath: string;

  constructor(filePath?: string) {
    // Use environment variable if set, otherwise fall back to default
    const defaultPath = process.env.BENCHMARK_RESULTS_PATH || "./benchmark-results.jsonl";
    this.filePath = path.resolve(filePath || defaultPath);
  }

  async appendResult(benchmark: QueuedBenchmark): Promise<void> {
    const line = JSON.stringify(benchmark) + "\n";
    await fs.appendFile(this.filePath, line, "utf-8");
  }

  async getAllResults(): Promise<QueuedBenchmark[]> {
    try {
      const content = await fs.readFile(this.filePath, "utf-8");
      const lines = content.trim().split("\n").filter(line => line.length > 0);
      return lines.map(line => JSON.parse(line));
    } catch (error: any) {
      if (error.code === "ENOENT") {
        return []; // File doesn't exist yet
      }
      throw error;
    }
  }

  async getResultById(id: string): Promise<QueuedBenchmark | undefined> {
    const results = await this.getAllResults();
    return results.find(r => r.id === id);
  }

  async clearResults(): Promise<void> {
    try {
      await fs.unlink(this.filePath);
    } catch (error: any) {
      if (error.code !== "ENOENT") {
        throw error;
      }
    }
  }
}
