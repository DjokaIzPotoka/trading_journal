"use client";

import * as React from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

export type CumulativePnLPoint = {
  date: string;
  cumulativePnl: number;
  displayDate: string;
};

type CumulativePnLChartProps = {
  data: CumulativePnLPoint[];
  range: "7D" | "30D" | "90D";
  onRangeChange: (range: "7D" | "30D" | "90D") => void;
};

export function CumulativePnLChart({ data, range, onRangeChange }: CumulativePnLChartProps) {
  const ranges: ("7D" | "30D" | "90D")[] = ["7D", "30D", "90D"];

  return (
    <div className="rounded-xl border border-white/10 bg-[#121826] p-5 shadow-lg">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-white">Cumulative P&L</h2>
        <div className="flex gap-2">
          {ranges.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => onRangeChange(r)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                range === r
                  ? "bg-white/10 text-white"
                  : "text-white/60 hover:text-white hover:bg-white/5"
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>
      <div className="h-[280px] w-full">
        {data.length === 0 ? (
          <div className="flex h-full items-center justify-center text-white/50 text-sm">
            No trade data yet
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
              <defs>
                <linearGradient id="cumulativePnlGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#34d399" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#34d399" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
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
                fill="url(#cumulativePnlGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
