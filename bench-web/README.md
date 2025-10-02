# bench-web (warm/cold, repeats, p50/p90)

## Setup
```bash
cd bench-web
npm i
```

## Run (dev)
```bash
npm run dev
# open http://localhost:5173
```

## How it works
- **warm**: prefetch once (non-measured) → auto-reload → measure `repeats` times with disk caches populated.
- **cold**: clear Cache Storage & IndexedDB, then measure in the same tab
  - Note: only the 1st iteration is strictly cold within a single page session.
