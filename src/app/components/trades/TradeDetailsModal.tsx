"use client";

import * as React from "react";
import { X, ArrowDownLeft, Target, DollarSign, TrendingUp, TrendingDown, Clock } from "lucide-react";
import type { Trade } from "@/app/lib/trades";

type TradeDetailsModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trade: Trade | null;
};

/** Best-effort: e.g. ADAUSDT → ADA/USDT when ending with common quote. */
function formatSymbolDisplay(symbol: string): string {
  const s = (symbol ?? "").trim().toUpperCase();
  if (!s) return "—";
  const quotes = ["USDT", "USDC", "BTC", "ETH", "BUSD", "DAI", "FDUSD", "TUSD"];
  for (const q of quotes) {
    if (s.endsWith(q) && s.length > q.length) {
      return `${s.slice(0, -q.length)}/${q}`;
    }
  }
  if (s.includes("/")) return s;
  return s;
}

function formatMoney(n: number): string {
  const sign = n >= 0 ? "+" : "";
  return `${sign}$${n.toFixed(2)}`;
}

function formatPct(n: number): string {
  const sign = n >= 0 ? "+" : "";
  return `${sign}${n.toFixed(2)}%`;
}

function formatEntryDate(iso: string): { date: string; time: string } {
  try {
    const d = new Date(iso);
    const date = d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    const time = d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
    const dayPart = d.toLocaleDateString("en-US", { weekday: "long" });
    const period = d.getHours() < 12 ? "Morning" : d.getHours() < 17 ? "Afternoon" : "Evening";
    return { date, time: `${time} • ${dayPart} ${period}` };
  } catch {
    return { date: "—", time: "—" };
  }
}

/**
 * Price movement %: LONG (exit-entry)/entry*100, SHORT (entry-exit)/entry*100.
 */
function priceMovementPercent(
  type: "long" | "short",
  entry: number,
  exit: number
): number | null {
  if (entry <= 0 || !Number.isFinite(exit)) return null;
  const raw = ((exit - entry) / entry) * 100;
  const pct = type === "long" ? raw : -raw;
  return Number.isFinite(pct) ? pct : null;
}

function derivePnlPercent(
  type: "long" | "short",
  entry_price: number,
  exit_price: number,
  existing: number | undefined
): number {
  if (existing != null && Number.isFinite(existing)) return existing;
  const p = priceMovementPercent(type, entry_price, exit_price);
  return p ?? 0;
}

