"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { Activity } from "lucide-react";
import {
  runMonteCarlo,
  type SimulationParams,
  type SimulationSummary,
} from "@/lib/sim/montecarlo";
import { computeFanSeries, percentileAt } from "@/lib/sim/percentiles";
import { samplePaths } from "@/lib/sim/samplePaths";
import type { DisplayMode } from "@/lib/sim/format";
import { FullscreenModal } from "../components/ui/FullscreenModal";

const FanChart = dynamic(
  () => import("../components/sim/FanChart").then((m) => m.FanChart),
  { ssr: false }
);

const SpaghettiChart = dynamic(
  () => import("../components/sim/SpaghettiChart").then((m) => m.SpaghettiChart),
  { ssr: false }
);

const DEFAULT_PARAMS: SimulationParams = {
  startingBalance: 1000,
  days: 30,
  simulations: 1000,
  tradesPerDay: 3,
  winRate: 50,
  riskPerTradePct: 1.0,
  leverage: 10,
  winRMin: 1.0,
  winRMax: 3.0,
  lossRMin: 1.0,
  lossRMax: 2.0,
  feeRatePerSidePct: 0.05,
  extremesEnabled: false,
  extremeProbPct: 0.1,
  extremeWinR: 10.0,
  extremeLossR: 10.0,
  ruinThresholdPct: 20,
  useSeed: false,
  seedValue: 12345,
};

function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min;
  return Math.max(min, Math.min(max, value));
}

function formatMoney(n: number): string {
  const sign = n >= 0 ? "+" : "";
  return `${sign}$${n.toFixed(2)}`;
}

function formatPct(n: number): string {
  return `${n.toFixed(2)}%`;
}

