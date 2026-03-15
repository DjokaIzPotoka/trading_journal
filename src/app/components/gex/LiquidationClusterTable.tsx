"use client";

import * as React from "react";
import type { LiquidationLevel } from "../../lib/market/types";

function formatPrice(n: number): string {
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

export type LiquidationClusterTableProps = {
  levels: LiquidationLevel[];
  spotPrice: number;
  /** Show only levels with meaningful weight and within band of spot */
  bandPct?: number;
  maxRows?: number;
};

export function LiquidationClusterTable({
  levels,
  spotPrice,
  bandPct = 0.1,
  maxRows = 10,
}: LiquidationClusterTableProps) {
  const filtered = React.useMemo(() => {
    const low = spotPrice * (1 - bandPct);
    const high = spotPrice * (1 + bandPct);
    return levels
      .filter((l) => l.price >= low && l.price <= high && l.totalWeight > 0)
      .sort((a, b) => b.totalWeight - a.totalWeight)
      .slice(0, maxRows);
  }, [levels, spotPrice, bandPct, maxRows]);

  return (
    <div className="rounded-xl border border-white/10 bg-[#121826] p-5">
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-white/60">
        Liquidation clusters (estimated)
      </h2>
      <p className="mb-4 text-xs text-white/50">
        Modeled pressure by price level. Not exact exchange data.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[320px] text-sm">
          <thead>
            <tr className="border-b border-white/10 text-left text-xs uppercase tracking-wider text-white/60">
              <th className="p-3">Price level</th>
              <th className="p-3 text-right">Long liq</th>
              <th className="p-3 text-right">Short liq</th>
              <th className="p-3 text-right">Total pressure</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((row) => (
              <tr
                key={row.price}
                className="border-b border-white/5 hover:bg-white/[0.02]"
              >
                <td className="p-3 font-medium text-white">
                  {formatPrice(row.price)}
                </td>
                <td className="p-3 text-right text-red-400/90">
                  {row.longLiqWeight.toLocaleString(undefined, {
                    maximumFractionDigits: 0,
                  })}
                </td>
                <td className="p-3 text-right text-emerald-400/90">
                  {row.shortLiqWeight.toLocaleString(undefined, {
                    maximumFractionDigits: 0,
                  })}
                </td>
                <td className="p-3 text-right text-white/80">
                  {row.totalWeight.toLocaleString(undefined, {
                    maximumFractionDigits: 0,
                  })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <p className="p-3 text-sm text-white/50">No cluster data in range.</p>
        )}
      </div>
    </div>
  );
}
