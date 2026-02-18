"use client";

import * as React from "react";
import { formatMonthYear } from "@/lib/date";

type MonthNavigatorProps = {
  monthDate: Date;
  onPrev: () => void;
  onNext: () => void;
  monthPnl?: number;
  daysTraded?: number;
};

function formatPnl(n: number): string {
  const sign = n >= 0 ? "+" : "";
  return `${sign}$${n.toFixed(2)}`;
}

export function MonthNavigator({
  monthDate,
  onPrev,
  onNext,
  monthPnl = 0,
  daysTraded = 0,
}: MonthNavigatorProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-3">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onPrev}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-white/80 transition hover:bg-white/10"
          aria-label="Previous month"
        >
          ‹
        </button>
        <span className="min-w-[7rem] text-center text-lg font-semibold text-white">
          {formatMonthYear(monthDate)}
        </span>
        <button
          type="button"
          onClick={onNext}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-white/80 transition hover:bg-white/10"
          aria-label="Next month"
        >
          ›
        </button>
      </div>
      <div className="text-sm text-white/70">
        P&L:{" "}
        <span className={monthPnl >= 0 ? "text-emerald-400" : "text-red-400"}>
          {formatPnl(monthPnl)}
        </span>{" "}
        {daysTraded} {daysTraded === 1 ? "day" : "days"}
      </div>
    </div>
  );
}
