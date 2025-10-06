import { pipeline, env } from "@huggingface/transformers";
import { performance } from "node:perf_hooks";
import path from "node:path";
import { BenchmarkOptions, BenchmarkResult } from "../core/types.js";
import { BenchmarkRawResult, aggregateMetrics } from "../core/metrics.js";
import { ensureEmptyDir } from "./cache.js";

async function benchOnce(
  modelId: string,
  task: string,
  dtype: string | undefined,
  batchSize: number
): Promise<BenchmarkRawResult> {
  const t0 = performance.now();
  const options: any = {};
  if (dtype) options.dtype = dtype;
  const pipe = await pipeline(task, modelId, options);
  const t1 = performance.now();

  // Prepare batch input
  const inputs = Array(batchSize).fill("The quick brown fox jumps over the lazy dog.");

  const t2 = performance.now();
  await pipe(inputs);
  const t3 = performance.now();

  // Run additional inferences to measure subsequent performance
  const subsequentTimes: number[] = [];
  for (let i = 0; i < 3; i++) {
    const t4 = performance.now();
    await pipe(inputs);
    const t5 = performance.now();
    subsequentTimes.push(+(t5 - t4).toFixed(1));
  }

  return {
    load_ms: +(t1 - t0).toFixed(1),
    first_infer_ms: +(t3 - t2).toFixed(1),
    subsequent_infer_ms: subsequentTimes,
  };
}

export async function runNodeBenchmark(options: BenchmarkOptions): Promise<BenchmarkResult> {
  const { modelId, task, mode, repeats, dtype, batchSize } = options;

  const cacheDir = path.resolve(".bench-cache/default");
  env.cacheDir = cacheDir;

  console.log(`Model     : ${modelId}`);
  console.log(`Task      : ${task}`);
  console.log(`Mode      : ${mode}`);
  console.log(`Repeats   : ${repeats}`);
  console.log(`DType     : ${dtype || 'auto'}`);
  console.log(`Batch Size: ${batchSize}`);
  console.log(`Cache     : ${cacheDir}`);

  const results: BenchmarkRawResult[] = [];

  if (mode === "warm") {
    // Fresh cache dir, prefetch once (not measured), then measure N times
    ensureEmptyDir(cacheDir);
    const warmOptions: any = {};
    if (dtype) warmOptions.dtype = dtype;
    const warm = await pipeline(task, modelId, warmOptions);
    const warmupInputs = Array(batchSize).fill("warmup");
    await warm(warmupInputs);

    for (let i = 0; i < repeats; i++) {
      const r = await benchOnce(modelId, task, dtype, batchSize);
      results.push(r);
    }
  } else {
    // cold: delete cache dir before each measured run
    for (let i = 0; i < repeats; i++) {
      ensureEmptyDir(cacheDir);
      const r = await benchOnce(modelId, task, dtype, batchSize);
      results.push(r);
    }
  }

  const metrics = aggregateMetrics(results);

  const result: BenchmarkResult = {
    platform: "node",
    runtime: `node-${process.versions.node}`,
    model: modelId,
    task,
    mode,
    repeats,
    batchSize,
    cacheDir,
    metrics,
  };

  if (dtype) result.dtype = dtype;

  return result;
}
