# bench-web (Transformers.js minimal browser benchmark)

## Setup
```bash
cd bench-web
npm i
```

## Run (dev)
```bash
npm run dev
# open http://localhost:5173
```

- Pick a model/task (default `Xenova/distilbert-base-uncased` + `feature-extraction`), click "Run benchmark".
- The page prints a small JSON with load time and first inference latency.
- Works with WASM by default. If your browser supports WebGPU, the library may use it automatically.
