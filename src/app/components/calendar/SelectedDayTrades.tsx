"use client";

import * as React from "react";
import { isSameDay, getTradeDate, formatShortDate } from "@/lib/date";
import type { Trade } from "../../lib/trades";

const MAX_VISIBLE = 5;

type SelectedDayTradesProps = {
  selectedDate: Date;
  trades: Trade[];
};

function formatPnl(n: number): string {
  const sign = n >= 0 ? "+" : "";
  return `${sign}$${n.toFixed(2)}`;
}

export function SelectedDayTrades({ selectedDate, trades }: SelectedDayTradesProps) {
  const dayTrades = React.useMemo(() => {
    const list = trades.filter((t) =>
      isSameDay(getTradeDate(t.created_at), selectedDate)
    );
    list.sort(
      (a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
    return list;
  }, [trades, selectedDate]);

  const visible = dayTrades.slice(0, MAX_VISIBLE);
  const remaining = dayTrades.length - MAX_VISIBLE;

  return (
    <div className="rounded-xl border border-white/10 bg-[#121826] p-5 shadow-lg">
      <h2 className="mb-4 text-lg font-semibold text-white">
        Selected Day
      </h2>
      <p className="mb-3 text-xs text-white/60">
        {formatShortDate(selectedDate)}
      </p>

      {dayTrades.length === 0 ? (
        <p className="py-4 text-center text-sm text-white/50">
          No trades for this day.
        </p>
      ) : (
        <ul className="space-y-2">
          {visible.map((t) => (
            <li
              key={t.id}
              className="flex items-center justify-between border-b border-white/5 py-2 last:border-0"
            >
              <div className="flex items-center gap-2">
                <span className="font-medium text-white">{t.symbol}</span>
                <span
                  className={`rounded px-1.5 py-0.5 text-[10px] font-medium uppercase ${
                    t.type === "long"
                      ? "bg-emerald-500/20 text-emerald-400"
                      : "bg-red-500/20 text-red-400"
                  }`}
                >
                  {t.type}
                </span>
              </div>
              <span
                className={
                  t.pnl >= 0 ? "text-emerald-400" : "text-red-400"
                }
              >
                {formatPnl(t.pnl)}
              </span>
            </li>
          ))}
        </ul>
      )}

      {remaining > 0 && (
        <button
          type="button"
          onClick={() => {}}
          className="mt-3 w-full text-center text-sm font-medium text-white/70 hover:text-white"
        >
          View all ({dayTrades.length})
        </button>
      )}
    </div>
  );
}
