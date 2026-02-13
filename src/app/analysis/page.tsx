"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { getTrades, type Trade } from "../lib/trades";
import { StatCards, type AnalysisStats } from "../components/analysis/StatCards";
import { DistributionCharts } from "../components/analysis/DistributionCharts";
import {
  CumulativePnLChart,
  type CumulativePnLPoint,
} from "../components/analysis/CumulativePnLChart";
import { PerformanceByDayOfMonth } from "../components/analysis/PerformanceByDayOfMonth";
import { MonthlyPerformance } from "../components/analysis/MonthlyPerformance";

type Range = "30D" | "90D" | "All Time";

function filterTradesByRange(trades: Trade[], range: Range): Trade[] {
  if (range === "All Time") return trades;
  const now = Date.now();
  const ms = range === "30D" ? 30 * 24 * 60 * 60 * 1000 : 90 * 24 * 60 * 60 * 1000;
  const cutoff = now - ms;
  return trades.filter((t) => new Date(t.created_at).getTime() >= cutoff);
}

function computeAnalysisStats(trades: Trade[]): AnalysisStats {
  const total = trades.length;
  const wins = trades.filter((t) => t.pnl > 0);
  const losses = trades.filter((t) => t.pnl < 0);
  const winCount = wins.length;
  const lossCount = losses.length;
  const grossProfit = wins.reduce((s, t) => s + t.pnl, 0);
  const grossLoss = Math.abs(losses.reduce((s, t) => s + t.pnl, 0));
  const winRatePct = total > 0 ? (winCount / total) * 100 : 0;
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0;
  const expectancy = total > 0 ? trades.reduce((s, t) => s + t.pnl, 0) / total : 0;

  const sorted = [...trades].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
  let peak = 0;
  let maxDrawdown = 0;
  let cumulative = 0;
  for (const t of sorted) {
    cumulative += t.pnl;
    if (cumulative > peak) peak = cumulative;
    const dd = peak - cumulative;
    if (dd > maxDrawdown) maxDrawdown = dd;
  }

  const pnls = trades.map((t) => t.pnl);
  const mean = pnls.length > 0 ? pnls.reduce((a, b) => a + b, 0) / pnls.length : 0;
  const variance =
    pnls.length > 1
      ? pnls.reduce((s, p) => s + (p - mean) ** 2, 0) / (pnls.length - 1)
      : 0;
  const std = Math.sqrt(variance);
  const sharpe = std > 0 ? mean / std : 0;

  return {
    winRatePct,
    profitFactor,
    expectancy,
    maxDrawdown,
    sharpe,
  };
}

