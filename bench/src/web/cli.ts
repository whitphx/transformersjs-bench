import { chromium, firefox, webkit, Browser } from "playwright";
import { createServer } from "vite";
import { getArg } from "../core/args.js";

// CLI for running browser benchmarks headlessly via Playwright

const modelId = process.argv[2] || "Xenova/distilbert-base-uncased";
const task = process.argv[3] || "feature-extraction";

const mode = getArg("mode", "warm") as "warm" | "cold";
const repeats = Math.max(1, parseInt(getArg("repeats", "3") || "3", 10));
const device = getArg("device", "webgpu") as "webgpu" | "wasm";
const dtype = getArg("dtype"); // optional: fp32, fp16, q8, q4, etc.
const batchSize = Math.max(1, parseInt(getArg("batch-size", "1") || "1", 10));
const browserType = getArg("browser", "chromium") as "chromium" | "firefox" | "webkit";
const headed = getArg("headed") === "true";

async function main() {
  console.log(`Model      : ${modelId}`);
  console.log(`Task       : ${task}`);
  console.log(`Mode       : ${mode}`);
  console.log(`Repeats    : ${repeats}`);
  console.log(`Device     : ${device}`);
  console.log(`DType      : ${dtype || 'auto'}`);
  console.log(`Batch Size : ${batchSize}`);
  console.log(`Browser    : ${browserType}`);
  console.log(`Headed     : ${headed}`);

  // Start Vite dev server
  const server = await createServer({
    configFile: false, // Don't load vite.config.ts to avoid permission issues in read-only filesystems
    server: {
      port: 5173,
      strictPort: false,
    },
    logLevel: "error",
    cacheDir: process.env.VITE_CACHE_DIR || "node_modules/.vite",
  });

  await server.listen();

  const port = server.config.server.port || 5173;
  const url = `http://localhost:${port}`;

  console.log(`Vite server started at ${url}`);

  let browser: Browser;

  // Build args based on mode
  const args = device === "wasm"
    ? [
        "--disable-gpu",
        "--disable-software-rasterizer",
        // Increase WASM memory limits for large models
        "--js-flags=--max-old-space-size=8192",
      ]
    : [
        // Official WebGPU flags from Chrome team
        // https://developer.chrome.com/blog/supercharge-web-ai-testing#enable-webgpu
        "--enable-unsafe-webgpu",
        "--enable-features=Vulkan",
      ];

  // Add headless-specific flags only in headless mode
  if (!headed && device !== "wasm") {
    args.push(
      "--no-sandbox",
      "--headless=new",
      "--use-angle=vulkan",
      "--disable-vulkan-surface"
    );
  }

  const launchOptions = {
    headless: !headed,
    args,
  };

  switch (browserType) {
    case "firefox":
      browser = await firefox.launch(launchOptions);
      break;
    case "webkit":
      browser = await webkit.launch(launchOptions);
      break;
    case "chromium":
    default:
      browser = await chromium.launch(launchOptions);
      break;
  }

  try {
    const context = await browser.newContext();
    const page = await context.newPage();

    // Expose console logs
    page.on("console", (msg) => {
      const type = msg.type();
      if (type === "error" || type === "warning") {
        console.log(`[browser ${type}]`, msg.text());
      }
    });

    // Catch page errors
    page.on("pageerror", (error) => {
      console.error(`[browser error]`, error.message);
    });

    // Navigate to the app
    await page.goto(url);

    // Wait for the page to be ready
    await page.waitForSelector("#run");

    console.log("\nStarting benchmark...");

    // Check WebGPU availability if using webgpu device
    if (device === "webgpu") {
      const gpuInfo = await page.evaluate(async () => {
        if (!('gpu' in navigator)) {
          return { available: false, adapter: null, features: null };
        }
        try {
          const adapter = await (navigator as any).gpu.requestAdapter();
          if (!adapter) {
            return { available: false, adapter: null, features: null };
          }
          const features = Array.from(adapter.features || []);
          const limits = adapter.limits ? {
            maxTextureDimension2D: adapter.limits.maxTextureDimension2D,
            maxComputeWorkgroupSizeX: adapter.limits.maxComputeWorkgroupSizeX,
          } : null;
          return {
            available: true,
            adapterInfo: adapter.info ? adapter.info.description : 'Unknown',
            features,
            limits
          };
        } catch (e) {
          return { available: false, adapter: null, error: String(e) };
        }
      });

      if (!gpuInfo.available) {
        console.error("\n❌ WebGPU is not available in this browser!");
        console.error("Make sure to use --enable-unsafe-webgpu flag for Chromium.");
        if (gpuInfo.error) console.error("Error:", gpuInfo.error);
        throw new Error("WebGPU not available");
      }

      console.log("✓ WebGPU is available");
      console.log(`  Adapter: ${gpuInfo.adapterInfo}`);
      if (gpuInfo.features && gpuInfo.features.length > 0) {
        console.log(`  Features: ${gpuInfo.features.slice(0, 3).join(', ')}${gpuInfo.features.length > 3 ? '...' : ''}`);
      }
    }

    // Use the exposed CLI function from main.ts
    const result = await page.evaluate(({ modelId, task, mode, repeats, device, dtype, batchSize }) => {
      return (window as any).runBenchmarkCLI({ modelId, task, mode, repeats, device, dtype, batchSize });
    }, { modelId, task, mode, repeats, device, dtype, batchSize });

    console.log("\n" + JSON.stringify(result, null, 2));

    // Log helpful messages if there's an error
    if (result.error) {
      console.error("\n❌ Benchmark completed with error:");
      console.error(`   Type: ${result.error.type}`);
      console.error(`   Stage: ${result.error.stage}`);
      console.error(`   Message: ${result.error.message}`);

      if (result.error.type === "memory_error" && device === "wasm") {
        console.error("\nSuggestions:");
        console.error("  1. Try using --device=webgpu instead of --device=wasm");
        console.error("  2. Use a smaller model variant");
        console.error("  3. Reduce the batch size with --batch-size=1");
      }
    }

  } finally {
    await browser.close();
    await server.close();
  }
}

// Check if this module is being run directly (not imported)
const isMainModule = process.argv[1]?.includes('web/cli');

if (isMainModule) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}

export { main };
