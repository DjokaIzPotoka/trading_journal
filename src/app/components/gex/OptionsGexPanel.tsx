"use client";

import * as React from "react";
import type { GEXResult } from "../../lib/market/gex";

function formatPrice(n: number): string {
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 2, minimumFractionDigits: 2 })}`;
}

function formatGEX(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${(n / 1e3).toFixed(2)}K`;
  return n.toFixed(0);
}

export type OptionsGexPanelProps = {
  gex: GEXResult | null;
  fallbackMessage?: string;
};

export function OptionsGexPanel({
  gex,
  fallbackMessage = "Options GEX data unavailable.",
}: OptionsGexPanelProps) {
  if (!gex) {
    return (
      <div className="rounded-xl border border-white/10 bg-[#121826] p-5">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-white/60">
          Options GEX
        </h2>
        <p className="text-sm text-white/50">{fallbackMessage}</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-white/10 bg-[#121826] p-5">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-white/60">
        Options GEX (Deribit)
      </h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-white/60">
            Net GEX
          </p>
          <p
            className={`mt-1 text-lg font-semibold ${
              gex.netGEX >= 0 ? "text-emerald-400" : "text-red-400"
            }`}
          >
            {formatGEX(gex.netGEX)}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-white/60">
            Call GEX
          </p>
          <p className="mt-1 text-lg font-semibold text-emerald-400/90">
            {formatGEX(gex.callGEX)}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-white/60">
            Put GEX
          </p>
          <p className="mt-1 text-lg font-semibold text-red-400/90">
            {formatGEX(gex.putGEX)}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-white/60">
            Zero gamma
          </p>
          <p className="mt-1 text-white">
            {gex.zeroGammaLevel != null
              ? formatPrice(gex.zeroGammaLevel)
              : "—"}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-white/60">
            Call wall
          </p>
          <p className="mt-1 text-white">
            {gex.callWall != null ? formatPrice(gex.callWall) : "—"}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-white/60">
            Put wall
          </p>
          <p className="mt-1 text-white">
            {gex.putWall != null ? formatPrice(gex.putWall) : "—"}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-white/60">
            Strongest + strike
          </p>
          <p className="mt-1 text-white">
            {gex.strongestPositiveStrike != null
              ? formatPrice(gex.strongestPositiveStrike)
              : "—"}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-white/60">
            Strongest − strike
          </p>
          <p className="mt-1 text-white">
            {gex.strongestNegativeStrike != null
              ? formatPrice(gex.strongestNegativeStrike)
              : "—"}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-white/60">
            Nearest expiry
          </p>
          <p className="mt-1 text-white">{gex.nearestExpirationUsed}</p>
        </div>
      </div>
    </div>
  );
}
