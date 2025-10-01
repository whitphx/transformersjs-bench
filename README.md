# transformersjs-bench-min (Minimal Template)

This zip contains two tiny templates to benchmark model *load* and *first inference* times with Transformers.js.

- `bench-node/`: Node.js CLI (WASM backend). Prints a JSON result to stdout.
- `bench-web/`: Vite + TypeScript browser page. Shows a JSON result on screen.

## Quick start

### Node CLI
```bash
cd bench-node
npm i
npm run bench
# or model/task override:
npm run bench -- Xenova/distilbert-base-uncased feature-extraction
```

### Browser app (Vite)
```bash
cd bench-web
npm i
npm run dev
# open http://localhost:5173 and click "Run benchmark"
```

## Notes
- Models are fetched from the Hugging Face Hub/CDN the first time.
- Browser backend selection (WebGPU/WASM) is handled internally by the library.
- Keep this minimal; extend with warm/cold runs, repetition, and export as needed.
