# bench-node (Transformers.js minimal benchmark)

## Setup
```bash
cd bench-node
npm i
```

## Run
```bash
# default: Xenova/distilbert-base-uncased + feature-extraction
npm run bench

# override model/task
npm run bench -- Xenova/distilbert-base-uncased feature-extraction
```

Output example:
```json
{
  "platform": "node",
  "runtime": "node-22.x",
  "model": "Xenova/distilbert-base-uncased",
  "task": "feature-extraction",
  "metrics": { "load_ms": 1234.5, "first_infer_ms": 98.7 }
}
```
