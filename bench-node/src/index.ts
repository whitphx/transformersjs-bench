import { pipeline } from "@xenova/transformers";
import { performance } from "node:perf_hooks";

// Minimal Node benchmark:
// Measures model load time and first inference latency.
// Default model/task can be overridden by CLI args.
//
// Usage:
//   npm run bench -- [model-id] [task]
// Example:
//   npm run bench -- Xenova/distilbert-base-uncased feature-extraction

const modelId = process.argv[2] || "Xenova/distilbert-base-uncased";
const task = process.argv[3] || "feature-extraction";

async function main() {
  console.log(`Model: ${modelId}`);
  console.log(`Task : ${task}`);

  const t0 = performance.now();
  const pipe = await pipeline(task, modelId, {
    // You can tweak backend settings here if needed.
    // For Node, WASM backend is used by default.
  });
  const t1 = performance.now();

  const input = "The quick brown fox jumps over the lazy dog.";

  const t2 = performance.now();
  await pipe(input);
  const t3 = performance.now();

  const loadMs = (t1 - t0).toFixed(1);
  const firstInferMs = (t3 - t2).toFixed(1);

  console.log(JSON.stringify({
    platform: "node",
    runtime: `node-${process.versions.node}`,
    model: modelId,
    task,
    metrics: {
      load_ms: Number(loadMs),
      first_infer_ms: Number(firstInferMs),
    }
  }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
