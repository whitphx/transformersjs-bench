# bench-web (warm/cold, repeats, p50/p90, CPU/GPU)

## Setup
```bash
cd bench-web
npm i
npm run bench:install  # Install Playwright browsers for CLI mode
```

## Run (Interactive UI)
```bash
npm run dev
# open http://localhost:5173
```

## Run (CLI with Playwright)
```bash
npm run bench:cli -- <model> <task> --mode <warm|cold> --repeats <n> --device <wasm|webgpu> [--browser <chromium|firefox|webkit>] [--headed true]
```

### Examples
```bash
# WASM (CPU) benchmark
npm run bench:cli -- Xenova/all-MiniLM-L6-v2 feature-extraction --mode warm --repeats 3 --device wasm

# WebGPU benchmark
npm run bench:cli -- Xenova/all-MiniLM-L6-v2 feature-extraction --mode warm --repeats 3 --device webgpu

# Cold mode
npm run bench:cli -- Xenova/all-MiniLM-L6-v2 feature-extraction --mode cold --repeats 3 --device wasm

# With Firefox
npm run bench:cli -- Xenova/all-MiniLM-L6-v2 feature-extraction --mode warm --repeats 3 --device wasm --browser firefox

# Headed mode (for debugging)
npm run bench:cli -- Xenova/all-MiniLM-L6-v2 feature-extraction --mode warm --repeats 3 --device wasm --headed true
```

## How it works
### Interactive UI
- **warm**: prefetch once (non-measured) → auto-reload → measure `repeats` times with disk caches populated.
- **cold**: clear Cache Storage & IndexedDB, then measure in the same tab
  - Note: only the 1st iteration is strictly cold within a single page session.

### CLI Mode
- Starts a Vite dev server and launches headless browser via Playwright
- **warm**: prefetch once (non-measured) → measure `repeats` times with caches populated (no page reload)
- **cold**: clears all caches before each run
- **device**: `wasm` for CPU, `webgpu` for GPU acceleration
- Supports Chromium, Firefox, and WebKit browsers
