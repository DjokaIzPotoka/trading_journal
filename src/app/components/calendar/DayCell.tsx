"use client";

import * as React from "react";
import type { CalendarDay } from "@/lib/date";

export type DayCellData = {
  dailyPnl: number;
  tradesCount: number;
  winRateDay: number;
};

type DayCellProps = {
  day: CalendarDay;
  data?: DayCellData | null;
  isSelected: boolean;
  isWeekend: boolean;
  onSelect: () => void;
};

function formatPnl(n: number): string {
  const sign = n >= 0 ? "+" : "";
  return `${sign}$${n.toFixed(2)}`;
}

export function DayCell({
  day,
  data,
  isSelected,
  isWeekend,
  onSelect,
}: DayCellProps) {
  const hasTrades = data != null && data.tradesCount > 0;
  const pnlColor =
    data != null && data.dailyPnl >= 0 ? "text-emerald-400" : "text-red-400";

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex min-h-[4.5rem] flex-col rounded-lg border p-2 text-left transition ${
        isSelected
          ? "border-blue-500 bg-blue-500/10 ring-1 ring-blue-500"
          : "border-transparent bg-transparent hover:bg-white/5"
      } ${isWeekend ? "opacity-80" : ""} ${hasTrades ? "bg-emerald-950/30" : ""}`}
    >
      <div className="flex items-start justify-between">
        <span className="text-sm font-medium text-white/90">{day.dayOfMonth}</span>
        {hasTrades && (
          <span className="text-xs text-white/70">{data!.tradesCount}</span>
        )}
      </div>
      {hasTrades && data && (
        <div className="mt-1 flex flex-col gap-0.5">
          <span className={`text-xs font-medium ${pnlColor}`}>
            {formatPnl(data.dailyPnl)}
          </span>
          {data.tradesCount > 0 && (
            <span className="text-[10px] text-white/60">
              {Math.round(data.winRateDay * 100)}% win
            </span>
          )}
        </div>
      )}
    </button>
  );
}
