/**
 * Sample a subset of paths for display (e.g. spaghetti chart).
 * If highlight path is provided, it is always included and not counted in sampleSize.
 */
export function samplePaths(
  paths: number[][],
  sampleSize: number,
  options?: { highlight?: number[]; rng?: () => number }
): number[][] {
  if (paths.length === 0) return [];
  if (paths.length <= sampleSize && !options?.highlight) return [...paths];

  const rng = options?.rng ?? Math.random;
  const highlight = options?.highlight;

  let excludeIdx = -1;
  if (highlight !== undefined) {
    excludeIdx = paths.findIndex(
      (p) =>
        p.length === highlight.length &&
        p.every((v, i) => v === highlight[i])
    );
  }

  const pool: number[] = [];
  for (let i = 0; i < paths.length; i++) {
    if (i !== excludeIdx) pool.push(i);
  }

  const need = Math.min(
    highlight !== undefined ? sampleSize - 1 : sampleSize,
    pool.length
  );

  for (let k = 0; k < need; k++) {
    const pick = k + Math.floor(rng() * (pool.length - k));
    [pool[k], pool[pick]] = [pool[pick], pool[k]];
  }

  const result: number[][] = [];
  if (highlight !== undefined) result.push(highlight);
  for (let k = 0; k < need; k++) result.push(paths[pool[k]]);
  return result;
}
