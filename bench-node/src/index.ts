import { pipeline, env } from "@huggingface/transformers";
import { performance } from "node:perf_hooks";
import fs from "node:fs";
import path from "node:path";

// Node benchmark with warm/cold modes, repeats, p50/p90

const modelId = process.argv[2] || "Xenova/distilbert-base-uncased";
const task = process.argv[3] || "feature-extraction";

function getArg(name: string, def?: string) {
  const i = process.argv.indexOf(`--${name}`);
  if (i !== -1 && i + 1 < process.argv.length) return process.argv[i + 1];
  return def;
}

const mode = (getArg("mode", "warm") as "warm" | "cold");
const repeats = Math.max(1, parseInt(getArg("repeats", "3") || "3", 10));
const cacheDir = getArg("cache-dir", path.resolve(".bench-cache/default"))!;
const dtype = getArg("dtype"); // optional: fp32, fp16, q8, q4, etc.
const batchSize = Math.max(1, parseInt(getArg("batch-size", "1") || "1", 10));

// Point library cache to a dedicated directory for controllable cold/warm behavior
env.cacheDir = cacheDir;

function ensureEmptyDir(dir: string) {
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
}

function percentile(values: number[], q: number) {
  const a = [...values].sort((x, y) => x - y);
  const i = (a.length - 1) * q;
  const i0 = Math.floor(i), i1 = Math.ceil(i);
  return i0 === i1 ? a[i0] : a[i0] + (a[i1] - a[i0]) * (i - i0);
}

async function benchOnce() {
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
    subsequent_infer_ms: subsequentTimes
  };
}

async function main() {
  console.log(`Model     : ${modelId}`);
  console.log(`Task      : ${task}`);
  console.log(`Mode      : ${mode}`);
  console.log(`Repeats   : ${repeats}`);
  console.log(`DType     : ${dtype || 'auto'}`);
  console.log(`Batch Size: ${batchSize}`);
  console.log(`Cache     : ${cacheDir}`);

  const loads: number[] = [];
  const firsts: number[] = [];
  const subsequents: number[] = [];

  if (mode === "warm") {
    // Fresh cache dir, prefetch once (not measured), then measure N times
    ensureEmptyDir(cacheDir);
    const warmOptions: any = {};
    if (dtype) warmOptions.dtype = dtype;
    const warm = await pipeline(task, modelId, warmOptions);
    const warmupInputs = Array(batchSize).fill("warmup");
    await warm(warmupInputs);

    for (let i = 0; i < repeats; i++) {
      const r = await benchOnce();
      loads.push(r.load_ms);
      firsts.push(r.first_infer_ms);
      subsequents.push(...r.subsequent_infer_ms);
    }
  } else {
    // cold: delete cache dir before each measured run
    for (let i = 0; i < repeats; i++) {
      ensureEmptyDir(cacheDir);
      const r = await benchOnce();
      loads.push(r.load_ms);
      firsts.push(r.first_infer_ms);
      subsequents.push(...r.subsequent_infer_ms);
    }
  }

  const result: any = {
    platform: "node",
    runtime: `node-${process.versions.node}`,
    model: modelId,
    task,
    mode,
    repeats,
    batchSize,
    cacheDir,
    metrics: {
      load_ms: { p50: +percentile(loads, 0.5).toFixed(1), p90: +percentile(loads, 0.9).toFixed(1), raw: loads },
      first_infer_ms: { p50: +percentile(firsts, 0.5).toFixed(1), p90: +percentile(firsts, 0.9).toFixed(1), raw: firsts },
      subsequent_infer_ms: { p50: +percentile(subsequents, 0.5).toFixed(1), p90: +percentile(subsequents, 0.9).toFixed(1), raw: subsequents }
    }
  };
  if (dtype) result.dtype = dtype;

  console.log(JSON.stringify(result, null, 2));
}

main().catch((e) => { console.error(e); process.exit(1); });
