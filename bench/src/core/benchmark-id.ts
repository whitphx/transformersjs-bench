/**
 * Benchmark ID Generator
 *
 * Creates human-readable, deterministic IDs from benchmark settings that:
 * 1. Group results with identical configurations
 * 2. Use model ID as directory structure (e.g., "Xenova/all-MiniLM-L6-v2/...")
 * 3. Encode other parameters as filename
 * 4. Are sortable and searchable
 */

export interface EnvironmentInfo {
  // Node.js format
  cpu?: {
    model?: string;
    cores?: number;
  };
  memory?: {
    total?: string;
    deviceMemory?: number; // Web browser format (GB)
  };
  gpu?: {
    vendor?: string;
    renderer?: string;
  };
  platform?: string;
  arch?: string;

  // Web browser format (direct fields)
  cpuCores?: number;
}

export interface BenchmarkSettings {
  platform: "node" | "web";
  modelId: string;
  task: string;
  mode: "warm" | "cold";
  device?: string;
  dtype?: string;
  batchSize?: number;
  browser?: string;
  headed?: boolean;
  environment?: EnvironmentInfo;
}

/**
 * Generate a benchmark ID path from settings
 *
 * Format: {task}/{modelId}/{platform}_{mode}_{device}_{dtype}_{batch}_{browser}_{headed}
 *
 * Examples:
 * - "feature-extraction/Xenova/all-MiniLM-L6-v2/node_warm_cpu_fp32_b1"
 * - "feature-extraction/Xenova/distilbert-base-uncased/web_warm_wasm_q8_b1_chromium"
 * - "text-generation/meta-llama/Llama-2-7b/web_cold_webgpu_fp16_b4_firefox_headed"
 *
 * The path can be used to create directories and files:
 * - Directory: {task}/{modelId}/
 * - Filename: {platform}_{mode}_{device}_{dtype}_{batch}_{browser}_{headed}.jsonl
 */
export function generateBenchmarkId(settings: BenchmarkSettings): string {
  // Task at top level
  const task = settings.task;

  // Model ID is preserved as-is (with slashes for directory structure)
  const modelId = settings.modelId;

  // Generate filename parts from other settings (excluding task since it's in the directory)
  const filenameParts = generateFilenameParts(settings);

  // Combine: task/modelId/filename
  return `${task}/${modelId}/${filenameParts.join("_")}`;
}

/**
 * Sanitize environment strings for use in filenames
 */
function sanitizeEnvString(str: string): string {
  return str
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9\-]/g, "")
    .substring(0, 20); // Limit length
}

/**
 * Generate the filename parts (everything except task and model ID)
 */
