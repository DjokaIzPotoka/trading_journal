"use client";

import * as React from "react";
import type { StrikeExposure } from "../../lib/market/gex";

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

export type CryptoStrikeTableProps = {
  strikeExposures: StrikeExposure[];
  /** Max rows to show */
  maxRows?: number;
};

const TOP_N = 10;

export function CryptoStrikeTable({
  strikeExposures,
  maxRows = TOP_N,
}: CryptoStrikeTableProps) {
  const rows = React.useMemo(() => {
    const byMagnitude = [...strikeExposures].sort(
      (a, b) => Math.abs(b.netExposure) - Math.abs(a.netExposure)
    );
    return byMagnitude.slice(0, maxRows);
  }, [strikeExposures, maxRows]);

  return (
    <div className="overflow-x-auto rounded-xl border border-white/10 bg-[#121826]">
      <table className="w-full min-w-[400px] text-sm">
        <thead>
          <tr className="border-b border-white/10 text-left text-xs uppercase tracking-wider text-white/60">
            <th className="p-4">Strike</th>
            <th className="p-4 text-right">Call GEX</th>
            <th className="p-4 text-right">Put GEX</th>
            <th className="p-4 text-right">Net GEX</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.strike}
              className="border-b border-white/5 hover:bg-white/[0.02]"
            >
              <td className="p-4 font-medium tabular-nums text-white">
                  {formatPrice(row.strike)}
              </td>
              <td className="p-4 text-right tabular-nums text-emerald-400/90">
                {formatGEX(row.callExposure)}
              </td>
              <td className="p-4 text-right tabular-nums text-red-400/90">
                {formatGEX(row.putExposure)}
              </td>
              <td
                className={`p-4 text-right tabular-nums ${
                  row.netExposure >= 0
                    ? "text-emerald-400/90"
                    : "text-red-400/90"
                }`}
              >
                {formatGEX(row.netExposure)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {strikeExposures.length > maxRows && (
        <p className="border-t border-white/5 p-3 text-xs text-white/50">
          Top {maxRows} by net GEX magnitude (of {strikeExposures.length} strikes).
        </p>
      )}
    </div>
  );
}
