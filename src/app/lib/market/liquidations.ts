/**
 * Modeled liquidation heatmap / pressure engine.
 * NOT exact exchange data — clearly labeled as estimated/modeled.
 *
 * Uses: current price, OI, funding, long/short bias, weighted leverage buckets,
 * Gaussian-like entry distribution, price binning, intensity and light smoothing.
 */

import type {
  LiquidationLevel,
  LiquidationHeatmapBin,
  LiquidationSummary,
} from "./types";

// ─── Leverage buckets: realistic distribution (more weight on lower leverage) ───
const LEVERAGE_BUCKETS: { leverage: number; weight: number }[] = [
  { leverage: 5, weight: 0.28 },
  { leverage: 10, weight: 0.26 },
  { leverage: 20, weight: 0.2 },
  { leverage: 25, weight: 0.12 },
  { leverage: 50, weight: 0.09 },
  { leverage: 100, weight: 0.05 },
];

/** Gaussian-like weights for entry zones -5% to +5% (11 zones). Centered near spot. */
function getEntryZoneWeights(): number[] {
  const zones = 11;
  const sigma = 2.2;
  const weights: number[] = [];
  let sum = 0;
  for (let i = 0; i < zones; i++) {
    const x = (i - (zones - 1) / 2) / ((zones - 1) / 2);
    const w = Math.exp(-0.5 * (x * sigma) ** 2);
    weights.push(w);
    sum += w;
  }
  return weights.map((w) => w / sum);
}

function getEntryZoneCenters(spot: number): number[] {
  const out: number[] = [];
  for (let i = -5; i <= 5; i++) {
    out.push(spot * (1 + (i / 100)));
  }
  return out;
}

/** Long liquidation price: below entry. Isolated margin style. */
function longLiquidationPrice(entryPrice: number, leverage: number): number {
  const maintenanceFraction = 0.9 / leverage;
  return entryPrice * (1 - maintenanceFraction);
}

/** Short liquidation price: above entry. */
function shortLiquidationPrice(entryPrice: number, leverage: number): number {
  const maintenanceFraction = 0.9 / leverage;
  return entryPrice * (1 + maintenanceFraction);
}

/** Adaptive price step: larger for high-priced assets (e.g. BTC). */
function getPriceStep(spot: number): number {
  if (spot >= 50000) return spot * 0.0015;
  if (spot >= 5000) return spot * 0.002;
  if (spot >= 500) return spot * 0.003;
  return spot * 0.005;
}

export type BuildLiquidationHeatmapParams = {
  spotPrice: number;
  openInterest: number;
  /** 0–1; 0.5 = balanced. >0.5 = more longs. */
  longShortRatio?: number;
  /** Funding rate; positive => longs pay (slightly more long crowding). */
  fundingRate?: number;
  /** Override price step (absolute). */
  priceStep?: number;
  /** Number of bins each side of spot. */
  binsEachSide?: number;
};

/**
 * Build raw bin map: for each (entry zone × leverage × side) add liquidation
 * weight to the appropriate price bin. Uses weighted leverage and Gaussian-like entry.
 */
