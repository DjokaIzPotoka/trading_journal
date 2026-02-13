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
  Cell,
} from "recharts";

type DayPnl = { day: number; pnl: number; trades: number; winRate: number };

type PerformanceByDayOfMonthProps = {
  data: DayPnl[];
};

export function PerformanceByDayOfMonth({ data }: PerformanceByDayOfMonthProps) {
  return (
    <div className="rounded-xl border border-white/10 bg-[#121826] p-5 shadow-lg">
      <h3 className="mb-4 text-lg font-semibold text-white">Performance by Day of Month</h3>
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
                dataKey="day"
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
                formatter={(value, _name, props) => {
                  const p = (props as { payload?: DayPnl })?.payload;
                  return [
                    `$${Number(value ?? 0).toFixed(2)}`,
                    p ? `Day ${p.day} · ${p.trades} trades · ${p.winRate.toFixed(0)}% win` : "",
                  ];
                }}
              />
              <Bar dataKey="pnl" radius={[4, 4, 0, 0]} fillOpacity={0.9}>
                {data.map((entry, index) => (
                  <Cell key={index} fill={entry.pnl >= 0 ? "#34d399" : "#f87171"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
      {data.some((d) => d.trades > 0) && (
        <div className="mt-3 flex flex-wrap gap-4 border-t border-white/10 pt-3 text-xs text-white/70">
          {data.filter((d) => d.trades > 0).map((d) => (
            <span key={d.day}>
              Day {d.day} {d.winRate.toFixed(0)}% {d.trades} trades
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
