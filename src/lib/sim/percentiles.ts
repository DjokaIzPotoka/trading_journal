/**
 * Compute percentile bands across paths for each day index.
 * paths[i] = balance series for path i (same length for all).
 * Uses linear interpolation between indices for percentile values.
 */
export const DEFAULT_FAN_PERCENTILES = [1, 5, 10, 20, 30, 40, 50, 60, 70, 80, 90, 95, 99] as const;

export function percentileAt(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (idx - lo) * (sorted[hi] - sorted[lo]);
}

export type FanSeriesMulti = {
  x: number[];
  bands: Record<number, number[]>;
  centerLine: number[];
  meanSeries: number[];
};

export function computeFanSeries(
  paths: number[][],
  percentiles: number[] = [...DEFAULT_FAN_PERCENTILES]
): FanSeriesMulti {
  if (paths.length === 0) {
    const empty: Record<number, number[]> = {};
    percentiles.forEach((p) => (empty[p] = []));
    return { x: [], bands: empty, centerLine: [], meanSeries: [] };
  }

  const numDays = paths[0].length;
  const x = Array.from({ length: numDays }, (_, i) => i);
  const row: number[] = new Array(paths.length);

  const bands: Record<number, number[]> = {};
  percentiles.forEach((p) => {
    bands[p] = new Array(numDays);
  });

  const meanSeries: number[] = new Array(numDays);

  for (let j = 0; j < numDays; j++) {
    for (let i = 0; i < paths.length; i++) {
      row[i] = paths[i][j] ?? 0;
    }
    row.sort((a, b) => a - b);
    percentiles.forEach((p) => {
      bands[p][j] = percentileAt(row, p);
    });
    meanSeries[j] = row.reduce((s, v) => s + v, 0) / row.length;
  }

  const p50 = percentiles.includes(50) ? bands[50] : new Array(numDays).fill(0);
  return { x, bands, centerLine: p50, meanSeries };
}

/** Legacy type for backward compatibility; use FanSeriesMulti. */
export type FanSeries = {
  x: number[];
  p5: number[];
  p25: number[];
  p50: number[];
  p75: number[];
  p95: number[];
};

export function computeFanSeriesLegacy(paths: number[][]): FanSeries {
  const multi = computeFanSeries(paths, [5, 25, 50, 75, 95]);
  return {
    x: multi.x,
    p5: multi.bands[5],
    p25: multi.bands[25],
    p50: multi.centerLine,
    p75: multi.bands[75],
    p95: multi.bands[95],
  };
}
