import { pipeline } from "@xenova/transformers";

const btn = document.getElementById("run") as HTMLButtonElement;
const out = document.getElementById("out") as HTMLPreElement;
const statusEl = document.getElementById("status") as HTMLSpanElement;
const modelEl = document.getElementById("model") as HTMLInputElement;
const taskEl = document.getElementById("task") as HTMLSelectElement;

function now() {
  return performance.now();
}

async function run() {
  const modelId = modelEl.value.trim() || "Xenova/distilbert-base-uncased";
  const task = taskEl.value;
  statusEl.textContent = "loading...";

  const t0 = now();
  const pipe = await pipeline(task, modelId, {
    // For browser, the library will pick the best available backend (WebGPU/WASM).
  });
  const t1 = now();

  const input = "The quick brown fox jumps over the lazy dog.";
  statusEl.textContent = "running inference...";

  const t2 = now();
  await pipe(input);
  const t3 = now();

  const result = {
    platform: "browser",
    runtime: navigator.userAgent,
    backend_hint: ("gpu" in navigator) ? "webgpu-or-wasm" : "wasm",
    model: modelId,
    task,
    metrics: {
      load_ms: +(t1 - t0).toFixed(1),
      first_infer_ms: +(t3 - t2).toFixed(1),
    }
  };

  out.textContent = JSON.stringify(result, null, 2);
  statusEl.textContent = "done";
}

btn.addEventListener("click", () => {
  run().catch((e) => {
    out.textContent = String(e);
    statusEl.textContent = "error";
    console.error(e);
  });
});
