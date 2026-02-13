"use client";

import * as React from "react";
import Link from "next/link";
import type { Trade } from "../../lib/trades";

type RecentTradesProps = {
  trades: Trade[];
};

function formatMoney(n: number): string {
  const sign = n >= 0 ? "+" : "";
  return `${sign}$${n.toFixed(2)}`;
}

function formatPct(n: number): string {
  const sign = n >= 0 ? "+" : "";
  return `${sign}${n.toFixed(2)}%`;
}

export function RecentTrades({ trades }: RecentTradesProps) {
  return (
    <div className="rounded-xl border border-white/10 bg-[#121826] p-5 shadow-lg">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">Recent Trades</h2>
        <Link
          href="/trades"
          className="text-sm font-medium text-emerald-400 hover:text-emerald-300"
        >
          View All
        </Link>
      </div>
      {trades.length === 0 ? (
        <p className="py-6 text-center text-sm text-white/50">No trades yet.</p>
      ) : (
        <ul className="space-y-3">
          {trades.map((t) => {
            const isWin = t.pnl >= 0;
            return (
              <li
                key={t.id}
                className="flex flex-wrap items-center gap-2 rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2.5"
              >
                <span
                  className={`flex h-6 w-6 items-center justify-center rounded ${
                    isWin ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"
                  }`}
                  aria-hidden
                >
                  {isWin ? "↑" : "↓"}
                </span>
                <span className="font-medium text-white">{t.symbol}</span>
                <span
                  className={`rounded px-2 py-0.5 text-xs font-medium ${
                    t.type === "long"
                      ? "bg-emerald-500/20 text-emerald-400"
                      : "bg-red-500/20 text-red-400"
                  }`}
                >
                  {t.type.toUpperCase()}
                </span>
                <span className="text-sm text-white/60">
                  ${t.entry_price.toFixed(2)} → ${t.exit_price.toFixed(2)}
                </span>
                <span className={isWin ? "text-emerald-400" : "text-red-400"}>
                  {formatMoney(t.pnl)}
                </span>
                <span className={`text-sm ${isWin ? "text-emerald-400" : "text-red-400"}`}>
                  {formatPct(t.pnl_percent)}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
