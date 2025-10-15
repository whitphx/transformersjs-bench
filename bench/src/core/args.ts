export function getArg(name: string, def?: string): string | undefined {
  // Check for --name=value format
  const equalFormat = process.argv.find(arg => arg.startsWith(`--${name}=`));
  if (equalFormat) {
    return equalFormat.split('=')[1];
  }

  // Check for --name value format
  const i = process.argv.indexOf(`--${name}`);
  if (i !== -1 && i + 1 < process.argv.length) return process.argv[i + 1];

  return def;
}

export function parseArgs() {
  const modelId = process.argv[2];
  const task = process.argv[3];

  if (!modelId) {
    throw new Error(
      "modelId is required\n" +
      "Usage: tsx src/node/index.ts <modelId> <task> [options]\n" +
      "Example: tsx src/node/index.ts Xenova/distilbert-base-uncased feature-extraction"
    );
  }

  if (!task) {
    throw new Error(
      "task is required\n" +
      "Usage: tsx src/node/index.ts <modelId> <task> [options]\n" +
      "Example: tsx src/node/index.ts Xenova/distilbert-base-uncased feature-extraction"
    );
  }

  const mode = (getArg("mode", "warm") as "warm" | "cold");
  const repeats = Math.max(1, parseInt(getArg("repeats", "3") || "3", 10));
  const dtype = getArg("dtype"); // optional: fp32, fp16, q8, q4, etc.
  const batchSize = Math.max(1, parseInt(getArg("batch-size", "1") || "1", 10));

  return {
    modelId,
    task,
    mode,
    repeats,
    dtype,
    batchSize,
  };
}
