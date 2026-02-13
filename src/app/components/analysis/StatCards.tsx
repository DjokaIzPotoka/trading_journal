"use client";

import * as React from "react";

export type AnalysisStats = {
  winRatePct: number;
  profitFactor: number;
  expectancy: number;
  maxDrawdown: number;
  sharpe: number;
};

type StatCardsProps = {
  stats: AnalysisStats;
};

const cardClass = "rounded-xl border border-white/10 bg-[#121826] p-4 shadow-lg";

export function StatCards({ stats }: StatCardsProps) {
  const cards: { label: string; value: string; positive?: boolean; negative?: boolean }[] = [
    {
      label: "Win Rate",
      value: `${stats.winRatePct.toFixed(1)}%`,
      positive: stats.winRatePct >= 50,
    },
    {
      label: "Profit Factor",
      value: stats.profitFactor === Infinity || stats.profitFactor > 999 ? "999.00" : stats.profitFactor.toFixed(2),
    },
    {
      label: "Expectancy",
      value: `$${stats.expectancy >= 0 ? "" : ""}${stats.expectancy.toFixed(2)}`,
      positive: stats.expectancy >= 0,
      negative: stats.expectancy < 0,
    },
    {
      label: "Max DD",
      value: `$${Math.abs(stats.maxDrawdown).toFixed(2)}`,
      negative: true,
    },
    {
      label: "Sharpe",
      value: stats.sharpe.toFixed(2),
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
      {cards.map((card) => (
        <div key={card.label} className={cardClass}>
          <p className="text-xs font-medium uppercase tracking-wider text-white/60">
            {card.label}
          </p>
          <p
            className={`mt-1 text-xl font-semibold ${
              card.positive ? "text-green-400" : ""
            } ${card.negative ? "text-red-400" : ""} ${
              !card.positive && !card.negative ? "text-white" : ""
            }`}
          >
            {card.value}
          </p>
        </div>
      ))}
    </div>
  );
}
