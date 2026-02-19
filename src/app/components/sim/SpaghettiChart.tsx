"use client";

import * as React from "react";
import ReactECharts from "echarts-for-react";
import type { EChartsOption } from "echarts";
import { formatBalance, formatAxisLabel, type DisplayMode } from "@/lib/sim/format";

const CHART_BG = "transparent";
const GRID = { left: 52, right: 28, top: 28, bottom: 52 };
const AXIS_LABEL = { color: "rgba(255,255,255,0.5)" };
const SPLIT_LINE = { lineStyle: { color: "rgba(255,255,255,0.06)" } };
const GRAY = "rgba(255,255,255,0.15)";
const GREEN = "#34d399";
const LOG_MIN = 1e-6;

type SpaghettiChartProps = {
  x: number[];
  paths: number[][];
  highlight?: number[];
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
  x: number[],
  paths: number[][],
  highlight: number[] | undefined,
  yMin: number | undefined,
  yMax: number | undefined,
  displayMode: DisplayMode,
  yAxisType: "value" | "log"
): EChartsOption {
  if (x.length === 0) {
    return { backgroundColor: CHART_BG, grid: GRID };
  }

  const xData = x.map((v) => `Day ${v}`);

  const series: EChartsOption["series"] = paths.map((data) => {
    const isHighlight =
      highlight &&
      data.length === highlight.length &&
      data.every((v, j) => v === highlight[j]);
    const plotData = yAxisType === "log" ? data.map(clampForLog) : data;
    return {
      type: "line",
      data: plotData,
      lineStyle: {
        color: isHighlight ? GREEN : GRAY,
        width: isHighlight ? 2.5 : 1,
        opacity: isHighlight ? 1 : 0.4,
      },
      showSymbol: false,
      emphasis: { disabled: !isHighlight },
      tooltip: isHighlight
        ? {
            show: true,
            trigger: "axis",
            formatter: () => {
              return data
                .map((v, j) => `Day ${x[j]}: ${formatBalance(v, displayMode)}`)
                .join("<br/>");
            },
          }
        : { show: false },
    };
  });

  const resolvedYMin =
    yAxisType === "log" && yMin != null ? Math.max(LOG_MIN, yMin) : yMin;

  const tooltipFormatter = (params: unknown) => {
    const arr = Array.isArray(params) ? params : [];
    if (arr.length === 0) return "";
    const first = arr[0];
    const dataIndex = first?.dataIndex;
    if (dataIndex == null || dataIndex < 0 || dataIndex >= x.length) return "";
    const day = x[dataIndex];
    const lines = arr.map((p: { seriesName?: string; value?: number }) => {
      const v = typeof p?.value === "number" ? p.value : 0;
      return `${p?.seriesName ?? ""}: ${formatBalance(v, displayMode)}`;
    }).filter(Boolean);
    return `Day ${day}<br/>` + lines.join("<br/>");
  };

  return {
    backgroundColor: CHART_BG,
    grid: GRID,
    tooltip: {
      trigger: "axis",
      backgroundColor: "#0f172a",
      borderColor: "rgba(255,255,255,0.1)",
      borderWidth: 1,
      padding: 10,
      textStyle: { color: "rgba(255,255,255,0.9)", fontSize: 12 },
      axisPointer: { type: "cross" },
      formatter: tooltipFormatter,
    },
    xAxis: {
      type: "category",
      data: xData,
      axisLabel: AXIS_LABEL,
      axisLine: { lineStyle: { color: "rgba(255,255,255,0.1)" } },
      splitLine: SPLIT_LINE,
    },
    yAxis: {
      type: yAxisType,
      axisLabel: {
        ...AXIS_LABEL,
        formatter: (value: number) => formatAxisLabel(value, displayMode),
      },
      axisLine: { show: false },
      splitLine: SPLIT_LINE,
      nameTextStyle: AXIS_LABEL,
      min: resolvedYMin,
      max: yMax,
    },
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
    series,
    animation: false,
  };
}

export function SpaghettiChart({
  x,
  paths,
  highlight,
  yMin,
  yMax,
  displayMode,
  yAxisType,
  onExpand,
  containerClassName = "h-[320px] w-full",
}: SpaghettiChartProps) {
  const option = React.useMemo(
    () =>
      buildOption(
        x,
        paths,
        highlight,
        yMin,
        yMax,
        displayMode,
        yAxisType
      ),
    [x, paths, highlight, yMin, yMax, displayMode, yAxisType]
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
