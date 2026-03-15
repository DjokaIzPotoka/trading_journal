"use client";

import * as React from "react";
import type { LiquidationSummary } from "../../lib/market/types";

function formatPrice(n: number): string {
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

export type LiquidationZonesCardProps = {
  summary: LiquidationSummary | null;
  spotPrice: number;
};

export function LiquidationZonesCard({
  summary,
  spotPrice,
}: LiquidationZonesCardProps) {
  if (!summary) {
    return (
      <div className="rounded-xl border border-white/10 bg-[#121826] p-5">
        <h2 className="mb-2 text-lg font-semibold text-white">
          Liquidation zones
        </h2>
        <p className="text-sm text-white/50">Estimated model unavailable.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-white/10 bg-[#121826] p-5">
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-white/60">
        Key liquidation zones (estimated)
      </h2>
      <p className="mb-4 text-xs text-white/50">
        Modeled from OI, leverage buckets, and positioning assumptions. Not exact exchange data.
      </p>
      {summary.marketBias != null && summary.marketBias !== "" && (
        <p className="mb-3 text-xs font-medium uppercase tracking-wider text-white/60">
          Crowding: {summary.marketBias}
        </p>
      )}
      <ul className="space-y-2 text-sm text-white/70">
        {summary.strongestDownsideCluster != null && (
          <li>
            <span className="text-white/50">Strongest downside cluster:</span>{" "}
            {formatPrice(summary.strongestDownsideCluster)}
          </li>
        )}
        {summary.strongestUpsideCluster != null && (
          <li>
            <span className="text-white/50">Strongest upside cluster:</span>{" "}
            {formatPrice(summary.strongestUpsideCluster)}
          </li>
        )}
        {summary.nearestDownsideFlushZone != null && (
          <li>
            <span className="text-white/50">Nearest downside flush zone:</span>{" "}
            {formatPrice(summary.nearestDownsideFlushZone)}
          </li>
        )}
        {summary.nearestUpsideSqueezeZone != null && (
          <li>
            <span className="text-white/50">Nearest upside squeeze zone:</span>{" "}
            {formatPrice(summary.nearestUpsideSqueezeZone)}
          </li>
        )}
      </ul>
      <p className="mt-2 text-xs text-white/50">
        Spot: {formatPrice(summary.currentPrice ?? spotPrice)}
      </p>
    </div>
  );
}
