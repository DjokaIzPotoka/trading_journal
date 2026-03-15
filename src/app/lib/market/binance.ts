/**
 * Binance USD-M Futures public API.
 * Server-side only. No API keys required for read-only market data.
 */

import type { BinanceFuturesSnapshot, BinanceOIHistoryPoint } from "./types";

const BINANCE_BASE =
  process.env.BINANCE_API_BASE || "https://fapi.binance.com";

function toNum(val: unknown): number {
  const n = Number(val);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Map crypto asset to Binance USDT perpetual symbol.
 */
export function binanceSymbolForAsset(asset: "BTC" | "ETH"): string {
  return asset === "BTC" ? "BTCUSDT" : "ETHUSDT";
}

/**
 * Fetch mark price, funding rate, and current price for a symbol.
 */
export async function getBinanceFuturesSnapshot(
  symbol: string
): Promise<BinanceFuturesSnapshot | null> {
  try {
    const [premiumRes, oiRes] = await Promise.all([
      fetch(`${BINANCE_BASE}/fapi/v1/premiumIndex?symbol=${symbol}`),
      fetch(`${BINANCE_BASE}/fapi/v1/openInterest?symbol=${symbol}`),
    ]);
    if (!premiumRes.ok || !oiRes.ok) return null;

    const premium = (await premiumRes.json()) as Record<string, unknown>;
    const oiData = (await oiRes.json()) as Record<string, unknown>;

    const markPrice = toNum(premium.markPrice);
    const price = markPrice || toNum(premium.indexPrice);
    const openInterest = toNum(oiData.openInterest);
    const nextFundingTime = toNum(premium.nextFundingTime);

    return {
      symbol,
      price,
      markPrice,
      fundingRate: toNum(premium.lastFundingRate),
      nextFundingTime,
      openInterest,
    };
  } catch {
    return null;
  }
}

/**
 * Open interest history. Period: 5m, 15m, 30m, 1h, 2h, 4h, 6h, 12h, 1d.
 */
export async function getBinanceOpenInterestHistory(
  symbol: string,
  options?: { period?: "1h" | "4h" | "1d"; limit?: number }
): Promise<BinanceOIHistoryPoint[]> {
  const period = options?.period ?? "1h";
  const limit = Math.min(Math.max(options?.limit ?? 24, 1), 500);
  try {
    const url = `${BINANCE_BASE}/futures/data/openInterestHist?symbol=${symbol}&period=${period}&limit=${limit}`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const arr = (await res.json()) as Array<Record<string, unknown>>;
    return arr.map((row) => ({
      timestamp: toNum(row.timestamp),
      sumOpenInterest: toNum(row.sumOpenInterest),
      sumOpenInterestValue: toNum(row.sumOpenInterestValue),
    }));
  } catch {
    return [];
  }
}

/**
 * Funding rate history (optional; for context).
 */
export async function getBinanceFundingHistory(
  symbol: string,
  options?: { limit?: number }
): Promise<Array<{ fundingTime: number; fundingRate: number }>> {
  const limit = Math.min(Math.max(options?.limit ?? 24, 1), 1000);
  try {
    const res = await fetch(
      `${BINANCE_BASE}/fapi/v1/fundingRate?symbol=${symbol}&limit=${limit}`
    );
    if (!res.ok) return [];
    const arr = (await res.json()) as Array<Record<string, unknown>>;
    return arr.map((row) => ({
      fundingTime: toNum(row.fundingTime),
      fundingRate: toNum(row.fundingRate),
    }));
  } catch {
    return [];
  }
}
