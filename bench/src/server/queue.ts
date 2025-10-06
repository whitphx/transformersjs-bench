import { EventEmitter } from "events";
import { BenchmarkResult } from "../core/types.js";

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
        console.error(`\n❌ Benchmark ${pending.id} failed:`);
        console.error(`   Message: ${error.message}`);
        if (error.stack) {
          console.error(`   Stack trace:\n${error.stack}`);
        }
      } else {
        pending.error = String(error);
        console.error(`\n❌ Benchmark ${pending.id} failed: ${pending.error}`);
      }
      pending.completedAt = Date.now();
      this.emit("failed", pending);
    }

    this.isProcessing = false;
    // Process next item
    setImmediate(() => this.processQueue());
  }

  private async runBenchmark(request: BenchmarkRequest): Promise<BenchmarkResult> {
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

      console.log(`\n[Queue] Dispatching node benchmark with command: tsx ${args.join(' ')}`);

      return new Promise((resolve, reject) => {
        const proc = spawn("tsx", args, { cwd: process.cwd() });
        let stdout = "";
        let stderr = "";

        proc.stdout.on("data", (data) => {
          stdout += data.toString();
        });

        proc.stderr.on("data", (data) => {
          stderr += data.toString();
        });

        proc.on("close", (code) => {
          if (code !== 0) {
            reject(new Error(`Benchmark failed with code ${code}: ${stderr}`));
            return;
          }

          // Extract JSON from stdout (last JSON object)
          const jsonMatch = stdout.match(/\{[\s\S]*"platform"[\s\S]*\}/);
          if (jsonMatch) {
            try {
              const result = JSON.parse(jsonMatch[0]);
              resolve(result);
            } catch (e) {
              reject(new Error(`Failed to parse benchmark result: ${e}`));
            }
          } else {
            reject(new Error("No benchmark result found in output"));
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

      console.log(`\n[Queue] Dispatching web benchmark with command: tsx ${args.join(' ')}`);

      return new Promise((resolve, reject) => {
        const proc = spawn("tsx", args, { cwd: process.cwd() });
        let stdout = "";
        let stderr = "";

        proc.stdout.on("data", (data) => {
          stdout += data.toString();
        });

        proc.stderr.on("data", (data) => {
          stderr += data.toString();
        });

        proc.on("close", (code) => {
          if (code !== 0) {
            reject(new Error(`Benchmark failed with code ${code}: ${stderr}`));
            return;
          }

          // Extract JSON from stdout (last JSON object)
          const jsonMatch = stdout.match(/\{[\s\S]*"platform"[\s\S]*\}/);
          if (jsonMatch) {
            try {
              const result = JSON.parse(jsonMatch[0]);
              resolve(result);
            } catch (e) {
              reject(new Error(`Failed to parse benchmark result: ${e}`));
            }
          } else {
            reject(new Error("No benchmark result found in output"));
          }
        });
      });
    }
  }
}
