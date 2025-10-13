import fs from "fs/promises";
import path from "path";
import { QueuedBenchmark } from "./queue.js";
import { generateBenchmarkPath, type BenchmarkSettings } from "../core/benchmark-id.js";

export class BenchmarkStorage {
  private baseDir: string;

  constructor(baseDir?: string) {
    // Use environment variable if set, otherwise fall back to default
    const defaultDir = process.env.BENCHMARK_RESULTS_DIR || "./benchmark-results";
    this.baseDir = path.resolve(baseDir || defaultDir);
  }

  /**
   * Get the file path for a benchmark based on its settings
   */
  private getBenchmarkFilePath(benchmark: QueuedBenchmark): string {
    const settings: BenchmarkSettings = {
      platform: benchmark.platform,
      modelId: benchmark.modelId,
      task: benchmark.task,
      mode: benchmark.mode,
      device: benchmark.device,
      dtype: benchmark.dtype,
      batchSize: benchmark.batchSize,
      browser: benchmark.browser,
      headed: benchmark.headed,
    };

    const { dir, filename } = generateBenchmarkPath(settings);
    return path.join(this.baseDir, dir, filename);
  }

  async appendResult(benchmark: QueuedBenchmark): Promise<void> {
    const filePath = this.getBenchmarkFilePath(benchmark);
    const dir = path.dirname(filePath);

    // Ensure directory exists
    await fs.mkdir(dir, { recursive: true });

    // Append result as JSONL
    const line = JSON.stringify(benchmark) + "\n";
    await fs.appendFile(filePath, line, "utf-8");
  }

  /**
   * Read all results from a specific JSONL file
   */
  private async readJsonlFile(filePath: string): Promise<QueuedBenchmark[]> {
    try {
      const content = await fs.readFile(filePath, "utf-8");
      const lines = content.trim().split("\n").filter(line => line.length > 0);
      return lines.map(line => JSON.parse(line));
    } catch (error: any) {
      if (error.code === "ENOENT") {
        return []; // File doesn't exist yet
      }
      throw error;
    }
  }

  /**
   * Recursively find all JSONL files in the results directory
   */
  private async findAllJsonlFiles(dir: string): Promise<string[]> {
    const files: string[] = [];

    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          // Recursively search subdirectories
          const subFiles = await this.findAllJsonlFiles(fullPath);
          files.push(...subFiles);
        } else if (entry.isFile() && entry.name.endsWith(".jsonl")) {
          files.push(fullPath);
        }
      }
    } catch (error: any) {
      if (error.code === "ENOENT") {
        return []; // Directory doesn't exist yet
      }
      throw error;
    }

    return files;
  }

  async getAllResults(): Promise<QueuedBenchmark[]> {
    const allFiles = await this.findAllJsonlFiles(this.baseDir);
    const allResults: QueuedBenchmark[] = [];

    for (const file of allFiles) {
      const results = await this.readJsonlFile(file);
      allResults.push(...results);
    }

    return allResults;
  }

  async getResultById(id: string): Promise<QueuedBenchmark | undefined> {
    const results = await this.getAllResults();
    return results.find(r => r.id === id);
  }

  /**
   * Get all results for a specific benchmark configuration
   */
  async getResultsBySettings(settings: BenchmarkSettings): Promise<QueuedBenchmark[]> {
    const { dir, filename } = generateBenchmarkPath(settings);
    const filePath = path.join(this.baseDir, dir, filename);
    return this.readJsonlFile(filePath);
  }

  /**
   * Get all results for a specific model (all configurations)
   */
  async getResultsByModel(modelId: string): Promise<QueuedBenchmark[]> {
    const modelDir = path.join(this.baseDir, modelId);
    const allFiles = await this.findAllJsonlFiles(modelDir);
    const allResults: QueuedBenchmark[] = [];

    for (const file of allFiles) {
      const results = await this.readJsonlFile(file);
      allResults.push(...results);
    }

    return allResults;
  }

  async clearResults(): Promise<void> {
    try {
      await fs.rm(this.baseDir, { recursive: true, force: true });
    } catch (error: any) {
      if (error.code !== "ENOENT") {
        throw error;
      }
    }
  }
}
