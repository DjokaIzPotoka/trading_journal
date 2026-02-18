"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  Calendar,
  BarChart3,
  Clock,
  FileText,
  Download,
  DollarSign,
  Target,
  Percent,
  TrendingUp,
} from "lucide-react";
import { getTrades } from "../lib/trades";
import type { Trade } from "../lib/trades";
import {
  computeReportMetrics,
  computeCumulativeSeries,
  type CumulativePoint,
} from "@/lib/reportMetrics";

type PeriodPreset = "7" | "30" | "90" | "custom";

function getRangeForPreset(preset: PeriodPreset): { from: Date; to: Date } {
  const to = new Date();
  to.setHours(23, 59, 59, 999);
  const from = new Date(to);
  const days = preset === "7" ? 7 : preset === "30" ? 30 : 90;
  from.setDate(from.getDate() - days);
  from.setHours(0, 0, 0, 0);
  return { from, to };
}

function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function formatMoney(n: number): string {
  const sign = n >= 0 ? "+" : "";
  return `${sign}$${n.toFixed(2)}`;
}

function filterTradesInRange(
  trades: Trade[],
  fromISO: string,
  toISO: string
): Trade[] {
  const from = new Date(fromISO).getTime();
  const to = new Date(toISO + "T23:59:59.999Z").getTime();
  return trades.filter((t) => {
    const tms = new Date(t.created_at).getTime();
    return tms >= from && tms <= to;
  });
}

