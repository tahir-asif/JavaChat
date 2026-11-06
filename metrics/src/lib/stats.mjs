export function percentile(sortedValues, p) {
  if (sortedValues.length === 0) return null;
  const index = Math.ceil((p / 100) * sortedValues.length) - 1;
  return sortedValues[Math.min(Math.max(index, 0), sortedValues.length - 1)];
}

export function summarize(values) {
  const numbers = values.filter((value) => Number.isFinite(value));
  if (numbers.length === 0) {
    return { count: 0, min: null, p50: null, p95: null, p99: null, max: null, mean: null };
  }
  const sorted = [...numbers].sort((a, b) => a - b);
  const sum = sorted.reduce((acc, value) => acc + value, 0);
  return {
    count: sorted.length,
    min: round(sorted[0]),
    p50: round(percentile(sorted, 50)),
    p95: round(percentile(sorted, 95)),
    p99: round(percentile(sorted, 99)),
    max: round(sorted[sorted.length - 1]),
    mean: round(sum / sorted.length)
  };
}

export function round(value) {
  return typeof value === 'number' ? Math.round(value * 100) / 100 : value;
}

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
