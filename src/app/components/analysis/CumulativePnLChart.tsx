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
  totalPnl: number;
};

export function CumulativePnLChart({ data, totalPnl }: CumulativePnLChartProps) {
  return (
    <div className="rounded-xl border border-white/10 bg-[#121826] p-5 shadow-lg">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">Cumulative P&L</h3>
        <span className={`text-lg font-semibold ${totalPnl >= 0 ? "text-green-400" : "text-red-400"}`}>
          {totalPnl >= 0 ? "+" : ""}${totalPnl.toFixed(2)}
        </span>
      </div>
      <div className="h-[280px] w-full">
        {data.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-white/50">
            No trade data yet
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
              <defs>
                <linearGradient id="analysisCumulativeGradient" x1="0" y1="0" x2="0" y2="1">
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
              />
              <Area
                type="monotone"
                dataKey="cumulativePnl"
                stroke="#34d399"
                strokeWidth={2}
                fill="url(#analysisCumulativeGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