function generateFilenameParts(settings: BenchmarkSettings): string[] {
  const parts: string[] = [];

  // 1. Platform (node/web)
  parts.push(settings.platform);

  // 2. Mode (warm/cold)
  parts.push(settings.mode);

  // 3. Device
  if (settings.device) {
    parts.push(settings.device);
  } else if (settings.platform === "node") {
    parts.push("cpu"); // default for node
  } else {
    parts.push("webgpu"); // default for web
  }

  // 4. DType (if specified)
  if (settings.dtype) {
    parts.push(settings.dtype);
  }

  // 5. Batch size (always include for consistency)
  const batchSize = settings.batchSize || 1;
  parts.push(`b${batchSize}`);

  // 6. Browser (for web platform)
  if (settings.platform === "web" && settings.browser) {
    parts.push(settings.browser);
  }

  // 7. Headed mode (for web platform, only if true)
  if (settings.platform === "web" && settings.headed) {
    parts.push("headed");
  }

  // 8. Environment info (CPU, memory, architecture, GPU)
  if (settings.environment) {
    const env = settings.environment;

    // CPU model (sanitized, first significant part) - Node.js only
    if (env.cpu?.model) {
      const cpuName = sanitizeEnvString(env.cpu.model.split(/[\s(]/)[0]);
      if (cpuName) {
        parts.push(cpuName);
      }
    }

    // CPU cores (support both Node.js and web browser formats)
    const cores = env.cpu?.cores || env.cpuCores;
    if (cores) {
      parts.push(`${cores}c`);
    }

    // Memory (support both Node.js and web browser formats)
    if (env.memory?.total) {
      // Node.js format: Parse memory string like "32.00 GB" -> "32gb"
      const memMatch = env.memory.total.match(/^(\d+)/);
      if (memMatch) {
        parts.push(`${memMatch[1]}gb`);
      }
    } else if (env.memory?.deviceMemory) {
      // Web browser format: deviceMemory is already in GB
      parts.push(`${env.memory.deviceMemory}gb`);
    }

    // Architecture (Node.js only, browser uses platform like "MacIntel")
    if (env.arch) {
      parts.push(env.arch);
    }

    // GPU vendor/renderer for web (if using webgpu)
    if (settings.platform === "web" && settings.device === "webgpu" && env.gpu) {
      if (env.gpu.vendor) {
        const gpuVendor = sanitizeEnvString(env.gpu.vendor.split(/[\s(]/)[0]);
        if (gpuVendor && gpuVendor !== "google") { // Skip "Google Inc."
          parts.push(`gpu-${gpuVendor}`);
        }
      }
    }
  }

  return parts;
}

/**
 * Generate a filesystem path for storing benchmark results
 * Returns: { dir: "feature-extraction/Xenova/all-MiniLM-L6-v2", filename: "node_warm_cpu_fp32_b1.jsonl" }
 */
export function generateBenchmarkPath(settings: BenchmarkSettings): { dir: string; filename: string; fullPath: string } {
  const dir = `${settings.task}/${settings.modelId}`;
  const filenameParts = generateFilenameParts(settings);
  const filename = `${filenameParts.join("_")}.jsonl`;
  const fullPath = `${dir}/${filename}`;

  return { dir, filename, fullPath };
}

/**
 * Parse a benchmark ID path back into settings (best effort)
 * This is useful for filtering and querying
 *
 * Example: "feature-extraction/Xenova/all-MiniLM-L6-v2/node_warm_cpu_fp32_b1"
 */
export function parseBenchmarkId(id: string): Partial<BenchmarkSettings> {
  const settings: Partial<BenchmarkSettings> = {};

  // Split into parts
  const pathParts = id.split("/");

  if (pathParts.length < 4) {
    return settings; // Invalid ID - need at least task/org/model/filename
  }

  // Extract task (first part)
  settings.task = pathParts[0];

  // Extract model ID (everything from second part to second-to-last slash)
  // Example: ["feature-extraction", "Xenova", "all-MiniLM-L6-v2", "node_warm_cpu_fp32_b1"]
  // modelId should be "Xenova/all-MiniLM-L6-v2"
  const lastSlashIdx = id.lastIndexOf("/");
  const taskLength = settings.task.length + 1; // +1 for the slash
  settings.modelId = id.substring(taskLength, lastSlashIdx);

  // Extract filename parts (everything after the last slash)
  const filenamePart = id.substring(lastSlashIdx + 1);
  const parts = filenamePart.split("_");

  if (parts.length < 3) {
    return settings; // Invalid filename format
  }

  let idx = 0;

  // Platform
  if (parts[idx] === "node" || parts[idx] === "web") {
    settings.platform = parts[idx] as "node" | "web";
    idx++;
  }

  // Mode
  if (idx < parts.length && (parts[idx] === "warm" || parts[idx] === "cold")) {
    settings.mode = parts[idx] as "warm" | "cold";
    idx++;
  }

  // Device (might be cpu, webgpu, wasm)
  if (idx < parts.length && ["cpu", "webgpu", "wasm"].includes(parts[idx])) {
    settings.device = parts[idx];
    idx++;
  }

  // DType
  if (idx < parts.length && ["fp32", "fp16", "q8", "q4", "int8", "uint8", "bnb4", "q4f16"].includes(parts[idx])) {
    settings.dtype = parts[idx];
    idx++;
  }

  // Batch size
  if (idx < parts.length && parts[idx].startsWith("b")) {
    const batch = parseInt(parts[idx].substring(1), 10);
    if (!isNaN(batch)) {
      settings.batchSize = batch;
      idx++;
    }
  }

  // Browser
  if (idx < parts.length && ["chromium", "firefox", "webkit"].includes(parts[idx])) {
    settings.browser = parts[idx];
    idx++;
  }

  // Headed
  if (idx < parts.length && parts[idx] === "headed") {
    settings.headed = true;
    idx++;
  }

  return settings;
}

/**
 * Generate a human-readable display name from settings
 */
export function generateDisplayName(settings: BenchmarkSettings): string {
  const parts: string[] = [];

  // Model name
  parts.push(settings.modelId);

  // Task
  parts.push(`(${settings.task})`);

  // Platform and device
  if (settings.platform === "web") {
    parts.push(`[${settings.browser || "browser"}/${settings.device || "webgpu"}]`);
  } else {
    parts.push(`[node/${settings.device || "cpu"}]`);
  }

  // Mode
  parts.push(settings.mode);

  // DType if specified
  if (settings.dtype) {
    parts.push(settings.dtype);
  }

  // Batch size if not 1
  const batchSize = settings.batchSize || 1;
  if (batchSize !== 1) {
    parts.push(`batch=${batchSize}`);
  }

  // Headed if true
  if (settings.headed) {
    parts.push("headed");
  }

  return parts.join(" ");
}
