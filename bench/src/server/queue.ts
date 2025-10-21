import { EventEmitter } from "events";
import { BenchmarkResult } from "../core/types.js";
import { logger } from "../core/logger.js";

export interface BenchmarkRequest {
  id: string;
  platform: "node" | "web";
  modelId: string;
  task: string;
  mode: "warm" | "cold";
  repeats: number;
  dtype?: string;
  batchSize: number;
  device?: string;
  browser?: string;
  headed?: boolean;
  timestamp: number;
}

export interface QueuedBenchmark extends BenchmarkRequest {
  status: "pending" | "running" | "completed" | "failed";
  result?: BenchmarkResult;
  error?: string;
  startedAt?: number;
  completedAt?: number;
}

export class BenchmarkQueue extends EventEmitter {
  private queue: QueuedBenchmark[] = [];
  private isProcessing = false;

  /**
   * Extract JSON from stdout by finding the last valid JSON object
   * that contains "platform" field
   */
  private extractJsonResult(stdout: string): any {
    // Try to find all potential JSON objects (lines that start with { and contain "platform")
    const lines = stdout.split('\n');

    // Search backwards for the last valid JSON object with "platform"
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i].trim();
      if (line.startsWith('{') && line.includes('"platform"')) {
        try {
          const parsed = JSON.parse(line);
          if (parsed.platform) {
            return parsed;
          }
        } catch (e) {
          // Not valid JSON on this line, continue searching
          continue;
        }
      }
    }

    // Fallback: try to extract a multi-line JSON object
    // Find the last occurrence of a JSON block that contains "platform"
    const jsonMatches = stdout.match(/\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/g);
    if (jsonMatches) {
      // Search backwards through matches
      for (let i = jsonMatches.length - 1; i >= 0; i--) {
        const match = jsonMatches[i];
        if (match.includes('"platform"')) {
          try {
            const parsed = JSON.parse(match);
            if (parsed.platform) {
              return parsed;
            }
          } catch (e) {
            continue;
          }
        }
      }
    }

    return null;
  }

  addBenchmark(request: BenchmarkRequest): void {
    const queued: QueuedBenchmark = {
      ...request,
      status: "pending",
    };
    this.queue.push(queued);
    this.emit("added", queued);
    this.processQueue();
  }

  getBenchmark(id: string): QueuedBenchmark | undefined {
    return this.queue.find((b) => b.id === id);
  }

  getAllBenchmarks(): QueuedBenchmark[] {
    return [...this.queue];
  }

  getQueueStatus() {
    return {
      total: this.queue.length,
      pending: this.queue.filter((b) => b.status === "pending").length,
      running: this.queue.filter((b) => b.status === "running").length,
      completed: this.queue.filter((b) => b.status === "completed").length,
      failed: this.queue.filter((b) => b.status === "failed").length,
    };
  }

  private async processQueue() {
    if (this.isProcessing) return;

    const pending = this.queue.find((b) => b.status === "pending");
    if (!pending) return;

    this.isProcessing = true;
    pending.status = "running";
    pending.startedAt = Date.now();

    this.emit("started", pending);

    try {
      const result = await this.runBenchmark(pending);
      pending.status = "completed";
      pending.result = result;
      pending.completedAt = Date.now();
      this.emit("completed", pending);
    } catch (error) {
      pending.status = "failed";
      // Capture detailed error information
      if (error instanceof Error) {
        pending.error = error.message;
        // Log full error details to console
        logger.error(`\n❌ Benchmark ${pending.id} failed:`);
        logger.error(`   Message: ${error.message}`);
        if (error.stack) {
          logger.error(`   Stack trace:\n${error.stack}`);
        }
      } else {
        pending.error = String(error);
        logger.error(`\n❌ Benchmark ${pending.id} failed: ${pending.error}`);
      }
      pending.completedAt = Date.now();
      this.emit("failed", pending);
    } finally {
      // Ensure isProcessing is always reset
      this.isProcessing = false;
      // Process next item
      setImmediate(() => this.processQueue());
    }
  }

  private async runBenchmark(request: BenchmarkRequest): Promise<BenchmarkResult> {
    const BENCHMARK_TIMEOUT = parseInt(process.env.BENCHMARK_TIMEOUT || String(10 * 60 * 1000), 10); // 10 minutes default

    if (request.platform === "node") {
      // Use spawn instead of dynamic import to avoid import.meta.url issues
      const { spawn } = await import("child_process");

      // Build command args
      const args = [
        "src/node/index.ts",
        request.modelId,
        request.task,
        `--mode=${request.mode}`,
        `--repeats=${request.repeats}`,
        `--batch-size=${request.batchSize}`,
      ];
      if (request.dtype) args.push(`--dtype=${request.dtype}`);

      logger.log(`\n[Queue] Dispatching node benchmark with command: tsx ${args.join(' ')}`);

      return new Promise((resolve, reject) => {
        const proc = spawn("tsx", args, { cwd: process.cwd() });
        let stdout = "";
        let stderr = "";
        let isResolved = false;

        // Timeout handler
        const timeoutId = setTimeout(() => {
          if (!isResolved) {
            isResolved = true;
            logger.error(`[Queue] Benchmark ${request.id} timed out after ${BENCHMARK_TIMEOUT / 1000}s`);
            proc.kill('SIGTERM');
            // Give it 5 seconds to clean up, then force kill
            setTimeout(() => proc.kill('SIGKILL'), 5000);
            reject(new Error(`Benchmark timed out after ${BENCHMARK_TIMEOUT / 1000}s`));
          }
        }, BENCHMARK_TIMEOUT);

        proc.stdout.on("data", (data) => {
          const chunk = data.toString();
          stdout += chunk;
          // Log stdout in real-time for debugging
          if (process.env.DEBUG_BENCHMARK) {
            logger.log(`[stdout] ${chunk}`);
          }
        });

        proc.stderr.on("data", (data) => {
          const chunk = data.toString();
          stderr += chunk;
          // Log stderr in real-time for debugging
          if (process.env.DEBUG_BENCHMARK) {
            logger.error(`[stderr] ${chunk}`);
          }
        });

        // Error handler for spawn failures
        proc.on("error", (error) => {
          if (!isResolved) {
            isResolved = true;
            clearTimeout(timeoutId);
            reject(new Error(`Failed to spawn process: ${error.message}`));
          }
        });

        proc.on("close", (code, signal) => {
          if (!isResolved) {
            isResolved = true;
            clearTimeout(timeoutId);

            if (signal) {
              reject(new Error(`Benchmark killed by signal ${signal}`));
              return;
            }

            if (code !== 0) {
              reject(new Error(`Benchmark failed with code ${code}: ${stderr}`));
              return;
            }

            // Extract JSON from stdout
            const result = this.extractJsonResult(stdout);
            if (result) {
              resolve(result);
            } else {
              logger.error(`[Queue] Failed to extract JSON from stdout.`);
              logger.error(`[Queue] stdout (first 500 chars): ${stdout.substring(0, 500)}`);
              logger.error(`[Queue] stdout (last 500 chars): ${stdout.substring(Math.max(0, stdout.length - 500))}`);
              if (stderr) {
                logger.error(`[Queue] stderr: ${stderr.substring(0, 500)}`);
              }
              reject(new Error("No valid benchmark result found in output"));
            }
          }
        });
      });
    } else {
      // For web benchmarks, we'll use the CLI approach with Playwright
      const { spawn } = await import("child_process");

      // Build command args
      const args = [
        "src/web/cli.ts",
        request.modelId,
        request.task,
        `--mode=${request.mode}`,
        `--repeats=${request.repeats}`,
        `--device=${request.device || "webgpu"}`,
        `--batch-size=${request.batchSize}`,
      ];
      if (request.dtype) args.push(`--dtype=${request.dtype}`);
      if (request.browser) args.push(`--browser=${request.browser}`);
      if (request.headed) args.push(`--headed=true`);

      logger.log(`\n[Queue] Dispatching web benchmark with command: tsx ${args.join(' ')}`);

      return new Promise((resolve, reject) => {
        const proc = spawn("tsx", args, { cwd: process.cwd() });
        let stdout = "";
        let stderr = "";
        let isResolved = false;

        // Timeout handler
        const timeoutId = setTimeout(() => {
          if (!isResolved) {
            isResolved = true;
            logger.error(`[Queue] Benchmark ${request.id} timed out after ${BENCHMARK_TIMEOUT / 1000}s`);
            proc.kill('SIGTERM');
            // Give it 5 seconds to clean up, then force kill
            setTimeout(() => proc.kill('SIGKILL'), 5000);
            reject(new Error(`Benchmark timed out after ${BENCHMARK_TIMEOUT / 1000}s`));
          }
        }, BENCHMARK_TIMEOUT);

        proc.stdout.on("data", (data) => {
          const chunk = data.toString();
          stdout += chunk;
          // Log stdout in real-time for debugging
          if (process.env.DEBUG_BENCHMARK) {
            logger.log(`[stdout] ${chunk}`);
          }
        });

        proc.stderr.on("data", (data) => {
          const chunk = data.toString();
          stderr += chunk;
          // Log stderr in real-time for debugging
          if (process.env.DEBUG_BENCHMARK) {
            logger.error(`[stderr] ${chunk}`);
          }
        });

        // Error handler for spawn failures
        proc.on("error", (error) => {
          if (!isResolved) {
            isResolved = true;
            clearTimeout(timeoutId);
            reject(new Error(`Failed to spawn process: ${error.message}`));
          }
        });

        proc.on("close", (code, signal) => {
          if (!isResolved) {
            isResolved = true;
            clearTimeout(timeoutId);

            if (signal) {
              reject(new Error(`Benchmark killed by signal ${signal}`));
              return;
            }

            if (code !== 0) {
              reject(new Error(`Benchmark failed with code ${code}: ${stderr}`));
              return;
            }

            // Extract JSON from stdout
            const result = this.extractJsonResult(stdout);
            if (result) {
              resolve(result);
            } else {
              logger.error(`[Queue] Failed to extract JSON from stdout.`);
              logger.error(`[Queue] stdout (first 500 chars): ${stdout.substring(0, 500)}`);
              logger.error(`[Queue] stdout (last 500 chars): ${stdout.substring(Math.max(0, stdout.length - 500))}`);
              if (stderr) {
                logger.error(`[Queue] stderr: ${stderr.substring(0, 500)}`);
              }
              reject(new Error("No valid benchmark result found in output"));
            }
          }
        });
      });
    }
  }
}
