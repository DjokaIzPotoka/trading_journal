"use client";

import * as React from "react";
import Link from "next/link";
import { getStartingBalance, setStartingBalance } from "../lib/settings";

export default function SettingsPage() {
  const [balance, setBalance] = React.useState<string>("");
  const [saved, setSaved] = React.useState(false);

  React.useEffect(() => {
    setBalance(String(getStartingBalance()));
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseFloat(balance);
    if (!Number.isFinite(num) || num < 0) return;
    setStartingBalance(num);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="min-h-screen bg-[#0B0F1A] text-white">
      <div className="mx-auto max-w-2xl px-4 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold">Settings</h1>
          <p className="mt-1 text-sm text-white/60">Manage your trading journal preferences.</p>
        </div>

        <div className="rounded-xl border border-white/10 bg-[#121826] p-6 shadow-lg">
          <h2 className="text-lg font-medium text-white">Starting Balance</h2>
          <p className="mt-1 text-sm text-white/60">
            Used to compute Total Balance on the dashboard (Total Balance = Starting Balance + Realized P&L).
          </p>
          <form onSubmit={handleSubmit} className="mt-4">
            <input
              type="number"
              step="0.01"
              min="0"
              value={balance}
              onChange={(e) => setBalance(e.target.value)}
              className="w-full max-w-xs rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
              placeholder="0"
            />
            <div className="mt-4 flex items-center gap-3">
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
