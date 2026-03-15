"use client";

import * as React from "react";

function formatPrice(n: number): string {
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 0, minimumFractionDigits: 0 })}`;
}

type LevelCardProps = {
  tag: string;
  value: string;
  context?: string;
  variant: "call" | "put" | "combo" | "gamma" | "zero" | "vol";
};

const variantStyles: Record<LevelCardProps["variant"], { bg: string; tag: string }> = {
  call: { bg: "bg-emerald-500/10 border-emerald-500/20", tag: "text-emerald-400" },
  put: { bg: "bg-red-500/10 border-red-500/20", tag: "text-red-400" },
  combo: { bg: "bg-violet-500/10 border-violet-500/20", tag: "text-violet-400" },
  gamma: { bg: "bg-blue-500/10 border-blue-500/20", tag: "text-blue-400" },
  zero: { bg: "bg-white/5 border-white/10", tag: "text-white/70" },
  vol: { bg: "bg-amber-500/10 border-amber-500/20", tag: "text-amber-400" },
};

function LevelCard({ tag, value, context, variant }: LevelCardProps) {
  const style = variantStyles[variant];
  return (
    <div
      className={`rounded-xl border p-4 ${style.bg}`}
    >
      <span className={`text-xs font-semibold uppercase tracking-wider ${style.tag}`}>
        {tag}
      </span>
      <p className="mt-1.5 text-xl font-semibold text-white tabular-nums">
        {value}
      </p>
      {context != null && context !== "" && (
        <p className="mt-0.5 text-xs text-white/50">{context}</p>
      )}
    </div>
  );
}

export type KeyLevelsGridProps = {
  spotPrice: number;
  zeroGammaLevel: number | null;
  callWall: number | null;
  putWall: number | null;
  strongestPositiveStrike: number | null;
  strongestNegativeStrike: number | null;
};

export function KeyLevelsGrid({
  spotPrice,
  zeroGammaLevel,
  callWall,
  putWall,
  strongestPositiveStrike,
  strongestNegativeStrike,
}: KeyLevelsGridProps) {
  const pts = (level: number) => {
    const diff = level - spotPrice;
    if (Math.abs(diff) < spotPrice * 0.001) return "at spot";
    return diff > 0 ? `${diff.toFixed(0)} pts above spot` : `${Math.abs(diff).toFixed(0)} pts below spot`;
  };

  const levels: Array<{ tag: string; value: string; context?: string; variant: LevelCardProps["variant"] }> = [];
  if (zeroGammaLevel != null) {
    levels.push({
      tag: "Zero gamma",
      value: formatPrice(zeroGammaLevel),
      context: pts(zeroGammaLevel),
      variant: "zero",
    });
  }
  if (callWall != null) {
    levels.push({
      tag: "Call wall",
      value: formatPrice(callWall),
      context: pts(callWall),
      variant: "call",
    });
  }
  if (putWall != null) {
    levels.push({
      tag: "Put wall",
      value: formatPrice(putWall),
      context: pts(putWall),
      variant: "put",
    });
  }
  if (strongestPositiveStrike != null) {
    levels.push({
      tag: "Strongest + strike",
      value: formatPrice(strongestPositiveStrike),
      context: pts(strongestPositiveStrike),
      variant: "gamma",
    });
  }
  if (strongestNegativeStrike != null) {
    levels.push({
      tag: "Strongest − strike",
      value: formatPrice(strongestNegativeStrike),
      context: pts(strongestNegativeStrike),
      variant: "gamma",
    });
  }

  if (levels.length === 0) return null;

  return (
    <section className="mb-10">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-white/60">
        Key levels
      </h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {levels.map((level) => (
          <LevelCard
            key={level.tag}
            tag={level.tag}
            value={level.value}
            context={level.context}
            variant={level.variant}
          />
        ))}
      </div>
    </section>
  );
}
