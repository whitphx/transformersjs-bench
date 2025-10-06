# Repository Guidelines

## Project Structure & Module Organization
- Root: overview in `README.md`.
- `bench-node/`: Node.js CLI benchmark. Source in `src/index.ts`.
- `bench-web/`: Browser benchmark (UI + headless). Source in `src/main.ts` and `src/cli.ts`, HTML in `index.html`.
- Caching: Node uses `.bench-cache/<name>`; Web clears Cache Storage + IndexedDB between runs.

## Build, Test, and Development Commands
- Node (CLI):
  - `cd bench-node && npm i`
  - `npm run bench -- <model> <task> --mode <warm|cold> --repeats <n> [--cache-dir <path>]` (runs benchmark)
  - `npm run build` (type-check via `tsc`)
- Web (UI + CLI):
  - `cd bench-web && npm i && npm run bench:install` (install Playwright browsers)
  - `npm run dev` (start Vite dev server, open http://localhost:5173)
  - `npm run build` (Vite production build)
  - `npm run bench:cli -- <model> <task> --mode <warm|cold> --repeats <n> --device <wasm|webgpu> [--browser <chromium|firefox|webkit>] [--headed true]`
  - Examples:
    - `npm run bench -- Xenova/distilbert-base-uncased feature-extraction --mode warm --repeats 5 --cache-dir .bench-cache/warm`
    - `npm run bench:cli -- Xenova/all-MiniLM-L6-v2 feature-extraction --mode cold --repeats 3 --device wasm`

## Coding Style & Naming Conventions
- Language: TypeScript, ES modules.
- Indentation: 2 spaces; use async/await; keep functions small and composable.
- Filenames: lowercase like `index.ts`, `main.ts`, `cli.ts`; group code under `src/`.
- Exports: prefer named exports from modules; avoid default exports.
- Lint/format: no ESLint/Prettier config in repo—match existing style and run `tsc`/Vite builds to type-check.

## Testing Guidelines
- No unit test framework configured. Validate by running benchmarks and inspecting JSON output for `p50/p90` across `load_ms`, `first_infer_ms`, and `subsequent_infer_ms`.
- Repro tips:
  - Warm (Node): prefetch once, then measure N runs using a dedicated `.bench-cache/<name>`.
  - Cold (Node/Web): ensure cache directory is emptied or browser caches are cleared per run.

## Commit & Pull Request Guidelines
- Commits: short, imperative, scoped when helpful (e.g., `bench-web: add cold mode`). Project history follows this style, e.g., “Add batchsize param”, “Warm/Cold tests, repeated tests”.
- PRs: include purpose, sample commands to reproduce, and a result snippet or screenshot. Link related issues and note any flags (e.g., Chromium `--enable-unsafe-webgpu`) or cache paths used.

## Security & Configuration Tips
- WebGPU: may require flags (`--enable-unsafe-webgpu`) or supported browsers; CLI installs Playwright browsers via `npm run bench:install`.
- Cache safety: Node cold runs delete the target cache dir—use only paths under `.bench-cache/`.
