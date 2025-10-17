/**
 * Hugging Face Dataset Integration
 *
 * Uploads benchmark results to a Hugging Face Dataset repository.
 * - Preserves file path structure: {task}/{org}/{model}/{params}.json
 * - Uses JSON format (not JSONL)
 * - Overwrites existing files instead of appending
 */

import { uploadFile, listFiles } from "@huggingface/hub";
import { generateBenchmarkPath, type BenchmarkSettings } from "../core/benchmark-id.js";
import type { QueuedBenchmark } from "./queue.js";
import { logger } from "../core/logger.js";

export interface HFDatasetConfig {
  repo: string;
  token: string;
}

export class HFDatasetUploader {
  private config: HFDatasetConfig | null = null;

  constructor(config?: HFDatasetConfig) {
    if (config && config.repo && config.token) {
      this.config = config;
    }
  }

  /**
   * Check if HF Dataset upload is enabled
   */
  isEnabled(): boolean {
    return this.config !== null;
  }

  /**
   * Get the HF Dataset file path for a benchmark
   */
  private getHFFilePath(benchmark: QueuedBenchmark): string {
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
      environment: benchmark.result?.environment ? {
        cpu: benchmark.result.environment.cpu,
        memory: benchmark.result.environment.memory,
        gpu: benchmark.result.environment.gpu,
        platform: benchmark.result.environment.platform,
        arch: benchmark.result.environment.arch,
        cpuCores: benchmark.result.environment.cpuCores, // Web browser format
      } : undefined,
    };

    const { fullPath } = generateBenchmarkPath(settings);
    // Replace .jsonl extension with .json
    return fullPath.replace(/\.jsonl$/, ".json");
  }

  /**
   * Transform benchmark data for HF Dataset upload
   * Lifts frequently-accessed fields to top level for easier browsing
   */
  private transformForUpload(benchmark: QueuedBenchmark): any {
    const result = benchmark.result || {};

    return {
      // Top-level metadata
      id: benchmark.id,
      status: benchmark.status,
      timestamp: benchmark.timestamp,
      startedAt: benchmark.startedAt,
      completedAt: benchmark.completedAt,

      // Configuration (lifted to top level)
      platform: benchmark.platform,
      modelId: benchmark.modelId,
      task: benchmark.task,
      mode: benchmark.mode,
      device: benchmark.device,
      dtype: benchmark.dtype,
      batchSize: benchmark.batchSize,
      repeats: benchmark.repeats,

      // Browser-specific (only if web platform)
      ...(benchmark.platform === "web" && {
        browser: benchmark.browser,
        headed: benchmark.headed,
      }),

      // Runtime info (lifted from result)
      runtime: result.runtime,

      // Metrics (lifted to top level for easy access)
      metrics: result.metrics,

      // Environment (lifted to top level for easy access)
      environment: result.environment,

      // Error info (if present)
      ...(result.error && { error: result.error }),

      // Additional metadata
      ...(result.cacheDir && { cacheDir: result.cacheDir }),
      ...(result.notes && { notes: result.notes }),
    };
  }

  /**
   * Upload a benchmark result to HF Dataset
   * Overwrites the file if it already exists
   */
  async uploadResult(benchmark: QueuedBenchmark): Promise<void> {
    if (!this.config) {
      throw new Error("HF Dataset upload is not configured");
    }

    const filePath = this.getHFFilePath(benchmark);

    // Transform and convert benchmark to JSON string
    const transformed = this.transformForUpload(benchmark);
    const content = JSON.stringify(transformed, null, 2);
    const blob = new Blob([content], { type: "application/json" });

    try {
      // Upload file to HF Dataset (overwrites if exists)
      await uploadFile({
        repo: {
          type: "dataset",
          name: this.config.repo,
        },
        credentials: { accessToken: this.config.token },
        file: {
          path: filePath,
          content: blob,
        },
        commitTitle: `Update benchmark: ${benchmark.modelId} (${benchmark.platform}/${benchmark.task})`,
        commitDescription: `Benchmark ID: ${benchmark.id}\nStatus: ${benchmark.status}\nTimestamp: ${new Date(benchmark.timestamp).toISOString()}`,
      });

      logger.log(`✓ Uploaded to HF Dataset: ${filePath}`);
    } catch (error: any) {
      logger.error(`✗ Failed to upload to HF Dataset: ${filePath}`, error.message);
      throw error;
    }
  }

  /**
   * List all files in the HF Dataset
   */
  async listAllFiles(): Promise<string[]> {
    if (!this.config) {
      throw new Error("HF Dataset upload is not configured");
    }

    try {
      const files = [];
      for await (const file of listFiles({
        repo: {
          type: "dataset",
          name: this.config.repo,
        },
        credentials: { accessToken: this.config.token },
      })) {
        if (file.path.endsWith(".json")) {
          files.push(file.path);
        }
      }
      return files;
    } catch (error: any) {
      logger.error("✗ Failed to list files from HF Dataset", error.message);
      throw error;
    }
  }
}
