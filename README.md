---
title: Transformers.js Benchmark Server
emoji: 🚀
colorFrom: blue
colorTo: green
sdk: docker
pinned: false
---

# Transformers.js Benchmark Server

A REST API server for running and managing Transformers.js benchmarks on both Node.js and browser (via Playwright) platforms.

## Features

- **Queue-based benchmark execution**: Submit benchmarks via REST API and process them sequentially
- **Multi-platform support**: Run benchmarks on Node.js or in browsers (via Playwright)
- **Result persistence**: Store benchmark results in JSONL format
- **Validation**: Request validation using Zod schemas
- **CLI client**: Command-line interface for interacting with the server

## API Endpoints

### Submit Benchmark
```bash
POST /api/benchmark
Content-Type: application/json

{
  "platform": "node",          # "node" or "web"
  "modelId": "Xenova/all-MiniLM-L6-v2",
  "task": "feature-extraction",
  "mode": "warm",              # "warm" or "cold"
  "repeats": 3,
  "dtype": "fp32",             # fp32, fp16, q8, int8, uint8, q4, bnb4, q4f16
  "batchSize": 1,
  "device": "webgpu",          # For web: "webgpu" or "wasm"
  "browser": "chromium",       # For web: "chromium", "firefox", "webkit"
  "headed": false
}
```

### Get Benchmark Result
```bash
GET /api/benchmark/:id
```

### List All Benchmarks
```bash
GET /api/benchmarks
```

### Queue Status
```bash
GET /api/queue
```

### Clear Results
```bash
DELETE /api/benchmarks
```

## Architecture

```
.
├── bench/          # Benchmark server and execution logic
│   ├── src/
│   │   ├── core/      # Shared types and utilities
│   │   ├── node/      # Node.js benchmark runner
│   │   ├── web/       # Browser benchmark runner (Playwright)
│   │   └── server/    # REST API server (Hono)
│   └── package.json
├── client/         # CLI client for the server
│   ├── src/
│   │   └── index.ts   # Yargs-based CLI
│   └── package.json
└── Dockerfile
```

## Development

### Running locally

1. Install dependencies:
```bash
cd bench && npm install
cd ../client && npm install
```

2. Install Playwright browsers:
```bash
cd bench && npm run bench:install
```

3. Start the server:
```bash
cd bench && npm run server
```

4. Use the CLI client:
```bash
cd client && npm run cli -- submit Xenova/all-MiniLM-L6-v2 feature-extraction --wait
```

## Deployment

This server is designed to run on Hugging Face Spaces using Docker. The Dockerfile includes all necessary dependencies including Playwright browsers for running web-based benchmarks.

## License

MIT
