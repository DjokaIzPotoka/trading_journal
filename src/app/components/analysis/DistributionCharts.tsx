"use client";

import * as React from "react";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const cardClass = "rounded-xl border border-white/10 bg-[#121826] p-5 shadow-lg";

type WinLossData = { name: string; value: number; count: number };
type MarketData = { name: string; value: number; pct: number };

type DistributionChartsProps = {
  winCount: number;
  lossCount: number;
  avgWin: number;
  avgLoss: number;
  largestWin: number;
  largestLoss: number;
  marketCounts: { crypto: number; cfd: number; forex: number };
};

export function DistributionCharts({
  winCount,
  lossCount,
  avgWin,
  avgLoss,
  largestWin,
  largestLoss,
  marketCounts,
}: DistributionChartsProps) {
  const totalTrades = winCount + lossCount;
  const winRatePct = totalTrades > 0 ? (winCount / totalTrades) * 100 : 0;

  const winLossData: WinLossData[] = [
    { name: "Wins", value: winRatePct, count: winCount },
    { name: "Losses", value: 100 - winRatePct, count: lossCount },
  ].filter((d) => d.count > 0);
  if (winLossData.length === 0) winLossData.push({ name: "No trades", value: 100, count: 0 });

  const avgBarData = [
    { name: "Average Win", value: Math.max(0, avgWin), fill: "#34d399" },
    { name: "Average Loss", value: Math.abs(Math.min(0, avgLoss)), fill: "#f87171" },
  ];

  const totalMarket = marketCounts.crypto + marketCounts.cfd + marketCounts.forex;
  const marketData: MarketData[] = [
    { name: "Crypto", value: marketCounts.crypto, pct: totalMarket > 0 ? (marketCounts.crypto / totalMarket) * 100 : 0 },
    { name: "CFD", value: marketCounts.cfd, pct: totalMarket > 0 ? (marketCounts.cfd / totalMarket) * 100 : 0 },
    { name: "Forex", value: marketCounts.forex, pct: totalMarket > 0 ? (marketCounts.forex / totalMarket) * 100 : 0 },
  ].filter((d) => d.value > 0);
  if (marketData.length === 0) marketData.push({ name: "No data", value: 1, pct: 100 });

  const WIN_COLOR = "#34d399";
  const LOSS_COLOR = "#f87171";
  const MARKET_COLORS = ["#fb923c", "#60a5fa", "#a78bfa"];

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      {/* Win/Loss Distribution */}
      <div className={cardClass}>
        <h3 className="mb-4 text-lg font-semibold text-white">Win/Loss Distribution</h3>
        <div className="h-[220px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={winLossData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={75}
                paddingAngle={2}
                label={({ name, value }) =>
                  value > 0 ? `${value.toFixed(1)}%` : ""
                }
                labelLine={false}
              >
                {winLossData.map((_, i) => (
                  <Cell
                    key={i}
                    fill={winLossData[i].name === "Wins" ? WIN_COLOR : winLossData[i].name === "Losses" ? LOSS_COLOR : "#6b7280"}
                  />
                ))}
              </Pie>
              <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle" fill="white" className="text-sm font-medium">
                {winRatePct.toFixed(1)}% Win Rate
              </text>
              <Tooltip
                contentStyle={{
                  backgroundColor: "#121826",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: "8px",
                }}
                formatter={(value, _name, props) =>
                  [`${Number(value ?? 0).toFixed(1)}%`, (props?.payload ? `${props.payload.name} (${props.payload.count})` : "") as string]
                }
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-2 flex justify-center gap-4 text-sm">
          <span className="flex items-center gap-1.5 text-white/80">
            <span className="h-2 w-2 rounded-full bg-green-400" /> Wins ({winCount})
          </span>
          <span className="flex items-center gap-1.5 text-white/80">
            <span className="h-2 w-2 rounded-full bg-red-400" /> Losses ({lossCount})
          </span>
        </div>
      </div>

      {/* Average Win vs Loss */}
      <div className={cardClass}>
        <h3 className="mb-4 text-lg font-semibold text-white">Average Win vs Loss</h3>
        <div className="h-[180px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={avgBarData}
              layout="vertical"
              margin={{ left: 0, right: 24 }}
            >
              <XAxis type="number" stroke="rgba(255,255,255,0.4)" tick={{ fill: "rgba(255,255,255,0.6)", fontSize: 11 }} tickFormatter={(v) => `$${v}`} />
              <YAxis type="category" dataKey="name" width={90} stroke="rgba(255,255,255,0.4)" tick={{ fill: "rgba(255,255,255,0.6)", fontSize: 11 }} />
              <Bar dataKey="value" radius={[0, 4, 4, 0]} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#121826",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: "8px",
                }}
                formatter={(value) => [`$${Number(value ?? 0).toFixed(2)}`, ""]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-3 flex justify-between border-t border-white/10 pt-3 text-sm">
          <span className="text-white/70">
            Largest Win <span className="text-green-400">+${largestWin.toFixed(2)}</span>
          </span>
          <span className="text-white/70">
            Largest Loss <span className="text-red-400">${largestLoss.toFixed(2)}</span>
          </span>
        </div>
      </div>

      {/* Market Distribution */}
      <div className={cardClass}>
        <h3 className="mb-4 text-lg font-semibold text-white">Market Distribution</h3>
        <div className="h-[220px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={marketData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={75}
                paddingAngle={2}
                label={(props: { payload?: MarketData }) =>
                  props.payload && props.payload.pct > 0
                    ? `${props.payload.name} (${props.payload.pct.toFixed(0)}%)`
                    : ""
                }
              >
                {marketData.map((_, i) => (
                  <Cell key={i} fill={MARKET_COLORS[i % MARKET_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: "#121826",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: "8px",
                }}
                formatter={(value, name, props) =>
                  [((props as { payload?: MarketData })?.payload ? `${(props as { payload: MarketData }).payload.pct.toFixed(1)}%` : String(value ?? 0)), String(name ?? "")]
                }
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-2 flex flex-wrap justify-center gap-3 text-sm">
          {marketData.map((d, i) => (
            <span key={d.name} className="flex items-center gap-1.5 text-white/80">
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: MARKET_COLORS[i % MARKET_COLORS.length] }}
              />
              {d.name} ({d.pct.toFixed(0)}%)
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
