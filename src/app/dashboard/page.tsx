"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { getTrades, getTradeStats, type Trade } from "../lib/trades";
import { getStartingBalance } from "../lib/settings";
import { StatCards } from "../components/dashboard/StatCards";
import {
  CumulativePnLChart,
  type CumulativePnLPoint,
} from "../components/dashboard/CumulativePnLChart";
import { RecentTrades } from "../components/dashboard/RecentTrades";

type Range = "7D" | "30D" | "90D";

function buildCumulativeData(trades: Trade[], range: Range): CumulativePnLPoint[] {
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
  if (points.length === 0) return [];

  const now = Date.now();
  const ms: Record<Range, number> = { "7D": 7 * 24 * 60 * 60 * 1000, "30D": 30 * 24 * 60 * 60 * 1000, "90D": 90 * 24 * 60 * 60 * 1000 };
  const cutoff = now - ms[range];
  return points.filter((p) => new Date(p.date).getTime() >= cutoff);
}

export default function DashboardPage() {
  const [range, setRange] = React.useState<Range>("90D");
  const [startingBalance, setStartingBalance] = React.useState(0);

  React.useEffect(() => {
    setStartingBalance(getStartingBalance());
  }, []);

  const { data: trades = [], isLoading: tradesLoading } = useQuery({
    queryKey: ["trades", "all"],
    queryFn: () => getTrades({}),
  });

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["tradeStats"],
    queryFn: getTradeStats,
  });

  const totalPnl = stats?.total_pnl ?? 0;
  const totalBalance = startingBalance + totalPnl;
  const winRatePct = stats?.win_rate_pct ?? 0;
  const totalTrades = stats?.total_trades ?? 0;
  const totalFees = stats?.total_fees ?? 0;
  const avgWin = stats?.avg_win ?? null;
  const avgLoss = stats?.avg_loss ?? null;

  const chartData = React.useMemo(
    () => buildCumulativeData(trades, range),
    [trades, range]
  );

  const recentTrades = React.useMemo(() => trades.slice(0, 5), [trades]);

  const isLoading = tradesLoading || statsLoading;

  return (
    <div className="min-h-screen bg-[#0B0F1A] text-white">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <header className="mb-8 flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-white">Dashboard</h1>
            <p className="mt-1 text-sm text-white/60">
              Welcome back! Here&apos;s your trading overview.
            </p>
          </div>
          <div className="mt-2 text-right text-xs text-white/50 sm:mt-0">
            Last updated: {new Date().toLocaleDateString("en-US")}
          </div>
        </header>

        {isLoading ? (
          <div className="py-12 text-center text-white/60">Loading…</div>
        ) : (
          <>
            <section className="mb-8">
              <StatCards
                totalBalance={totalBalance}
                totalPnl={totalPnl}
                winRatePct={winRatePct}
                totalTrades={totalTrades}
                totalFees={totalFees}
                avgWin={avgWin}
                avgLoss={avgLoss}
              />
            </section>

            <section className="mb-8">
              <CumulativePnLChart
                data={chartData}
                range={range}
                onRangeChange={setRange}
              />
            </section>

            <section>
              <RecentTrades trades={recentTrades} />
            </section>
          </>
        )}

        <footer className="mt-8 flex gap-4 text-sm text-white/60">
          <Link href="/analysis" className="hover:text-white">
            Analytics
          </Link>
          <Link href="/trades" className="hover:text-white">
            Trade History
          </Link>
          <Link href="/settings" className="hover:text-white">
            Settings
          </Link>
        </footer>
      </div>
    </div>
  );
}
