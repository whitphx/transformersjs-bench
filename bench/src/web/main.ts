import { runWebBenchmarkCold, runWebBenchmarkWarm } from "./benchmark.js";

const btn = document.getElementById("run") as HTMLButtonElement;
const out = document.getElementById("out") as HTMLPreElement;
const statusEl = document.getElementById("status") as HTMLSpanElement;
const modelEl = document.getElementById("model") as HTMLInputElement;
const taskEl = document.getElementById("task") as HTMLSelectElement;
const modeEl = document.getElementById("mode") as HTMLSelectElement;
const repeatsEl = document.getElementById("repeats") as HTMLInputElement;
const deviceEl = document.getElementById("device") as HTMLSelectElement;

// URL parameter utilities
function getUrlParams(): URLSearchParams {
  return new URLSearchParams(window.location.search);
}

function setUrlParams(params: Record<string, string>) {
  const url = new URL(window.location.href);
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });
  window.history.replaceState({}, '', url);
}

function loadParamsFromUrl() {
  const params = getUrlParams();
  if (params.has('model')) modelEl.value = params.get('model')!;
  if (params.has('task')) taskEl.value = params.get('task')!;
  if (params.has('mode')) modeEl.value = params.get('mode')!;
  if (params.has('repeats')) repeatsEl.value = params.get('repeats')!;
  if (params.has('device')) deviceEl.value = params.get('device')!;
}

function saveParamsToUrl(modelId: string, task: string, mode: string, repeats: number, device: string, dtype?: string, batchSize?: number) {
  const params: Record<string, string> = {
    model: modelId,
    task,
    mode,
    repeats: String(repeats),
    device,
  };
  if (dtype) params.dtype = dtype;
  if (batchSize && batchSize !== 1) params['batch-size'] = String(batchSize);
  setUrlParams(params);
}

async function runWarmWithReload(modelId: string, task: string, repeats: number, device: string, dtype?: string, batchSize: number = 1) {
  const flag = sessionStorage.getItem("__warm_ready__");
  if (!flag) {
    statusEl.textContent = "prefetching (warmup) ...";
    // Save params to URL for reproducibility
    saveParamsToUrl(modelId, task, 'warm', repeats, device, dtype, batchSize);
    // Perform warmup and store flag
    const { pipeline } = await import("@huggingface/transformers");
    const options: any = { device };
    if (dtype) options.dtype = dtype;
    const p = await pipeline(task, modelId, options);
    const warmupInputs = Array(batchSize).fill("warmup");
    await p(warmupInputs);
    sessionStorage.setItem("__warm_ready__", "1");
    location.reload();
    return null;
  } else {
    sessionStorage.removeItem("__warm_ready__");
    statusEl.textContent = "running (warm)...";
    return await runWebBenchmarkWarm(modelId, task, repeats, device, dtype, batchSize);
  }
}

async function run() {
  const modelId = modelEl.value.trim() || "Xenova/distilbert-base-uncased";
  const task = taskEl.value;
  const mode = modeEl.value as "warm" | "cold";
  const repeats = Math.max(1, parseInt(repeatsEl.value || "3", 10));
  const device = deviceEl.value;
  const params = getUrlParams();
  const dtype = params.get('dtype') || undefined;
  const batchSize = params.has('batch-size') ? parseInt(params.get('batch-size')!, 10) : 1;

  out.textContent = "{}";

  if (mode === "cold") {
    statusEl.textContent = "clearing caches (cold)...";
    saveParamsToUrl(modelId, task, 'cold', repeats, device, dtype, batchSize);
    const r = await runWebBenchmarkCold(modelId, task, repeats, device, dtype, batchSize);
    if (r) {
      out.textContent = JSON.stringify(r, null, 2);
      statusEl.textContent = "done (cold)";
    }
  } else {
    const r = await runWarmWithReload(modelId, task, repeats, device, dtype, batchSize);
    if (r) {
      out.textContent = JSON.stringify(r, null, 2);
      statusEl.textContent = "done (warm)";
    }
  }
}

// Load parameters from URL on page load
loadParamsFromUrl();

// Auto-run if returning from warm reload
(async () => {
  const flag = sessionStorage.getItem("__warm_ready__");
  if (flag) {
    try {
      // Parameters are already in URL, just load them to form
      loadParamsFromUrl();
      await run();
    } catch (e) {
      console.error(e);
    }
  }
})();

btn.addEventListener("click", () => {
  run().catch((e) => {
    out.textContent = String(e);
    statusEl.textContent = "error";
    console.error(e);
  });
});

// Expose for CLI use
(window as any).runBenchmarkCLI = async function (params: {
  modelId: string;
  task: string;
  mode: string;
  repeats: number;
  device: string;
  dtype?: string;
  batchSize?: number;
}) {
  const batchSize = params.batchSize || 1;
  if (params.mode === "cold") {
    return await runWebBenchmarkCold(params.modelId, params.task, params.repeats, params.device, params.dtype, batchSize);
  } else {
    return await runWebBenchmarkWarm(params.modelId, params.task, params.repeats, params.device, params.dtype, batchSize);
  }
};
