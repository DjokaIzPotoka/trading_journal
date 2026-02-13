"use client";

import * as React from "react";

type StatCardsProps = {
  totalBalance: number;
  totalPnl: number;
  winRatePct: number;
  totalTrades: number;
  totalFees?: number;
  avgWin?: number | null;
  avgLoss?: number | null;
};

function formatMoney(n: number): string {
  const sign = n < 0 ? "-" : "";
  return `${sign}$${Math.abs(n).toFixed(2)}`;
}

export function StatCards({
  totalBalance,
  totalPnl,
  winRatePct,
  totalTrades,
  totalFees = 0,
  avgWin = null,
  avgLoss = null,
}: StatCardsProps) {
  const cards: { label: string; value: string; sub?: string; positive?: boolean }[] = [
    { label: "Total Balance", value: formatMoney(totalBalance) },
    {
      label: "Total P&L",
      value: formatMoney(totalPnl),
      sub: totalPnl >= 0 ? "+0.00% vs cost" : "",
      positive: totalPnl >= 0,
    },
    { label: "Win Rate", value: `${winRatePct.toFixed(1)}%` },
    { label: "Total Trades", value: String(totalTrades) },
    { label: "Total Fees", value: formatMoney(totalFees) },
    {
      label: "Avg Win",
      value: avgWin != null ? formatMoney(avgWin) : "$0.00",
      positive: true,
    },
    {
      label: "Avg Loss",
      value: avgLoss != null ? formatMoney(avgLoss) : "$0.00",
      positive: false,
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-7">
      {cards.map((card) => (
        <div
          key={card.label}
          className="rounded-xl border border-white/10 bg-[#121826] p-4 shadow-lg"
        >
          <p className="text-xs font-medium uppercase tracking-wider text-white/60">
            {card.label}
          </p>
          <p
            className={`mt-1 text-xl font-semibold ${
              card.positive === true ? "text-emerald-400" : ""
            } ${card.positive === false ? "text-red-400" : ""} ${
              card.positive === undefined ? "text-white" : ""
            }`}
          >
            {card.value}
          </p>
          {card.sub != null && card.sub !== "" && (
            <p className="mt-0.5 flex items-center gap-1 text-xs text-emerald-400">
              <span aria-hidden>↑</span> {card.sub}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
