"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as React from "react";
import { MarketFilterProvider } from "@/store/marketFilterStore";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = React.useState(() => new QueryClient());
  return (
    <QueryClientProvider client={queryClient}>
      <MarketFilterProvider>
        {children}
      </MarketFilterProvider>
    </QueryClientProvider>
  );
}
