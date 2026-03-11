"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { getTrades } from "../../lib/trades";
import { filterTradesByMarket } from "@/lib/tradeFilters";
import { computeReportMetrics } from "@/lib/reportMetrics";
import { useMarketFilter } from "@/store/marketFilterStore";
import {
  getAlerts,
  getDailyInsights,
  type Stats,
  type MarketContext,
  type Alert,
  type Insight,
} from "../../lib/ai";

type NotificationItem = {
  title: string;
  message: string;
  type: string;
  priority?: number;
};

function buildStatsFromTrades(
  totalTrades: number,
  winRatePct: number,
  avgWin: number | null,
  avgLoss: number | null,
  profitFactor: number
): Stats {
  return {
    totalTrades,
    winRate: winRatePct,
    profitFactor,
    avgWin: avgWin ?? 0,
    avgLoss: avgLoss ?? 0,
    maxDrawdown: 0,
    bestSetup: "N/A",
  };
}

const defaultContext: MarketContext = {
  gexRegime: "Unknown",
  nextEvent: "None",
  timeToEvent: "—",
  session: "—",
  dayOfWeek: new Date().toLocaleDateString("en-US", { weekday: "long" }),
};

function SkeletonRow() {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2.5">
      <div className="h-4 w-2/3 animate-pulse rounded bg-white/10" />
      <div className="h-3 w-full animate-pulse rounded bg-white/5" />
    </div>
  );
}

function getCardStyles(type: string): string {
  const t = type.toUpperCase();
  const base =
    "rounded-xl border transition-colors duration-200 ease-out " +
    "px-4 py-3.5 " +
    "hover:border-opacity-40 ";
  if (t === "EDGE" || t === "OK")
    return base + "bg-emerald-500/[0.08] border-emerald-500/25 ring-1 ring-emerald-500/10";
  if (t === "WARN")
    return base + "bg-amber-500/[0.08] border-amber-500/25 ring-1 ring-amber-500/10";
  if (t === "PATTERN")
    return base + "bg-blue-500/[0.08] border-blue-500/25 ring-1 ring-blue-500/10";
  if (t === "RISK" || t === "DANGER")
    return base + "bg-red-500/[0.08] border-red-500/25 ring-1 ring-red-500/10";
  if (t === "INFO")
    return base + "bg-slate-400/[0.06] border-slate-400/20 ring-1 ring-slate-400/5";
  return base + "bg-white/[0.03] border-white/10 ring-1 ring-white/5";
}

function getTypeBadgeStyles(type: string): string {
  const t = type.toUpperCase();
  const chip = "inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider ";
  if (t === "EDGE" || t === "OK")
    return chip + "bg-emerald-500/25 text-emerald-300 border border-emerald-500/30";
  if (t === "WARN")
    return chip + "bg-amber-500/25 text-amber-200 border border-amber-500/30";
  if (t === "PATTERN")
    return chip + "bg-blue-500/25 text-blue-200 border border-blue-500/30";
  if (t === "RISK" || t === "DANGER")
    return chip + "bg-red-500/25 text-red-200 border border-red-500/30";
  if (t === "INFO")
    return chip + "bg-slate-400/20 text-slate-200 border border-slate-400/25";
  return chip + "bg-white/15 text-white/80 border border-white/20";
}

function getPriorityBadgeStyles(type: string): string {
  const t = type.toUpperCase();
  const chip = "inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium tabular-nums ";
  if (t === "EDGE" || t === "OK")
    return chip + "bg-emerald-500/15 text-emerald-300/90";
  if (t === "WARN")
    return chip + "bg-amber-500/15 text-amber-200/90";
  if (t === "PATTERN")
    return chip + "bg-blue-500/15 text-blue-200/90";
  if (t === "RISK" || t === "DANGER")
    return chip + "bg-red-500/15 text-red-200/90";
  if (t === "INFO")
    return chip + "bg-slate-400/15 text-slate-200/90";
  return chip + "bg-white/10 text-white/70";
}

