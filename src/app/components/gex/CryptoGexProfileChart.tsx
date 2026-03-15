"use client";

import * as React from "react";
import ReactECharts from "echarts-for-react";
import type { EChartsOption } from "echarts";
import type { StrikeExposure } from "../../lib/market/gex";

function formatPrice(n: number): string {
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function formatGEX(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${(n / 1e3).toFixed(2)}K`;
  return n.toFixed(0);
}

export type CryptoGexProfileChartProps = {
  strikeExposures: StrikeExposure[];
  spotPrice: number;
  maxStrikes?: number;
  /** When true, section provides title; no internal heading/card wrapper */
  compact?: boolean;
};

const AXIS_LABEL = "rgba(255,255,255,0.5)";
const AXIS_LINE = "rgba(255,255,255,0.2)";
const GRID_COLOR = "rgba(255,255,255,0.06)";
const NET_GEX_COLOR = "rgba(96,165,250,0.85)";

export function CryptoGexProfileChart({
  strikeExposures,
  spotPrice,
  maxStrikes = 60,
  compact = false,
}: CryptoGexProfileChartProps) {
  const data = React.useMemo(() => {
    const slice =
      strikeExposures.length <= maxStrikes
        ? strikeExposures
        : strikeExposures.filter((_, i) => {
            const step = Math.ceil(strikeExposures.length / maxStrikes);
            return i % step === 0;
          });
    return slice.map((s) => ({
      strike: s.strike,
      netGEX: s.netExposure,
      strikeLabel: formatPrice(s.strike),
    }));
  }, [strikeExposures, maxStrikes]);

  const option: EChartsOption = React.useMemo(() => {
    if (data.length === 0) return {};

    const strikes = data.map((d) => d.strike);
    const xMin = Math.min(...strikes);
    const xMax = Math.max(...strikes);
    const xPadding = (xMax - xMin) * 0.02 || 1000;

    const markLineData: Array<{ xAxis: number; lineStyle: { color: string; type: "dashed"; width: number }; label?: { show: boolean } }> = [];
    if (spotPrice >= xMin - xPadding && spotPrice <= xMax + xPadding) {
      markLineData.push({
        xAxis: spotPrice,
        lineStyle: { color: "rgba(255,255,255,0.45)", type: "dashed", width: 1 },
        label: { show: false },
      });
    }

    return {
      backgroundColor: "transparent",
      grid: { left: 52, right: 24, top: 24, bottom: 36, containLabel: false },
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
        axisLabel: { color: AXIS_LABEL, fontSize: 10, formatter: (v: number) => formatGEX(Number(v)) },
      },
      tooltip: {
        trigger: "axis",
        backgroundColor: "#0f172a",
        borderColor: "rgba(255,255,255,0.1)",
        borderWidth: 1,
        padding: [10, 12],
        textStyle: { color: "rgba(255,255,255,0.9)", fontSize: 12 },
        formatter: (params: unknown) => {
          const arr = Array.isArray(params) ? params : [];
          const p = arr[0];
          if (!p || !p.data) return "";
          const payload = p.data as [number, number];
          const strike = payload[0];
          const netVal = payload[1];
          return [
            `<div style="font-weight:600;margin-bottom:6px;padding-bottom:6px;border-bottom:1px solid rgba(255,255,255,0.1);">Strike ${formatPrice(strike)}</div>`,
            `<div style="display:flex;justify-content:space-between;gap:16px;"><span style="color:rgba(255,255,255,0.5);">Net GEX</span><span style="color:rgba(147,197,253,0.95);font-family:monospace;">${formatGEX(netVal)}</span></div>`,
          ].join("");
        },
      },
      series: [
        {
          name: "Net GEX",
          type: "bar",
          data: data.map((d) => [d.strike, d.netGEX]),
          itemStyle: {
            color: (params: { data: [number, number] }) =>
              params.data[1] >= 0 ? NET_GEX_COLOR : "rgba(239,68,68,0.85)",
          },
          barMaxWidth: 14,
          barMinWidth: 4,
          markLine: markLineData.length ? { symbol: "none", lineStyle: { width: 1 }, data: markLineData } : undefined,
        },
      ],
    } as EChartsOption;
  }, [data, spotPrice]);

  const chart = (
    <div className="h-[280px] w-full">
      {data.length === 0 ? (
        <div className="flex h-full items-center justify-center text-sm text-white/50">
          No strike data
        </div>
      ) : (
        <ReactECharts option={option} notMerge style={{ height: "100%", width: "100%" }} opts={{ renderer: "canvas" }} />
      )}
    </div>
  );

  if (compact) return chart;
  return (
    <div className="rounded-xl border border-white/10 bg-[#121826] p-5">
      <h2 className="mb-4 text-lg font-semibold text-white">Net GEX by strike</h2>
      {chart}
    </div>
  );
}
