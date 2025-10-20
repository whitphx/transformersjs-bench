#!/usr/bin/env node

import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { table } from "table";
import prompts from "prompts";
import { searchModels, formatModel } from "./hf-api.js";
import { PIPELINE_DATA } from "@huggingface/tasks";
import type { ModelEntry } from "@huggingface/hub";
import { listFiles } from "@huggingface/hub";

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

/**
 * Fetch existing benchmark file paths from HuggingFace Dataset
 * Returns a Set of file paths for quick lookup
 */
async function fetchExistingBenchmarks(datasetRepo: string, token?: string): Promise<Set<string>> {
  console.log(`\nFetching existing benchmarks from ${datasetRepo}...`);
  const existingFiles = new Set<string>();

  try {
    for await (const file of listFiles({
      repo: {
        type: "dataset",
        name: datasetRepo,
      },
      credentials: token ? { accessToken: token } : undefined,
    })) {
      if (file.path.endsWith(".json")) {
        existingFiles.add(file.path);
      }
    }
    console.log(`  Found ${existingFiles.size} existing benchmarks\n`);
  } catch (error: any) {
    console.warn(`  Warning: Failed to fetch existing benchmarks: ${error.message}`);
    console.warn(`  Proceeding without exclusion filter\n`);
  }

  return existingFiles;
}

/**
 * Generate the expected file path for a benchmark combination
 * Must match the path generation logic in the server
 */
