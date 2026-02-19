import type { Market } from "./trades";

/**
 * Symbols per market. Add or remove symbols as needed.
 * Symbol dropdown options are filtered by selected market.
 */
export const SYMBOLS_BY_MARKET: Record<Market, string[]> = {
  crypto: [
    "BTC/USDT",
    "ETH/USDT",
    "SOL/USDT",
    "BNB/USDT",
    "XRP/USDT",
    "ADA/USDT",
    "DOGE/USDT",
    "AVAX/USDT",
    "LINK/USDT",
    "DOT/USDT",
    "MATIC/USDT",
    "UNI/USDT",
    "ATOM/USDT",
    "LTC/USDT",
    "NEAR/USDT",
    "APT/USDT",
    "ARB/USDT",
    "OP/USDT",
    "INJ/USDT",
    "SUI/USDT",
    "TIA/USDT",
    "SEI/USDT",
    "PEPE/USDT",
    "WIF/USDT",
    "FET/USDT",
    "RENDER/USDT",
    // Add more crypto pairs below:
  ],
  cfd: [
    "US100",
    "US500",
    "US30",
    "NQ",
    "ES",
    "YM",
    "XAU/USD",
    "XAG/USD",
    "GER40",
    "UK100",
    "NAS100",
    "SPX500",
    // Add more CFD symbols below:
  ],
  forex: [
    "EUR/USD",
    "GBP/USD",
    "USD/JPY",
    "USD/CHF",
    "AUD/USD",
    "NZD/USD",
    "EUR/GBP",
    "EUR/JPY",
    "GBP/JPY",
    // Add more forex pairs below:
  ],
  stocks: [
    "AAPL",
    "MSFT",
    "GOOGL",
    "AMZN",
    "NVDA",
    "META",
    "TSLA",
    "BRK.B",
    "JPM",
    "V",
    // Add more stock symbols below:
  ],
};

export function getSymbolsForMarket(market: Market): string[] {
  return SYMBOLS_BY_MARKET[market] ?? [];
}
