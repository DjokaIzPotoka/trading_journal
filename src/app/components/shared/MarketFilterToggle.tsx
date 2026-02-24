"use client";

import * as React from "react";
import { useMarketFilter } from "@/store/marketFilterStore";
import type { MarketFilter } from "@/store/marketFilterStore";

const OPTIONS: { value: MarketFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "crypto", label: "Crypto" },
  { value: "stocks", label: "Stocks" },
];

export function MarketFilterToggle() {
  const { marketFilter, setMarketFilter } = useMarketFilter();

  return (
    <div className="flex rounded-lg border border-white/10 bg-white/5 p-0.5">
      {OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => setMarketFilter(opt.value)}
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            marketFilter === opt.value
              ? "bg-white/10 text-white"
              : "text-white/60 hover:text-white hover:bg-white/5"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
