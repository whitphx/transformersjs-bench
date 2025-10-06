import { chromium, firefox, webkit, Browser, Page } from "playwright";
import { createServer } from "vite";

// CLI for running browser benchmarks headlessly via Playwright

const modelId = process.argv[2] || "Xenova/distilbert-base-uncased";
const task = process.argv[3] || "feature-extraction";

function getArg(name: string, def?: string) {
  const i = process.argv.indexOf(`--${name}`);
  if (i !== -1 && i + 1 < process.argv.length) return process.argv[i + 1];
  return def;
}

const mode = getArg("mode", "warm") as "warm" | "cold";
const repeats = Math.max(1, parseInt(getArg("repeats", "3") || "3", 10));
const device = getArg("device", "webgpu") as "webgpu" | "wasm";
const browserType = getArg("browser", "chromium") as "chromium" | "firefox" | "webkit";
const headed = getArg("headed") === "true";

async function main() {
  console.log(`Model   : ${modelId}`);
  console.log(`Task    : ${task}`);
  console.log(`Mode    : ${mode}`);
  console.log(`Repeats : ${repeats}`);
  console.log(`Device  : ${device}`);
  console.log(`Browser : ${browserType}`);
  console.log(`Headed  : ${headed}`);

  // Start Vite dev server
  const server = await createServer({
    server: {
      port: 5173,
      strictPort: false,
    },
    logLevel: "error",
  });

  await server.listen();

  const port = server.config.server.port || 5173;
  const url = `http://localhost:${port}`;

  console.log(`Vite server started at ${url}`);

  let browser: Browser;
  const launchOptions = {
    headless: !headed,
    args: device === "wasm"
      ? ["--disable-gpu", "--disable-software-rasterizer"]
      : ["--enable-unsafe-webgpu", "--enable-features=Vulkan"]
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

    // Navigate to the app
    await page.goto(url);

    // Wait for the page to be ready
    await page.waitForSelector("#run");

    console.log("\nStarting benchmark...");

    // Use the exposed CLI function from main.ts
    const result = await page.evaluate(({ modelId, task, mode, repeats, device }) => {
      return (window as any).runBenchmarkCLI({ modelId, task, mode, repeats, device });
    }, { modelId, task, mode, repeats, device });

    console.log("\n" + JSON.stringify(result, null, 2));

  } finally {
    await browser.close();
    await server.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
