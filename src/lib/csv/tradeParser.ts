import Papa from "papaparse";
import type { Market, TradeType } from "@/app/lib/trades";

/** Canonical CSV column names (case-insensitive, trimmed). Map flexible headers to these. */
const COLUMN_ALIASES: Record<string, string> = {
  symbol: "symbol",
  type: "type",
  market: "market",
  entry_price: "entry_price",
  "entry price": "entry_price",
  entryprice: "entry_price",
  exit_price: "exit_price",
  "exit price": "exit_price",
  exitprice: "exit_price",
  qty: "qty",
  quantity: "qty",
  fees: "fees",
  pnl: "pnl",
  pnl_percent: "pnl_percent",
  "pnl %": "pnl_percent",
  "pnl percent": "pnl_percent",
  pnlpercent: "pnl_percent",
  notes: "notes",
  date: "date",
  created_at: "date",
  "created at": "date",
  createdat: "date",
};

const VALID_TYPES: TradeType[] = ["long", "short"];
/** Canonical markets after normalization / auto-detect. Only these three are emitted. */
const VALID_MARKETS: Market[] = ["crypto", "forex", "stocks"];

/** Fiat ISO codes for forex detection (3-letter). */
const FIAT_CODES = new Set([
  "USD", "EUR", "GBP", "JPY", "CHF", "CAD", "AUD", "NZD", "NOK", "SEK", "DKK", "PLN", "CZK", "HUF", "RON", "BGN", "TRY", "ZAR", "MXN", "BRL", "CNY", "HKD", "SGD", "INR", "RUB",
]);

/** Quote/stable tokens that indicate crypto pair. */
const CRYPTO_QUOTES = ["USDT", "USDC", "BTC", "ETH", "BNB", "DAI", "FDUSD", "TUSD", "BUSD", "EURT"];

/** Common crypto base tickers (for symbols like BTCUSDT or BTC/USDT). */
const CRYPTO_BASES = ["BTC", "ETH", "SOL", "ADA", "AVAX", "DOGE", "XRP", "DOT", "LTC", "LINK", "TRX", "TON", "MATIC"];

/** Market column value aliases → canonical market. */
const MARKET_ALIASES: Record<string, Market> = {
  forex: "forex", fx: "forex", cfd_fx: "forex", cfd: "forex",
  crypto: "crypto", cryptocurrency: "crypto", spot: "crypto", futures: "crypto",
  stocks: "stocks", stock: "stocks", equities: "stocks", shares: "stocks",
};

export type ParsedTradeRow = {
  symbol: string;
  type: TradeType;
  market: Market;
  entry_price: number;
  exit_price: number;
  qty: number;
  fees: number;
  pnl: number;
  pnl_percent: number;
  notes: string | null;
  date: string | null;
};

export type RowResult =
  | { valid: true; row: ParsedTradeRow; rowIndex: number }
  | { valid: false; rowIndex: number; error: string; raw: Record<string, unknown> };

export type ParseResult = {
  success: boolean;
  error?: string;
  rowResults: RowResult[];
  validRows: ParsedTradeRow[];
  invalidCount: number;
};

function normalizeHeader(h: string): string {
  const trimmed = String(h ?? "").trim().toLowerCase().replace(/\s+/g, " ");
  return COLUMN_ALIASES[trimmed] ?? trimmed;
}

function trimVal(v: unknown): string {
  if (v == null) return "";
  return String(v).trim();
}

/**
 * Robust numeric parsing: allows "1,234.56" (US) and "1.234,56" (EU).
 * Removes thousands separators, normalizes decimal to dot, returns null on unparsable.
 * Optional fields: return null if empty/unparsable. Required fields use this and then
 * check for null / > 0 in validation.
 */
