import { parseArgs } from "../core/args.js";
import { runNodeBenchmark } from "./benchmark.js";

export async function main() {
  const options = parseArgs();
  const result = await runNodeBenchmark(options);
  console.log(JSON.stringify(result, null, 2));
}

// Check if this module is being run directly (not imported)
const isMainModule = process.argv[1]?.includes('node/index');

if (isMainModule) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
