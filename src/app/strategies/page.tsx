"use client";

import * as React from "react";
import Link from "next/link";
import { useSpreadShieldCalculatorExtended } from "../hooks/useSpreadShieldCalculator";
import {
  getLeverageMax,
  type AccountMode,
  type MarginMode,
  type MarginTotalMode,
  type LeverageMode,
  type TpSlMode,
  type PairMode,
} from "@/lib/spreadShieldCalculator";
import { SpreadShieldControlsPanel } from "../components/strategies/SpreadShieldControlsPanel";
import { SpreadShieldOutputPanel } from "../components/strategies/SpreadShieldOutputPanel";

const cardClass = "rounded-xl border border-white/10 bg-[#121826] p-5 shadow-lg";

function formatMoney(n: number): string {
  const sign = n >= 0 ? "+" : "";
  return `${sign}$${n.toFixed(2)}`;
}

function clampLeverage(v: number, max: number): number {
  return Math.max(1, Math.min(max, Number.isFinite(v) ? v : 1));
}

export default function StrategiesPage() {
  const [accountMode, setAccountMode] = React.useState<AccountMode>("crypto");
  const [marginTotalMode, setMarginTotalMode] = React.useState<MarginTotalMode>("total");
  const [marginMode, setMarginMode] = React.useState<MarginMode>("fixed");
  const [marginFixed, setMarginFixed] = React.useState<string>("100");
  const [marginPercent, setMarginPercent] = React.useState<number>(10);
  const [splitA, setSplitA] = React.useState<number>(50);
  const [marginAMode, setMarginAMode] = React.useState<MarginMode>("fixed");
  const [marginAFixed, setMarginAFixed] = React.useState<string>("50");
  const [marginAPercent, setMarginAPercent] = React.useState<number>(5);
  const [marginBMode, setMarginBMode] = React.useState<MarginMode>("fixed");
  const [marginBFixed, setMarginBFixed] = React.useState<string>("50");
  const [marginBPercent, setMarginBPercent] = React.useState<number>(5);
  const [leverageMode, setLeverageMode] = React.useState<LeverageMode>("shared");
  const [leverage, setLeverage] = React.useState<number>(10);
  const [leverageA, setLeverageA] = React.useState<number>(10);
  const [leverageB, setLeverageB] = React.useState<number>(10);
  const [tpSlMode, setTpSlMode] = React.useState<TpSlMode>("shared");
  const [tpPct, setTpPct] = React.useState<string>("1");
  const [slPct, setSlPct] = React.useState<string>("0.5");
  const [tpA, setTpA] = React.useState<string>("1");
  const [slA, setSlA] = React.useState<string>("0.5");
  const [tpB, setTpB] = React.useState<string>("1");
  const [slB, setSlB] = React.useState<string>("0.5");
  const [pairMode, setPairMode] = React.useState<PairMode>("spread");
  const [legASymbol, setLegASymbol] = React.useState("");
  const [legADir, setLegADir] = React.useState<"long" | "short">("long");
  const [legBSymbol, setLegBSymbol] = React.useState("");
  const [legBDir, setLegBDir] = React.useState<"long" | "short">("short");

  const leverageMax = getLeverageMax(accountMode);
  const result = useSpreadShieldCalculatorExtended({
    accountMode,
    marginTotalMode,
    marginMode,
    marginFixed: Math.max(0, parseFloat(marginFixed) || 0),
    marginPercent: Math.max(0, Math.min(100, marginPercent)),
    splitA,
    marginAMode,
    marginAFixed: Math.max(0, parseFloat(marginAFixed) || 0),
    marginAPercent: Math.max(0, Math.min(100, marginAPercent)),
    marginBMode,
    marginBFixed: Math.max(0, parseFloat(marginBFixed) || 0),
    marginBPercent: Math.max(0, Math.min(100, marginBPercent)),
    leverageMode,
    leverage: clampLeverage(leverage, leverageMax),
    leverageA: clampLeverage(leverageA, leverageMax),
    leverageB: clampLeverage(leverageB, leverageMax),
    tpSlMode,
    tpPct: Math.max(0, parseFloat(tpPct) || 0),
    slPct: Math.max(0, parseFloat(slPct) || 0),
    tpA: Math.max(0, parseFloat(tpA) || 0),
    slA: Math.max(0, parseFloat(slA) || 0),
    tpB: Math.max(0, parseFloat(tpB) || 0),
    slB: Math.max(0, parseFloat(slB) || 0),
  });

  return (
    <div className="min-h-screen bg-[#0B0F1A] text-white">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <header className="mb-6">
          <h1 className="text-2xl font-semibold text-white">SpreadShield</h1>
          <p className="mt-1 text-sm text-white/60">
            Two-leg Long/Short calculator with leverage + fees
          </p>
        </header>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:gap-8">
          <SpreadShieldControlsPanel
            accountSection={
              <>
                <div className="mb-4">
                  <p className="mb-2 text-xs font-medium text-white/60">Account mode</p>
                  <div className="flex rounded-lg border border-white/10 bg-white/5 p-0.5">
                    {(["crypto", "stocks"] as const).map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => setAccountMode(mode)}
                        className={`flex-1 rounded-md px-4 py-2.5 text-sm font-medium transition-colors ${
                          accountMode === mode
                            ? "bg-white/10 text-white"
                            : "text-white/60 hover:text-white hover:bg-white/5"
                        }`}
                      >
                        {mode === "crypto" ? "Crypto" : "Stocks"}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="mb-4">
                  <p className="mb-2 text-xs font-medium text-white/60">Trade structure</p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                      <p className="mb-2 text-xs text-white/50">Leg A</p>
                      <input
                        type="text"
                        value={legASymbol}
                        onChange={(e) => setLegASymbol(e.target.value)}
                        placeholder="Symbol"
                        className="mb-2 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                      />
                      <div className="flex gap-2">
                        {(["long", "short"] as const).map((d) => (
                          <button
                            key={d}
                            type="button"
                            onClick={() => setLegADir(d)}
                            className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                              legADir === d
                                ? d === "long"
                                  ? "bg-emerald-500/20 text-emerald-400"
                                  : "bg-red-500/20 text-red-400"
                                : "bg-white/5 text-white/60 hover:text-white"
                            }`}
                          >
                            {d === "long" ? "Long" : "Short"}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                      <p className="mb-2 text-xs text-white/50">Leg B</p>
                      <input
                        type="text"
                        value={legBSymbol}
                        onChange={(e) => setLegBSymbol(e.target.value)}
                        placeholder="Symbol"
                        className="mb-2 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                      />
                      <div className="flex gap-2">
                        {(["long", "short"] as const).map((d) => (
                          <button
                            key={d}
                            type="button"
                            onClick={() => setLegBDir(d)}
                            className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                              legBDir === d
                                ? d === "long"
                                  ? "bg-emerald-500/20 text-emerald-400"
                                  : "bg-red-500/20 text-red-400"
                                : "bg-white/5 text-white/60 hover:text-white"
                            }`}
                          >
                            {d === "long" ? "Long" : "Short"}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
                <div>
                  <p className="mb-2 text-xs font-medium text-white/60">Pair mode</p>
                  <div className="flex rounded-lg border border-white/10 bg-white/5 p-0.5">
                    {(["spread", "directional"] as const).map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => setPairMode(mode)}
                        className={`flex-1 rounded-md px-4 py-2.5 text-sm font-medium transition-colors ${
                          pairMode === mode
                            ? "bg-white/10 text-white"
                            : "text-white/60 hover:text-white hover:bg-white/5"
                        }`}
                      >
                        {mode === "spread" ? "Spread Mode" : "Directional Mode"}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            }
            capitalSection={
              <>
                {/* Margin: Total vs Per-Leg */}
                <div>
                  <p className="mb-2 text-xs font-medium text-white/60">Margin</p>
                  <div className="mb-3 flex rounded-lg border border-white/10 bg-white/5 p-0.5">
                    {(["total", "perLeg"] as const).map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setMarginTotalMode(m)}
                        className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium ${
                          marginTotalMode === m ? "bg-white/10 text-white" : "text-white/60 hover:text-white"
                        }`}
                      >
                        {m === "total" ? "Total Margin" : "Per-Leg Margin"}
                      </button>
                    ))}
                  </div>
                  {marginTotalMode === "total" ? (
                    <>
                      <div className="mb-2 flex flex-wrap items-center gap-3">
                        <div className="flex rounded-lg border border-white/10 bg-white/5 p-0.5">
                          {(["fixed", "percent"] as const).map((m) => (
                            <button
                              key={m}
                              type="button"
                              onClick={() => setMarginMode(m)}
                              className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                                marginMode === m ? "bg-white/10 text-white" : "text-white/60 hover:text-white"
                              }`}
                            >
                              {m === "fixed" ? "Fixed USDT/$" : "% of balance"}
                            </button>
                          ))}
                        </div>
                        {marginMode === "fixed" ? (
                          <input
                            type="number"
                            min={0}
                            step={1}
                            value={marginFixed}
                            onChange={(e) => setMarginFixed(e.target.value)}
                            className="w-32 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                          />
                        ) : (
                          <>
                            <input
                              type="range"
                              min={0}
                              max={100}
                              step={1}
                              value={marginPercent}
                              onChange={(e) => setMarginPercent(Number(e.target.value))}
                              className="h-2 w-40 rounded-lg accent-emerald-500"
                            />
                            <input
                              type="number"
                              min={0}
                              max={100}
                              step={0.5}
                              value={marginPercent}
                              onChange={(e) => setMarginPercent(Number(e.target.value) || 0)}
                              className="w-20 rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                            />
                            <span className="text-sm text-white/50">%</span>
                          </>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-white/60">Split A/B</span>
                        <input
                          type="range"
                          min={0}
                          max={100}
                          step={1}
                          value={splitA}
                          onChange={(e) => setSplitA(Number(e.target.value))}
                          className="h-2 w-32 rounded-lg accent-emerald-500"
                        />
                        <input
                          type="number"
                          min={0}
                          max={100}
                          step={1}
                          value={splitA}
                          onChange={(e) => setSplitA(Math.max(0, Math.min(100, Number(e.target.value) || 0)))}
                          className="w-14 rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                        />
                        <span className="text-sm text-white/50">% / {100 - splitA}%</span>
                      </div>
                    </>
                  ) : (
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <p className="mb-1 text-xs text-white/50">Leg A margin</p>
                        <div className="space-y-2">
                          <div className="flex rounded-lg border border-white/10 bg-white/5 p-0.5">
                            {(["fixed", "percent"] as const).map((m) => (
                              <button
                                key={m}
                                type="button"
                                onClick={() => setMarginAMode(m)}
                                className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium ${
                                  marginAMode === m ? "bg-white/10 text-white" : "text-white/60 hover:text-white"
                                }`}
                              >
                                {m === "fixed" ? "Fixed" : "% of balance"}
                              </button>
                            ))}
                          </div>
                          <div className="flex items-center gap-2">
                            {marginAMode === "fixed" ? (
                              <input
                                type="number"
                                min={0}
                                value={marginAFixed}
                                onChange={(e) => setMarginAFixed(e.target.value)}
                                className="w-32 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                              />
                            ) : (
                              <>
                                <input
                                  type="range"
                                  min={0}
                                  max={100}
                                  step={1}
                                  value={marginAPercent}
                                  onChange={(e) => setMarginAPercent(Number(e.target.value))}
                                  className="h-2 w-24 rounded-lg accent-emerald-500"
                                />
                                <input
                                  type="number"
                                  min={0}
                                  max={100}
                                  value={marginAPercent}
                                  onChange={(e) => setMarginAPercent(Number(e.target.value) || 0)}
                                  className="w-20 rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                                />
                                <span className="text-xs text-white/50">% of balance</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      <div>
                        <p className="mb-1 text-xs text-white/50">Leg B margin</p>
                        <div className="space-y-2">
                          <div className="flex rounded-lg border border-white/10 bg-white/5 p-0.5">
                            {(["fixed", "percent"] as const).map((m) => (
                              <button
                                key={m}
                                type="button"
                                onClick={() => setMarginBMode(m)}
                                className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium ${
                                  marginBMode === m ? "bg-white/10 text-white" : "text-white/60 hover:text-white"
                                }`}
                              >
                                {m === "fixed" ? "Fixed" : "% of balance"}
                              </button>
                            ))}
                          </div>
                          <div className="flex items-center gap-2">
                            {marginBMode === "fixed" ? (
                              <input
                                type="number"
                                min={0}
                                value={marginBFixed}
                                onChange={(e) => setMarginBFixed(e.target.value)}
                                className="w-32 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                              />
                            ) : (
                              <>
                                <input
                                  type="range"
                                  min={0}
                                  max={100}
                                  step={1}
                                  value={marginBPercent}
                                  onChange={(e) => setMarginBPercent(Number(e.target.value))}
                                  className="h-2 w-24 rounded-lg accent-emerald-500"
                                />
                                <input
                                  type="number"
                                  min={0}
                                  max={100}
                                  value={marginBPercent}
                                  onChange={(e) => setMarginBPercent(Number(e.target.value) || 0)}
                                  className="w-20 rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                                />
                                <span className="text-xs text-white/50">% of balance</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </>
            }
            riskSection={
              <>
                <div>
                  <p className="mb-2 text-xs font-medium text-white/60">Leverage (1× – {leverageMax}×)</p>
                  <div className="mb-3 flex rounded-lg border border-white/10 bg-white/5 p-0.5">
                    {(["shared", "perLeg"] as const).map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setLeverageMode(m)}
                        className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium ${
                          leverageMode === m ? "bg-white/10 text-white" : "text-white/60 hover:text-white"
                        }`}
                      >
                        {m === "shared" ? "Shared Leverage" : "Per-Leg Leverage"}
                      </button>
                    ))}
                  </div>
                  {leverageMode === "shared" ? (
                    <div className="flex flex-wrap items-center gap-3">
                      <input
                        type="range"
                        min={1}
                        max={leverageMax}
                        step={0.5}
                        value={leverage}
                        onChange={(e) => setLeverage(Number(e.target.value))}
                        className="h-2 w-40 rounded-lg accent-emerald-500"
                      />
                      <input
                        type="number"
                        min={1}
                        max={leverageMax}
                        step={0.5}
                        value={leverage}
                        onChange={(e) => setLeverage(clampLeverage(Number(e.target.value), leverageMax))}
                        className="w-20 rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                      />
                      <span className="text-sm text-white/50">×</span>
                    </div>
                  ) : (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="text-xs text-white/50 w-8">A</span>
                        <input
                          type="range"
                          min={1}
                          max={leverageMax}
                          step={0.5}
                          value={leverageA}
                          onChange={(e) => setLeverageA(clampLeverage(Number(e.target.value), leverageMax))}
                          className="h-2 w-32 rounded-lg accent-emerald-500"
                        />
                        <input
                          type="number"
                          min={1}
                          max={leverageMax}
                          step={0.5}
                          value={leverageA}
                          onChange={(e) => setLeverageA(clampLeverage(Number(e.target.value), leverageMax))}
                          className="w-20 rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                        />
                        <span className="text-sm text-white/50">×</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="text-xs text-white/50 w-8">B</span>
                        <input
                          type="range"
                          min={1}
                          max={leverageMax}
                          step={0.5}
                          value={leverageB}
                          onChange={(e) => setLeverageB(clampLeverage(Number(e.target.value), leverageMax))}
                          className="h-2 w-32 rounded-lg accent-emerald-500"
                        />
                        <input
                          type="number"
                          min={1}
                          max={leverageMax}
                          step={0.5}
                          value={leverageB}
                          onChange={(e) => setLeverageB(clampLeverage(Number(e.target.value), leverageMax))}
                          className="w-20 rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                        />
                        <span className="text-sm text-white/50">×</span>
                      </div>
                    </div>
                  )}
                </div>
                <div className="mt-4">
                  <p className="mb-2 text-xs font-medium text-white/60">TP / SL %</p>
                  <div className="mb-3 flex rounded-lg border border-white/10 bg-white/5 p-0.5">
                    {(["shared", "perLeg"] as const).map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setTpSlMode(m)}
                        className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium ${
                          tpSlMode === m ? "bg-white/10 text-white" : "text-white/60 hover:text-white"
                        }`}
                      >
                        {m === "shared" ? "Shared TP/SL" : "Per-Leg TP/SL"}
                      </button>
                    ))}
                  </div>
                  {tpSlMode === "shared" ? (
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label className="mb-1 block text-xs text-white/50">TP %</label>
                        <input
                          type="number"
                          min={0}
                          step={0.01}
                          value={tpPct}
                          onChange={(e) => setTpPct(e.target.value)}
                          className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs text-white/50">SL %</label>
                        <input
                          type="number"
                          min={0}
                          step={0.01}
                          value={slPct}
                          onChange={(e) => setSlPct(e.target.value)}
                          className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <p className="mb-1 text-xs text-white/50">Leg A</p>
                        <div className="flex gap-2">
                          <input
                            type="number"
                            min={0}
                            step={0.01}
                            placeholder="TP %"
                            value={tpA}
                            onChange={(e) => setTpA(e.target.value)}
                            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                          />
                          <input
                            type="number"
                            min={0}
                            step={0.01}
                            placeholder="SL %"
                            value={slA}
                            onChange={(e) => setSlA(e.target.value)}
                            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                          />
                        </div>
                      </div>
                      <div>
                        <p className="mb-1 text-xs text-white/50">Leg B</p>
                        <div className="flex gap-2">
                          <input
                            type="number"
                            min={0}
                            step={0.01}
                            placeholder="TP %"
                            value={tpB}
                            onChange={(e) => setTpB(e.target.value)}
                            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                          />
                          <input
                            type="number"
                            min={0}
                            step={0.01}
                            placeholder="SL %"
                            value={slB}
                            onChange={(e) => setSlB(e.target.value)}
                            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </>
            }
          />

          <SpreadShieldOutputPanel>
            <div className="space-y-4">
              {result.balanceMissing && (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
                  Balance is missing or 0. Set a starting balance in Settings (Crypto/Stocks) or use Fixed margin.
                </div>
              )}

              {/* A) Primary Results: Spread Outcomes + Visuals */}
              <div className={cardClass}>
                <p className="mb-3 text-xs font-medium uppercase tracking-wider text-white/60">Primary results</p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <p className="text-xs text-white/50">Spread Outcome 1 (TP A + SL B)</p>
                    <p
                      className={`text-xl font-semibold ${
                        result.spreadOutcome1 >= 0 ? "text-emerald-400" : "text-red-400"
                      }`}
                    >
                      {formatMoney(result.spreadOutcome1)}
                    </p>
                    <p className="text-xs text-white/50">
                      {result.spreadOutcome1Pct.toFixed(2)}% of balance
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-white/50">Spread Outcome 2 (SL A + TP B)</p>
                    <p
                      className={`text-xl font-semibold ${
                        result.spreadOutcome2 >= 0 ? "text-emerald-400" : "text-red-400"
                      }`}
                    >
                      {formatMoney(result.spreadOutcome2)}
                    </p>
                    <p className="text-xs text-white/50">
                      {result.spreadOutcome2Pct.toFixed(2)}% of balance
                    </p>
                  </div>
                </div>
              </div>

              {/* B) Leg Breakdown */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className={cardClass}>
                  <p className="mb-3 text-xs font-medium uppercase tracking-wider text-white/60">
                    Leg A {legASymbol || "(symbol)"}
                  </p>
                  <p className="text-sm text-white/80">Margin: ${result.legA.margin.toFixed(2)}</p>
                  <p className="text-sm text-white/80">Leverage: {result.legA.leverage}×</p>
                  <p className="text-sm text-white/80">Notional: ${result.legA.notional.toFixed(2)}</p>
                  <p className="mt-1 text-xs text-white/50">
                    Fees at TP: ${result.legA.feesAtTp.toFixed(2)} · at SL: ${result.legA.feesAtSl.toFixed(2)}
                  </p>
                  <p className="mt-0.5 text-sm text-emerald-400">Net TP: {formatMoney(result.legA.netTp)}</p>
                  <p className="text-sm text-red-400">Net SL: {formatMoney(result.legA.netSl)}</p>
                </div>
                <div className={cardClass}>
                  <p className="mb-3 text-xs font-medium uppercase tracking-wider text-white/60">
                    Leg B {legBSymbol || "(symbol)"}
                  </p>
                  <p className="text-sm text-white/80">Margin: ${result.legB.margin.toFixed(2)}</p>
                  <p className="text-sm text-white/80">Leverage: {result.legB.leverage}×</p>
                  <p className="text-sm text-white/80">Notional: ${result.legB.notional.toFixed(2)}</p>
                  <p className="mt-1 text-xs text-white/50">
                    Fees at TP: ${result.legB.feesAtTp.toFixed(2)} · at SL: ${result.legB.feesAtSl.toFixed(2)}
                  </p>
                  <p className="mt-0.5 text-sm text-emerald-400">Net TP: {formatMoney(result.legB.netTp)}</p>
                  <p className="text-sm text-red-400">Net SL: {formatMoney(result.legB.netSl)}</p>
                </div>
              </div>

              {/* C) Combined / Informational */}
              <div className={cardClass}>
                <p className="mb-3 text-xs font-medium uppercase tracking-wider text-white/60">Combined & info</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <p className="text-xs text-white/50">Account & margin</p>
                    <p className="text-sm font-medium text-white">
                      Balance: ${result.balance.toFixed(2)} ({accountMode})
                    </p>
                    <p className="text-xs text-white/50">Total margin: ${result.marginValue.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-white/50">Fee rate</p>
                    <p className="text-sm font-medium text-white">{(result.feeRate * 100).toFixed(3)}%</p>
                  </div>
                </div>
                <p className="mt-3 text-sm text-white/70">Total fees: ${result.totalFees.toFixed(2)}</p>
                <div className="mt-4 border-t border-white/10 pt-4">
                  <p className="text-xs text-white/50">Directional (informational)</p>
                  <p className="mt-1 text-sm text-emerald-400">
                    Both TP: {formatMoney(result.directionalBothTp)} ({result.directionalBothTpPct.toFixed(2)}% of balance)
                  </p>
                  <p className="text-sm text-red-400">
                    Both SL: {formatMoney(result.directionalBothSl)} ({result.directionalBothSlPct.toFixed(2)}% of balance)
                  </p>
                </div>
              </div>
            </div>
          </SpreadShieldOutputPanel>
        </div>

        <footer>
          <Link href="/dashboard" className="text-sm text-white/60 hover:text-white">
            ← Dashboard
          </Link>
        </footer>
      </div>
    </div>
  );
}
