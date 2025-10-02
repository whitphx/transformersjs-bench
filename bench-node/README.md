# bench-node (warm/cold, repeats, p50/p90)

## Setup
```bash
cd bench-node
npm i
```

## Run examples
```bash
# Warm: prefetch once (not measured) -> measure 5 times
npm run bench -- Xenova/distilbert-base-uncased feature-extraction --mode warm --repeats 5 --cache-dir .bench-cache/warm

# Cold: delete cache before each run, measure 3 times
npm run bench -- Xenova/distilbert-base-uncased feature-extraction --mode cold --repeats 3 --cache-dir .bench-cache/cold
```
