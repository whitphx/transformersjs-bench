export function percentile(values: number[], q: number): number {
  const a = [...values].sort((x, y) => x - y);
  const i = (a.length - 1) * q;
  const i0 = Math.floor(i), i1 = Math.ceil(i);
  return i0 === i1 ? a[i0] : a[i0] + (a[i1] - a[i0]) * (i - i0);
}

export interface BenchmarkRawResult {
  load_ms: number;
  first_infer_ms: number;
  subsequent_infer_ms: number[];
}

export interface BenchmarkMetrics {
  load_ms: { p50: number; p90: number; raw: number[] };
  first_infer_ms: { p50: number; p90: number; raw: number[] };
  subsequent_infer_ms: { p50: number; p90: number; raw: number[] };
}

export function aggregateMetrics(results: BenchmarkRawResult[]): BenchmarkMetrics {
  const loads: number[] = [];
  const firsts: number[] = [];
  const subsequents: number[] = [];

  for (const r of results) {
    loads.push(r.load_ms);
    firsts.push(r.first_infer_ms);
    subsequents.push(...r.subsequent_infer_ms);
  }

  return {
    load_ms: {
      p50: +percentile(loads, 0.5).toFixed(1),
      p90: +percentile(loads, 0.9).toFixed(1),
      raw: loads,
    },
    first_infer_ms: {
      p50: +percentile(firsts, 0.5).toFixed(1),
      p90: +percentile(firsts, 0.9).toFixed(1),
      raw: firsts,
    },
    subsequent_infer_ms: {
      p50: +percentile(subsequents, 0.5).toFixed(1),
      p90: +percentile(subsequents, 0.9).toFixed(1),
      raw: subsequents,
    },
  };
}
