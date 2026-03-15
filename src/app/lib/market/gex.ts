/**
 * GEX (Gamma Exposure) calculations — institutional-style model.
 *
 * Formula per option:
 *   GEX = gamma × open_interest × contract_size × spot_price²
 *   Call GEX: positive. Put GEX: same magnitude, negative.
 *
 * Crypto (Deribit): contract_size = 1 (1 BTC/ETH per contract).
 * Equity: contract_size = 100 when not provided.
 *
 * Aggregate by strike: call_gex_total, put_gex_total, net_gex, plus call_oi, put_oi, total_oi.
 * Key levels: call wall, put wall, zero gamma (with interpolation), vol trigger, strongest +/- strikes.
 */

import type { OptionContract, OptionChainResult } from "./types";
import { calculateGamma, timeToExpiryYears } from "./blackScholes";

/** Equity options default; Deribit crypto uses 1 per contract. */
const DEFAULT_CONTRACT_SIZE = 100;

export type StrikeExposure = {
  strike: number;
  callExposure: number;
  putExposure: number;
  netExposure: number;
  callOi?: number;
  putOi?: number;
  totalOi?: number;
};

export type GammaRegime = "positive" | "negative" | "neutral";

export type GEXResult = {
  spotPrice: number;
  totalGEX: number;
  callGEX: number;
  putGEX: number;
  netGEX: number;
  gammaRegime: GammaRegime;
  zeroGammaLevel: number | null;
  callWall: number | null;
  putWall: number | null;
  strongestPositiveStrike: number | null;
  strongestNegativeStrike: number | null;
  volTrigger: number | null;
  putCallOIRatio: number | null;
  nearestExpirationUsed: string;
  strikeExposures: StrikeExposure[];
  marketSummary: string;
};

/**
 * Resolve gamma for one contract: use provider value or compute via Black-Scholes.
 */
function resolveGamma(c: OptionContract, riskFreeRate: number): number {
  if (c.gamma != null && Number.isFinite(c.gamma) && c.gamma > 0) return c.gamma;
  const timeToExpiry = timeToExpiryYears(c.expiration);
  return calculateGamma({
    spot: c.underlyingPrice,
    strike: c.strike,
    iv: c.impliedVolatility ?? 0.2,
    timeToExpiry,
    riskFreeRate,
  });
}

/**
 * Per-option gamma exposure (institutional formula).
 * GEX = gamma × open_interest × contract_size × spot²
 * Calls: positive. Puts: negative.
 */
function contractGammaExposure(
  c: OptionContract,
  gammaVal: number,
  spotSq: number
): number {
  const size = c.contractSize ?? DEFAULT_CONTRACT_SIZE;
  const raw = gammaVal * c.openInterest * size * spotSq;
  return c.type === "call" ? raw : -raw;
}

/**
 * Compute full GEX metrics from an option chain.
 * Single-pass aggregation by strike; then key levels and zero-gamma with interpolation.
 */
