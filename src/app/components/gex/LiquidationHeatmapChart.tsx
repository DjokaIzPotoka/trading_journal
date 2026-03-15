"use client";

import * as React from "react";
import ReactECharts from "echarts-for-react";
import type { EChartsOption } from "echarts";
import type { LiquidationLevel, LiquidationHeatmapBin } from "../../lib/market/types";

function formatPrice(n: number): string {
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

export type LiquidationHeatmapChartProps = {
  levels: LiquidationLevel[];
  spotPrice: number;
  bins?: LiquidationHeatmapBin[];
  strongestDownsideCluster?: number | null;
  strongestUpsideCluster?: number | null;
  maxPoints?: number;
};

const AXIS_LABEL = "rgba(255,255,255,0.5)";
const AXIS_LINE = "rgba(255,255,255,0.2)";
const GRID_COLOR = "rgba(255,255,255,0.06)";

export function LiquidationHeatmapChart({
  levels,
  spotPrice,
  bins,
  strongestDownsideCluster,
  strongestUpsideCluster,
  maxPoints = 200,
}: LiquidationHeatmapChartProps) {
  const chartData = React.useMemo(() => {
    const source = bins ?? levels.map((l) => ({
      price: l.price,
      longLiqWeight: l.longLiqWeight,
      shortLiqWeight: l.shortLiqWeight,
      totalWeight: l.totalWeight,
      intensity: l.intensity ?? l.totalWeight / Math.max(1, ...levels.map((x) => x.totalWeight)),
    }));
    const sliced = source.length <= maxPoints ? source : source.filter((_, i) => i % Math.ceil(source.length / maxPoints) === 0);
    return sliced.map((d) => ({
      price: d.price,
      longLiq: d.longLiqWeight,
      shortLiq: d.shortLiqWeight,
      total: d.totalWeight,
      intensity: "intensity" in d ? (d as LiquidationHeatmapBin).intensity : (d as LiquidationLevel & { intensity?: number }).intensity ?? 0.5,
      priceLabel: formatPrice(d.price),
    }));
  }, [bins, levels, maxPoints]);

  const option: EChartsOption = React.useMemo(() => {
    if (chartData.length === 0) return {};

    const prices = chartData.map((d) => d.price);
    const xMin = Math.min(...prices);
    const xMax = Math.max(...prices);
    const xPadding = (xMax - xMin) * 0.02 || 1;

    const markLineData: Array<{ xAxis: number; lineStyle: { color: string; type?: "dashed"; width: number }; label?: { show: boolean } }> = [];
    if (spotPrice >= xMin - xPadding && spotPrice <= xMax + xPadding) {
      markLineData.push({ xAxis: spotPrice, lineStyle: { color: "rgba(255,255,255,0.9)", type: "dashed", width: 2 }, label: { show: false } });
    }
    if (strongestDownsideCluster != null) {
      markLineData.push({ xAxis: strongestDownsideCluster, lineStyle: { color: "rgba(239,68,68,0.6)", type: "dashed", width: 1 }, label: { show: false } });
    }
    if (strongestUpsideCluster != null) {
      markLineData.push({ xAxis: strongestUpsideCluster, lineStyle: { color: "rgba(34,197,94,0.6)", type: "dashed", width: 1 }, label: { show: false } });
    }

    return {
      backgroundColor: "transparent",
      grid: { left: 52, right: 24, top: 28, bottom: 44, containLabel: false },
      xAxis: {
        type: "value",
        min: xMin - xPadding,
        max: xMax + xPadding,
        axisLine: { lineStyle: { color: AXIS_LINE } },
        axisTick: { show: false },
        splitLine: { show: false },
        axisLabel: { color: AXIS_LABEL, fontSize: 10, formatter: (v: number) => formatPrice(v) },
      },
      yAxis: {
        type: "value",
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { lineStyle: { color: GRID_COLOR, type: "dashed" } },
        axisLabel: { color: AXIS_LABEL, fontSize: 10, formatter: (v: number) => Number(v).toLocaleString(undefined, { maximumFractionDigits: 0 }) },
      },
      tooltip: {
        trigger: "axis",
        backgroundColor: "#0f172a",
        borderColor: "rgba(255,255,255,0.15)",
        borderWidth: 1,
        padding: [10, 12],
        textStyle: { color: "rgba(255,255,255,0.9)", fontSize: 12 },
        formatter: (params: unknown) => {
          const arr = Array.isArray(params) ? params : [];
          const p = arr[0];
          if (!p || !p.data) return "";
          const payload = p.data as [number, number, number];
          const price = payload[0];
          const intensity = payload[2] ?? 0.5;
          const longVal = (arr[0]?.data as [number, number, number] | undefined)?.[1] ?? 0;
          const shortVal = (arr[1]?.data as [number, number, number] | undefined)?.[1] ?? 0;
          return [
            `<div style="font-weight:600;margin-bottom:6px;padding-bottom:6px;border-bottom:1px solid rgba(255,255,255,0.1);">${formatPrice(price)}</div>`,
            `<div style="display:flex;justify-content:space-between;gap:16px;"><span style="color:rgba(255,255,255,0.5);">Long liq</span><span style="color:rgb(248,113,113);font-family:monospace;">${longVal.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span></div>`,
            `<div style="display:flex;justify-content:space-between;gap:16px;"><span style="color:rgba(255,255,255,0.5);">Short liq</span><span style="color:rgb(74,222,128);font-family:monospace;">${shortVal.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span></div>`,
            `<div style="margin-top:6px;padding-top:6px;border-top:1px solid rgba(255,255,255,0.1);color:rgba(255,255,255,0.5);">Intensity ${(intensity * 100).toFixed(0)}%</div>`,
          ].join("");
        },
      },
      legend: {
        data: ["Long liq", "Short liq"],
        bottom: 4,
        left: "center",
        itemGap: 20,
        itemWidth: 10,
        itemHeight: 10,
        textStyle: { color: "rgba(255,255,255,0.6)", fontSize: 11 },
        icon: "rect",
      },
      series: [
        {
          name: "Long liq",
          type: "bar",
          stack: "liq",
          data: chartData.map((d) => [d.price, d.longLiq, d.intensity]),
          itemStyle: {
            color: (params: { data: [number, number, number] }) => {
              const intensity = params.data[2] ?? 0.5;
              const opacity = 0.25 + 0.65 * Math.min(intensity, 1);
              return `rgba(239,68,68,${opacity})`;
            },
          },
          barMaxWidth: 24,
        },
        {
          name: "Short liq",
          type: "bar",
          stack: "liq",
          data: chartData.map((d) => [d.price, d.shortLiq, d.intensity]),
          itemStyle: {
            color: (params: { data: [number, number, number] }) => {
              const intensity = params.data[2] ?? 0.5;
              const opacity = 0.25 + 0.65 * Math.min(intensity, 1);
              return `rgba(34,197,94,${opacity})`;
            },
          },
          barMaxWidth: 24,
          markLine: markLineData.length ? { symbol: "none", lineStyle: { width: 1 }, data: markLineData } : undefined,
        },
      ],
    } as EChartsOption;
  }, [chartData, spotPrice, strongestDownsideCluster, strongestUpsideCluster]);

  return (
    <div className="rounded-xl border border-white/10 bg-[#121826] p-5">
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-white/60">
        Liquidation pressure (modeled)
      </h2>
      <p className="mb-4 text-xs text-white/50">
        Modeled from OI, leverage buckets, and positioning assumptions. Not exact exchange data.
      </p>
      <div className="h-[320px] w-full">
        {chartData.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-white/50">
            No liquidation data
          </div>
        ) : (
          <ReactECharts option={option} notMerge style={{ height: "100%", width: "100%" }} opts={{ renderer: "canvas" }} />
        )}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-white/5 pt-3 text-xs text-white/50">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-3 rounded-sm bg-red-500/70" /> Long liq
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-3 rounded-sm bg-emerald-500/70" /> Short liq
        </span>
        <span className="text-white/40">·</span>
        <span>White dashed line = current price</span>
        {(strongestDownsideCluster != null || strongestUpsideCluster != null) && (
          <>
            <span className="text-white/40">·</span>
            <span>Red/Green dashed = strongest clusters</span>
          </>
        )}
      </div>
    </div>
  );
}
