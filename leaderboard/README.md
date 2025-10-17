---
title: Transformers.js Benchmark Leaderboard
emoji: 🏆
colorFrom: blue
colorTo: purple
sdk: gradio
sdk_version: 5.49.1
app_file: src/leaderboard/app.py
pinned: false
---

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

## Deployment on Hugging Face Spaces

This leaderboard is designed to be deployed on [Hugging Face Spaces](https://huggingface.co/spaces) using the Gradio SDK.

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

   # Copy leaderboard files
   cp -r /path/to/leaderboard/* .

   # Commit and push
   git add .
   git commit -m "Initial leaderboard deployment"
   git push
   ```

3. **Configure Space secrets**:
   - Go to your Space settings → **Variables and secrets**
   - Add the following secrets:
     - `HF_DATASET_REPO`: Your dataset repository (e.g., `username/benchmark-results`)
     - `HF_TOKEN`: Your HuggingFace API token (for private datasets)

4. **Space will automatically deploy** and be available at:
   ```
   https://huggingface.co/spaces/YOUR_USERNAME/YOUR_SPACE_NAME
   ```

### Space Configuration

The Space is configured via the YAML frontmatter in `README.md`:

```yaml
---
title: Transformers.js Benchmark Leaderboard
emoji: 🏆
colorFrom: blue
colorTo: purple
sdk: gradio
sdk_version: 5.49.1
app_file: src/leaderboard/app.py
pinned: false
---
```

**Key configuration options:**
- `sdk`: Must be `gradio` for Gradio apps
- `sdk_version`: Gradio version (matches your `pyproject.toml`)
- `app_file`: Path to the main Python file (relative to repository root)
- `pinned`: Set to `true` to pin the Space on your profile

### Requirements

The Space will automatically install dependencies from `pyproject.toml`:
- `gradio>=5.9.1`
- `pandas`
- `huggingface-hub`
- `python-dotenv`

### Environment Variables

Set these in your Space settings or in a `.env` file (not recommended for production):

| Variable | Required | Description |
|----------|----------|-------------|
| `HF_DATASET_REPO` | Yes | HuggingFace dataset repository containing benchmark results |
| `HF_TOKEN` | No | HuggingFace API token (only for private datasets) |

### Auto-Restart

Spaces automatically restart when:
- Code is pushed to the repository
- Dependencies are updated
- Environment variables are changed

### Monitoring

- View logs in the Space's **Logs** tab
- Check status in the **Settings** tab
- Monitor resource usage (CPU, memory)

## Development

The leaderboard is built with:
- **Gradio**: Web UI framework
- **Pandas**: Data manipulation
- **HuggingFace Hub**: Dataset loading

### Local Development

1. Install dependencies:
   ```bash
   uv sync
   ```

2. Set environment variables:
   ```bash
   export HF_DATASET_REPO="your-username/benchmark-results"
   export HF_TOKEN="your-hf-token"  # Optional
   ```

3. Run locally:
   ```bash
   uv run python -m leaderboard.app
   ```

4. Access at: http://localhost:7861