export function AIPredictiveReport() {
  const { marketFilter } = useMarketFilter();
  const [notifications, setNotifications] = React.useState<NotificationItem[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState(false);

  const { data: trades = [] } = useQuery({
    queryKey: ["trades", "all"],
    queryFn: () => getTrades({}),
  });

  const filteredTrades = React.useMemo(
    () => filterTradesByMarket(trades, marketFilter),
    [trades, marketFilter]
  );

  const stats: Stats = React.useMemo(() => {
    const metrics = computeReportMetrics(filteredTrades);
    const fromTrades = filteredTrades.length;
    const winRatePct = metrics.winRate;
    const wins = filteredTrades.filter((t) => t.pnl > 0);
    const losses = filteredTrades.filter((t) => t.pnl < 0);
    const avgWin = wins.length ? wins.reduce((s, t) => s + t.pnl, 0) / wins.length : null;
    const avgLoss = losses.length
      ? Math.abs(losses.reduce((s, t) => s + t.pnl, 0) / losses.length)
      : null;
    return buildStatsFromTrades(
      fromTrades,
      winRatePct,
      avgWin,
      avgLoss,
      metrics.profitFactor
    );
  }, [filteredTrades]);

  const handleGenerate = React.useCallback(async () => {
    if (filteredTrades.length === 0) return;
    setError(false);
    setLoading(true);
    setNotifications([]);
    try {
      const context: MarketContext = {
        ...defaultContext,
        dayOfWeek: new Date().toLocaleDateString("en-US", { weekday: "long" }),
      };
      const [alerts, insights] = await Promise.all([
        getAlerts(filteredTrades, stats, context),
        getDailyInsights(filteredTrades, stats),
      ]);
      const alertItems: NotificationItem[] = (alerts as Alert[]).map((a) => ({
        title: a.title,
        message: a.message,
        type: a.type,
        priority: a.priority,
      }));
      const insightItems: NotificationItem[] = (insights as Insight[]).map((i) => ({
        title: i.title,
        message: i.message,
        type: i.type,
        priority: i.confidence,
      }));
      const combined = [...alertItems, ...insightItems];
      setNotifications(combined);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [filteredTrades, stats]);

  const isEmpty = filteredTrades.length === 0;
  const showEmpty = isEmpty && !loading && notifications.length === 0;

  return (
    <div className="rounded-xl border border-white/10 bg-[#121826] p-5 shadow-lg">
      <h2 className="mb-4 text-lg font-semibold text-white">Predictive Report</h2>
      <button
        type="button"
        onClick={handleGenerate}
        disabled={isEmpty || loading}
        className="mb-4 rounded-lg bg-emerald-500/20 px-4 py-2 text-sm font-medium text-emerald-400 hover:bg-emerald-500/30 disabled:opacity-50"
      >
        Generate ✦
      </button>

      {loading && (
        <div className="space-y-3">
          <p className="text-sm text-white/60">Generating report…</p>
          <ul className="space-y-3">
            {[1, 2, 3].map((i) => (
              <li key={i}>
                <SkeletonRow />
              </li>
            ))}
          </ul>
        </div>
      )}

      {error && !loading && (
        <p className="py-4 text-sm text-red-400">Could not generate predictive report</p>
      )}

      {showEmpty && (
        <p className="py-4 text-sm text-white/50">Add trades to generate a predictive report.</p>
      )}

      {!loading && !error && notifications.length === 0 && !isEmpty && (
        <p className="py-4 text-sm text-amber-400/90">
          No insights or alerts were generated. Add GROQ_API_KEY to .env.local and restart the dev server. If you use a different model, ensure it is available for your API key (e.g. openai/gpt-oss-20b).
        </p>
      )}

      {!loading && !error && notifications.length > 0 && (
        <ul className="space-y-3">
          {notifications.map((n, i) => (
            <li
              key={`${n.title}-${i}`}
              className={getCardStyles(n.type)}
            >
              <div className="flex flex-wrap items-center gap-2 gap-y-1.5">
                <span className="text-[15px] font-semibold leading-tight text-white">
                  {n.title}
                </span>
                <span className={getTypeBadgeStyles(n.type)}>
                  {n.type}
                </span>
                {n.priority != null && (
                  <span className={getPriorityBadgeStyles(n.type)}>
                    {n.priority}
                  </span>
                )}
              </div>
              <p className="mt-2 text-sm leading-snug text-white/65">
                {n.message}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
