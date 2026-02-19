"use client";

import * as React from "react";
import ReactECharts from "echarts-for-react";
import type { EChartsOption } from "echarts";
import { formatBalance, formatAxisLabel, type DisplayMode } from "@/lib/sim/format";

const CHART_BG = "transparent";
const GRID = { left: 52, right: 28, top: 48, bottom: 52 };
const AXIS_LABEL = { color: "rgba(255,255,255,0.5)" };
const SPLIT_LINE = { lineStyle: { color: "rgba(255,255,255,0.06)" } };
const GREEN = "#34d399";
const PERCENTILES = [10, 20, 30, 40, 50, 60, 70, 80, 90] as const;
const LOG_MIN = 1e-6;

export type FanChartSeries = {
  x: number[];
  bands: Record<number, number[]>;
  centerLine: number[];
  centerLineLabel: string;
};

type FanChartProps = {
  series: FanChartSeries;
  title?: string;
  yMin?: number;
  yMax?: number;
  displayMode: DisplayMode;
  yAxisType: "value" | "log";
  onExpand?: () => void;
  containerClassName?: string;
};

function clampForLog(v: number): number {
  return v <= 0 ? LOG_MIN : v;
}

function buildOption(
  series: FanChartSeries,
  title: string | undefined,
  yMin: number | undefined,
  yMax: number | undefined,
  displayMode: DisplayMode,
  yAxisType: "value" | "log"
): EChartsOption {
  const { x, bands, centerLine, centerLineLabel } = series;
  if (x.length === 0) {
    return { backgroundColor: CHART_BG, grid: GRID };
  }

  const xData = x.map((v) => `Day ${v}`);

  const seriesList: EChartsOption["series"] = [];

  PERCENTILES.forEach((p) => {
    const arr = bands[p];
    if (!arr) return;
    const isMedian = p === 50;
    const distanceFromCenter = Math.abs(p - 50) / 40;
    const opacity = isMedian ? 1 : Math.max(0.25, 1 - distanceFromCenter * 0.65);
    const name = isMedian ? centerLineLabel : `Pct${p}`;
    seriesList.push({
      name,
      type: "line",
      data: yAxisType === "log" ? arr.map(clampForLog) : arr,
      lineStyle: {
        color: GREEN,
        width: isMedian ? 2.5 : 1,
        opacity,
      },
      showSymbol: false,
      smooth: false,
      emphasis: { focus: "series" },
    });
  });

  const tooltipPercs = [10, 50, 90];
  const formatter = (params: unknown) => {
    const arr = Array.isArray(params) ? params : [];
    const idx = arr[0]?.dataIndex;
    if (idx == null) return "";
    let s = `<div style="padding:4px 0">Day ${x[idx]}</div>`;
    tooltipPercs.forEach((p) => {
      const v = bands[p]?.[idx];
      if (v != null) s += `<div>P${p}: ${formatBalance(v, displayMode)}</div>`;
    });
    s += `<div>${centerLineLabel}: ${formatBalance(centerLine[idx] ?? 0, displayMode)}</div>`;
    return s;
  };

  const resolvedYMin =
    yAxisType === "log" && yMin != null ? Math.max(LOG_MIN, yMin) : yMin;
  const resolvedYMax = yMax;

  const yAxis: EChartsOption["yAxis"] = {
    type: yAxisType,
    axisLabel: {
      ...AXIS_LABEL,
      formatter: (value: number) => formatAxisLabel(value, displayMode),
    },
    axisLine: { show: false },
    splitLine: SPLIT_LINE,
    nameTextStyle: AXIS_LABEL,
    min: resolvedYMin,
    max: resolvedYMax,
  };

  return {
    backgroundColor: CHART_BG,
    grid: GRID,
    title: title
      ? {
          text: title,
          left: 0,
          top: 0,
          textStyle: { color: "rgba(255,255,255,0.9)", fontSize: 14 },
        }
      : undefined,
    legend: {
      type: "scroll",
      top: 0,
      right: 8,
      textStyle: { color: "rgba(255,255,255,0.7)", fontSize: 11 },
      pageButtonItemGap: 4,
      pageIconColor: "rgba(255,255,255,0.5)",
      pageTextStyle: { color: "rgba(255,255,255,0.5)" },
      data: [
        centerLineLabel,
        ...PERCENTILES.filter((p) => p !== 50).map((p) => `Pct${p}`),
      ],
    },
    tooltip: {
      trigger: "axis",
      backgroundColor: "#0f172a",
      borderColor: "rgba(255,255,255,0.1)",
      borderWidth: 1,
      padding: 10,
      textStyle: { color: "rgba(255,255,255,0.9)", fontSize: 12 },
      formatter,
      axisPointer: { type: "cross" },
    },
    xAxis: {
      type: "category",
      data: xData,
      axisLabel: AXIS_LABEL,
      axisLine: { lineStyle: { color: "rgba(255,255,255,0.1)" } },
      splitLine: SPLIT_LINE,
    },
    yAxis,
    dataZoom: [
      { type: "inside", xAxisIndex: 0, filterMode: "none" },
      { type: "slider", xAxisIndex: 0, height: 18, bottom: 8 },
      { type: "inside", yAxisIndex: 0, filterMode: "none" },
    ],
    toolbox: {
      right: 8,
      top: 8,
      feature: {
        dataZoom: { yAxisIndex: "none" },
        restore: {},
      },
      iconStyle: { borderColor: "rgba(255,255,255,0.5)" },
      emphasis: { iconStyle: { borderColor: "rgba(255,255,255,0.9)" } },
    },
    series: seriesList,
    animation: false,
  };
}

export function FanChart({
  series,
  title,
  yMin,
  yMax,
  displayMode,
  yAxisType,
  onExpand,
  containerClassName = "h-[320px] w-full",
}: FanChartProps) {
  const option = React.useMemo(
    () => buildOption(series, title, yMin, yMax, displayMode, yAxisType),
    [series, title, yMin, yMax, displayMode, yAxisType]
  );

  return (
    <div className="relative">
      {onExpand && (
        <button
          type="button"
          onClick={onExpand}
          className="absolute right-2 top-2 z-10 flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-[#121826] text-white/70 transition hover:bg-white/10 hover:text-white"
          aria-label="Expand chart"
        >
          <ExpandIcon />
        </button>
      )}
      <div className={containerClassName}>
        <ReactECharts option={option} notMerge style={{ height: "100%", width: "100%" }} />
      </div>
    </div>
  );
}

function ExpandIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3" />
    </svg>
  );
}
