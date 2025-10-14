# Transformers.js Benchmark Leaderboard

A Gradio-based leaderboard that displays benchmark results from a HuggingFace Dataset repository.

## Features

- 📊 Display benchmark results in a searchable/filterable table
- 🔍 Filter by model name, task, platform, device, mode, and dtype
- 🔄 Refresh data on demand from HuggingFace Dataset
- 📈 View performance metrics (load time, inference time, p50/p90 percentiles)

## Setup

1. Install dependencies:
   ```bash
   uv sync
   ```

2. Configure environment variables:
   ```bash
   cp .env.example .env
   ```

   Edit `.env` and set:
   - `HF_DATASET_REPO`: Your HuggingFace dataset repository (e.g., `username/transformersjs-benchmarks`)
   - `HF_TOKEN`: Your HuggingFace API token (optional, for private datasets)

## Usage

Run the leaderboard:

```bash
uv run python -m leaderboard.app
```

Or using the installed script:

```bash
uv run leaderboard
```

The leaderboard will be available at: http://localhost:7861

## Data Format

The leaderboard reads JSONL files from the HuggingFace Dataset repository. Each line should be a JSON object with the following structure:

```json
{
  "id": "benchmark-id",
  "platform": "web",
  "modelId": "Xenova/all-MiniLM-L6-v2",
  "task": "feature-extraction",
  "mode": "warm",
  "repeats": 3,
  "batchSize": 1,
  "device": "wasm",
  "browser": "chromium",
  "dtype": "fp32",
  "headed": false,
  "status": "completed",
  "timestamp": 1234567890,
  "result": {
    "metrics": {
      "load_ms": {"p50": 100, "p90": 120},
      "first_infer_ms": {"p50": 10, "p90": 15},
      "subsequent_infer_ms": {"p50": 8, "p90": 12}
    },
    "environment": {
      "cpuCores": 10,
      "memory": {"deviceMemory": 8}
    }
  }
}
```

## Development

The leaderboard is built with:
- **Gradio**: Web UI framework
- **Pandas**: Data manipulation
- **HuggingFace Hub**: Dataset loading
