# Transformers.js Benchmark

Unified benchmarking tool for testing Transformers.js performance on both Node.js and browser environments.

## Features

- **Unified CLI**: Single entrypoint for both Node and Web benchmarks
- **Shared Core**: Common benchmarking logic reduces code duplication
- **Platform Flexibility**: Test on Node.js runtime or browsers (via Playwright)
- **Comprehensive Metrics**: Measures load time, first inference, and subsequent inferences (p50, p90, raw)
- **Warm/Cold Modes**: Test with or without caching
- **Batch Support**: Run inference with configurable batch sizes
- **Device Options**: Choose between WebGPU, WASM, or default CPU

## Installation

```bash
npm install
npm run bench:install  # Install Playwright browsers for web benchmarks
```

## Usage

### Node.js Benchmark

```bash
# Default (Node platform)
npm run bench -- <model> <task> [options]

# Explicit Node platform
npm run bench -- <model> <task> --platform=node [options]

# Direct script
npm run bench:node -- <model> <task> [options]
```

**Example:**
```bash
npm run bench -- Xenova/all-MiniLM-L6-v2 feature-extraction --mode=warm --repeats=3 --batch-size=1
```

### Web (Browser) Benchmark

```bash
# Via unified CLI
npm run bench -- <model> <task> --platform=web [options]

# Direct script
npm run bench:web -- <model> <task> [options]
```

**Example:**
```bash
npm run bench -- Xenova/distilbert-base-uncased feature-extraction \
  --platform=web \
  --mode=warm \
  --device=webgpu \
  --repeats=3 \
  --batch-size=1
```

### Development Server (Browser UI)

```bash
npm run dev
```

Then open http://localhost:5173 to use the interactive web interface.

## Options

| Option | Description | Default | Values |
|--------|-------------|---------|--------|
| `--platform` | Runtime platform | `node` | `node`, `web` |
| `--mode` | Cache mode | `warm` | `warm`, `cold` |
| `--repeats` | Number of test iterations | `3` | Any positive integer |
| `--batch-size` | Batch size for inference | `1` | Any positive integer |
| `--dtype` | Data type precision | auto | `fp32`, `fp16`, `q8`, `q4`, etc. |
| `--device` | Device for web (browser only) | `webgpu` | `webgpu`, `wasm` |
| `--browser` | Browser type (web only) | `chromium` | `chromium`, `firefox`, `webkit` |
| `--headed` | Run browser in headed mode | `false` | `true`, `false` |

## Architecture

```
bench/
├── src/
│   ├── core/              # Shared benchmarking logic
│   │   ├── args.ts        # CLI argument parsing
│   │   ├── metrics.ts     # Statistics & aggregation
│   │   └── types.ts       # TypeScript interfaces
│   ├── node/              # Node.js implementation
│   │   ├── benchmark.ts   # Node benchmark runner
│   │   ├── cache.ts       # Filesystem cache management
│   │   └── index.ts       # Node CLI entry
│   ├── web/               # Browser implementation
│   │   ├── benchmark.ts   # Browser benchmark runner
│   │   ├── cache.ts       # Browser cache management (IndexedDB, etc.)
│   │   ├── cli.ts         # Playwright CLI for headless browser
│   │   └── main.ts        # Browser UI
│   └── index.ts           # Unified CLI router
├── index.html             # Browser UI HTML
├── package.json
├── tsconfig.json
└── vite.config.ts
```

## ⚠️ Important: WebGPU Headless Limitations

**WebGPU performance in headless mode is significantly degraded** (~25× slower than headed mode on macOS). This is a known limitation of headless browsers:

- **Headless mode**: Uses software rendering, giving misleading results
- **Headed mode** (`--headed=true`): Uses actual GPU, reflects real performance
- **Interactive UI** (`npm run dev`): Best for accurate WebGPU benchmarks

**Recommendation**: For WebGPU benchmarks, always use `--headed=true` or test interactively in a browser.

See: [Chrome WebGPU Testing Guide](https://developer.chrome.com/blog/supercharge-web-ai-testing#enable-webgpu) | [Playwright GPU Issues](https://github.com/microsoft/playwright/issues/11627)

---

## Output Format

All benchmarks output JSON with the following structure:

```json
{
  "platform": "node" | "browser",
  "runtime": "<runtime version or user agent>",
  "model": "<model-id>",
  "task": "<task-name>",
  "mode": "warm" | "cold",
  "repeats": 3,
  "batchSize": 1,
  "dtype": "<dtype>",
  "metrics": {
    "load_ms": {
      "p50": 70.5,
      "p90": 75.2,
      "raw": [67.3, 70.5, 75.2]
    },
    "first_infer_ms": {
      "p50": 3.2,
      "p90": 4.1,
      "raw": [3.1, 3.2, 4.1]
    },
    "subsequent_infer_ms": {
      "p50": 2.1,
      "p90": 2.8,
      "raw": [2.0, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8]
    }
  }
}
```

## Examples

### Compare Node vs Browser

```bash
# Node
npm run bench -- Xenova/distilbert-base-uncased feature-extraction --repeats=5

# Browser (WebGPU)
npm run bench -- Xenova/distilbert-base-uncased feature-extraction \
  --platform=web --device=webgpu --repeats=5

# Browser (WASM)
npm run bench -- Xenova/distilbert-base-uncased feature-extraction \
  --platform=web --device=wasm --repeats=5
```

### Test Different Quantizations

```bash
npm run bench -- Xenova/distilbert-base-uncased feature-extraction --dtype=fp32
npm run bench -- Xenova/distilbert-base-uncased feature-extraction --dtype=fp16
npm run bench -- Xenova/distilbert-base-uncased feature-extraction --dtype=q8
```

### Batch Processing

```bash
npm run bench -- Xenova/distilbert-base-uncased feature-extraction --batch-size=8 --repeats=3
```

## Development

```bash
# Build TypeScript
npm run build

# Run dev server for browser UI
npm run dev

# Preview built browser app
npm run preview
```