function buildRawBins(params: BuildLiquidationHeatmapParams): Map<number, { longLiq: number; shortLiq: number }> {
  const {
    spotPrice,
    openInterest,
    longShortRatio = 0.5,
    fundingRate = 0,
    binsEachSide = 120,
  } = params;

  const priceStep = params.priceStep ?? getPriceStep(spotPrice);
  const longShare = Math.max(0.2, Math.min(0.8, longShortRatio + fundingRate * 50));
  const shortShare = 1 - longShare;

  const entryCenters = getEntryZoneCenters(spotPrice);
  const entryWeights = getEntryZoneWeights();
  const binMin = spotPrice - binsEachSide * priceStep;
  const binMax = spotPrice + binsEachSide * priceStep;

  const map = new Map<number, { longLiq: number; shortLiq: number }>();

  function addToBin(price: number, longLiq: number, shortLiq: number): void {
    const key = Math.round(price / priceStep) * priceStep;
    if (key < binMin || key > binMax) return;
    const cur = map.get(key) ?? { longLiq: 0, shortLiq: 0 };
    cur.longLiq += longLiq;
    cur.shortLiq += shortLiq;
    map.set(key, cur);
  }

  for (let z = 0; z < entryCenters.length; z++) {
    const entryPrice = entryCenters[z];
    const zoneWeight = entryWeights[z] ?? 1 / 11;
    const oiInZone = openInterest * zoneWeight;

    for (const { leverage, weight: levWeight } of LEVERAGE_BUCKETS) {
      const longOi = (oiInZone * longShare * levWeight);
      const shortOi = (oiInZone * shortShare * levWeight);
      const severity = 0.7 + 0.3 * Math.min(leverage / 50, 1);

      const longLiqP = longLiquidationPrice(entryPrice, leverage);
      const shortLiqP = shortLiquidationPrice(entryPrice, leverage);

      addToBin(longLiqP, longOi * severity, 0);
      addToBin(shortLiqP, 0, shortOi * severity);
    }
  }

  return map;
}

/** Light 3-point smoothing so adjacent bins form continuous heat. */
function smoothBins(
  map: Map<number, { longLiq: number; shortLiq: number }>,
  priceStep: number
): Map<number, { longLiq: number; shortLiq: number }> {
  const keys = Array.from(map.keys()).sort((a, b) => a - b);
  const out = new Map<number, { longLiq: number; shortLiq: number }>();

  for (let i = 0; i < keys.length; i++) {
    const p = keys[i];
    const prev = map.get(p - priceStep) ?? { longLiq: 0, shortLiq: 0 };
    const cur = map.get(p) ?? { longLiq: 0, shortLiq: 0 };
    const next = map.get(p + priceStep) ?? { longLiq: 0, shortLiq: 0 };
    out.set(p, {
      longLiq: prev.longLiq * 0.2 + cur.longLiq * 0.6 + next.longLiq * 0.2,
      shortLiq: prev.shortLiq * 0.2 + cur.shortLiq * 0.6 + next.shortLiq * 0.2,
    });
  }
  return out;
}

/**
 * Build estimated liquidation levels with intensity (for tables and compatibility).
 */
export function buildLiquidationHeatmap(
  params: BuildLiquidationHeatmapParams
): LiquidationLevel[] {
  const { spotPrice } = params;
  const priceStep = params.priceStep ?? getPriceStep(spotPrice);
  const raw = buildRawBins(params);
  const smoothed = smoothBins(raw, priceStep);

  const levels: LiquidationLevel[] = [];
  const maxTotal = Math.max(
    1,
    ...Array.from(smoothed.values()).map((v) => v.longLiq + v.shortLiq)
  );

  for (const [price, { longLiq, shortLiq }] of smoothed.entries()) {
    const total = longLiq + shortLiq;
    levels.push({
      price,
      longLiqWeight: longLiq,
      shortLiqWeight: shortLiq,
      totalWeight: total,
      intensity: total / maxTotal,
    });
  }
  levels.sort((a, b) => a.price - b.price);
  return levels;
}

/**
 * Build heatmap bins with intensity for charting (dense, continuous pressure).
 */
export function buildLiquidationHeatmapBins(
  params: BuildLiquidationHeatmapParams
): LiquidationHeatmapBin[] {
  const { spotPrice } = params;
  const priceStep = params.priceStep ?? getPriceStep(spotPrice);
  const raw = buildRawBins(params);
  const smoothed = smoothBins(raw, priceStep);

  const maxTotal = Math.max(
    1,
    ...Array.from(smoothed.values()).map((v) => v.longLiq + v.shortLiq)
  );

  const bins: LiquidationHeatmapBin[] = [];
  for (const [price, { longLiq, shortLiq }] of smoothed.entries()) {
    const total = longLiq + shortLiq;
    bins.push({
      price,
      longLiqWeight: longLiq,
      shortLiqWeight: shortLiq,
      totalWeight: total,
      intensity: Math.min(1, total / maxTotal),
    });
  }
  bins.sort((a, b) => a.price - b.price);
  return bins;
}

