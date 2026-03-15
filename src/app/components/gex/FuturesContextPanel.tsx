"use client";

import * as React from "react";
import type { BinanceFuturesSnapshot } from "../../lib/market/types";

function formatPrice(n: number): string {
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 2, minimumFractionDigits: 2 })}`;
}

export type FuturesContextPanelProps = {
  futures: BinanceFuturesSnapshot | null;
  fallbackMessage?: string;
};

export function FuturesContextPanel({
  futures,
  fallbackMessage = "Futures data unavailable.",
}: FuturesContextPanelProps) {
  if (!futures) {
    return (
      <div className="rounded-xl border border-white/10 bg-[#121826] p-5">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-white/60">
          Futures context
        </h2>
        <p className="text-sm text-white/50">{fallbackMessage}</p>
      </div>
    );
  }

  const oiDir =
    futures.openInterestChange24h != null
      ? futures.openInterestChange24h >= 0
        ? "expanding"
        : "contracting"
      : null;
  const fundingPct = (futures.fundingRate * 100).toFixed(4);
  const bias =
    futures.fundingRate > 0.0001
      ? "Longs pay shorts (crowded longs)"
      : futures.fundingRate < -0.0001
        ? "Shorts pay longs (crowded shorts)"
        : "Neutral";

  return (
    <div className="rounded-xl border border-white/10 bg-[#121826] p-5">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-white/60">
        Futures context
      </h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-white/60">
            Price / Mark
          </p>
          <p className="mt-1 text-white">
            {formatPrice(futures.price)} / {formatPrice(futures.markPrice)}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-white/60">
            Funding rate
          </p>
          <p className="mt-1 text-white">{fundingPct}%</p>
          <p className="text-xs text-white/50">{bias}</p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-white/60">
            Open interest
          </p>
          <p className="mt-1 text-white">
            {futures.openInterest.toLocaleString(undefined, {
              maximumFractionDigits: 0,
            })}
          </p>
          {oiDir != null && (
            <p className="text-xs text-white/50">OI {oiDir}</p>
          )}
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-white/60">
            Market bias
          </p>
          <p className="mt-1 text-sm text-white/70">
            {futures.fundingRate > 0.0002
              ? "Positioning skewed long"
              : futures.fundingRate < -0.0002
                ? "Positioning skewed short"
                : "Balanced"}
          </p>
        </div>
      </div>
      <p className="mt-4 text-sm text-white/60">
        Is positioning crowded? Funding stretched? OI expanding or contracting?
        Use the above for context. Data from Binance USD-M futures.
      </p>
    </div>
  );
}
