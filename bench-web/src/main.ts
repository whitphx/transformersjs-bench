import { pipeline } from "@huggingface/transformers";

const btn = document.getElementById("run") as HTMLButtonElement;
const out = document.getElementById("out") as HTMLPreElement;
const statusEl = document.getElementById("status") as HTMLSpanElement;
const modelEl = document.getElementById("model") as HTMLInputElement;
const taskEl = document.getElementById("task") as HTMLSelectElement;
const modeEl = document.getElementById("mode") as HTMLSelectElement;
const repeatsEl = document.getElementById("repeats") as HTMLInputElement;
const deviceEl = document.getElementById("device") as HTMLSelectElement;

function now() { return performance.now(); }
function percentile(values: number[], q: number) {
  const a = [...values].sort((x, y) => x - y);
  const i = (a.length - 1) * q;
  const i0 = Math.floor(i), i1 = Math.ceil(i);
  return i0 === i1 ? a[i0] : a[i0] + (a[i1] - a[i0]) * (i - i0);
}
async function clearCaches({ clearSession = false }: { clearSession?: boolean } = {}) {
  try {
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => caches.delete(k)));
  } catch { }
  try {
    const anyIDB: any = indexedDB as any;
    if (typeof anyIDB.databases === "function") {
      const dbs = await anyIDB.databases();
      await Promise.all(dbs.map((d: any) => d?.name ? indexedDB.deleteDatabase(d.name) : undefined));
    } else {
      indexedDB.deleteDatabase("transformers-cache");
      indexedDB.deleteDatabase("model-cache");
    }
  } catch { }
  try {
    localStorage.clear();
    if (clearSession) sessionStorage.clear();
  } catch { }
}
async function benchOnce(modelId: string, task: string, device: string, dtype?: string, batchSize: number = 1) {
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
    subsequent_infer_ms: subsequentTimes
  };
}
async function runMany(modelId: string, task: string, repeats: number, device: string, dtype?: string, batchSize: number = 1) {
  const loads: number[] = [];
  const firsts: number[] = [];
  const subsequents: number[] = [];
  for (let i = 0; i < repeats; i++) {
    const r = await benchOnce(modelId, task, device, dtype, batchSize);
    loads.push(r.load_ms);
    firsts.push(r.first_infer_ms);
    subsequents.push(...r.subsequent_infer_ms);
  }
  return {
    load_ms: { p50: +percentile(loads, 0.5).toFixed(1), p90: +percentile(loads, 0.9).toFixed(1), raw: loads },
    first_infer_ms: { p50: +percentile(firsts, 0.5).toFixed(1), p90: +percentile(firsts, 0.9).toFixed(1), raw: firsts },
    subsequent_infer_ms: { p50: +percentile(subsequents, 0.5).toFixed(1), p90: +percentile(subsequents, 0.9).toFixed(1), raw: subsequents },
  };
}
async function runCold(modelId: string, task: string, repeats: number, device: string, dtype?: string, batchSize: number = 1) {
  statusEl.textContent = "clearing caches (cold)...";
  await clearCaches();
  statusEl.textContent = "running (cold)...";
  const metrics = await runMany(modelId, task, repeats, device, dtype, batchSize);
  const result: any = {
    platform: "browser",
    runtime: navigator.userAgent,
    mode: "cold",
    repeats,
    batchSize,
    model: modelId,
    task,
    device,
    metrics,
    notes: "Only the 1st iteration is strictly cold in a single page session."
  };
  if (dtype) result.dtype = dtype;
  return result;
}
async function runWarmDirect(modelId: string, task: string, repeats: number, device: string, dtype?: string, batchSize: number = 1) {
  statusEl.textContent = "prefetching (warmup) ...";
  const options: any = { device };
  if (dtype) options.dtype = dtype;
  const p = await pipeline(task, modelId, options);
  const warmupInputs = Array(batchSize).fill("warmup");
  await p(warmupInputs);
  statusEl.textContent = "running (warm)...";
  const metrics = await runMany(modelId, task, repeats, device, dtype, batchSize);
  const result: any = {
    platform: "browser",
    runtime: navigator.userAgent,
    mode: "warm",
    repeats,
    batchSize,
    model: modelId,
    task,
    device,
    metrics
  };
  if (dtype) result.dtype = dtype;
  return result;
}
async function runWarm(modelId: string, task: string, repeats: number, device: string, dtype?: string, batchSize: number = 1) {
  const flag = sessionStorage.getItem("__warm_ready__");
  if (!flag) {
    statusEl.textContent = "prefetching (warmup) ...";
    const options: any = { device };
    if (dtype) options.dtype = dtype;
    const p = await pipeline(task, modelId, options);
    const warmupInputs = Array(batchSize).fill("warmup");
    await p(warmupInputs);
    sessionStorage.setItem("__warm_ready__", JSON.stringify({ modelId, task, repeats, device, dtype, batchSize }));
    location.reload();
    return null;
  } else {
    sessionStorage.removeItem("__warm_ready__");
    return await runWarmDirect(modelId, task, repeats, device, dtype, batchSize);
  }
}
async function run() {
  const modelId = modelEl.value.trim() || "Xenova/distilbert-base-uncased";
  const task = taskEl.value;
  const mode = modeEl.value as "warm" | "cold";
  const repeats = Math.max(1, parseInt(repeatsEl.value || "3", 10));
  const device = deviceEl.value;
  out.textContent = "{}";
  if (mode === "cold") {
    const r = await runCold(modelId, task, repeats, device);
    if (r) { out.textContent = JSON.stringify(r, null, 2); statusEl.textContent = "done (cold)"; }
  } else {
    const r = await runWarm(modelId, task, repeats, device);
    console.log("warm run result:", r);
    if (r) { out.textContent = JSON.stringify(r, null, 2); statusEl.textContent = "done (warm)"; }
  }
}
(async () => {
  const flag = sessionStorage.getItem("__warm_ready__");
  if (flag) {
    try { await run(); } catch (e) { console.error(e); }
  }
})();
btn.addEventListener("click", () => {
  run().catch((e) => { out.textContent = String(e); statusEl.textContent = "error"; console.error(e); });
});

// Expose for CLI use
(window as any).runBenchmarkCLI = async function (params: { modelId: string, task: string, mode: string, repeats: number, device: string, dtype?: string, batchSize?: number }) {
  const batchSize = params.batchSize || 1;
  if (params.mode === "cold") {
    return await runCold(params.modelId, params.task, params.repeats, params.device, params.dtype, batchSize);
  } else {
    // For warm, use the direct function that skips reload logic
    return await runWarmDirect(params.modelId, params.task, params.repeats, params.device, params.dtype, batchSize);
  }
};
