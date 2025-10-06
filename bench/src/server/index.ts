import { Hono } from "hono";
import { cors } from "hono/cors";
import { serve } from "@hono/node-server";
import { BenchmarkQueue, BenchmarkRequest } from "./queue.js";
import { BenchmarkStorage } from "./storage.js";
import { randomUUID } from "crypto";

const app = new Hono();
const queue = new BenchmarkQueue();
const storage = new BenchmarkStorage();

// Enable CORS for development
app.use("/*", cors());

// Store completed benchmarks to file
queue.on("completed", async (benchmark) => {
  try {
    await storage.appendResult(benchmark);
    console.log(`✓ Benchmark ${benchmark.id} saved to file`);
  } catch (error) {
    console.error(`✗ Failed to save benchmark ${benchmark.id}:`, error);
  }
});

queue.on("failed", async (benchmark) => {
  try {
    await storage.appendResult(benchmark);
    console.log(`✗ Failed benchmark ${benchmark.id} saved to file`);
  } catch (error) {
    console.error(`✗ Failed to save failed benchmark ${benchmark.id}:`, error);
  }
});

// Log queue events
queue.on("added", (benchmark) => {
  console.log(`📥 Added to queue: ${benchmark.id} (${benchmark.platform}/${benchmark.modelId})`);
});

queue.on("started", (benchmark) => {
  console.log(`🚀 Started: ${benchmark.id}`);
});

queue.on("completed", (benchmark) => {
  console.log(`✅ Completed: ${benchmark.id} in ${(benchmark.completedAt! - benchmark.startedAt!) / 1000}s`);
});

queue.on("failed", (benchmark) => {
  console.log(`❌ Failed: ${benchmark.id} - ${benchmark.error}`);
});

// API Endpoints

/**
 * POST /api/benchmark
 * Submit a new benchmark request
 */
app.post("/api/benchmark", async (c) => {
  const body = await c.req.json();
  const {
    platform = "node",
    modelId,
    task,
    mode = "warm",
    repeats = 3,
    dtype,
    batchSize = 1,
    device = "webgpu",
    browser = "chromium",
    headed = false,
  } = body;

  if (!modelId || !task) {
    return c.json({ error: "modelId and task are required" }, 400);
  }

  const request: BenchmarkRequest = {
    id: randomUUID(),
    platform,
    modelId,
    task,
    mode,
    repeats,
    dtype,
    batchSize,
    device,
    browser,
    headed,
    timestamp: Date.now(),
  };

  queue.addBenchmark(request);

  return c.json({
    id: request.id,
    message: "Benchmark queued",
    position: queue.getQueueStatus().pending,
  });
});

/**
 * GET /api/benchmark/:id
 * Get benchmark status/result by ID
 */
app.get("/api/benchmark/:id", async (c) => {
  const id = c.req.param("id");

  // Check queue first (for pending/running benchmarks)
  const queued = queue.getBenchmark(id);
  if (queued) {
    return c.json(queued);
  }

  // Check storage (for completed benchmarks)
  const stored = await storage.getResultById(id);
  if (stored) {
    return c.json(stored);
  }

  return c.json({ error: "Benchmark not found" }, 404);
});

/**
 * GET /api/benchmarks
 * Get all benchmark results from storage
 */
app.get("/api/benchmarks", async (c) => {
  const results = await storage.getAllResults();
  return c.json({
    total: results.length,
    results,
  });
});

/**
 * GET /api/queue
 * Get current queue status
 */
app.get("/api/queue", (c) => {
  const status = queue.getQueueStatus();
  const allBenchmarks = queue.getAllBenchmarks();

  return c.json({
    status,
    queue: allBenchmarks,
  });
});

/**
 * DELETE /api/benchmarks
 * Clear all stored results
 */
app.delete("/api/benchmarks", async (c) => {
  await storage.clearResults();
  return c.json({ message: "All results cleared" });
});

/**
 * GET /
 * Simple status page
 */
app.get("/", (c) => {
  const status = queue.getQueueStatus();
  return c.html(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Benchmark Server</title>
      <style>
        body { font-family: system-ui; max-width: 800px; margin: 2rem auto; padding: 0 1rem; }
        h1 { color: #333; }
        .status { background: #f5f5f5; padding: 1rem; border-radius: 4px; margin: 1rem 0; }
        .endpoint { background: #fff; border: 1px solid #ddd; padding: 0.5rem; margin: 0.5rem 0; border-radius: 4px; }
        .method { display: inline-block; width: 60px; font-weight: bold; color: #0066cc; }
        code { background: #f0f0f0; padding: 2px 6px; border-radius: 3px; }
      </style>
    </head>
    <body>
      <h1>🚀 Transformers.js Benchmark Server</h1>

      <div class="status">
        <h2>Queue Status</h2>
        <p>Pending: ${status.pending} | Running: ${status.running} | Completed: ${status.completed} | Failed: ${status.failed}</p>
      </div>

      <h2>API Endpoints</h2>

      <div class="endpoint">
        <span class="method">POST</span> <code>/api/benchmark</code> - Submit benchmark request
      </div>

      <div class="endpoint">
        <span class="method">GET</span> <code>/api/benchmark/:id</code> - Get benchmark status/result
      </div>

      <div class="endpoint">
        <span class="method">GET</span> <code>/api/benchmarks</code> - Get all stored results
      </div>

      <div class="endpoint">
        <span class="method">GET</span> <code>/api/queue</code> - Get queue status
      </div>

      <div class="endpoint">
        <span class="method">DELETE</span> <code>/api/benchmarks</code> - Clear all results
      </div>

      <h2>Example Request</h2>
      <pre style="background: #f5f5f5; padding: 1rem; border-radius: 4px; overflow-x: auto;">
curl -X POST http://localhost:3000/api/benchmark \\
  -H "Content-Type: application/json" \\
  -d '{
    "platform": "node",
    "modelId": "Xenova/all-MiniLM-L6-v2",
    "task": "feature-extraction",
    "mode": "warm",
    "repeats": 3,
    "batchSize": 1
  }'
      </pre>
    </body>
    </html>
  `);
});

const PORT = Number(process.env.PORT) || 3000;

serve({
  fetch: app.fetch,
  port: PORT,
}, (info) => {
  console.log(`
🚀 Benchmark Server running on http://localhost:${info.port}

API Endpoints:
  POST   /api/benchmark      - Submit benchmark
  GET    /api/benchmark/:id  - Get result
  GET    /api/benchmarks     - List all results
  GET    /api/queue          - Queue status
  DELETE /api/benchmarks     - Clear results
  `);
});