function parseNumberSafe(v: unknown): number | null {
  if (v == null || v === "") return null;
  let s = String(v).trim().replace(/\s+/g, "");
  if (!s) return null;
  const lastDot = s.lastIndexOf(".");
  const lastComma = s.lastIndexOf(",");
  if (lastDot !== -1 && lastComma !== -1) {
    const decimalSep = lastDot > lastComma ? "." : ",";
    const thousandsSep = lastDot > lastComma ? "," : ".";
    s = s.replace(new RegExp(escapeRegex(thousandsSep), "g"), "").replace(decimalSep, ".");
  } else if (lastComma !== -1) {
    s = s.replace(/,/g, ".");
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Normalize type to long/short. Supports: long, short, buy→long, sell→short,
 * b→long, s→short, 1→long, -1→short. Trim + lowercase before mapping.
 */
function normalizeType(s: string): TradeType | null {
  const t = s.toLowerCase().trim();
  if (t === "long" || t === "buy" || t === "b" || t === "1") return "long";
  if (t === "short" || t === "sell" || t === "s" || t === "-1") return "short";
  return null;
}

/**
 * Normalize market from CSV value using aliases. Returns canonical market or null.
 * Does not auto-detect; use inferMarketFromSymbol when value is missing/invalid.
 */
function normalizeMarket(s: string): Market | null {
  const key = s.toLowerCase().trim().replace(/\s+/g, "_");
  return MARKET_ALIASES[key] ?? null;
}

/**
 * Symbol normalization: trim, uppercase, remove spaces, normalize hyphen to slash
 * (e.g. BTC-USDT → BTC/USDT). Does not invent or over-transform symbols.
 */
function normalizeSymbol(s: string): string {
  const t = String(s ?? "").trim().toUpperCase().replace(/\s+/g, "");
  return t.replace(/-/g, "/");
}

/**
 * Infer market from symbol when market column is missing/empty/invalid.
 * Deterministic: 1) forex (6-letter fiat pair or SLASH with both sides fiat),
 * 2) crypto (contains common quote or base ticker), 3) fallback stocks.
 */
function inferMarketFromSymbol(symbol: string): Market {
  const sym = symbol.toUpperCase().replace(/\s+/g, "");
  const hasSlash = sym.includes("/");
  if (hasSlash) {
    const [a, b] = sym.split("/").map((p) => p.trim());
    if (a && b && FIAT_CODES.has(a) && FIAT_CODES.has(b)) return "forex";
  } else if (sym.length === 6) {
    const left = sym.slice(0, 3);
    const right = sym.slice(3, 6);
    if (FIAT_CODES.has(left) && FIAT_CODES.has(right)) return "forex";
  }
  for (const q of CRYPTO_QUOTES) {
    if (sym.includes(q)) return "crypto";
  }
  const base = hasSlash ? sym.split("/")[0]?.trim() ?? sym : sym;
  for (const c of CRYPTO_BASES) {
    if (base === c || base.startsWith(c)) return "crypto";
  }
  return "stocks";
}

function parseDate(v: unknown): string | null {
  const s = trimVal(v);
  if (!s) return null;
  const d = new Date(s);
  return Number.isFinite(d.getTime()) ? d.toISOString() : null;
}

/**
 * Validate a single parsed row. Returns error message or null if valid.
 */
function validateRow(r: ParsedTradeRow): string | null {
  if (!r.symbol || !r.symbol.trim()) return "Missing symbol";
  if (!VALID_TYPES.includes(r.type)) return "Invalid type (use long or short)";
  if (!VALID_MARKETS.includes(r.market)) return "Invalid market (use crypto, forex, or stocks)";
  if (!(r.entry_price > 0)) return "entry_price must be > 0";
  if (!(r.exit_price > 0)) return "exit_price must be > 0";
  if (!(r.qty > 0)) return "qty must be > 0";
  return null;
}

/**
 * Parse CSV string with PapaParse, map headers, trim and convert values,
 * then validate each row. Returns per-row results and list of valid rows.
 */
export function parseTradesCsv(csvString: string): ParseResult {
  const rowResults: RowResult[] = [];
  const validRows: ParsedTradeRow[] = [];

  const parsed = Papa.parse<Record<string, string>>(csvString, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => normalizeHeader(h),
  });

  if (parsed.errors.length > 0) {
    const first = parsed.errors[0];
    return {
      success: false,
      error: first?.message ?? "CSV parse error",
      rowResults: [],
      validRows: [],
      invalidCount: 0,
    };
  }

  const rows = parsed.data as Record<string, string>[];
  if (!rows || rows.length === 0) {
    return {
      success: true,
      error: undefined,
      rowResults: [],
      validRows: [],
      invalidCount: 0,
    };
  }

  const headers = Object.keys(rows[0] ?? {});
  const hasRequired =
    headers.includes("symbol") &&
    headers.includes("type") &&
    headers.includes("entry_price") &&
    headers.includes("exit_price") &&
    headers.includes("qty");

  if (!hasRequired) {
    return {
      success: false,
      error: "Missing required columns. Expected at least: symbol, type, entry_price, exit_price, qty (market is optional, auto-detected from symbol if missing)",
      rowResults: [],
      validRows: [],
      invalidCount: 0,
    };
  }

  for (let i = 0; i < rows.length; i++) {
    const raw = rows[i] ?? {};
    const rowIndex = i + 2; // 1-based + header row
    const rawSymbol = trimVal(raw.symbol);
    const symbol = normalizeSymbol(rawSymbol);

    if (!symbol) {
      rowResults.push({ valid: false, rowIndex, error: "Missing symbol", raw: raw as Record<string, unknown> });
      continue;
    }

    const typeVal = normalizeType(trimVal(raw.type));
    if (typeVal === null) {
      rowResults.push({
        valid: false,
        rowIndex,
        error: "Invalid type",
        raw: raw as Record<string, unknown>,
      });
      continue;
    }

    const marketStr = trimVal(raw.market);
    const marketVal: Market = normalizeMarket(marketStr) ?? inferMarketFromSymbol(symbol);

    const entry_price = parseNumberSafe(raw.entry_price);
    if (entry_price === null || entry_price <= 0) {
      rowResults.push({
        valid: false,
        rowIndex,
        error: entry_price === null ? "Invalid entry_price" : "entry_price must be > 0",
        raw: raw as Record<string, unknown>,
      });
      continue;
    }

    const exit_price = parseNumberSafe(raw.exit_price);
    if (exit_price === null || exit_price <= 0) {
      rowResults.push({
        valid: false,
        rowIndex,
        error: exit_price === null ? "Invalid exit_price" : "exit_price must be > 0",
        raw: raw as Record<string, unknown>,
      });
      continue;
    }

    const qty = parseNumberSafe(raw.qty);
    if (qty === null || qty <= 0) {
      rowResults.push({
        valid: false,
        rowIndex,
        error: qty === null ? "Invalid qty" : "qty must be > 0",
        raw: raw as Record<string, unknown>,
      });
      continue;
    }

    const feesRaw = trimVal(raw.fees);
    const fees = feesRaw === "" ? 0 : (parseNumberSafe(raw.fees) ?? (feesRaw ? null : 0));
    if (fees === null) {
      rowResults.push({ valid: false, rowIndex, error: "Invalid fees", raw: raw as Record<string, unknown> });
      continue;
    }

    const pnlRaw = trimVal(raw.pnl);
    const pnl = pnlRaw === "" ? 0 : (parseNumberSafe(raw.pnl) ?? (pnlRaw ? null : 0));
    if (pnl === null) {
      rowResults.push({ valid: false, rowIndex, error: "Invalid pnl", raw: raw as Record<string, unknown> });
      continue;
    }

    const pnlPercentRaw = trimVal(raw.pnl_percent);
    const pnl_percent = pnlPercentRaw === "" ? 0 : (parseNumberSafe(raw.pnl_percent) ?? (pnlPercentRaw ? null : 0));
    if (pnl_percent === null) {
      rowResults.push({ valid: false, rowIndex, error: "Invalid pnl_percent", raw: raw as Record<string, unknown> });
      continue;
    }

    const notes = trimVal(raw.notes) || null;
    const date = parseDate(raw.date);

    const parsedRow: ParsedTradeRow = {
      symbol,
      type: typeVal,
      market: marketVal,
      entry_price,
      exit_price,
      qty,
      fees,
      pnl,
      pnl_percent,
      notes,
      date,
    };

    const err = validateRow(parsedRow);
    if (err) {
      rowResults.push({ valid: false, rowIndex, error: err, raw: raw as Record<string, unknown> });
      continue;
    }

    rowResults.push({ valid: true, row: parsedRow, rowIndex });
    validRows.push(parsedRow);
  }

  return {
    success: true,
    rowResults,
    validRows,
    invalidCount: rowResults.filter((r) => !r.valid).length,
  };
}
