import { pipeline } from "@huggingface/transformers";
import { BenchmarkRawResult, aggregateMetrics } from "../core/metrics.js";
import { BenchmarkResult } from "../core/types.js";
import { clearCaches } from "./cache.js";
import { getBrowserEnvInfo } from "./envinfo.js";

function now() {
  return performance.now();
}

async function benchOnce(
  modelId: string,
  task: string,
  device: string,
  dtype: string | undefined,
  batchSize: number
): Promise<BenchmarkRawResult | { error: { type: string; message: string; stage: "load" | "inference" } }> {
  try {
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
  } catch (error: any) {
    // Determine error type and stage
    const errorMessage = error?.message || String(error);
    let errorType = "runtime_error";
    let stage: "load" | "inference" = "load";

    if (errorMessage.includes("Aborted") || errorMessage.includes("out of memory")) {
      errorType = "memory_error";
    } else if (errorMessage.includes("Failed to fetch") || errorMessage.includes("network")) {
      errorType = "network_error";
    }

    return {
      error: {
        type: errorType,
        message: errorMessage,
        stage,
      },
    };
  }
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
  let error: { type: string; message: string; stage: "load" | "inference" } | undefined;

  for (let i = 0; i < repeats; i++) {
    const r = await benchOnce(modelId, task, device, dtype, batchSize);
    if ('error' in r) {
      error = r.error;
      break;
    }
    results.push(r);
  }

  const envInfo = await getBrowserEnvInfo();

  const result: BenchmarkResult = {
    platform: "browser",
    runtime: navigator.userAgent,
    mode: "cold",
    repeats,
    batchSize,
    model: modelId,
    task,
    device,
    environment: envInfo,
    notes: "Only the 1st iteration is strictly cold in a single page session.",
  };

  if (error) {
    result.error = error;
  } else {
    const metrics = aggregateMetrics(results);
    result.metrics = metrics;
  }

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
  let error: { type: string; message: string; stage: "load" | "inference" } | undefined;

  // Prefetch/warmup
  try {
    const options: any = { device };
    if (dtype) options.dtype = dtype;
    const p = await pipeline(task, modelId, options);
    const warmupInputs = Array(batchSize).fill("warmup");
    await p(warmupInputs);
  } catch (err: any) {
    const errorMessage = err?.message || String(err);
    let errorType = "runtime_error";
    if (errorMessage.includes("Aborted") || errorMessage.includes("out of memory")) {
      errorType = "memory_error";
    } else if (errorMessage.includes("Failed to fetch") || errorMessage.includes("network")) {
      errorType = "network_error";
    }
    error = {
      type: errorType,
      message: errorMessage,
      stage: "load",
    };
  }

  const results: BenchmarkRawResult[] = [];

  if (!error) {
    for (let i = 0; i < repeats; i++) {
      const r = await benchOnce(modelId, task, device, dtype, batchSize);
      if ('error' in r) {
        error = r.error;
        break;
      }
      results.push(r);
    }
  }

  const envInfo = await getBrowserEnvInfo();

  const result: BenchmarkResult = {
    platform: "browser",
    runtime: navigator.userAgent,
    mode: "warm",
    repeats,
    batchSize,
    model: modelId,
    task,
    device,
    environment: envInfo,
  };

  if (error) {
    result.error = error;
  } else {
    const metrics = aggregateMetrics(results);
    result.metrics = metrics;
  }

  if (dtype) result.dtype = dtype;
  return result;
}
