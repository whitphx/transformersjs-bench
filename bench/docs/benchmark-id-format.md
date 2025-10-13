# Benchmark ID and File Organization

## Overview

Benchmark results are organized using a deterministic ID system that groups results with identical settings into the same file. The ID is structured hierarchically with task at the top level, followed by model ID, and finally encoded parameters.

## Directory Structure

Results are stored in nested directories with task as the top level:

```
benchmark-results/
├── {task}/
│   └── {org}/
│       └── {model-name}/
│           ├── {params1}.jsonl
│           ├── {params2}.jsonl
│           └── {params3}.jsonl
```

## ID Format

**Full ID**: `{task}/{modelId}/{platform}_{mode}_{device}_{dtype}_{batch}_{browser}_{headed}`

### Components

1. **Task** (top-level directory): The transformers task
   - Examples: `feature-extraction`, `text-classification`, `text-generation`, `sentiment-analysis`
   - Rationale: Tasks are fundamentally different operations, so they form the primary organization

2. **Model ID** (nested directory path): Full model identifier with organization
   - Examples: `Xenova/all-MiniLM-L6-v2`, `meta-llama/Llama-2-7b`
   - Preserved as-is, including slashes for directory structure

3. **Platform**: `node` or `web`

4. **Mode**: `warm` or `cold`

5. **Device**: Execution device
   - Node.js: `cpu` (default), `webgpu`
   - Web: `webgpu` (default), `wasm`

6. **DType** (optional): Model data type
   - Examples: `fp32`, `fp16`, `q8`, `q4`, `int8`
   - Omitted if not specified

7. **Batch Size**: Always included as `b{N}`
   - Examples: `b1`, `b4`, `b32`

8. **Browser** (web only): Browser type
   - Examples: `chromium`, `firefox`, `webkit`
   - Omitted for Node.js benchmarks

9. **Headed** (web only): Display mode
   - Included as `headed` only if true
   - Omitted for headless mode or Node.js benchmarks

## Examples

### Node.js Benchmarks

```
feature-extraction/Xenova/all-MiniLM-L6-v2/node_warm_cpu_fp32_b1.jsonl
feature-extraction/Xenova/all-MiniLM-L6-v2/node_warm_webgpu_fp16_b4.jsonl
feature-extraction/Xenova/all-MiniLM-L6-v2/node_cold_cpu_b1.jsonl
text-generation/meta-llama/Llama-2-7b/node_warm_cpu_q4_b1.jsonl
```

### Web Benchmarks

```
feature-extraction/Xenova/distilbert-base-uncased/web_warm_wasm_b1_chromium.jsonl
feature-extraction/Xenova/distilbert-base-uncased/web_warm_wasm_q8_b1_firefox.jsonl
feature-extraction/Xenova/distilbert-base-uncased/web_warm_webgpu_fp16_b1_chromium_headed.jsonl
feature-extraction/Xenova/roberta-large-mnli/web_cold_wasm_b1_chromium.jsonl
```

### Mixed Tasks and Models

```
benchmark-results/
├── feature-extraction/
│   └── Xenova/
│       ├── all-MiniLM-L6-v2/
│       │   ├── node_warm_cpu_fp32_b1.jsonl
│       │   └── web_warm_wasm_b1_chromium.jsonl
│       └── distilbert-base-uncased/
│           └── node_warm_webgpu_fp16_b1.jsonl
└── text-classification/
    └── Xenova/
        └── distilbert-base-uncased/
            └── node_warm_cpu_fp32_b1.jsonl
```

## File Format

Each file is in JSONL (JSON Lines) format, with one benchmark result per line. This allows:
- Appending new results without parsing the entire file
- Streaming large result sets
- Easy analysis with tools like `jq`

Example:
```jsonl
{"id":"uuid1","platform":"node","modelId":"Xenova/all-MiniLM-L6-v2","task":"feature-extraction",...}
{"id":"uuid2","platform":"node","modelId":"Xenova/all-MiniLM-L6-v2","task":"feature-extraction",...}
{"id":"uuid3","platform":"node","modelId":"Xenova/all-MiniLM-L6-v2","task":"feature-extraction",...}
```

## Querying Results

### API Endpoints

1. **Get all results**:
   ```bash
   curl http://localhost:7860/api/benchmarks
   ```

2. **Get results by model**:
   ```bash
   curl "http://localhost:7860/api/benchmarks?modelId=Xenova/all-MiniLM-L6-v2"
   ```

3. **Get specific benchmark**:
   ```bash
   curl http://localhost:7860/api/benchmark/{uuid}
   ```

### Direct File Access

Results can also be queried directly from the filesystem:

```bash
# All results for a specific task
cat benchmark-results/feature-extraction/**/*.jsonl | jq

# All results for a specific model across all tasks
cat benchmark-results/*/Xenova/all-MiniLM-L6-v2/*.jsonl | jq

# All results for a specific model and task
cat benchmark-results/feature-extraction/Xenova/all-MiniLM-L6-v2/*.jsonl | jq

# Specific configuration
cat benchmark-results/feature-extraction/Xenova/all-MiniLM-L6-v2/node_warm_cpu_fp32_b1.jsonl | jq

# Count results per configuration
wc -l benchmark-results/feature-extraction/Xenova/all-MiniLM-L6-v2/*.jsonl

# Filter by device across all models
cat benchmark-results/feature-extraction/*/*/web_*_wasm_*.jsonl | jq

# Compare same model across different tasks
cat benchmark-results/*/Xenova/distilbert-base-uncased/node_warm_cpu_fp32_b1.jsonl | jq
```

## Benefits

1. **Task-First Organization**: Primary organization by task type, as models are typically designed for specific tasks
2. **Grouping**: Multiple runs with identical settings are stored together in JSONL files
3. **Easy Comparison**: Compare different models on the same task, or same model across different tasks
4. **Organization**: Clear hierarchy: task → org → model → configurations
5. **Readability**: Filenames are human-readable and self-documenting
6. **Searchability**: Easy to find specific configurations using filesystem tools and glob patterns
7. **Scalability**: Nested directory structure handles thousands of models and tasks
8. **Model ID Preservation**: Full model IDs maintained without sanitization, preserving org/model structure

## Configuration

The base directory can be customized via environment variable:

```bash
export BENCHMARK_RESULTS_DIR=/path/to/results
npm run server
```

Default: `./benchmark-results`
