"use server";

/**
 * Crypto GEX page data aggregator.
 * Fetches Binance futures, Deribit options, computes GEX and liquidation heatmap.
 * All API and calculation logic is server-side.
 */

import type { CryptoAsset } from "./types";
import type { BinanceFuturesSnapshot, BinanceOIHistoryPoint, LiquidationSummary } from "./types";
import { getBinanceFuturesSnapshot, getBinanceOpenInterestHistory, binanceSymbolForAsset } from "./binance";
import { getDeribitOptionChain, type GEXTimeframe } from "./deribit";
import { buildLiquidationSummary } from "./liquidations";
import { computeGEX, type GEXResult } from "./gex";

const RISK_FREE_RATE = Number(process.env.RISK_FREE_RATE) || 0.04;
const DEFAULT_CRYPTO_GEX_ASSET = (process.env.DEFAULT_CRYPTO_GEX_ASSET || "BTC") as CryptoAsset;

export type CryptoGexPagePayload = {
  asset: CryptoAsset;
  lastUpdated: string;
  /** Binance futures context */
  futures: BinanceFuturesSnapshot | null;
  oiHistory: BinanceOIHistoryPoint[];
  /** Deribit options GEX */
  gex: GEXResult | null;
  /** Estimated liquidation heatmap (modeled) */
  liquidationSummary: LiquidationSummary | null;
  /** Partial failure messages; page can still render. */
  errors: string[];
};

/**
 * Build a short market summary from GEX + futures (rules-based).
 */
function buildCryptoMarketSummary(
  gex: GEXResult | null,
  futures: BinanceFuturesSnapshot | null
): string {
  const parts: string[] = [];
  if (futures) {
    parts.push(`Funding ${(futures.fundingRate * 100).toFixed(4)}%`);
    if (futures.openInterestChange24h != null) {
      const dir = futures.openInterestChange24h >= 0 ? "expanding" : "contracting";
      parts.push(`OI ${dir}`);
    }
  }
  if (gex) {
    parts.push(`Net GEX ${gex.gammaRegime}`);
    if (gex.zeroGammaLevel != null) parts.push(`Zero gamma ~$${gex.zeroGammaLevel.toLocaleString()}`);
    if (gex.callWall != null) parts.push(`Call wall $${gex.callWall.toLocaleString()}`);
    if (gex.putWall != null) parts.push(`Put wall $${gex.putWall.toLocaleString()}`);
  }
  if (parts.length === 0) return "Insufficient data for summary.";
  return parts.join(". ");
}

/**
 * Fetch and aggregate all data for the Crypto GEX page.
 * timeframe: "daily" = nearest expiry only; "weekly" = aggregate expirations within next 7 days.
 */
export async function getCryptoGexPageData(
  asset: CryptoAsset = DEFAULT_CRYPTO_GEX_ASSET,
  options?: { timeframe?: GEXTimeframe }
): Promise<CryptoGexPagePayload> {
  const errors: string[] = [];
  const symbol = binanceSymbolForAsset(asset);
  const timeframe = options?.timeframe ?? "daily";

  const [futuresResult, oiHistResult, chainResult] = await Promise.allSettled([
    getBinanceFuturesSnapshot(symbol),
    getBinanceOpenInterestHistory(symbol, { period: "1h", limit: 24 }),
    getDeribitOptionChain(asset, { timeframe }),
  ]);

  let futures: BinanceFuturesSnapshot | null = null;
  if (futuresResult.status === "fulfilled") {
    futures = futuresResult.value;
  } else {
    errors.push("Binance futures unavailable.");
  }

  let oiHistory: BinanceOIHistoryPoint[] = [];
  if (oiHistResult.status === "fulfilled") {
    oiHistory = oiHistResult.value;
  }
  if (futures && oiHistory.length >= 2) {
    const now = oiHistory[oiHistory.length - 1];
    const prev = oiHistory[oiHistory.length - 2];
    if (now && prev) {
      futures = {
        ...futures,
        openInterestChange24h: now.sumOpenInterest - prev.sumOpenInterest,
      };
    }
  }

  let gex: GEXResult | null = null;
  if (chainResult.status === "fulfilled" && chainResult.value) {
    try {
      gex = computeGEX(chainResult.value, { riskFreeRate: RISK_FREE_RATE });
      gex = {
        ...gex,
        marketSummary: buildCryptoMarketSummary(gex, futures),
      };
    } catch (e) {
      errors.push(e instanceof Error ? e.message : "GEX calculation failed.");
    }
  } else {
    errors.push("Deribit options data unavailable.");
  }

  let liquidationSummary: LiquidationSummary | null = null;
  if (futures && futures.openInterest > 0 && futures.markPrice > 0) {
    try {
      const longShortRatio =
        futures.fundingRate > 0 ? 0.55 : futures.fundingRate < 0 ? 0.45 : 0.5;
      liquidationSummary = buildLiquidationSummary({
        spotPrice: futures.markPrice,
        openInterest: futures.openInterest,
        longShortRatio,
        fundingRate: futures.fundingRate,
      });
    } catch {
      errors.push("Liquidation model unavailable.");
    }
  }

  return {
    asset,
    lastUpdated: new Date().toISOString(),
    futures,
    oiHistory,
    gex,
    liquidationSummary,
    errors,
  };
}
