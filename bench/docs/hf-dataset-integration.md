# Hugging Face Dataset Integration

The benchmark server can automatically upload results to a Hugging Face Dataset repository for centralized storage and sharing.

## Features

- **Automatic Upload**: Results are automatically pushed to HF Dataset when benchmarks complete
- **File Structure Preservation**: Uses the same path structure: `{task}/{org}/{model}/{params}.json`
- **JSON Format**: Results are stored as JSON (not JSONL) for better Dataset compatibility
- **Overwrite Strategy**: Each configuration gets a single file that is overwritten with the latest result
- **Error Tracking**: Failed benchmarks are also uploaded to track issues

## Setup

### 1. Create a Hugging Face Dataset

1. Go to https://huggingface.co/new-dataset
2. Create a new dataset (e.g., `username/transformersjs-benchmark-results`)
3. Keep it public or private based on your needs

### 2. Get Your HF Token

1. Go to https://huggingface.co/settings/tokens
2. Create a new token with `write` permissions
3. Copy the token

### 3. Configure Environment Variables

Create or update `.env` file in the `bench` directory:

```bash
# Hugging Face Dataset Configuration
HF_DATASET_REPO=whitphx/transformersjs-performance-leaderboard-results-dev
HF_TOKEN=hf_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Optional: Local storage directory
BENCHMARK_RESULTS_DIR=./benchmark-results

# Optional: Server port
PORT=7860
```

**Important**: Never commit `.env` to git. It's already in `.gitignore`.

## Usage

Once configured, the server will automatically upload results:

```bash
# Start the server
npm run server

# You should see:
# 📤 HF Dataset upload enabled: username/transformersjs-benchmark-results
```

When benchmarks complete, you'll see:

```
✅ Completed: abc-123 in 5.2s
✓ Benchmark abc-123 saved to file
✓ Uploaded to HF Dataset: feature-extraction/Xenova/all-MiniLM-L6-v2/node_warm_cpu_fp32_b1.json
```

## File Structure in HF Dataset

The dataset will have the same structure as local storage:

```
feature-extraction/
├── Xenova/
│   ├── all-MiniLM-L6-v2/
│   │   ├── node_warm_cpu_fp32_b1.json
│   │   ├── node_warm_webgpu_fp16_b1.json
│   │   └── web_warm_wasm_b1_chromium.json
│   └── distilbert-base-uncased/
│       └── node_warm_cpu_fp32_b1.json
text-classification/
└── Xenova/
    └── distilbert-base-uncased/
        └── node_warm_cpu_fp32_b1.json
```

## JSON Format

Each file contains a single benchmark result (not multiple runs):

```json
{
  "id": "abc-123-456",
  "platform": "node",
  "modelId": "Xenova/all-MiniLM-L6-v2",
  "task": "feature-extraction",
  "mode": "warm",
  "repeats": 3,
  "dtype": "fp32",
  "batchSize": 1,
  "device": "cpu",
  "timestamp": 1234567890,
  "status": "completed",
  "result": {
    "metrics": { ... },
    "environment": { ... }
  }
}
```

## Behavior

### Overwriting Results

- Each benchmark configuration maps to a single file
- New results **overwrite** the existing file
- Only the **latest** result is kept per configuration
- This ensures the dataset always has current data

### Local vs Remote Storage

- **Local (JSONL)**: Keeps history of all runs (append-only)
- **Remote (JSON)**: Keeps only latest result (overwrite)

This dual approach allows:
- Local: Full history for analysis
- Remote: Clean, current results for leaderboards

### Failed Benchmarks

Failed benchmarks are also uploaded to track:
- Which models/configs have issues
- Error types (memory errors, etc.)
- Environmental context

Example failed result:

```json
{
  "id": "def-456-789",
  "status": "failed",
  "error": "Benchmark failed with code 1: ...",
  "result": {
    "error": {
      "type": "memory_error",
      "message": "Aborted(). Build with -sASSERTIONS for more info.",
      "stage": "load"
    },
    "environment": { ... }
  }
}
```

## Git Commits

Each upload creates a git commit in the dataset with:

```
Update benchmark: Xenova/all-MiniLM-L6-v2 (node/feature-extraction)

Benchmark ID: abc-123-456
Status: completed
Timestamp: 2025-10-13T06:48:57.481Z
```

## Disabling Upload

To disable HF Dataset upload:

1. Remove `HF_TOKEN` from `.env`, or
2. Remove both `HF_DATASET_REPO` and `HF_TOKEN`

The server will show:

```
📤 HF Dataset upload disabled (set HF_DATASET_REPO and HF_TOKEN to enable)
```

## Error Handling

If HF upload fails:
- The error is logged but doesn't fail the benchmark
- Local storage still succeeds
- You can retry manually or fix configuration

Example error:

```
✗ Failed to upload benchmark abc-123 to HF Dataset: Authentication failed
```

## API Endpoint (Future)

Currently uploads happen automatically. In the future, we could add:

```bash
# Manually trigger upload of a specific result
POST /api/benchmark/:id/upload

# Re-upload all local results to HF Dataset
POST /api/benchmarks/sync
```

## Development vs Production

Use different dataset repositories for development and production:

**Development** (`.env`):
```bash
HF_DATASET_REPO=whitphx/transformersjs-performance-leaderboard-results-dev
```

**Production** (deployed environment):
```bash
HF_DATASET_REPO=whitphx/transformersjs-performance-leaderboard-results
```

This allows testing without polluting production data.
