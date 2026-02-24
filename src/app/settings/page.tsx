"use client";

import * as React from "react";
import Link from "next/link";
import {
  getStartingBalanceCrypto,
  getStartingBalanceStocks,
  setStartingBalanceCrypto,
  setStartingBalanceStocks,
} from "../lib/settings";

export default function SettingsPage() {
  const [cryptoBalance, setCryptoBalance] = React.useState<string>("");
  const [stocksBalance, setStocksBalance] = React.useState<string>("");
  const [saved, setSaved] = React.useState(false);

  React.useEffect(() => {
    setCryptoBalance(String(getStartingBalanceCrypto()));
    setStocksBalance(String(getStartingBalanceStocks()));
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const crypto = parseFloat(cryptoBalance);
    const stocks = parseFloat(stocksBalance);
    if (!Number.isFinite(crypto) || crypto < 0 || !Number.isFinite(stocks) || stocks < 0) return;
    setStartingBalanceCrypto(crypto);
    setStartingBalanceStocks(stocks);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const total =
    Number.isFinite(parseFloat(cryptoBalance)) && Number.isFinite(parseFloat(stocksBalance))
      ? parseFloat(cryptoBalance) + parseFloat(stocksBalance)
      : getStartingBalanceCrypto() + getStartingBalanceStocks();

  return (
    <div className="min-h-screen bg-[#0B0F1A] text-white">
      <div className="mx-auto max-w-2xl px-4 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold">Settings</h1>
          <p className="mt-1 text-sm text-white/60">Manage your trading journal preferences.</p>
        </div>

        <div className="rounded-xl border border-white/10 bg-[#121826] p-6 shadow-lg">
          <h2 className="text-lg font-medium text-white">Starting Balances</h2>
          <p className="mt-1 text-sm text-white/60">
            Used to compute Total Balance per market (Dashboard All = Crypto + Stocks + combined P&L).
          </p>
          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-white/80">Crypto</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={cryptoBalance}
                onChange={(e) => setCryptoBalance(e.target.value)}
                className="mt-1 w-full max-w-xs rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                placeholder="10000"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-white/80">Stocks</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={stocksBalance}
                onChange={(e) => setStocksBalance(e.target.value)}
                className="mt-1 w-full max-w-xs rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                placeholder="10000"
              />
            </div>
            <p className="text-sm text-white/50">Total (All): ${total.toFixed(2)}</p>
            <div className="flex items-center gap-3">
              <button
                type="submit"
                className="rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-500 transition-colors"
              >
                Save
              </button>
              {saved && (
                <span className="text-sm text-emerald-400">Saved.</span>
              )}
            </div>
          </form>
        </div>

        <div className="mt-8">
          <Link
            href="/dashboard"
            className="text-sm text-white/70 hover:text-white"
          >
            ← Back to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