export default function ReportsPage() {
  const today = new Date();
  const [periodPreset, setPeriodPreset] = React.useState<PeriodPreset>("30");
  const [customFrom, setCustomFrom] = React.useState<string>(() => {
    const d = new Date(today);
    d.setDate(d.getDate() - 30);
    return toISODate(d);
  });
  const [customTo, setCustomTo] = React.useState<string>(() => toISODate(today));
  const [activeTab, setActiveTab] = React.useState<"perf" | "stats" | "trades">(
    "perf"
  );
  const [exporting, setExporting] = React.useState(false);
  const [exportError, setExportError] = React.useState<string | null>(null);

  const { data: allTrades = [] } = useQuery({
    queryKey: ["trades", "reports"],
    queryFn: () => getTrades({}),
  });

  const { from: rangeFrom, to: rangeTo } = React.useMemo(() => {
    if (periodPreset === "custom") {
      return {
        from: customFrom,
        to: customTo,
      };
    }
    const { from: f, to: t } = getRangeForPreset(periodPreset);
    return { from: toISODate(f), to: toISODate(t) };
  }, [periodPreset, customFrom, customTo]);

  const tradesInRange = React.useMemo(
    () => filterTradesInRange(allTrades, rangeFrom, rangeTo),
    [allTrades, rangeFrom, rangeTo]
  );

  const metrics = React.useMemo(
    () => computeReportMetrics(tradesInRange),
    [tradesInRange]
  );

  const chartData = React.useMemo(
    () => computeCumulativeSeries(tradesInRange),
    [tradesInRange]
  );

  const handleExportPdf = React.useCallback(async () => {
    setExportError(null);
    setExporting(true);
    try {
      const res = await fetch(
        `/api/reports/pdf?from=${encodeURIComponent(rangeFrom)}&to=${encodeURIComponent(rangeTo)}`
      );
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Export failed (${res.status})`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `trading-report_${rangeFrom}_${rangeTo}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setExportError(e instanceof Error ? e.message : "Export failed");
    } finally {
      setExporting(false);
    }
  }, [rangeFrom, rangeTo]);

  return (
    <div className="min-h-screen bg-[#0B0F1A] text-white">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-white">Reports</h1>
            <p className="mt-1 text-sm text-white/60">
              Generate and export detailed trading reports
            </p>
          </div>
          <button
            type="button"
            onClick={handleExportPdf}
            disabled={exporting}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow transition hover:bg-blue-700 disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            {exporting ? "Exporting…" : "Export PDF"}
          </button>
        </header>

        {exportError && (
          <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {exportError}
          </div>
        )}

        {/* Report Period */}
        <section className="mb-6 rounded-xl border border-white/10 bg-[#121826] p-5 shadow-lg">
          <div className="mb-4 flex items-center gap-2">
            <Calendar className="h-5 w-5 text-white/70" />
            <h2 className="text-lg font-semibold text-white">Report Period</h2>
          </div>
          <div className="flex flex-wrap gap-4">
            <select
              value={periodPreset}
              onChange={(e) =>
                setPeriodPreset(e.target.value as PeriodPreset)
              }
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="7">Last 7 Days</option>
              <option value="30">Last 30 Days</option>
              <option value="90">Last 90 Days</option>
              <option value="custom">Custom range</option>
            </select>
            {periodPreset === "custom" && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-white/60">Custom range:</span>
                <input
                  type="date"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
                />
                <span className="text-white/50">→</span>
                <input
                  type="date"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                  className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
                />
              </div>
            )}
          </div>
        </section>

        {/* Tabs */}
        <div className="mb-6 flex gap-1 rounded-lg border border-white/10 bg-[#121826] p-1">
          <button
            type="button"
            onClick={() => setActiveTab("perf")}
            className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition ${
              activeTab === "perf"
                ? "bg-white/10 text-white"
                : "text-white/70 hover:text-white hover:bg-white/5"
            }`}
          >
            <BarChart3 className="h-4 w-4" />
            Perf
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("stats")}
            className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition ${
              activeTab === "stats"
                ? "bg-white/10 text-white"
                : "text-white/70 hover:text-white hover:bg-white/5"
            }`}
          >
            <Clock className="h-4 w-4" />
            Stats
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("trades")}
            className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition ${
              activeTab === "trades"
                ? "bg-white/10 text-white"
                : "text-white/70 hover:text-white hover:bg-white/5"
            }`}
          >
            <FileText className="h-4 w-4" />
            Trades
          </button>
        </div>

        {/* Summary cards */}
        <section className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <SummaryCard
            title="Net P&L"
            value={formatMoney(metrics.netPnl)}
            sub={`${metrics.totalTrades} trades`}
            positive={metrics.netPnl >= 0}
            icon={<DollarSign className="h-4 w-4 text-white/50" />}
          />
          <SummaryCard
            title="Win Rate"
            value={`${metrics.winRate.toFixed(1)}%`}
            sub={`${metrics.wins}W / ${metrics.losses}L`}
            icon={<Target className="h-4 w-4 text-white/50" />}
          />
          <SummaryCard
            title="Profit Factor"
            value={metrics.profitFactor.toFixed(2)}
            sub="Gross profit / Gross loss"
            icon={<Percent className="h-4 w-4 text-white/50" />}
          />
          <SummaryCard
            title="Expectancy"
            value={formatMoney(metrics.expectancy)}
            sub="Per trade"
            positive={metrics.expectancy >= 0}
            icon={<TrendingUp className="h-4 w-4 text-white/50" />}
          />
        </section>

        {/* Cumulative P&L */}
        <section className="rounded-xl border border-white/10 bg-[#121826] p-5 shadow-lg">
          <h2 className="mb-1 text-lg font-semibold text-white">
            Cumulative P&L
          </h2>
          <p className="mb-4 text-sm text-white/60">
            Your equity curve over the selected period
          </p>
          <div className="h-[280px] w-full">
            {chartData.length === 0 ? (
              <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-white/20 text-sm text-white/50">
                No trade data in this period
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={chartData}
                  margin={{ top: 8, right: 8, left: 8, bottom: 8 }}
                >
                  <defs>
                    <linearGradient
                      id="reportCumulativeGradient"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset="0%"
                        stopColor="#34d399"
                        stopOpacity={0.4}
                      />
                      <stop
                        offset="100%"
                        stopColor="#34d399"
                        stopOpacity={0}
                      />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="rgba(255,255,255,0.06)"
                  />
                  <XAxis
                    dataKey="displayDate"
                    stroke="rgba(255,255,255,0.4)"
                    tick={{ fill: "rgba(255,255,255,0.6)", fontSize: 11 }}
                    tickLine={{ stroke: "rgba(255,255,255,0.1)" }}
                  />
                  <YAxis
                    stroke="rgba(255,255,255,0.4)"
                    tick={{ fill: "rgba(255,255,255,0.6)", fontSize: 11 }}
                    tickLine={{ stroke: "rgba(255,255,255,0.1)" }}
                    tickFormatter={(v) => `$${v}`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#121826",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: "8px",
                    }}
                    labelStyle={{ color: "rgba(255,255,255,0.8)" }}
                    formatter={(value: number | undefined) => [
                      value != null ? `$${Number(value).toFixed(2)}` : "",
                      "Cumulative P&L",
                    ]}
                    labelFormatter={(label) => label}
                  />
                  <Area
                    type="monotone"
                    dataKey="cumulativePnl"
                    stroke="#34d399"
                    strokeWidth={2}
                    fill="url(#reportCumulativeGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

type SummaryCardProps = {
  title: string;
  value: string;
  sub: string;
  positive?: boolean;
  icon: React.ReactNode;
};

function SummaryCard({
  title,
  value,
  sub,
  positive,
  icon,
}: SummaryCardProps) {
  return (
    <div className="relative rounded-xl border border-white/10 bg-[#121826] p-4 shadow-lg">
      <div className="absolute right-3 top-3">{icon}</div>
      <p className="text-xs font-medium uppercase tracking-wider text-white/60">
        {title}
      </p>
      <p
        className={`mt-1 text-xl font-semibold ${
          positive === true ? "text-emerald-400" : ""
        } ${positive === false ? "text-red-400" : ""} ${
          positive === undefined ? "text-white" : ""
        }`}
      >
        {value}
      </p>
      <p className="mt-0.5 text-xs text-white/50">{sub}</p>
    </div>
  );
}