function generateBenchmarkPath(combo: {
  task: string;
  modelId: string;
  platform: string;
  mode: string;
  device: string;
  dtype: string;
  batchSize: number;
  browser?: string;
  headed?: boolean;
}): string {
  // Extract org and model name from modelId
  const parts = combo.modelId.split("/");
  const org = parts.length > 1 ? parts[0] : "default";
  const modelName = parts.length > 1 ? parts[1] : parts[0];

  // Build path components similar to server logic
  const pathParts = [
    combo.task,
    org,
    modelName,
  ];

  // Build filename parts
  const filenameParts = [
    combo.platform,
    combo.mode,
    combo.device,
    `b${combo.batchSize}`,
  ];

  // Add dtype if specified and not fp32 (default)
  if (combo.dtype && combo.dtype !== "fp32") {
    filenameParts.push(combo.dtype);
  }

  // Add browser for web platform
  if (combo.platform === "web" && combo.browser) {
    filenameParts.push(combo.browser);
  }

  // Add headed indicator for web platform
  if (combo.platform === "web" && combo.headed) {
    filenameParts.push("headed");
  }

  const filename = filenameParts.join("_") + ".json";
  return [...pathParts, filename].join("/");
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
          choices: Object.keys(PIPELINE_DATA),
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
        ["ID", "Status", "Platform", "Model", "Task", "Mode", "Repeats", "Batch", "DType", "Device", "Browser", "Headed", "Duration"],
      ];

      result.results.forEach((b: any) => {
        const duration = b.completedAt && b.startedAt
          ? `${((b.completedAt - b.startedAt) / 1000).toFixed(1)}s`
          : "-";

        // Status with emoji
        const statusMap: Record<string, string> = {
          completed: "✅ completed",
          failed: "❌ failed",
          running: "🔄 running",
          pending: "⏳ pending",
        };
        const statusDisplay = statusMap[b.status] || b.status;

        // Platform with emoji
        const platformDisplay = b.platform === "node" ? "🟢 node" : "🌐 web";

        // Headed with emoji
        const headedDisplay = b.headed ? "👁️ Yes" : "No";

        data.push([
          b.id.substring(0, 8),
          statusDisplay,
          platformDisplay,
          b.modelId,
          b.task,
          b.mode,
          b.repeats.toString(),
          b.batchSize.toString(),
          b.dtype || "-",
          b.device || "-",
          b.browser || "-",
          headedDisplay,
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
  .command(
    "batch [query...]",
    "Search HuggingFace models and submit benchmarks for them",
    (yargs) => {
      return yargs
        .positional("query", {
          describe: "Optional search queries to filter model names (can specify multiple)",
          type: "string",
          array: true,
        })
        .option("task", {
          describe: "Task type to filter models (e.g., feature-extraction, image-classification)",
          choices: Object.keys(PIPELINE_DATA),
          alias: "t",
        })
        .option("limit", {
          describe: "Maximum number of models to benchmark",
          type: "number",
        })
        .option("platform", {
          describe: "Platform(s) to run on (can specify multiple)",
          type: "array",
          default: ["node"],
        })
        .option("mode", {
          describe: "Cache mode(s) (can specify multiple)",
          type: "array",
          default: ["warm"],
        })
        .option("repeats", {
          describe: "Number of times to repeat the benchmark",
          type: "number",
          default: 3,
        })
        .option("batch-size", {
          describe: "Batch size(s) for inference (can specify multiple)",
          type: "array",
          default: [1],
        })
        .option("device", {
          describe: "Device(s) for platform (can specify multiple)",
          type: "array",
          default: ["webgpu"],
        })
        .option("browser", {
          describe: "Browser(s) for web platform (can specify multiple)",
          type: "array",
          default: ["chromium"],
        })
        .option("dtype", {
          describe: "Data type(s) (can specify multiple)",
          type: "array",
          default: ["fp32"],
        })
        .option("yes", {
          alias: "y",
          describe: "Skip confirmation prompt",
          type: "boolean",
          default: false,
        })
        .option("exclude-existing", {
          alias: "e",
          describe: "Exclude benchmarks that already exist in the HF Dataset",
          type: "boolean",
          default: false,
        })
        .option("hf-dataset-repo", {
          describe: "HuggingFace Dataset repository to check for existing benchmarks",
          type: "string",
        })
        .option("hf-token", {
          describe: "HuggingFace API token (for private datasets)",
          type: "string",
        });
    },
    async (argv) => {
      // Validate that at least one of task or query is provided
      const task = argv.task as keyof typeof PIPELINE_DATA | undefined;
      const queries = argv.query && argv.query.length > 0 ? argv.query : undefined;

      if (!task && !queries) {
        console.error("Error: You must specify either a task type or search queries (or both)");
        console.error("Examples:");
        console.error("  batch feature-extraction bert");
        console.error("  batch feature-extraction");
        console.error("  batch bert distilbert");
        process.exit(1);
      }

      const taskText = task ? `${task} ` : "";
      const queryText = queries && queries.length > 0
        ? ` matching [${queries.join(", ")}]`
        : "";

      console.log(`Searching for ${taskText}models${queryText}...\n`);

      let allModels: ModelEntry[] = [];

      if (queries && queries.length > 0) {
        // Search with each query and combine results
        const modelSets: ModelEntry[][] = [];
        for (const query of queries) {
          const models = await searchModels({
            task: task,
            search: query,
            limit: argv.limit,
          });
          modelSets.push(models);
          console.log(`  Found ${models.length} models for query "${query}"${task ? ` (task: ${task})` : ""}`);
        }

        // Deduplicate models by ID
        const modelMap = new Map<string, ModelEntry>();
        for (const models of modelSets) {
          for (const model of models) {
            modelMap.set(model.id, model);
          }
        }
        allModels = Array.from(modelMap.values());
        console.log(`  Total unique models: ${allModels.length}\n`);
      } else {
        // No query specified, search by task only
        allModels = await searchModels({
          task: task,
          limit: argv.limit,
        });
      }

      if (allModels.length === 0) {
        console.log("No models found.");
        return;
      }

      console.log(`Found ${allModels.length} models:\n`);
      allModels.forEach((model, index) => {
        console.log(`${index + 1}. ${formatModel(model)}`);
      });

      // Generate all combinations
      const platforms = argv.platform as string[];
      const modes = argv.mode as string[];
      const batchSizes = argv.batchSize as number[];
      const devices = argv.device as string[];
      const browsers = argv.browser as string[];
      const dtypes = argv.dtype as string[];

      const combinations: Array<{
        modelId: string;
        task?: string;
        platform: string;
        mode: string;
        batchSize: number;
        device: string;
        browser: string;
        dtype: string;
      }> = [];

      for (const model of allModels) {
        for (const platform of platforms) {
          for (const mode of modes) {
            for (const batchSize of batchSizes) {
              for (const device of devices) {
                for (const browser of browsers) {
                  for (const dtype of dtypes) {
                    combinations.push({
                      modelId: (model as any).name || model.id,
                      task: model.task || undefined, // Store model's task for later use
                      platform,
                      mode,
                      batchSize,
                      device,
                      browser,
                      dtype,
                    });
                  }
                }
              }
            }
          }
        }
      }

      // Filter out existing benchmarks if requested
      let filteredCombinations = combinations;
      if (argv.excludeExisting) {
        const datasetRepo = argv.hfDatasetRepo || process.env.HF_DATASET_REPO;
        const hfToken = argv.hfToken || process.env.HF_TOKEN;

        if (!datasetRepo) {
          console.error("\n❌ Error: --exclude-existing requires --hf-dataset-repo or HF_DATASET_REPO env var");
          process.exit(1);
        }

        const existingFiles = await fetchExistingBenchmarks(datasetRepo, hfToken);

        // Filter combinations
        filteredCombinations = combinations.filter((combo) => {
          const modelTask = task || combo.task || "feature-extraction";
          const benchmarkPath = generateBenchmarkPath({
            task: modelTask,
            modelId: combo.modelId,
            platform: combo.platform,
            mode: combo.mode,
            device: combo.device,
            dtype: combo.dtype,
            batchSize: combo.batchSize,
            browser: combo.browser,
            headed: false, // Default, as it's not in the combination
          });
          return !existingFiles.has(benchmarkPath);
        });

        const excludedCount = combinations.length - filteredCombinations.length;
        console.log(`\n📊 Exclusion Filter:`);
        console.log(`  Total combinations: ${combinations.length}`);
        console.log(`  Existing benchmarks: ${excludedCount}`);
        console.log(`  New benchmarks to run: ${filteredCombinations.length}\n`);
      }

      console.log(`\n📊 Benchmark Plan:`);
      console.log(`  Models: ${allModels.length}`);
      console.log(`  Platforms: ${platforms.join(", ")}`);
      console.log(`  Modes: ${modes.join(", ")}`);
      console.log(`  Batch Sizes: ${batchSizes.join(", ")}`);
      console.log(`  Devices: ${devices.join(", ")}`);
      console.log(`  Browsers: ${browsers.join(", ")}`);
      console.log(`  DTypes: ${dtypes.join(", ")}`);
      console.log(`  Total benchmarks: ${filteredCombinations.length}`);

      // Ask for confirmation unless -y flag is used
      if (!argv.yes) {
        const response = await prompts({
          type: "confirm",
          name: "proceed",
          message: `Proceed with submitting ${filteredCombinations.length} benchmark(s)?`,
          initial: true,
        });

        if (!response.proceed) {
          console.log("\nCancelled.");
          return;
        }
      }

      console.log(`\nSubmitting ${filteredCombinations.length} benchmarks...`);

      const submitted: string[] = [];
      const failed: Array<{ combo: string; error: string }> = [];

      for (const combo of filteredCombinations) {
        try {
          // Use task from model if not specified in command
          const modelTask = task || (combo as any).task || "feature-extraction";

          const options: SubmitOptions = {
            modelId: combo.modelId,
            task: modelTask,
            platform: combo.platform as "node" | "web",
            mode: combo.mode as "warm" | "cold",
            repeats: argv.repeats,
            batchSize: combo.batchSize,
            dtype: combo.dtype,
            device: combo.device,
            browser: combo.browser as "chromium" | "firefox" | "webkit",
          };

          const result = await submitBenchmark(options);
          const desc = `${combo.modelId} [${combo.platform}/${combo.device}/${combo.mode}/b${combo.batchSize}/${combo.dtype}]`;
          submitted.push(desc);
          console.log(`✓ Queued: ${desc} (${result.id})`);
        } catch (error: any) {
          const desc = `${combo.modelId} [${combo.platform}/${combo.device}/${combo.dtype}]`;
          failed.push({ combo: desc, error: error.message });
          console.log(`✗ Failed: ${desc} - ${error.message}`);
        }
      }

      console.log(`\n📊 Summary:`);
      console.log(`  ✓ Submitted: ${submitted.length}`);
      console.log(`  ✗ Failed: ${failed.length}`);

      if (submitted.length > 0) {
        console.log(`\nCheck status with: bench-client queue`);
      }
    }
  )
  .demandCommand(1, "You need to specify a command")
  .help()
  .alias("h", "help")
  .strict()
  .parse();

export { submitBenchmark, getBenchmark, listBenchmarks, getQueueStatus, pollBenchmark };