export default function SimulationsPage() {
  const [params, setParams] = React.useState<SimulationParams>(DEFAULT_PARAMS);
  const [summary, setSummary] = React.useState<SimulationSummary | null>(null);
  const [paths, setPaths] = React.useState<ReturnType<typeof runMonteCarlo>["paths"] | null>(null);
  const [running, setRunning] = React.useState(false);
  const [chartTab, setChartTab] = React.useState<"fan" | "spaghetti">("fan");
  const [spaghettiSampleSize, setSpaghettiSampleSize] = React.useState(300);
  const [showHighlight, setShowHighlight] = React.useState(true);
  const [autoZoomY, setAutoZoomY] = React.useState(true);
  const [includeOutliers, setIncludeOutliers] = React.useState(false);
  const [centerLineMode, setCenterLineMode] = React.useState<"median" | "mean">("median");
  const [expandedChart, setExpandedChart] = React.useState<"fan" | "spaghetti" | null>(null);
  const [displayMode, setDisplayMode] = React.useState<DisplayMode>("absolute");
  const [logScale, setLogScale] = React.useState(false);

  const updateParam = React.useCallback(<K extends keyof SimulationParams>(
    key: K,
    value: SimulationParams[K]
  ) => {
    setParams((prev) => ({ ...prev, [key]: value }));
  }, []);

  const validatedParams = React.useMemo((): SimulationParams => {
    return {
      ...params,
      startingBalance: Math.max(1, Number(params.startingBalance) || 1),
      days: Math.max(1, Math.min(365, Math.floor(Number(params.days) || 1))),
      simulations: Math.max(1, Math.min(100000, Math.floor(Number(params.simulations) || 1))),
      tradesPerDay: Math.max(1, Math.min(100, Math.floor(Number(params.tradesPerDay) || 1))),
      winRate: clamp(Number(params.winRate) || 0, 0, 100),
      riskPerTradePct: Math.max(0.01, Number(params.riskPerTradePct) || 0),
      leverage: Math.max(1, Number(params.leverage) || 1),
      winRMin: Number(params.winRMin) || 0,
      winRMax: Number(params.winRMax) || 0,
      lossRMin: Number(params.lossRMin) || 0,
      lossRMax: Number(params.lossRMax) || 0,
      feeRatePerSidePct: Math.max(0, Number(params.feeRatePerSidePct) || 0),
      extremeProbPct: clamp(Number(params.extremeProbPct) || 0, 0, 100),
      extremeWinR: Math.max(0, Number(params.extremeWinR) || 0),
      extremeLossR: Math.max(0, Number(params.extremeLossR) || 0),
      ruinThresholdPct: clamp(Number(params.ruinThresholdPct) || 0, 0, 100),
      seedValue: params.useSeed
        ? typeof params.seedValue === "number"
          ? params.seedValue
          : String(params.seedValue || "12345")
        : 12345,
    };
  }, [params]);

  const handleRun = React.useCallback(() => {
    setRunning(true);
    setSummary(null);
    setPaths(null);
    requestAnimationFrame(() => {
      try {
        const result = runMonteCarlo(validatedParams);
        setPaths(result.paths);
        setSummary(result.summary);
      } finally {
        setRunning(false);
      }
    });
  }, [validatedParams]);

  const handleReset = React.useCallback(() => {
    setParams(DEFAULT_PARAMS);
    setSummary(null);
    setPaths(null);
  }, []);

  const showHighSimWarning = validatedParams.simulations > 10000;

  const dailyPaths = React.useMemo(() => {
    if (!paths || paths.length === 0) return [];
    const days = validatedParams.days;
    const tradesPerDay = validatedParams.tradesPerDay;
    const result: number[][] = [];
    for (let i = 0; i < paths.length; i++) {
      const b = paths[i].balances;
      const row: number[] = [];
      for (let d = 0; d <= days; d++) {
        const idx = Math.min(d * tradesPerDay, b.length - 1);
        row.push(b[idx] ?? 0);
      }
      result.push(row);
    }
    return result;
  }, [paths, validatedParams.days, validatedParams.tradesPerDay]);

  const xAxis = React.useMemo(
    () => (dailyPaths.length > 0 ? Array.from({ length: dailyPaths[0].length }, (_, i) => i) : []),
    [dailyPaths]
  );

  const fanSeriesMulti = React.useMemo(
    () => (dailyPaths.length > 0 ? computeFanSeries(dailyPaths) : null),
    [dailyPaths]
  );

  const fanChartSeries = React.useMemo(() => {
    if (!fanSeriesMulti) return null;
    const centerLine =
      centerLineMode === "mean" ? fanSeriesMulti.meanSeries : fanSeriesMulti.centerLine;
    return {
      x: fanSeriesMulti.x,
      bands: fanSeriesMulti.bands,
      centerLine,
      centerLineLabel: centerLineMode === "mean" ? "Mean" : "Median",
    };
  }, [fanSeriesMulti, centerLineMode]);

  const fanYRange = React.useMemo(() => {
    if (!fanSeriesMulti || !autoZoomY) return { yMin: undefined, yMax: undefined };
    const bands = fanSeriesMulti.bands;
    let lo: number, hi: number;
    if (includeOutliers && bands[1] && bands[99]) {
      lo = Math.min(...bands[1]);
      hi = Math.max(...bands[99]);
    } else {
      lo = bands[5] ? Math.min(...bands[5]) : 0;
      hi = bands[95] ? Math.max(...bands[95]) : 0;
    }
    const padding = 0.02;
    const span = hi - lo || 1;
    let yMin = Math.max(0, lo - span * padding);
    let yMax = hi + span * padding;
    if (yMax <= yMin) yMax = yMin + 1;
    return { yMin, yMax };
  }, [fanSeriesMulti, autoZoomY, includeOutliers]);

  const spaghettiSampledPaths = React.useMemo(() => {
    if (dailyPaths.length === 0 || chartTab !== "spaghetti") return [];
    const size = Math.max(50, Math.min(1000, Math.floor(spaghettiSampleSize)));
    const highlight =
      showHighlight && fanSeriesMulti
        ? centerLineMode === "mean"
          ? fanSeriesMulti.meanSeries
          : fanSeriesMulti.centerLine
        : undefined;
    return samplePaths(dailyPaths, size, { highlight });
  }, [dailyPaths, chartTab, spaghettiSampleSize, showHighlight, fanSeriesMulti, centerLineMode]);

  const spaghettiYRange = React.useMemo(() => {
    if (!autoZoomY || spaghettiSampledPaths.length === 0) return { yMin: undefined, yMax: undefined };
    const all: number[] = [];
    spaghettiSampledPaths.forEach((p) => p.forEach((v) => all.push(v)));
    if (all.length === 0) return { yMin: undefined, yMax: undefined };
    all.sort((a, b) => a - b);
    const p5 = percentileAt(all, 5);
    const p95 = percentileAt(all, 95);
    const span = p95 - p5 || 1;
    const padding = 0.02;
    let yMin = Math.max(0, p5 - span * padding);
    let yMax = p95 + span * padding;
    if (yMax <= yMin) yMax = yMin + 1;
    return { yMin, yMax };
  }, [autoZoomY, spaghettiSampledPaths]);

  const startingBalance = validatedParams.startingBalance;

  const chartFanSeries = React.useMemo(() => {
    if (!fanChartSeries) return null;
    if (displayMode === "absolute") return fanChartSeries;
    const scale = startingBalance;
    const scaleArr = (arr: number[]) => arr.map((v) => v / scale);
    const bands: Record<number, number[]> = {};
    Object.keys(fanChartSeries.bands).forEach((k) => {
      const p = Number(k);
      bands[p] = scaleArr(fanChartSeries.bands[p]);
    });
    return {
      x: fanChartSeries.x,
      bands,
      centerLine: scaleArr(fanChartSeries.centerLine),
      centerLineLabel: fanChartSeries.centerLineLabel,
    };
  }, [fanChartSeries, displayMode, startingBalance]);

  const chartSpaghettiPaths = React.useMemo(() => {
    if (displayMode === "absolute") return spaghettiSampledPaths;
    const scale = startingBalance;
    return spaghettiSampledPaths.map((path) => path.map((v) => v / scale));
  }, [spaghettiSampledPaths, displayMode, startingBalance]);

  const chartFanYRange = React.useMemo(() => {
    if (!autoZoomY || !chartFanSeries) return { yMin: undefined, yMax: undefined };
    const bands = chartFanSeries.bands;
    let lo: number, hi: number;
    if (includeOutliers && bands[1] && bands[99]) {
      lo = Math.min(...bands[1]);
      hi = Math.max(...bands[99]);
    } else {
      lo = bands[5] ? Math.min(...bands[5]) : 0;
      hi = bands[95] ? Math.max(...bands[95]) : 0;
    }
    const padding = 0.02;
    const span = hi - lo || 1;
    let yMin = Math.max(0, lo - span * padding);
    let yMax = hi + span * padding;
    if (yMax <= yMin) yMax = yMin + 1;
    return { yMin, yMax };
  }, [autoZoomY, includeOutliers, chartFanSeries]);

  const chartSpaghettiYRange = React.useMemo(() => {
    if (!autoZoomY || chartSpaghettiPaths.length === 0) return { yMin: undefined, yMax: undefined };
    const all: number[] = [];
    chartSpaghettiPaths.forEach((p) => p.forEach((v) => all.push(v)));
    if (all.length === 0) return { yMin: undefined, yMax: undefined };
    all.sort((a, b) => a - b);
    const p5 = percentileAt(all, 5);
    const p95 = percentileAt(all, 95);
    const span = p95 - p5 || 1;
    const padding = 0.02;
    let yMin = Math.max(0, p5 - span * padding);
    let yMax = p95 + span * padding;
    if (yMax <= yMin) yMax = yMin + 1;
    return { yMin, yMax };
  }, [autoZoomY, chartSpaghettiPaths]);

  return (
    <div className="min-h-screen bg-[#0B0F1A] text-white">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <header className="mb-8">
          <h1 className="text-2xl font-semibold text-white">Simulations</h1>
          <p className="mt-1 text-sm text-white/60">
            Monte Carlo risk-based performance simulation
          </p>
        </header>

        <div className="rounded-xl border border-white/10 bg-[#121826] p-6 shadow-lg">
          <div className="grid gap-8 lg:grid-cols-[1fr,340px]">
            {/* Form */}
            <div className="space-y-6">
              {showHighSimWarning && (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-400">
                  Running more than 10,000 simulations may be slow in the browser.
                </div>
              )}

              <section>
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-white/70">
                  Core
                </h2>
                <div className="grid gap-4 sm:grid-cols-2">
                  <LabelInput
                    label="Starting balance"
                    type="number"
                    value={params.startingBalance}
                    onChange={(v) => updateParam("startingBalance", Number(v))}
                    min={1}
                  />
                  <LabelInput
                    label="Days"
                    type="number"
                    value={params.days}
                    onChange={(v) => updateParam("days", Math.floor(Number(v)))}
                    min={1}
                    max={365}
                  />
                  <LabelInput
                    label="Simulations"
                    type="number"
                    value={params.simulations}
                    onChange={(v) => updateParam("simulations", Math.floor(Number(v)))}
                    min={1}
                    max={100000}
                  />
                  <LabelInput
                    label="Trades per day"
                    type="number"
                    value={params.tradesPerDay}
                    onChange={(v) => updateParam("tradesPerDay", Math.floor(Number(v)))}
                    min={1}
                  />
                  <LabelInput
                    label="Win rate (%)"
                    type="number"
                    value={params.winRate}
                    onChange={(v) => updateParam("winRate", Number(v))}
                    min={0}
                    max={100}
                    step={0.1}
                  />
                  <LabelInput
                    label="Risk per trade (%)"
                    type="number"
                    value={params.riskPerTradePct}
                    onChange={(v) => updateParam("riskPerTradePct", Number(v))}
                    min={0.01}
                    step={0.1}
                  />
                  <LabelInput
                    label="Leverage"
                    type="number"
                    value={params.leverage}
                    onChange={(v) => updateParam("leverage", Number(v))}
                    min={1}
                    step={0.1}
                  />
                </div>
              </section>

              <section>
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-white/70">
                  Return distribution (R multiples)
                </h2>
                <div className="grid gap-4 sm:grid-cols-2">
                  <LabelInput
                    label="Win R min"
                    type="number"
                    value={params.winRMin}
                    onChange={(v) => updateParam("winRMin", Number(v))}
                    step={0.1}
                  />
                  <LabelInput
                    label="Win R max"
                    type="number"
                    value={params.winRMax}
                    onChange={(v) => updateParam("winRMax", Number(v))}
                    step={0.1}
                  />
                  <LabelInput
                    label="Loss R min"
                    type="number"
                    value={params.lossRMin}
                    onChange={(v) => updateParam("lossRMin", Number(v))}
                    step={0.1}
                  />
                  <LabelInput
                    label="Loss R max"
                    type="number"
                    value={params.lossRMax}
                    onChange={(v) => updateParam("lossRMax", Number(v))}
                    step={0.1}
                  />
                </div>
              </section>

              <section>
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-white/70">
                  Fees
                </h2>
                <LabelInput
                  label="Fee rate per side (%)"
                  type="number"
                  value={params.feeRatePerSidePct}
                  onChange={(v) => updateParam("feeRatePerSidePct", Number(v))}
                  min={0}
                  step={0.01}
                />
              </section>

              <section>
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-white/70">
                  Extreme trades (fat tails)
                </h2>
                <div className="flex flex-wrap items-center gap-4">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={params.extremesEnabled}
                      onChange={(e) => updateParam("extremesEnabled", e.target.checked)}
                      className="rounded border-white/20 bg-white/5 text-emerald-500 focus:ring-emerald-500"
                    />
                    <span className="text-sm text-white/80">Enable extremes</span>
                  </label>
                  {params.extremesEnabled && (
                    <>
                      <LabelInput
                        label="Extreme prob (%)"
                        type="number"
                        value={params.extremeProbPct}
                        onChange={(v) => updateParam("extremeProbPct", Number(v))}
                        min={0}
                        max={100}
                        step={0.01}
                      />
                      <LabelInput
                        label="Extreme win R"
                        type="number"
                        value={params.extremeWinR}
                        onChange={(v) => updateParam("extremeWinR", Number(v))}
                        min={0}
                        step={0.1}
                      />
                      <LabelInput
                        label="Extreme loss R"
                        type="number"
                        value={params.extremeLossR}
                        onChange={(v) => updateParam("extremeLossR", Number(v))}
                        min={0}
                        step={0.1}
                      />
                    </>
                  )}
                </div>
              </section>

              <section>
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-white/70">
                  Ruin
                </h2>
                <LabelInput
                  label="Ruin threshold (%)"
                  type="number"
                  value={params.ruinThresholdPct}
                  onChange={(v) => updateParam("ruinThresholdPct", Number(v))}
                  min={0}
                  max={100}
                  step={1}
                />
              </section>

              <section>
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-white/70">
                  Seed
                </h2>
                <div className="flex flex-wrap items-center gap-4">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={params.useSeed}
                      onChange={(e) => updateParam("useSeed", e.target.checked)}
                      className="rounded border-white/20 bg-white/5 text-emerald-500 focus:ring-emerald-500"
                    />
                    <span className="text-sm text-white/80">Use seed</span>
                  </label>
                  {params.useSeed && (
                    <input
                      type="text"
                      value={
                        typeof params.seedValue === "number"
                          ? String(params.seedValue)
                          : params.seedValue
                      }
                      onChange={(e) => {
                        const v = e.target.value;
                        const n = Number(v);
                        updateParam(
                          "seedValue",
                          v.trim() === ""
                            ? 12345
                            : Number.isNaN(n)
                              ? v
                              : n
                        );
                      }}
                      placeholder="12345 or any string"
                      className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/40 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  )}
                </div>
              </section>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleRun}
                  disabled={running}
                  className="rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white shadow transition hover:bg-emerald-700 disabled:opacity-50"
                >
                  {running ? "Running…" : "Run Simulation"}
                </button>
                <button
                  type="button"
                  onClick={handleReset}
                  className="rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-white/80 transition hover:bg-white/10"
                >
                  Reset
                </button>
              </div>
            </div>

            {/* Summary panel */}
            <div className="rounded-xl border border-white/10 bg-[#0B0F1A]/80 p-5">
              <h2 className="mb-4 text-lg font-semibold text-white">
                Summary
              </h2>
              {summary === null ? (
                <p className="text-sm text-white/50">
                  Run a simulation to see results. Paths are kept for future charts.
                </p>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <SummaryCard
                      label="Mean final balance"
                      value={formatMoney(summary.meanFinalBalance)}
                    />
                    <SummaryCard
                      label="Median final balance"
                      value={formatMoney(summary.medianFinalBalance)}
                    />
                    <SummaryCard
                      label="5th percentile"
                      value={formatMoney(summary.p5FinalBalance)}
                    />
                    <SummaryCard
                      label="95th percentile"
                      value={formatMoney(summary.p95FinalBalance)}
                    />
                    <SummaryCard
                      label="Best"
                      value={formatMoney(summary.bestFinalBalance)}
                      positive
                    />
                    <SummaryCard
                      label="Worst"
                      value={formatMoney(summary.worstFinalBalance)}
                      negative
                    />
                  </div>
                  <dl className="space-y-2 border-t border-white/10 pt-4 text-sm">
                    <Row label="Mean max drawdown" value={formatPct(summary.meanMaxDrawdownPct)} />
                    <Row label="Ruin probability" value={formatPct(summary.ruinProbabilityPct)} />
                    <Row label="Total trades per sim" value={String(summary.totalTradesPerSim)} />
                    <Row label="Avg fee paid" value={formatMoney(summary.avgFeePaid)} />
                    <Row
                      label="Avg P&L"
                      value={formatMoney(summary.avgPnL)}
                      positive={summary.avgPnL >= 0}
                      negative={summary.avgPnL < 0}
                    />
                  </dl>
                  {paths != null && (
                    <p className="text-xs text-white/50">
                      {paths.length} paths stored for charts
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Charts section - only when results exist */}
          {summary != null && paths != null && (
            <div className="mt-8 rounded-xl border border-white/10 bg-[#121826] p-6 shadow-lg">
              <h2 className="mb-4 text-lg font-semibold text-white">Charts</h2>
              <div className="mb-4 flex flex-wrap items-center gap-4">
                <div className="flex rounded-lg border border-white/10 bg-white/5 p-1">
                  <button
                    type="button"
                    onClick={() => setChartTab("fan")}
                    className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                      chartTab === "fan"
                        ? "bg-white/10 text-white"
                        : "text-white/70 hover:text-white hover:bg-white/5"
                    }`}
                  >
                    Fan
                  </button>
                  <button
                    type="button"
                    onClick={() => setChartTab("spaghetti")}
                    className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                      chartTab === "spaghetti"
                        ? "bg-white/10 text-white"
                        : "text-white/70 hover:text-white hover:bg-white/5"
                    }`}
                  >
                    Spaghetti
                  </button>
                </div>
                <label className="flex items-center gap-2 text-sm text-white/70">
                  <input
                    type="checkbox"
                    checked={autoZoomY}
                    onChange={(e) => setAutoZoomY(e.target.checked)}
                    className="rounded border-white/20 bg-white/5 text-emerald-500 focus:ring-emerald-500"
                  />
                  Auto zoom Y
                </label>
                <label className="flex items-center gap-2 text-sm text-white/70">
                  <input
                    type="checkbox"
                    checked={includeOutliers}
                    onChange={(e) => setIncludeOutliers(e.target.checked)}
                    className="rounded border-white/20 bg-white/5 text-emerald-500 focus:ring-emerald-500"
                  />
                  Include outliers
                </label>
                <div className="flex items-center gap-2 text-sm text-white/70">
                  <span>Center line:</span>
                  <select
                    value={centerLineMode}
                    onChange={(e) => setCenterLineMode(e.target.value as "median" | "mean")}
                    className="rounded border border-white/10 bg-white/5 px-2 py-1 text-white focus:border-emerald-500 focus:outline-none"
                  >
                    <option value="median">Median</option>
                    <option value="mean">Mean</option>
                  </select>
                </div>
                <div className="flex rounded-lg border border-white/10 bg-white/5 p-1">
                  <button
                    type="button"
                    onClick={() => setDisplayMode("absolute")}
                    className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                      displayMode === "absolute"
                        ? "bg-white/10 text-white"
                        : "text-white/70 hover:text-white hover:bg-white/5"
                    }`}
                  >
                    Absolute ($)
                  </button>
                  <button
                    type="button"
                    onClick={() => setDisplayMode("multiple")}
                    className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                      displayMode === "multiple"
                        ? "bg-white/10 text-white"
                        : "text-white/70 hover:text-white hover:bg-white/5"
                    }`}
                  >
                    Multiple (×)
                  </button>
                </div>
                <label className="flex items-center gap-2 text-sm text-white/70">
                  <input
                    type="checkbox"
                    checked={logScale}
                    onChange={(e) => setLogScale(e.target.checked)}
                    className="rounded border-white/20 bg-white/5 text-emerald-500 focus:ring-emerald-500"
                  />
                  Log scale
                </label>
                {chartTab === "spaghetti" && (
                  <>
                    <label className="flex items-center gap-2 text-sm text-white/70">
                      Sample size
                      <input
                        type="number"
                        min={50}
                        max={1000}
                        value={spaghettiSampleSize}
                        onChange={(e) =>
                          setSpaghettiSampleSize(
                            Math.max(50, Math.min(1000, Math.floor(Number(e.target.value) || 50))))
                        }
                        className="w-20 rounded border border-white/10 bg-white/5 px-2 py-1 text-sm text-white focus:border-emerald-500 focus:outline-none"
                      />
                    </label>
                    <label className="flex items-center gap-2 text-sm text-white/70">
                      <input
                        type="checkbox"
                        checked={showHighlight}
                        onChange={(e) => setShowHighlight(e.target.checked)}
                        className="rounded border-white/20 bg-white/5 text-emerald-500 focus:ring-emerald-500"
                      />
                      Show highlight
                    </label>
                  </>
                )}
              </div>
              {chartTab === "fan" && chartFanSeries && (
                <FanChart
                  series={chartFanSeries}
                  title="Balance percentiles (P10–P90)"
                  yMin={chartFanYRange.yMin}
                  yMax={chartFanYRange.yMax}
                  displayMode={displayMode}
                  yAxisType={logScale ? "log" : "value"}
                  onExpand={() => setExpandedChart("fan")}
                />
              )}
              {chartTab === "spaghetti" && xAxis.length > 0 && (
                <SpaghettiChart
                  x={xAxis}
                  paths={chartSpaghettiPaths}
                  highlight={
                    showHighlight && chartFanSeries ? chartFanSeries.centerLine : undefined
                  }
                  yMin={chartSpaghettiYRange.yMin}
                  yMax={chartSpaghettiYRange.yMax}
                  displayMode={displayMode}
                  yAxisType={logScale ? "log" : "value"}
                  onExpand={() => setExpandedChart("spaghetti")}
                />
              )}
            </div>
          )}

          <FullscreenModal
            open={expandedChart !== null}
            onClose={() => setExpandedChart(null)}
            title={expandedChart === "fan" ? "Fan chart" : expandedChart === "spaghetti" ? "Spaghetti chart" : undefined}
          >
            {expandedChart === "fan" && chartFanSeries && (
              <FanChart
                series={chartFanSeries}
                title="Balance percentiles (P10–P90)"
                yMin={chartFanYRange.yMin}
                yMax={chartFanYRange.yMax}
                displayMode={displayMode}
                yAxisType={logScale ? "log" : "value"}
                containerClassName="h-[80vh] w-full"
              />
            )}
            {expandedChart === "spaghetti" && xAxis.length > 0 && (
              <SpaghettiChart
                x={xAxis}
                paths={chartSpaghettiPaths}
                highlight={showHighlight && chartFanSeries ? chartFanSeries.centerLine : undefined}
                yMin={chartSpaghettiYRange.yMin}
                yMax={chartSpaghettiYRange.yMax}
                displayMode={displayMode}
                yAxisType={logScale ? "log" : "value"}
                containerClassName="h-[80vh] w-full"
              />
            )}
          </FullscreenModal>
        </div>
      </div>
    </div>
  );
}

