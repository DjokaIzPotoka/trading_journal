import type { Trade } from "@/app/lib/trades";

export type MarketFilter = "all" | "crypto" | "stocks";

/**
 * Filter trades by global market filter.
 * "crypto" => market === "crypto"
 * "stocks" => market === "stocks"
 * "all" => all trades (crypto, stocks, forex, cfd, etc.)
 */
export function filterTradesByMarket(
  trades: Trade[],
  marketFilter: MarketFilter
): Trade[] {
  if (marketFilter === "all") return trades;
  if (marketFilter === "crypto") return trades.filter((t) => t.market === "crypto");
  return trades.filter((t) => t.market === "stocks");
}

export type CumulativePnLPoint = {
  date: string;
  cumulativePnl: number;
  displayDate: string;
};

/**
 * Compute cumulative P&L series from trades (sorted by created_at ascending).
 */
export function computeCumulativePnL(trades: Trade[]): CumulativePnLPoint[] {
  const sorted = [...trades].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
  let cumulative = 0;
  const points: CumulativePnLPoint[] = [];
  for (const t of sorted) {
    cumulative += t.pnl;
    const d = new Date(t.created_at);
    points.push({
      date: d.toISOString(),
      cumulativePnl: Math.round(cumulative * 100) / 100,
      displayDate: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    });
  }
  return points;
}

export type BalancePoint = {
  date: string;
  balance: number;
  displayDate: string;
};

/**
 * Compute balance series: startingBalance + cumulative P&L at each trade date.
 * Empty trades => single point at startingBalance (use "now" as date for display).
 */
export function computeBalanceSeries(
  trades: Trade[],
  startingBalance: number
): BalancePoint[] {
  const cumulative = computeCumulativePnL(trades);
  if (cumulative.length === 0) {
    const d = new Date();
    return [
      {
        date: d.toISOString(),
        balance: startingBalance,
        displayDate: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      },
    ];
  }
  return cumulative.map((p) => ({
    date: p.date,
    balance: Math.round((startingBalance + p.cumulativePnl) * 100) / 100,
    displayDate: p.displayDate,
  }));
}

/** Stats derived from a list of trades (for use when filter is crypto/stocks). */
export function computeStatsFromTrades(trades: Trade[]): {
  total_pnl: number;
  total_trades: number;
  total_fees: number;
  win_rate_pct: number | null;
  avg_win: number | null;
  avg_loss: number | null;
} {
  const total_trades = trades.length;
  const total_pnl = trades.reduce((s, t) => s + t.pnl, 0);
  const total_fees = trades.reduce((s, t) => s + t.fees, 0);
  const wins = trades.filter((t) => t.pnl > 0);
  const losses = trades.filter((t) => t.pnl < 0);
  const win_rate_pct =
    total_trades > 0 ? (wins.length / total_trades) * 100 : null;
  const avg_win = wins.length > 0 ? wins.reduce((s, t) => s + t.pnl, 0) / wins.length : null;
  const avg_loss =
    losses.length > 0
      ? Math.abs(losses.reduce((s, t) => s + t.pnl, 0) / losses.length)
      : null;
  return {
    total_pnl,
    total_trades,
    total_fees,
    win_rate_pct: win_rate_pct ?? 0,
    avg_win,
    avg_loss,
  };
}
