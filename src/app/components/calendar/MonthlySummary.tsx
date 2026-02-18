"use client";

import * as React from "react";

type MonthlySummaryProps = {
  netPnl: number;
  totalTrades: number;
  winningDays: number;
  losingDays: number;
  winRatePct: number;
};

function formatPnl(n: number): string {
  const sign = n >= 0 ? "+" : "";
  return `${sign}$${n.toFixed(2)}`;
}

export function MonthlySummary({
  netPnl,
  totalTrades,
  winningDays,
  losingDays,
  winRatePct,
}: MonthlySummaryProps) {
  const rows: { label: string; value: string; positive?: boolean }[] = [
    { label: "Net P&L", value: formatPnl(netPnl), positive: netPnl >= 0 },
    { label: "Total Trades", value: String(totalTrades) },
    { label: "Winning Days", value: String(winningDays), positive: true },
    { label: "Losing Days", value: String(losingDays), positive: false },
    { label: "Win Rate", value: `${winRatePct.toFixed(1)}%` },
  ];

  return (
    <div className="rounded-xl border border-white/10 bg-[#121826] p-5 shadow-lg">
      <h2 className="mb-4 text-lg font-semibold text-white">Monthly Summary</h2>
      <dl className="space-y-3">
        {rows.map(({ label, value, positive }) => (
          <div
            key={label}
            className="flex items-center justify-between text-sm"
          >
            <dt className="text-white/70">{label}</dt>
            <dd
              className={`font-semibold ${
                positive === true
                  ? "text-emerald-400"
                  : positive === false
                    ? "text-red-400"
                    : "text-white"
              }`}
            >
              {value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