function LabelInput({
  label,
  type,
  value,
  onChange,
  min,
  max,
  step,
}: {
  label: string;
  type: "number" | "text";
  value: number | string;
  onChange: (v: number | string) => void;
  min?: number;
  max?: number;
  step?: number;
}) {
  const displayValue =
    type === "number" && typeof value === "number" && Number.isNaN(value)
      ? ""
      : value;
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-white/60">
        {label}
      </label>
      <input
        type={type}
        value={displayValue}
        onChange={(e) =>
          onChange(
            type === "number"
              ? (e.target.value === ""
                  ? NaN
                  : e.target.valueAsNumber)
              : e.target.value
          )
        }
        min={min}
        max={max}
        step={step}
        className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
      />
    </div>
  );
}

function SummaryCard({
  label,
  value,
  positive,
  negative,
}: {
  label: string;
  value: string;
  positive?: boolean;
  negative?: boolean;
}) {
  return (
    <div className="rounded-lg border border-white/5 bg-white/[0.02] p-3">
      <p className="text-xs text-white/60">{label}</p>
      <p
        className={`mt-0.5 font-semibold ${
          positive ? "text-emerald-400" : ""
        } ${negative ? "text-red-400" : ""} ${!positive && !negative ? "text-white" : ""}`}
      >
        {value}
      </p>
    </div>
  );
}

function Row({
  label,
  value,
  positive,
  negative,
}: {
  label: string;
  value: string;
  positive?: boolean;
  negative?: boolean;
}) {
  return (
    <div className="flex justify-between">
      <dt className="text-white/60">{label}</dt>
      <dd
        className={
          positive ? "text-emerald-400" : negative ? "text-red-400" : "text-white"
        }
      >
        {value}
      </dd>
    </div>
  );
}
