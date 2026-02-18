"use client";

import * as React from "react";

type WeeklySummaryProps = {
  weekLabel: string;
  weeklyPnl: number;
  tradedDays: number;
};

function formatPnl(n: number): string {
  const sign = n >= 0 ? "+" : "";
  return `${sign}$${n.toFixed(2)}`;
}

export function WeeklySummary({
  weekLabel,
  weeklyPnl,
  tradedDays,
}: WeeklySummaryProps) {
  return (
    <div className="rounded-xl border border-white/10 bg-[#121826] p-5 shadow-lg">
      <h2 className="mb-4 text-lg font-semibold text-white">Weekly P&L</h2>
      <div className="flex items-center justify-between text-sm">
        <span className="text-white/70">{weekLabel}</span>
        <span className="text-white/60">
          {tradedDays} {tradedDays === 1 ? "day" : "days"}
        </span>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <span
          className={`text-lg font-semibold ${
            weeklyPnl >= 0 ? "text-emerald-400" : "text-red-400"
          }`}
        >
          {formatPnl(weeklyPnl)}
        </span>
        {weeklyPnl >= 0 && (
          <span className="text-emerald-400" aria-hidden>
            ↗
          </span>
        )}
      </div>
    </div>
  );
}
