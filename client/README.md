# Benchmark Client

CLI client for interacting with the Transformers.js benchmark server.

## Installation

```bash
npm install
```

## Usage

The client provides commands to submit benchmarks, check their status, and view results.

From the client directory:
```bash
npm run cli -- <command> [options]
```

Or from the root directory:
```bash
npm run cli --prefix client -- <command> [options]
```

### Submit a Benchmark

```bash
npm run cli -- submit <modelId> <task> [options]
```

**Options:**
- `--platform <node|web>` - Platform to run on (default: node)
- `--mode <warm|cold>` - Cache mode (default: warm)
- `--repeats <n>` - Number of times to repeat (default: 3)
- `--batch-size <n>` - Batch size for inference (default: 1)
- `--dtype <type>` - Data type (fp32, fp16, q8, etc.)
- `--device <device>` - Device for web platform (default: webgpu)
- `--browser <chromium|firefox|webkit>` - Browser for web (default: chromium)
- `--headed` - Run browser in headed mode
- `--wait` - Wait for completion

**Examples:**

```bash
# Submit a Node.js benchmark
npm run cli -- submit Xenova/all-MiniLM-L6-v2 feature-extraction --platform node --repeats 5 --wait

# Submit a web benchmark with WebGPU
npm run cli -- submit Xenova/distilbert-base-uncased fill-mask --platform web --device webgpu --headed

# Submit with specific dtype
npm run cli -- submit Xenova/all-MiniLM-L6-v2 feature-extraction --dtype fp16 --batch-size 4
```

### Get Benchmark Result

```bash
npm run cli -- get <benchmark-id>
```

### List All Benchmarks

```bash
npm run cli -- list
```

### Check Queue Status

```bash
npm run cli -- queue
```

## Configuration

Set the server URL via environment variable:

```bash
export BENCH_SERVER_URL=http://localhost:3000
```

Default: `http://localhost:3000`
