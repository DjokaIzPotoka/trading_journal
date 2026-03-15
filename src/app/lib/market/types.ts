/**
 * Market data provider interface.
 * Allows swapping Yahoo for Tradier (or others) without rewriting GEX logic.
 */

export type FuturesQuote = {
  symbol: string;
  price: number;
  previousClose?: number;
  change?: number;
  changePercent?: number;
  currency?: string;
};

export type OptionContract = {
  strike: number;
  type: "call" | "put";
  openInterest: number;
  impliedVolatility: number | null;
  /** Gamma from provider if available; otherwise computed via Black-Scholes */
  gamma: number | null;
  expiration: number; // Unix timestamp
  underlyingPrice: number;
  /** Contract multiplier, default 100 */
  contractSize?: number;
};

export type OptionChainResult = {
  symbol: string;
  underlyingPrice: number;
  expirationDates: number[];
  strikes: number[];
  options: OptionContract[];
  /** Nearest expiration used (Unix ms), or earliest in range for weekly */
  nearestExpiration: number;
  /** When using a range (e.g. weekly), human-readable label for display */
  expirationRangeLabel?: string;
};

export type MarketDataProvider = {
  /** Fetch futures quote (ES=F, NQ=F, GC=F, SI=F) */
  getFuturesQuote(symbol: string): Promise<FuturesQuote | null>;
  /** Fetch option chain for underlying (SPY, QQQ). Used as proxy for ES/NQ GEX. */
  getOptionChain(
    symbol: string,
    options?: { expirationTimestamp?: number }
  ): Promise<OptionChainResult | null>;
  /** List available expiration timestamps for a symbol */
  getOptionExpirations(symbol: string): Promise<number[]>;
};

// ─── Crypto (Binance / Deribit) types ───────────────────────────────────────

export type CryptoAsset = "BTC" | "ETH";

export type BinanceFuturesSnapshot = {
  symbol: string;
  price: number;
  markPrice: number;
  fundingRate: number;
  nextFundingTime: number;
  openInterest: number;
  /** Optional 24h change from history if available */
  openInterestChange24h?: number;
};

export type BinanceOIHistoryPoint = {
  timestamp: number;
  sumOpenInterest: number;
  sumOpenInterestValue: number;
};

export type LiquidationLevel = {
  price: number;
  longLiqWeight: number;
  shortLiqWeight: number;
  totalWeight: number;
  /** 0–1 normalized intensity for heatmap display (optional, set by model). */
  intensity?: number;
};

/** Single bin from the modeled liquidation heatmap (for charting). */
export type LiquidationHeatmapBin = {
  price: number;
  longLiqWeight: number;
  shortLiqWeight: number;
  totalWeight: number;
  /** Normalized intensity 0–1 for heatmap shading. */
  intensity: number;
};

export type LiquidationSummary = {
  levels: LiquidationLevel[];
  /** Bins with intensity for heatmap chart (same price range as levels). */
  bins?: LiquidationHeatmapBin[];
  currentPrice: number;
  strongestDownsideCluster: number | null;
  strongestUpsideCluster: number | null;
  nearestDownsideFlushZone: number | null;
  nearestUpsideSqueezeZone: number | null;
  /** Human-readable bias e.g. "Long crowding" / "Short crowding" / "Balanced". */
  marketBias?: string;
};
