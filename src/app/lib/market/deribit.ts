/**
 * Deribit options API (public endpoints).
 * Server-side only. No API keys required for market data.
 */

import type { OptionContract, OptionChainResult } from "./types";
import type { CryptoAsset } from "./types";

const DERIBIT_BASE =
  process.env.DERIBIT_API_BASE || "https://www.deribit.com/api/v2";

type DeribitRpcRequest = {
  jsonrpc: string;
  method: string;
  params: Record<string, unknown>;
  id: number;
};

type DeribitRpcResponse<T = unknown> = {
  result?: T;
  error?: { code: number; message: string };
};

function toNum(val: unknown): number {
  const n = Number(val);
  return Number.isFinite(n) ? n : 0;
}

async function deribitRequest<T = unknown>(
  method: string,
  params: Record<string, unknown>
): Promise<T | null> {
  try {
    const body: DeribitRpcRequest = {
      jsonrpc: "2.0",
      method,
      params,
      id: Math.floor(Math.random() * 1e6),
    };
    const res = await fetch(DERIBIT_BASE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await res.json()) as DeribitRpcResponse<T>;
    if (!res.ok) return null;
    if (data.error) return null;
    return data.result ?? null;
  } catch {
    return null;
  }
}

type DeribitInstrument = {
  instrument_name?: string;
  strike?: number;
  expiration_timestamp?: number;
  kind?: string;
  [key: string]: unknown;
};

type DeribitBookSummary = {
  instrument_name?: string;
  open_interest?: number;
  mark_iv?: number;
  [key: string]: unknown;
};

/**
 * Parse instrument name "BTC-28MAR25-100000-C" -> { strike, expiry, type }.
 */
function parseInstrumentName(
  name: string,
  currency: string
): { strike: number; expirationMs: number; type: "call" | "put" } | null {
  const parts = name.split("-");
  if (parts.length < 4) return null;
  const [cur, dateStr, strikeStr, typeStr] = parts;
  if (cur !== currency) return null;
  const strike = toNum(strikeStr);
  if (!Number.isFinite(strike) || strike <= 0) return null;
  const type = typeStr?.toUpperCase() === "C" ? "call" : "put";
  const expirationMs = parseDeribitDate(dateStr);
  return { strike, expirationMs, type };
}

/** Parse "28MAR25" -> Unix ms. */
function parseDeribitDate(dateStr: string): number {
  if (!dateStr || dateStr.length < 7) return Date.now() + 86400 * 7 * 1000;
  const day = parseInt(dateStr.slice(0, 2), 10);
  const monthStr = dateStr.slice(2, 5).toUpperCase();
  const yearStr = dateStr.slice(5, 9);
  const year = parseInt(yearStr, 10) || new Date().getFullYear();
  const months: Record<string, number> = {
    JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5,
    JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11,
  };
  const month = months[monthStr] ?? 0;
  const d = new Date(year, month, Math.min(day, 28));
  return d.getTime();
}

/**
 * Get list of option instruments for a currency.
 */
export async function getDeribitInstruments(
  currency: string,
  kind: "option" | "future" = "option"
): Promise<DeribitInstrument[]> {
  const result = await deribitRequest<DeribitInstrument[]>(
    "public/get_instruments",
    { currency, kind }
  );
  return Array.isArray(result) ? result : [];
}

/**
 * Get book summary (open interest, optional mark_iv) for all options in a currency.
 */
export async function getDeribitBookSummaryByCurrency(
  currency: string,
  kind: "option" | "future" = "option"
): Promise<DeribitBookSummary[]> {
  const result = await deribitRequest<DeribitBookSummary[]>(
    "public/get_book_summary_by_currency",
    { currency, kind }
  );
  return Array.isArray(result) ? result : [];
}

/**
 * Get index price for currency (BTC or ETH) for underlying price.
 */
export async function getDeribitIndexPrice(currency: string): Promise<number> {
  const result = await deribitRequest<{ index_price?: number }>(
    "public/get_index_price",
    { index_name: `${currency.toLowerCase()}_usd` }
  );
  if (result && typeof result === "object" && "index_price" in result)
    return toNum((result as { index_price?: number }).index_price);
  return 0;
}

/**
 * Nearest expiry (Unix ms) for an asset from instruments.
 */
export function getNearestDeribitExpiry(
  instruments: DeribitInstrument[],
  currency: string
): number {
  const now = Date.now();
  let nearest = 0;
  for (const inst of instruments) {
    const name = String(inst.instrument_name ?? "");
    const parsed = parseInstrumentName(name, currency);
    if (!parsed) continue;
    if (parsed.expirationMs >= now && (nearest === 0 || parsed.expirationMs < nearest))
      nearest = parsed.expirationMs;
  }
  return nearest;
}

/** Timeframe for GEX: daily = nearest expiry only; weekly = aggregate next 7 days. */
export type GEXTimeframe = "daily" | "weekly";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Build option chain for GEX: normalize Deribit data to OptionContract[] and OptionChainResult.
 * Uses book summary for open_interest; expiration from instrument or parsed name.
 * Gamma/IV: use mark_iv from book summary when available, else Black-Scholes with default IV.
 * timeframe: "daily" = nearest expiry only; "weekly" = all expirations within next 7 days (aggregated by strike in GEX).
 */
