#!/usr/bin/env node

import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { table } from "table";

const SERVER_URL = process.env.BENCH_SERVER_URL || "http://localhost:7860";

interface SubmitOptions {
  platform?: "node" | "web";
  modelId: string;
  task: string;
  mode?: "warm" | "cold";
  repeats?: number;
  dtype?: string;
  batchSize?: number;
  device?: string;
  browser?: string;
  headed?: boolean;
}

async function submitBenchmark(options: SubmitOptions) {
  const response = await fetch(`${SERVER_URL}/api/benchmark`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(options),
  });

  if (!response.ok) {
    throw new Error(`Failed to submit benchmark: ${response.statusText}`);
  }

  return await response.json();
}

async function getBenchmark(id: string) {
  const response = await fetch(`${SERVER_URL}/api/benchmark/${id}`);

  if (!response.ok) {
    throw new Error(`Failed to get benchmark: ${response.statusText}`);
  }

  return await response.json();
}

async function listBenchmarks() {
  const response = await fetch(`${SERVER_URL}/api/benchmarks`);

  if (!response.ok) {
    throw new Error(`Failed to list benchmarks: ${response.statusText}`);
  }

  return await response.json();
}

async function getQueueStatus() {
  const response = await fetch(`${SERVER_URL}/api/queue`);

  if (!response.ok) {
    throw new Error(`Failed to get queue status: ${response.statusText}`);
  }

  return await response.json();
}

async function pollBenchmark(id: string, interval = 2000): Promise<any> {
  return new Promise((resolve, reject) => {
    const check = async () => {
      try {
        const result = await getBenchmark(id);

        if (result.status === "completed") {
          resolve(result);
        } else if (result.status === "failed") {
          reject(new Error(result.error));
        } else {
          console.log(`Status: ${result.status}...`);
          setTimeout(check, interval);
        }
      } catch (error) {
        reject(error);
      }
    };
    check();
  });
}

yargs(hideBin(process.argv))
  .command(
    "submit <modelId> <task>",
    "Submit a new benchmark request",
    (yargs) => {
      return yargs
        .positional("modelId", {
          describe: "Model ID to benchmark",
          type: "string",
          demandOption: true,
        })
        .positional("task", {
          describe: "Task to perform (e.g., feature-extraction, fill-mask)",
          type: "string",
          demandOption: true,
        })
        .option("platform", {
          describe: "Platform to run on",
          choices: ["node", "web"] as const,
          default: "node" as const,
        })
        .option("mode", {
          describe: "Cache mode",
          choices: ["warm", "cold"] as const,
          default: "warm" as const,
        })
        .option("repeats", {
          describe: "Number of times to repeat the benchmark",
          type: "number",
          default: 3,
        })
        .option("batch-size", {
          describe: "Batch size for inference",
          type: "number",
          default: 1,
        })
        .option("dtype", {
          describe: "Data type",
          choices: ["fp32", "fp16", "q8", "int8", "uint8", "q4", "bnb4", "q4f16"] as const,
          default: "fp32" as const,
        })
        .option("device", {
          describe: "Device for web platform",
          type: "string",
          default: "webgpu",
        })
        .option("browser", {
          describe: "Browser for web platform",
          choices: ["chromium", "firefox", "webkit"] as const,
          default: "chromium" as const,
        })
        .option("headed", {
          describe: "Run browser in headed mode",
          type: "boolean",
          default: false,
        })
        .option("wait", {
          describe: "Wait for benchmark completion",
          type: "boolean",
          default: false,
        });
    },
    async (argv) => {
      const options: SubmitOptions = {
        modelId: argv.modelId,
        task: argv.task,
        platform: argv.platform,
        mode: argv.mode,
        repeats: argv.repeats,
        batchSize: argv.batchSize,
        dtype: argv.dtype,
        device: argv.device,
        browser: argv.browser,
        headed: argv.headed,
      };

      console.log("Submitting benchmark with options:");
      console.log(JSON.stringify(options, null, 2));
      const result = await submitBenchmark(options);
      console.log(`✓ Benchmark queued: ${result.id}`);
      console.log(`  Position in queue: ${result.position}`);

      if (argv.wait) {
        console.log("\nWaiting for completion...");
        const completed = await pollBenchmark(result.id);
        console.log("\n✅ Benchmark completed!");
        console.log(JSON.stringify(completed.result, null, 2));
      } else {
        console.log(`\nCheck status with: bench-client get ${result.id}`);
      }
    }
  )
  .command(
    "get <id>",
    "Get benchmark result by ID",
    (yargs) => {
      return yargs.positional("id", {
        describe: "Benchmark ID",
        type: "string",
        demandOption: true,
      });
    },
    async (argv) => {
      const result = await getBenchmark(argv.id);
      console.log(JSON.stringify(result, null, 2));
    }
  )
  .command(
    "list",
    "List all benchmark results",
    () => { },
    async () => {
      const result = await listBenchmarks();
      console.log(`Total benchmarks: ${result.total}\n`);

      const data = [
        ["ID", "Status", "Platform", "Model", "Task", "Mode", "Repeats", "Batch", "DType", "Device", "Browser", "Duration"],
      ];

      result.results.forEach((b: any) => {
        const duration = b.completedAt && b.startedAt
          ? `${((b.completedAt - b.startedAt) / 1000).toFixed(1)}s`
          : "-";

        data.push([
          b.id.substring(0, 8),
          b.status,
          b.platform,
          b.modelId,
          b.task,
          b.mode,
          b.repeats.toString(),
          b.batchSize.toString(),
          b.dtype || "-",
          b.device || "-",
          b.browser || "-",
          duration,
        ]);
      });

      console.log(table(data));
    }
  )
  .command(
    "queue",
    "Show queue status",
    () => { },
    async () => {
      const result = await getQueueStatus();
      console.log("Queue Status:");
      console.log(`  Pending: ${result.status.pending}`);
      console.log(`  Running: ${result.status.running}`);
      console.log(`  Completed: ${result.status.completed}`);
      console.log(`  Failed: ${result.status.failed}`);

      if (result.queue.length > 0) {
        console.log("\nCurrent Queue:");
        result.queue.forEach((b: any) => {
          console.log(`  [${b.status}] ${b.id} - ${b.platform}/${b.modelId}`);
        });
      }
    }
  )
  .demandCommand(1, "You need to specify a command")
  .help()
  .alias("h", "help")
  .strict()
  .parse();

export { submitBenchmark, getBenchmark, listBenchmarks, getQueueStatus, pollBenchmark };
