import { pipeline } from "@huggingface/transformers";
import { BenchmarkRawResult, aggregateMetrics } from "../core/metrics.js";
import { BenchmarkResult } from "../core/types.js";
import { clearCaches } from "./cache.js";

function now() {
  return performance.now();
}

async function benchOnce(
  modelId: string,
  task: string,
  device: string,
  dtype: string | undefined,
  batchSize: number
): Promise<BenchmarkRawResult> {
  const t0 = now();
  const options: any = { device };
  if (dtype) options.dtype = dtype;
  const pipe = await pipeline(task, modelId, options);
  const t1 = now();

  // Prepare batch input
  const inputs = Array(batchSize).fill("The quick brown fox jumps over the lazy dog.");

  const t2 = now();
  await pipe(inputs);
  const t3 = now();

  // Run additional inferences to measure subsequent performance
  const subsequentTimes: number[] = [];
  for (let i = 0; i < 3; i++) {
    const t4 = now();
    await pipe(inputs);
    const t5 = now();
    subsequentTimes.push(+(t5 - t4).toFixed(1));
  }

  return {
    load_ms: +(t1 - t0).toFixed(1),
    first_infer_ms: +(t3 - t2).toFixed(1),
    subsequent_infer_ms: subsequentTimes,
  };
}

export async function runWebBenchmarkCold(
  modelId: string,
  task: string,
  repeats: number,
  device: string,
  dtype?: string,
  batchSize: number = 1
): Promise<BenchmarkResult> {
  await clearCaches();

  const results: BenchmarkRawResult[] = [];
  for (let i = 0; i < repeats; i++) {
    const r = await benchOnce(modelId, task, device, dtype, batchSize);
    results.push(r);
  }

  const metrics = aggregateMetrics(results);

  const result: BenchmarkResult = {
    platform: "browser",
    runtime: navigator.userAgent,
    mode: "cold",
    repeats,
    batchSize,
    model: modelId,
    task,
    device,
    metrics,
    notes: "Only the 1st iteration is strictly cold in a single page session.",
  };
  if (dtype) result.dtype = dtype;
  return result;
}

export async function runWebBenchmarkWarm(
  modelId: string,
  task: string,
  repeats: number,
  device: string,
  dtype?: string,
  batchSize: number = 1
): Promise<BenchmarkResult> {
  // Prefetch/warmup
  const options: any = { device };
  if (dtype) options.dtype = dtype;
  const p = await pipeline(task, modelId, options);
  const warmupInputs = Array(batchSize).fill("warmup");
  await p(warmupInputs);

  const results: BenchmarkRawResult[] = [];
  for (let i = 0; i < repeats; i++) {
    const r = await benchOnce(modelId, task, device, dtype, batchSize);
    results.push(r);
  }

  const metrics = aggregateMetrics(results);

  const result: BenchmarkResult = {
    platform: "browser",
    runtime: navigator.userAgent,
    mode: "warm",
    repeats,
    batchSize,
    model: modelId,
    task,
    device,
    metrics,
  };
  if (dtype) result.dtype = dtype;
  return result;
}