/**
 * Find strongest downside cluster (max long liq below spot) and strongest upside (max short liq above spot).
 */
export function findStrongestLiquidationClusters(
  levels: LiquidationLevel[],
  spotPrice: number
): {
  strongestDownsideCluster: number | null;
  strongestUpsideCluster: number | null;
} {
  const below = levels.filter((l) => l.price < spotPrice);
  const above = levels.filter((l) => l.price > spotPrice);
  const maxLong = (a: LiquidationLevel, b: LiquidationLevel) =>
    a.longLiqWeight >= b.longLiqWeight ? a : b;
  const maxShort = (a: LiquidationLevel, b: LiquidationLevel) =>
    a.shortLiqWeight >= b.shortLiqWeight ? a : b;
  return {
    strongestDownsideCluster: below.length > 0 ? below.reduce(maxLong).price : null,
    strongestUpsideCluster: above.length > 0 ? above.reduce(maxShort).price : null,
  };
}

/** Alias for compatibility. */
export const findTopLiquidationClusters = findStrongestLiquidationClusters;

/**
 * Nearest downside flush: below spot, within band, max long liquidation.
 */
export function findNearestDownsideFlush(
  levels: LiquidationLevel[],
  spotPrice: number,
  bandPct = 0.08
): number | null {
  const low = spotPrice * (1 - bandPct);
  const below = levels.filter((l) => l.price < spotPrice && l.price >= low);
  if (below.length === 0) return null;
  return below.reduce((best, l) => (l.longLiqWeight >= best.longLiqWeight ? l : best)).price;
}

/**
 * Nearest upside squeeze: above spot, within band, max short liquidation.
 */
export function findNearestUpsideSqueeze(
  levels: LiquidationLevel[],
  spotPrice: number,
  bandPct = 0.08
): number | null {
  const high = spotPrice * (1 + bandPct);
  const above = levels.filter((l) => l.price > spotPrice && l.price <= high);
  if (above.length === 0) return null;
  return above.reduce((best, l) => (l.shortLiqWeight >= best.shortLiqWeight ? l : best)).price;
}

/**
 * Full pressure summary: nearest flush below, nearest squeeze above.
 */
export function summarizeLiquidationPressure(
  levels: LiquidationLevel[],
  spotPrice: number
): {
  nearestDownsideFlushZone: number | null;
  nearestUpsideSqueezeZone: number | null;
} {
  return {
    nearestDownsideFlushZone: findNearestDownsideFlush(levels, spotPrice),
    nearestUpsideSqueezeZone: findNearestUpsideSqueeze(levels, spotPrice),
  };
}

function getMarketBias(longShortRatio: number, fundingRate: number): string {
  if (longShortRatio >= 0.6 && fundingRate > 0.0001) return "Long crowding";
  if (longShortRatio <= 0.4 && fundingRate < -0.0001) return "Short crowding";
  if (longShortRatio >= 0.55) return "Slightly long";
  if (longShortRatio <= 0.45) return "Slightly short";
  return "Balanced";
}

/**
 * Full summary: levels, bins (with intensity), clusters, nearest zones, market bias.
 */
export function buildLiquidationSummary(
  params: BuildLiquidationHeatmapParams
): LiquidationSummary {
  const { spotPrice, longShortRatio = 0.5, fundingRate = 0 } = params;
  const levels = buildLiquidationHeatmap(params);
  const bins = buildLiquidationHeatmapBins(params);
  const clusters = findStrongestLiquidationClusters(levels, spotPrice);
  const nearest = summarizeLiquidationPressure(levels, spotPrice);

  return {
    levels,
    bins,
    currentPrice: spotPrice,
    strongestDownsideCluster: clusters.strongestDownsideCluster,
    strongestUpsideCluster: clusters.strongestUpsideCluster,
    nearestDownsideFlushZone: nearest.nearestDownsideFlushZone,
    nearestUpsideSqueezeZone: nearest.nearestUpsideSqueezeZone,
    marketBias: getMarketBias(longShortRatio, fundingRate),
  };
}
