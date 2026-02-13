"use client";

import * as React from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

type MonthPnl = { month: string; shortLabel: string; pnl: number };

type MonthlyPerformanceProps = {
  data: MonthPnl[];
  bestMonth: string;
  bestPnl: number;
  worstMonth: string;
  worstPnl: number;
};

export function MonthlyPerformance({
  data,
  bestMonth,
  bestPnl,
  worstMonth,
  worstPnl,
}: MonthlyPerformanceProps) {
  return (
    <div className="rounded-xl border border-white/10 bg-[#121826] p-5 shadow-lg">
      <h3 className="mb-4 text-lg font-semibold text-white">Monthly Performance</h3>
      <div className="h-[260px]">
        {data.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-white/50">
            No trade data yet
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis
                dataKey="shortLabel"
                stroke="rgba(255,255,255,0.4)"
                tick={{ fill: "rgba(255,255,255,0.6)", fontSize: 11 }}
                tickLine={{ stroke: "rgba(255,255,255,0.1)" }}
              />
              <YAxis
                stroke="rgba(255,255,255,0.4)"
                tick={{ fill: "rgba(255,255,255,0.6)", fontSize: 11 }}
                tickFormatter={(v) => `$${v}`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#121826",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: "8px",
                }}
                formatter={(value, _name, props) => [
                  `$${Number(value ?? 0).toFixed(2)}`,
                  (props as { payload?: MonthPnl })?.payload?.month ?? "",
                ]}
              />
              <Bar
                dataKey="pnl"
                radius={[4, 4, 0, 0]}
                fill="#34d399"
                fillOpacity={0.9}
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
      <div className="mt-3 flex justify-between border-t border-white/10 pt-3 text-sm">
        <span className="text-white/70">
          Best Month <span className="text-green-400">{bestMonth} ({bestPnl >= 0 ? "+" : ""}${bestPnl.toFixed(2)})</span>
        </span>
        <span className="text-white/70">
          Worst Month <span className="text-red-400">{worstMonth} ({worstPnl >= 0 ? "+" : ""}${worstPnl.toFixed(2)})</span>
        </span>
      </div>
    </div>
  );
}
