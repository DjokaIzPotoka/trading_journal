import type { Trade } from "@/app/lib/trades";

export type ReportMetrics = {
  netPnl: number;
  totalTrades: number;
  wins: number;
  losses: number;
  winRate: number;
  grossProfit: number;
  grossLoss: number;
  profitFactor: number;
  expectancy: number;
  bestTrade: number;
  worstTrade: number;
};

export type CumulativePoint = {
  date: string;
  cumulativePnl: number;
  displayDate: string;
};

/** Trade date for sorting/filtering (uses created_at; no exit_time in schema) */
function tradeDate(t: Trade): Date {
  return new Date(t.created_at);
}

export function computeReportMetrics(trades: Trade[]): ReportMetrics {
  const totalTrades = trades.length;
  const netPnl = trades.reduce((s, t) => s + t.pnl, 0);
  const wins = trades.filter((t) => t.pnl > 0).length;
  const losses = trades.filter((t) => t.pnl < 0).length;
  const winRate = totalTrades > 0 ? (wins / totalTrades) * 100 : 0;
  const grossProfit = trades.filter((t) => t.pnl > 0).reduce((s, t) => s + t.pnl, 0);
  const grossLoss = Math.abs(
    trades.filter((t) => t.pnl < 0).reduce((s, t) => s + t.pnl, 0)
  );
  const profitFactor =
    grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0;
  const expectancy = totalTrades > 0 ? netPnl / totalTrades : 0;
  const pnls = trades.map((t) => t.pnl);
  const bestTrade = pnls.length ? Math.max(...pnls) : 0;
  const worstTrade = pnls.length ? Math.min(...pnls) : 0;

  return {
    netPnl,
    totalTrades,
    wins,
    losses,
    winRate,
    grossProfit,
    grossLoss,
    profitFactor: Number.isFinite(profitFactor) ? profitFactor : 0,
    expectancy,
    bestTrade,
    worstTrade,
  };
}

/**
 * Cumulative P&L series sorted by trade date (created_at) ascending.
 */
export function computeCumulativeSeries(trades: Trade[]): CumulativePoint[] {
  const sorted = [...trades].sort(
    (a, b) => tradeDate(a).getTime() - tradeDate(b).getTime()
  );
  let cumulative = 0;
  const points: CumulativePoint[] = [];
  for (const t of sorted) {
    cumulative += t.pnl;
    const d = tradeDate(t);
    points.push({
      date: d.toISOString(),
      cumulativePnl: Math.round(cumulative * 100) / 100,
      displayDate: d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      }),
    });
  }
  return points;
}
