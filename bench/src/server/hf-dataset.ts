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
    };

    const { fullPath } = generateBenchmarkPath(settings);
    // Replace .jsonl extension with .json
    return fullPath.replace(/\.jsonl$/, ".json");
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

    // Convert benchmark to JSON string
    const content = JSON.stringify(benchmark, null, 2);
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

      console.log(`✓ Uploaded to HF Dataset: ${filePath}`);
    } catch (error: any) {
      console.error(`✗ Failed to upload to HF Dataset: ${filePath}`, error.message);
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
      console.error("✗ Failed to list files from HF Dataset", error.message);
      throw error;
    }
  }
}
