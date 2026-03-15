"use client";

import * as React from "react";

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

type HeroCardProps = {
  label: string;
  value: string;
  sub?: string;
  positive?: boolean;
  tint?: "neutral" | "positive" | "negative";
};

function HeroCard({ label, value, sub, positive, tint = "neutral" }: HeroCardProps) {
  const tintBg =
    tint === "positive"
      ? "bg-emerald-500/5 border-emerald-500/15"
      : tint === "negative"
        ? "bg-red-500/5 border-red-500/15"
        : "bg-[#121826] border-white/10";
  return (
    <div className={`rounded-xl border p-4 shadow-lg ${tintBg}`}>
      <p className="text-[11px] font-semibold uppercase tracking-widest text-white/50">
        {label}
      </p>
      <p
        className={`mt-2 text-2xl font-bold tabular-nums ${
          positive === true ? "text-emerald-400" : ""
        } ${positive === false ? "text-red-400" : ""} ${
          positive === undefined ? "text-white" : ""
        }`}
      >
        {value}
      </p>
      {sub != null && sub !== "" && (
        <p className="mt-1 text-xs text-white/50">{sub}</p>
      )}
    </div>
  );
}

function SecondaryCard({
  label,
  value,
  positive,
}: {
  label: string;
  value: string;
  positive?: boolean;
}) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2">
      <p className="text-[10px] font-medium uppercase tracking-wider text-white/50">
        {label}
      </p>
      <p
        className={`mt-0.5 text-sm font-semibold tabular-nums ${
          positive === true ? "text-emerald-400" : ""
        } ${positive === false ? "text-red-400" : ""} ${
          positive === undefined ? "text-white/90" : ""
        }`}
      >
        {value}
      </p>
    </div>
  );
}

export type CryptoSummaryCardsProps = {
  price: number | null;
  markPrice: number | null;
  fundingRate: number | null;
  openInterest: number | null;
  oiChange24h: number | null;
  netGEX: number | null;
  gammaRegime: string | null;
  zeroGammaLevel: number | null;
  callWall: number | null;
  putWall: number | null;
  nearestExpirationUsed: string | null;
};

export function CryptoSummaryCards({
  price,
  markPrice,
  fundingRate,
  openInterest,
  oiChange24h,
  netGEX,
  gammaRegime,
  zeroGammaLevel,
  callWall,
  putWall,
  nearestExpirationUsed,
}: CryptoSummaryCardsProps) {
  return (
    <section className="mb-10">
      <div className="mb-3 flex items-baseline justify-between gap-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-white/60">
          Market snapshot
        </h2>
        <div className="flex flex-wrap gap-2">
          <SecondaryCard
            label="Funding"
            value={
              fundingRate != null
                ? `${(fundingRate * 100).toFixed(4)}%`
                : "—"
            }
            positive={fundingRate != null ? fundingRate < 0 : undefined}
          />
          <SecondaryCard
            label="OI"
            value={
              openInterest != null
                ? openInterest.toLocaleString(undefined, { maximumFractionDigits: 0 })
                : "—"
            }
          />
          <SecondaryCard
            label="OI Δ24h"
            value={
              oiChange24h != null
                ? `${oiChange24h >= 0 ? "+" : ""}${oiChange24h.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
                : "—"
            }
            positive={oiChange24h != null ? oiChange24h >= 0 : undefined}
          />
          <SecondaryCard label="Expiry" value={nearestExpirationUsed ?? "—"} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <HeroCard
          label="Spot"
          value={price != null ? formatPrice(price) : "—"}
          sub={markPrice != null ? `Mark ${formatPrice(markPrice)}` : undefined}
        />
        <HeroCard
          label="Net GEX"
          value={netGEX != null ? formatGEX(netGEX) : "—"}
          positive={netGEX != null ? netGEX >= 0 : undefined}
          tint={netGEX != null && netGEX >= 0 ? "positive" : netGEX != null ? "negative" : "neutral"}
        />
        <HeroCard
          label="Gamma regime"
          value={gammaRegime ?? "—"}
        />
        <HeroCard
          label="Zero gamma"
          value={zeroGammaLevel != null ? formatPrice(zeroGammaLevel) : "—"}
        />
        <HeroCard
          label="Call wall"
          value={callWall != null ? formatPrice(callWall) : "—"}
          tint="positive"
        />
        <HeroCard
          label="Put wall"
          value={putWall != null ? formatPrice(putWall) : "—"}
          tint="negative"
        />
      </div>
    </section>
  );
}
