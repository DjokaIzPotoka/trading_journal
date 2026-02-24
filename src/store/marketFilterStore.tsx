"use client";

import * as React from "react";

export type MarketFilter = "all" | "crypto" | "stocks";

const STORAGE_KEY = "trading_journal_market_filter";

function loadFilter(): MarketFilter {
  if (typeof window === "undefined") return "all";
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === "crypto" || raw === "stocks" || raw === "all") return raw;
    return "all";
  } catch {
    return "all";
  }
}

function saveFilter(value: MarketFilter): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, value);
  } catch {
    // ignore
  }
}

type MarketFilterContextValue = {
  marketFilter: MarketFilter;
  setMarketFilter: (filter: MarketFilter) => void;
};

const MarketFilterContext = React.createContext<MarketFilterContextValue | null>(null);

export function MarketFilterProvider({ children }: { children: React.ReactNode }) {
  const [marketFilter, setState] = React.useState<MarketFilter>("all");

  React.useEffect(() => {
    setState(loadFilter());
  }, []);

  const setMarketFilter = React.useCallback((filter: MarketFilter) => {
    setState(filter);
    saveFilter(filter);
  }, []);

  const value = React.useMemo(
    () => ({ marketFilter, setMarketFilter }),
    [marketFilter, setMarketFilter]
  );

  return (
    <MarketFilterContext.Provider value={value}>
      {children}
    </MarketFilterContext.Provider>
  );
}

export function useMarketFilter(): MarketFilterContextValue {
  const ctx = React.useContext(MarketFilterContext);
  if (!ctx) {
    throw new Error("useMarketFilter must be used within MarketFilterProvider");
  }
  return ctx;
}
