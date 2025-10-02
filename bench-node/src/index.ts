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
  const pipe = await pipeline(task, modelId, {});
  const t1 = performance.now();

  const t2 = performance.now();
  await pipe("The quick brown fox jumps over the lazy dog.");
  const t3 = performance.now();

  return { load_ms: +(t1 - t0).toFixed(1), first_infer_ms: +(t3 - t2).toFixed(1) };
}

async function main() {
  console.log(`Model  : ${modelId}`);
  console.log(`Task   : ${task}`);
  console.log(`Mode   : ${mode}`);
  console.log(`Repeats: ${repeats}`);
  console.log(`Cache  : ${cacheDir}`);

  const loads: number[] = [];
  const firsts: number[] = [];

  if (mode === "warm") {
    // Fresh cache dir, prefetch once (not measured), then measure N times
    ensureEmptyDir(cacheDir);
    const warm = await pipeline(task, modelId, {});
    await warm("warmup");

    for (let i = 0; i < repeats; i++) {
      const r = await benchOnce();
      loads.push(r.load_ms);
      firsts.push(r.first_infer_ms);
    }
  } else {
    // cold: delete cache dir before each measured run
    for (let i = 0; i < repeats; i++) {
      ensureEmptyDir(cacheDir);
      const r = await benchOnce();
      loads.push(r.load_ms);
      firsts.push(r.first_infer_ms);
    }
  }

  const result = {
    platform: "node",
    runtime: `node-${process.versions.node}`,
    model: modelId,
    task,
    mode,
    repeats,
    cacheDir,
    metrics: {
      load_ms: { p50: +percentile(loads, 0.5).toFixed(1), p90: +percentile(loads, 0.9).toFixed(1), raw: loads },
      first_infer_ms: { p50: +percentile(firsts, 0.5).toFixed(1), p90: +percentile(firsts, 0.9).toFixed(1), raw: firsts }
    }
  };

  console.log(JSON.stringify(result, null, 2));
}

main().catch((e) => { console.error(e); process.exit(1); });
