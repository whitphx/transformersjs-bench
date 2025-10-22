---
title: Transformers.js Benchmark Leaderboard
emoji: 🏆
colorFrom: blue
colorTo: purple
sdk: gradio
sdk_version: 5.49.1
app_file: leaderboard/src/leaderboard/app.py
pinned: false
---

# Transformers.js Benchmark Leaderboard

A Gradio-based leaderboard that displays benchmark results from a HuggingFace Dataset repository.

## Features

- **📊 Interactive leaderboard**: Display benchmark results in a searchable/filterable table
- **🔍 Advanced filtering**: Filter by model name, task, platform, device, mode, and dtype
- **⭐ Recommended models**: Curated list of WebGPU-compatible beginner-friendly models
- **🔄 Real-time updates**: Refresh data on demand from HuggingFace Dataset
- **📈 Performance metrics**: View load time, inference time, and p50/p90 percentiles
- **📝 Markdown export**: Export recommended models for documentation

## Architecture

```
.
├── leaderboard/       # Gradio-based leaderboard app
│   ├── src/
│   │   └── leaderboard/
│   │       ├── app.py          # Main Gradio application
│   │       ├── data_loader.py  # HuggingFace Dataset loader
│   │       └── formatters.py   # Data formatting utilities
│   ├── pyproject.toml          # Python dependencies
│   └── README.md               # Detailed leaderboard docs
├── bench/             # Benchmark server (separate deployment)
│   ├── src/
│   │   ├── core/      # Shared types and utilities
│   │   ├── node/      # Node.js benchmark runner
│   │   ├── web/       # Browser benchmark runner
│   │   └── server/    # REST API server
│   └── package.json
└── client/            # CLI client for benchmark server
    ├── src/
    └── package.json
```

## Development

### Running locally

1. Install dependencies:
```bash
cd leaderboard
uv sync
```

2. Configure environment variables:
```bash
# Create .env file or export variables
export HF_DATASET_REPO="your-username/benchmark-results"
export HF_TOKEN="your-hf-token"  # Optional, for private datasets
```

3. Run the leaderboard:
```bash
uv run python -m leaderboard.app
```

The leaderboard will be available at: http://localhost:7861

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `HF_DATASET_REPO` | Yes | HuggingFace dataset repository containing benchmark results |
| `HF_TOKEN` | No | HuggingFace API token (only needed for private datasets) |

## Deployment

This leaderboard is designed to run on Hugging Face Spaces using the Gradio SDK.

### Quick Deploy

1. **Create a new Space** on Hugging Face:
   - Go to https://huggingface.co/new-space
   - Choose **Gradio** as the SDK
   - Set the Space name (e.g., `transformersjs-benchmark-leaderboard`)

2. **Upload files to your Space**:
   ```bash
   # Clone your Space repository
   git clone https://huggingface.co/spaces/YOUR_USERNAME/YOUR_SPACE_NAME
   cd YOUR_SPACE_NAME

   # Copy leaderboard files (adjust path as needed)
   cp -r /path/to/this/repo/leaderboard/* .

   # Commit and push
   git add .
   git commit -m "Deploy leaderboard"
   git push
   ```

3. **Configure Space secrets**:
   - Go to your Space settings → **Variables and secrets**
   - Add `HF_DATASET_REPO`: Your dataset repository (e.g., `username/benchmark-results`)
   - Add `HF_TOKEN`: Your HuggingFace API token (if using private datasets)

4. **Space will automatically deploy** and be available at:
   ```
   https://huggingface.co/spaces/YOUR_USERNAME/YOUR_SPACE_NAME
   ```

### Dependencies

The Space automatically installs dependencies from `pyproject.toml`:
- `gradio>=5.49.1` - Web UI framework
- `pandas>=2.3.3` - Data manipulation
- `huggingface-hub>=0.35.3` - Dataset loading
- `python-dotenv>=1.1.1` - Environment variables

## Data Format

The leaderboard reads JSONL files from the HuggingFace Dataset repository. Each line should be a JSON object with benchmark results:

```json
{
  "id": "benchmark-id",
  "platform": "web",
  "modelId": "Xenova/all-MiniLM-L6-v2",
  "task": "feature-extraction",
  "mode": "warm",
  "device": "wasm",
  "dtype": "fp32",
  "status": "completed",
  "result": {
    "metrics": {
      "load_ms": {"p50": 100, "p90": 120},
      "first_infer_ms": {"p50": 10, "p90": 15},
      "subsequent_infer_ms": {"p50": 8, "p90": 12}
    }
  }
}
```

## Related Projects

- **Benchmark Server** (`bench/`): REST API server for running benchmarks (separate Docker deployment)
- **CLI Client** (`client/`): Command-line tool for submitting benchmarks to the server

## License

MIT