export function TradeDetailsModal({ open, onOpenChange, trade }: TradeDetailsModalProps) {
  const [pnlToggle, setPnlToggle] = React.useState<"$" | "%">("$");

  React.useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onOpenChange]);

  React.useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  if (!open || !trade) return null;

  const entry = trade.entry_price ?? 0;
  const exit = trade.exit_price ?? 0;
  const pnl = trade.pnl ?? 0;
  const pnlPercent = derivePnlPercent(
    trade.type,
    entry,
    exit,
    trade.pnl_percent
  );
  const movementPct = priceMovementPercent(trade.type, entry, exit);
  const pnlPositive = pnl >= 0;
  const entryTiming = formatEntryDate(trade.created_at);

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={() => onOpenChange(false)}
        aria-hidden
      />
      <div className="flex min-h-full flex-col items-center justify-center py-8 px-4">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="trade-details-title"
          className="relative z-10 w-full max-w-md overflow-hidden rounded-[20px] border border-white/10 bg-zinc-900/95 shadow-2xl backdrop-blur-xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/5 text-muted-foreground">
                <ArrowDownLeft className="h-4 w-4" />
              </div>
              <h2
                id="trade-details-title"
                className="text-lg font-bold text-white"
              >
                {formatSymbolDisplay(trade.symbol)}
              </h2>
              <span
                className={`inline-flex rounded-lg px-2.5 py-1 text-xs font-semibold ${
                  trade.type === "long"
                    ? "bg-emerald-500/20 text-emerald-400"
                    : "bg-red-500/20 text-red-400"
                }`}
              >
                {trade.type.toUpperCase()}
              </span>
              <span className="inline-flex rounded-lg bg-zinc-700/80 px-2.5 py-1 text-xs font-medium text-zinc-300 capitalize">
                {trade.market}
              </span>
            </div>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="rounded-lg p-2 text-zinc-400 hover:bg-white/10 hover:text-white transition-colors"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="space-y-4 px-5 py-5">
            {/* Profit block — green background, green text (like design) */}
            <div
              className={`rounded-xl px-4 py-4 ${
                pnlPositive
                  ? "bg-emerald-500/25 border border-emerald-500/30"
                  : "bg-red-500/25 border border-red-500/30"
              }`}
            >
              <div className="flex justify-end">
                <p
                  className={`text-xs font-medium uppercase tracking-wider ${
                    pnlPositive ? "text-emerald-200" : "text-red-200"
                  }`}
                >
                  Profit
                </p>
              </div>
              <div className="mt-1 flex items-center justify-between gap-3">
                <span
                  className={`text-2xl font-bold tabular-nums ${
                    pnlPositive ? "text-emerald-400" : "text-red-400"
                  }`}
                >
                  {pnlToggle === "$" ? formatMoney(pnl) : formatPct(pnlPercent)}
                </span>
                <span
                  className={`flex rounded-lg p-0.5 ${
                    pnlPositive
                      ? "bg-emerald-500/30 border border-emerald-400/30"
                      : "bg-red-500/30 border border-red-400/30"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setPnlToggle("$")}
                    className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                      pnlToggle === "$"
                        ? pnlPositive
                          ? "bg-emerald-400 text-emerald-950"
                          : "bg-red-400 text-red-950"
                        : pnlPositive
                          ? "text-emerald-200 hover:text-emerald-50"
                          : "text-red-200 hover:text-red-50"
                    }`}
                  >
                    $
                  </button>
                  <button
                    type="button"
                    onClick={() => setPnlToggle("%")}
                    className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                      pnlToggle === "%"
                        ? pnlPositive
                          ? "bg-emerald-400 text-emerald-950"
                          : "bg-red-400 text-red-950"
                        : pnlPositive
                          ? "text-emerald-200 hover:text-emerald-50"
                          : "text-red-200 hover:text-red-50"
                    }`}
                  >
                    %
                  </button>
                </span>
              </div>
              <p
                className={`mt-1 text-sm ${
                  pnlPositive ? "text-emerald-400" : "text-red-400"
                }`}
              >
                {pnlToggle === "$" ? formatPct(pnlPercent) : formatMoney(pnl)}
              </p>
            </div>

            {/* Prices block — Entry + Exit */}
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-xl bg-zinc-800/50 border border-white/5 px-4 py-3">
                <div className="flex items-center gap-2 text-zinc-400">
                  <Target className="h-3.5 w-3.5" />
                  <p className="text-xs font-medium uppercase tracking-wider">
                    Entry Price
                  </p>
                </div>
                <p className="mt-1.5 text-lg font-bold text-white">
                  {entry > 0 ? `$${entry.toFixed(2)}` : "—"}
                </p>
              </div>
              <div className="rounded-xl bg-zinc-800/50 border border-white/5 px-4 py-3">
                <div className="flex items-center gap-2 text-zinc-400">
                  <DollarSign className="h-3.5 w-3.5" />
                  <p className="text-xs font-medium uppercase tracking-wider">
                    Exit Price
                  </p>
                </div>
                <p className="mt-1.5 text-lg font-bold text-white">
                  {exit > 0 ? `$${exit.toFixed(2)}` : "—"}
                </p>
              </div>
            </div>

            {/* Price Movement — panel with trend icon */}
            {movementPct != null && (
              <div
                className={`rounded-xl border px-4 py-3 ${
                  movementPct >= 0
                    ? "bg-emerald-500/10 border-emerald-500/20"
                    : "bg-red-500/10 border-red-500/20"
                }`}
              >
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium uppercase tracking-wider text-zinc-400">
                    Price Movement
                  </p>
                  <span
                    className={`flex items-center gap-1.5 text-lg font-bold ${
                      movementPct >= 0 ? "text-emerald-400" : "text-red-400"
                    }`}
                  >
                    {movementPct >= 0 ? (
                      <TrendingUp className="h-5 w-5" />
                    ) : (
                      <TrendingDown className="h-5 w-5" />
                    )}
                    {formatPct(movementPct)}
                  </span>
                </div>
              </div>
            )}

            {/* Entry date — single line */}
            <div className="flex items-center gap-2 text-sm text-zinc-400">
              <Clock className="h-4 w-4 shrink-0" />
              <span>
                {entryTiming.date}
                {entryTiming.time !== "—" && (
                  <span className="ml-1.5 text-zinc-500">{entryTiming.time}</span>
                )}
              </span>
            </div>

            {/* Bottom info cards */}
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-lg bg-zinc-800/80 border border-white/5 px-3 py-2.5">
                <p className="text-xs font-medium text-zinc-400">Risk %</p>
                <p className="mt-0.5 text-sm font-medium text-white">—</p>
              </div>
              <div className="rounded-lg bg-zinc-800/80 border border-white/5 px-3 py-2.5">
                <p className="text-xs font-medium text-zinc-400">R:R Ratio</p>
                <p className="mt-0.5 text-sm font-medium text-white">—</p>
              </div>
              <div className="rounded-lg bg-zinc-800/80 border border-white/5 px-3 py-2.5">
                <p className="text-xs font-medium text-zinc-400">A+ Setup</p>
                <p className="mt-0.5 text-sm font-medium text-white">No</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
