"use client";

import * as React from "react";

export type CryptoMarketSummaryProps = {
  summary: string;
  title?: string;
};

export function CryptoMarketSummary({
  summary,
  title = "Market summary",
}: CryptoMarketSummaryProps) {
  return (
    <div className="rounded-xl border border-white/10 bg-[#121826] p-5">
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-white/60">{title}</h2>
      <p className="text-sm leading-relaxed text-white/70">{summary}</p>
    </div>
  );
}