function buildCumulativeData(trades: Trade[]): CumulativePnLPoint[] {
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

function buildDayOfMonthData(trades: Trade[]): { day: number; pnl: number; trades: number; winRate: number }[] {
  const byDay: Record<number, { pnl: number; count: number; wins: number }> = {};
  for (let d = 1; d <= 31; d++) byDay[d] = { pnl: 0, count: 0, wins: 0 };
  for (const t of trades) {
    const day = new Date(t.created_at).getDate();
    byDay[day].pnl += t.pnl;
    byDay[day].count += 1;
    if (t.pnl > 0) byDay[day].wins += 1;
  }
  return Array.from({ length: 31 }, (_, i) => {
    const day = i + 1;
    const x = byDay[day];
    return {
      day,
      pnl: Math.round(x.pnl * 100) / 100,
      trades: x.count,
      winRate: x.count > 0 ? (x.wins / x.count) * 100 : 0,
    };
  });
}

function buildMonthlyData(trades: Trade[]): {
  data: { month: string; shortLabel: string; pnl: number }[];
  bestMonth: string;
  bestPnl: number;
  worstMonth: string;
  worstPnl: number;
} {
  const byMonth: Record<string, number> = {};
  for (const t of trades) {
    const d = new Date(t.created_at);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    byMonth[key] = (byMonth[key] ?? 0) + t.pnl;
  }
  const months = Object.entries(byMonth)
    .map(([key, pnl]) => {
      const [y, m] = key.split("-");
      const date = new Date(parseInt(y, 10), parseInt(m, 10) - 1);
      return {
        month: date.toLocaleDateString("en-US", { month: "long", year: "numeric" }),
        shortLabel: date.toLocaleDateString("en-US", { month: "short" }),
        pnl: Math.round(pnl * 100) / 100,
      };
    })
    .sort((a, b) => a.shortLabel.localeCompare(b.shortLabel));
  if (months.length === 0) {
    return {
      data: [],
      bestMonth: "—",
      bestPnl: 0,
      worstMonth: "—",
      worstPnl: 0,
    };
  }
  const best = months.reduce((a, b) => (b.pnl >= a.pnl ? b : a), months[0]);
  const worst = months.reduce((a, b) => (b.pnl <= a.pnl ? b : a), months[0]);
  return {
    data: months,
    bestMonth: best.shortLabel,
    bestPnl: best.pnl,
    worstMonth: worst.shortLabel,
    worstPnl: worst.pnl,
  };
}

export default function AnalysisPage() {
  const [range, setRange] = React.useState<Range>("All Time");

  const { data: allTrades = [], isLoading } = useQuery({
    queryKey: ["trades", "all"],
    queryFn: () => getTrades({}),
  });

  const trades = React.useMemo(
    () => filterTradesByRange(allTrades, range),
    [allTrades, range]
  );

  const stats = React.useMemo(() => computeAnalysisStats(trades), [trades]);
  const cumulativeData = React.useMemo(() => buildCumulativeData(trades), [trades]);
  const dayOfMonthData = React.useMemo(() => buildDayOfMonthData(trades), [trades]);
  const monthly = React.useMemo(() => buildMonthlyData(trades), [trades]);

  const totalPnl = trades.reduce((s, t) => s + t.pnl, 0);
  const winCount = trades.filter((t) => t.pnl > 0).length;
  const lossCount = trades.filter((t) => t.pnl < 0).length;
  const avgWin = winCount > 0 ? trades.filter((t) => t.pnl > 0).reduce((s, t) => s + t.pnl, 0) / winCount : 0;
  const avgLoss = lossCount > 0 ? trades.filter((t) => t.pnl < 0).reduce((s, t) => s + t.pnl, 0) / lossCount : 0;
  const marketCounts = React.useMemo(() => {
    let crypto = 0, cfd = 0, forex = 0;
    for (const t of trades) {
      if (t.market === "crypto") crypto++;
      else if (t.market === "cfd") cfd++;
      else forex++;
    }
    return { crypto, cfd, forex };
  }, [trades]);
  const largestWin = trades.length > 0 ? Math.max(...trades.filter((t) => t.pnl > 0).map((t) => t.pnl), 0) : 0;
  const largestLoss = trades.length > 0 ? Math.min(...trades.filter((t) => t.pnl < 0).map((t) => t.pnl), 0) : 0;

  return (
    <div className="min-h-screen bg-[#0B0F1A] text-white">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <header className="mb-8 flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-white">Analytics</h1>
            <p className="mt-1 text-sm text-white/60">
              Detailed performance metrics and trading insights
            </p>
          </div>
          <div className="mt-2 flex gap-2 sm:mt-0">
            {(["30D", "90D", "All Time"] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRange(r)}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                  range === r ? "bg-white/10 text-white" : "text-white/60 hover:bg-white/5 hover:text-white"
                }`}
              >
                {r === "30D" ? "30 Days" : r === "90D" ? "90 Days" : "All Time"}
              </button>
            ))}
          </div>
        </header>

        {isLoading ? (
          <div className="py-12 text-center text-white/60">Loading…</div>
        ) : (
          <>
            <section className="mb-8">
              <StatCards stats={stats} />
            </section>

            <section className="mb-8">
              <DistributionCharts
                winCount={winCount}
                lossCount={lossCount}
                avgWin={avgWin}
                avgLoss={avgLoss}
                largestWin={largestWin}
                largestLoss={largestLoss}
                marketCounts={marketCounts}
              />
            </section>

            <section className="mb-8">
              <CumulativePnLChart data={cumulativeData} totalPnl={totalPnl} />
            </section>

            <section className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
              <PerformanceByDayOfMonth data={dayOfMonthData} />
              <MonthlyPerformance
                data={monthly.data}
                bestMonth={monthly.bestMonth}
                bestPnl={monthly.bestPnl}
                worstMonth={monthly.worstMonth}
                worstPnl={monthly.worstPnl}
              />
            </section>

            <section className="rounded-xl border border-white/10 bg-[#121826]/50 px-6 py-4">
              <div className="flex flex-wrap items-center gap-6 text-sm">
                <span className="text-white/80">
                  Total Trades <span className="font-medium text-white">{trades.length}</span>
                </span>
                <span className="text-white/80">
                  Winning Trades <span className="font-medium text-green-400">{winCount}</span>
                </span>
                <span className="text-white/80">
                  Losing Trades <span className="font-medium text-red-400">{lossCount}</span>
                </span>
                <span className="text-white/80">
                  Average Win <span className="font-medium text-green-400">+${avgWin.toFixed(2)}</span>
                </span>
                <span className="text-white/80">
                  Average Loss <span className="font-medium text-red-400">${avgLoss.toFixed(2)}</span>
                </span>
                <span className="text-white/80">
                  Net P&L <span className={`font-medium ${totalPnl >= 0 ? "text-green-400" : "text-red-400"}`}>{totalPnl >= 0 ? "+" : ""}${totalPnl.toFixed(2)}</span>
                </span>
              </div>
            </section>
          </>
        )}

        <footer className="mt-8">
          <Link href="/dashboard" className="text-sm text-white/60 hover:text-white">
            ← Dashboard
          </Link>
        </footer>
      </div>
    </div>
  );
}
