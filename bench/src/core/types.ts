export interface BenchmarkOptions {
  modelId: string;
  task: string;
  mode: "warm" | "cold";
  repeats: number;
  dtype?: string;
  batchSize: number;
}

export interface BenchmarkResult {
  platform: string;
  runtime: string;
  model: string;
  task: string;
  mode: string;
  repeats: number;
  batchSize: number;
  dtype?: string;
  metrics?: {
    load_ms: { p50: number; p90: number; raw: number[] };
    first_infer_ms: { p50: number; p90: number; raw: number[] };
    subsequent_infer_ms: { p50: number; p90: number; raw: number[] };
  };
  error?: {
    type: string;
    message: string;
    stage?: "load" | "inference";
  };
  [key: string]: any;
}