export async function getDeribitOptionChain(
  asset: CryptoAsset,
  options?: { expirationTimestamp?: number; timeframe?: GEXTimeframe }
): Promise<OptionChainResult | null> {
  const currency = asset;
  const timeframe = options?.timeframe ?? "daily";
  const [instruments, bookSummary, indexPrice] = await Promise.all([
    getDeribitInstruments(currency, "option"),
    getDeribitBookSummaryByCurrency(currency, "option"),
    getDeribitIndexPrice(currency),
  ]);

  const underlyingPrice = indexPrice > 0 ? indexPrice : 0;
  const summaryByInst = new Map<string, DeribitBookSummary>();
  for (const b of bookSummary) {
    const name = String(b.instrument_name ?? "");
    if (name) summaryByInst.set(name, b);
  }

  const contracts: OptionContract[] = [];
  const expirationSet = new Set<number>();
  const strikeSet = new Set<number>();

  for (const inst of instruments) {
    const name = String(inst.instrument_name ?? "");
    const parsed = parseInstrumentName(name, currency);
    if (!parsed) continue;

    const summary = summaryByInst.get(name);
    const openInterest = summary ? toNum(summary.open_interest) : toNum((inst as Record<string, unknown>).open_interest);
    if (openInterest <= 0) continue;

    const expirationMsFromApi = toNum(inst.expiration_timestamp);
    const expirationMs = expirationMsFromApi > 1e12 ? expirationMsFromApi : parsed.expirationMs;
    const expirationSec = Math.floor(expirationMs / 1000);
    expirationSet.add(expirationMs);
    strikeSet.add(parsed.strike);

    const markIv = summary ? toNum(summary.mark_iv) : null;
    const iv =
      markIv != null && markIv > 0 && markIv < 5
        ? markIv
        : markIv != null && markIv >= 5
          ? markIv / 100
          : 0.5;

    contracts.push({
      strike: parsed.strike,
      type: parsed.type,
      openInterest,
      impliedVolatility: iv > 0 ? iv : 0.5,
      gamma: null,
      expiration: expirationSec,
      underlyingPrice: underlyingPrice || 1,
      contractSize: 1,
    });
  }

  if (contracts.length === 0) return null;

  const now = Date.now();
  const expirationDates = Array.from(expirationSet).sort((a, b) => a - b);
  const targetExpiry = options?.expirationTimestamp;
  let filtered = contracts;
  let nearestExpiration = expirationDates[0] ?? now;
  let expirationRangeLabel: string | undefined;

  if (timeframe === "weekly") {
    const weekEnd = now + 7 * MS_PER_DAY;
    filtered = contracts.filter((c) => {
      const expMs = c.expiration * 1000;
      return expMs >= now && expMs <= weekEnd;
    });
    if (filtered.length > 0) {
      const expirationsInRange = [...new Set(filtered.map((c) => c.expiration * 1000))].sort((a, b) => a - b);
      nearestExpiration = expirationsInRange[0] ?? now;
      expirationRangeLabel = "next 7 days";
    } else {
      const futureExpirations = expirationDates.filter((e) => e >= now);
      nearestExpiration = futureExpirations[0] ?? expirationDates[expirationDates.length - 1] ?? now;
      filtered = contracts.filter((c) => (c.expiration * 1000) === nearestExpiration);
      if (filtered.length === 0) filtered = contracts;
    }
  } else if (targetExpiry != null) {
    filtered = contracts.filter((c) => {
      const expMs = c.expiration * 1000;
      return expMs === targetExpiry;
    });
    if (filtered.length > 0) nearestExpiration = targetExpiry;
  } else {
    const futureExpirations = expirationDates.filter((e) => e >= now);
    nearestExpiration = futureExpirations[0] ?? expirationDates[expirationDates.length - 1] ?? now;
    filtered = contracts.filter((c) => {
      const expMs = c.expiration * 1000;
      return expMs === nearestExpiration;
    });
    if (filtered.length === 0) filtered = contracts;
  }

  const strikes = Array.from(strikeSet).sort((a, b) => a - b);

  return {
    symbol: `${currency}-options`,
    underlyingPrice,
    expirationDates: expirationDates.map((ms) => Math.floor(ms / 1000)),
    strikes,
    options: filtered,
    nearestExpiration,
    ...(expirationRangeLabel ? { expirationRangeLabel } : {}),
  };
}

/**
 * Options snapshot for display: get option chain and return metadata (nearest expiry string, etc.).
 */
export async function getDeribitOptionsSnapshot(
  asset: CryptoAsset
): Promise<{
  underlyingPrice: number;
  nearestExpiration: number;
  optionCount: number;
} | null> {
  const chain = await getDeribitOptionChain(asset);
  if (!chain) return null;
  return {
    underlyingPrice: chain.underlyingPrice,
    nearestExpiration: chain.nearestExpiration,
    optionCount: chain.options.length,
  };
}