export function computeGEX(
  chain: OptionChainResult,
  options?: { riskFreeRate?: number }
): GEXResult {
  const riskFreeRate = options?.riskFreeRate ?? 0.04;
  const spot = chain.underlyingPrice;
  const spotSq = spot * spot;

  type Acc = { callGex: number; putGex: number; callOi: number; putOi: number };
  const strikeMap = new Map<number, Acc>();
  let totalCallGEX = 0;
  let totalCallOI = 0;
  let totalPutOI = 0;

  for (const c of chain.options) {
    const gammaVal = resolveGamma(c, riskFreeRate);
    const exposure = contractGammaExposure(c, gammaVal, spotSq);
    const oi = c.openInterest;
    const key = c.strike;
    const existing = strikeMap.get(key) ?? { callGex: 0, putGex: 0, callOi: 0, putOi: 0 };

    if (c.type === "call") {
      existing.callGex += exposure;
      existing.callOi += oi;
      totalCallGEX += exposure;
      totalCallOI += oi;
    } else {
      existing.putGex += exposure;
      existing.putOi += oi;
      totalPutOI += oi;
    }
    strikeMap.set(key, existing);
  }

  const strikeExposures: StrikeExposure[] = [...strikeMap.entries()]
    .map(([strike, { callGex, putGex, callOi, putOi }]) => ({
      strike,
      callExposure: callGex,
      putExposure: putGex,
      netExposure: callGex + putGex,
      callOi,
      putOi,
      totalOi: callOi + putOi,
    }))
    .sort((a, b) => a.strike - b.strike);

  const totalPutGEX = strikeExposures.reduce((s, x) => s + x.putExposure, 0);
  const netGEX = totalCallGEX + totalPutGEX;
  const gammaRegime: GammaRegime =
    netGEX > 0 ? "positive" : netGEX < 0 ? "negative" : "neutral";

  // Zero gamma: cumulative net GEX across strikes; interpolate where it crosses zero
  let zeroGammaLevel: number | null = null;
  let running = 0;
  const sorted = strikeExposures;
  for (let i = 0; i < sorted.length; i++) {
    const s = sorted[i];
    const next = running + s.netExposure;
    if (running <= 0 && next > 0) {
      if (next !== running) {
        zeroGammaLevel = s.strike + (sorted[i + 1] != null ? (sorted[i + 1].strike - s.strike) * (0 - running) / (next - running) : 0);
      } else {
        zeroGammaLevel = s.strike;
      }
      break;
    }
    if (running >= 0 && next < 0) {
      if (next !== running) {
        zeroGammaLevel = s.strike + (sorted[i + 1] != null ? (sorted[i + 1].strike - s.strike) * (0 - running) / (next - running) : 0);
      } else {
        zeroGammaLevel = s.strike;
      }
      break;
    }
    running = next;
  }

  // Call wall: strike with maximum call GEX
  let callWall: number | null = null;
  let putWall: number | null = null;
  let strongestPositiveStrike: number | null = null;
  let strongestNegativeStrike: number | null = null;
  if (strikeExposures.length > 0) {
    const byCall = [...strikeExposures].sort((a, b) => b.callExposure - a.callExposure)[0];
    const byPut = [...strikeExposures].sort((a, b) => a.putExposure - b.putExposure)[0];
    const byNetPos = [...strikeExposures].sort((a, b) => b.netExposure - a.netExposure)[0];
    const byNetNeg = [...strikeExposures].sort((a, b) => a.netExposure - b.netExposure)[0];
    callWall = byCall?.strike ?? null;
    putWall = byPut?.strike ?? null;
    strongestPositiveStrike = byNetPos?.strike ?? null;
    strongestNegativeStrike = byNetNeg?.strike ?? null;
  }

  // Vol trigger: largest strike below spot where net GEX < 0
  let volTrigger: number | null = null;
  const belowSpot = strikeExposures.filter((s) => s.strike < spot && s.netExposure < 0);
  if (belowSpot.length > 0) {
    volTrigger = belowSpot.reduce((best, s) => (s.strike > best ? s.strike : best), belowSpot[0].strike);
  }

  const putCallOIRatio = totalCallOI > 0 ? totalPutOI / totalCallOI : null;

  const chainWithLabel = chain as OptionChainResult & { expirationRangeLabel?: string };
  const nearestExpirationUsed =
    chainWithLabel.expirationRangeLabel != null && chainWithLabel.expirationRangeLabel !== ""
      ? chainWithLabel.expirationRangeLabel
      : new Date(chain.nearestExpiration).toISOString().slice(0, 10);

  const marketSummary = [
    `Spot: $${spot.toFixed(2)}`,
    `Net GEX: ${(netGEX / 1e9).toFixed(2)}B`,
    `Regime: ${gammaRegime}`,
    zeroGammaLevel != null ? `Zero gamma ~$${Math.round(zeroGammaLevel).toLocaleString()}` : "",
    callWall != null ? `Call wall $${callWall.toLocaleString()}` : "",
    putWall != null ? `Put wall $${putWall.toLocaleString()}` : "",
    putCallOIRatio != null ? `P/C OI ratio ${putCallOIRatio.toFixed(2)}` : "",
  ]
    .filter(Boolean)
    .join(". ");

  return {
    spotPrice: spot,
    totalGEX: netGEX,
    callGEX: totalCallGEX,
    putGEX: totalPutGEX,
    netGEX,
    gammaRegime,
    zeroGammaLevel,
    callWall,
    putWall,
    strongestPositiveStrike,
    strongestNegativeStrike,
    volTrigger,
    putCallOIRatio,
    nearestExpirationUsed,
    strikeExposures,
    marketSummary,
  };
}
