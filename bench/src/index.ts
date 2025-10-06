#!/usr/bin/env node

import { getArg } from "./core/args.js";

const platform = getArg("platform", "node") as "node" | "web";

async function main() {
  if (platform === "web") {
    // Import and run web CLI
    const { main: webMain } = await import("./web/cli.js");
    await webMain();
  } else {
    // Import and run node CLI
    const { main: nodeMain } = await import("./node/index.js");
    await nodeMain();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
