# transformersjs-bench-min (warm/cold + repeats + p50/p90)

Includes:
- `bench-node/`: Node CLI with `--mode warm|cold`, `--repeats`, `--cache-dir`.
- `bench-web/`: Browser app with warm (prefetch+reload) / cold (clear caches) and repeats.

## Quick start
### Node
```bash
cd bench-node
npm i
npm run bench -- Xenova/distilbert-base-uncased feature-extraction --mode warm --repeats 5 --cache-dir .bench-cache/warm
```
### Web
```bash
cd bench-web
npm i
npm run dev
```
