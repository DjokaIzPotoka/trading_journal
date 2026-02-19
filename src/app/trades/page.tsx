"use client";

import * as React from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import {
  getTrades,
  getTradeStats,
  deleteTrade,
  deleteAllTrades,
  type Trade,
  type Market,
  type TradeType,
} from "../lib/trades";
import { getStartingBalance } from "../lib/settings";
import { AddTradeDialog } from "../components/trades/AddTradeDialog";
import { ImportTradesModal } from "../components/trades/ImportTradesModal";

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

function formatMoney(n: number) {
  const sign = n >= 0 ? "+" : "";
  return `${sign}$${n.toFixed(2)}`;
}

function formatPct(n: number) {
  const sign = n >= 0 ? "+" : "";
  return `${sign}${n.toFixed(2)}%`;
}

export default function TradesPage() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [importOpen, setImportOpen] = React.useState(false);
  const [totalBalance, setTotalBalance] = React.useState(0);

  const [search, setSearch] = React.useState("");
  const [market, setMarket] = React.useState<Market | "">("");
  const [type, setType] = React.useState<TradeType | "">("");
  const [from, setFrom] = React.useState("");
  const [to, setTo] = React.useState("");
  const [confirmDeleteAll, setConfirmDeleteAll] = React.useState(false);

  const filters = React.useMemo(
    () => ({
      symbol: search || undefined,
      market: market || undefined,
      type: type || undefined,
      from: from || undefined,
      to: to || undefined,
    }),
    [search, market, type, from, to]
  );

  const { data: trades = [], isLoading: tradesLoading } = useQuery({
    queryKey: ["trades", filters],
    queryFn: () => getTrades(filters),
  });

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["tradeStats"],
    queryFn: getTradeStats,
  });

  React.useEffect(() => {
    setTotalBalance(getStartingBalance() + (stats?.total_pnl ?? 0));
  }, [stats?.total_pnl]);

  const deleteMutation = useMutation({
    mutationFn: deleteTrade,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trades"] });
      queryClient.invalidateQueries({ queryKey: ["tradeStats"] });
    },
  });

  const deleteAllMutation = useMutation({
    mutationFn: deleteAllTrades,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trades"] });
      queryClient.invalidateQueries({ queryKey: ["tradeStats"] });
    },
  });

  const refetch = () => {
    queryClient.invalidateQueries({ queryKey: ["trades"] });
    queryClient.invalidateQueries({ queryKey: ["tradeStats"] });
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Trade History</h1>
            <p className="text-muted-foreground">View and analyze all your trading activity.</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setImportOpen(true)}
              className="inline-flex items-center justify-center rounded-lg border border-border bg-background px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted"
            >
              Import CSV
            </button>
            <button
              type="button"
              onClick={() => setDialogOpen(true)}
              className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90"
            >
              + Add Trade
            </button>
          </div>
        </div>

        {/* KPI cards */}
        <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-5">
          <KpiCard
            label="Total P&L"
            value={stats ? formatMoney(stats.total_pnl ?? 0) : "—"}
            positive={stats != null && (stats.total_pnl ?? 0) >= 0}
            loading={statsLoading}
          />
          <KpiCard
            label="Win Rate"
            value={stats ? `${(stats.win_rate_pct ?? 0).toFixed(1)}%` : "—"}
            loading={statsLoading}
          />
          <KpiCard
            label="Avg Win"
            value={stats && stats.avg_win != null ? formatMoney(stats.avg_win) : "$0.00"}
            positive
            loading={statsLoading}
          />
          <KpiCard
            label="Avg Loss"
            value={stats && stats.avg_loss != null ? formatMoney(stats.avg_loss) : "$0.00"}
            positive={false}
            loading={statsLoading}
          />
          <KpiCard
            label="Total Trades"
            value={stats ? String(stats.total_trades) : "—"}
            loading={statsLoading}
          />
        </div>

        {/* Filters */}
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <input
            type="text"
            placeholder="Search by symbol..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm w-48"
          />
          <select
            value={market}
            onChange={(e) => setMarket((e.target.value || "") as Market | "")}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">All markets</option>
            <option value="crypto">Crypto</option>
            <option value="cfd">CFD</option>
            <option value="forex">Forex</option>
          </select>
          <select
            value={type}
            onChange={(e) => setType((e.target.value || "") as TradeType | "")}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">All types</option>
            <option value="long">Long</option>
            <option value="short">Short</option>
          </select>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </div>

        {/* Table */}
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="px-4 py-3 text-left font-medium">Symbol</th>
                  <th className="px-4 py-3 text-left font-medium">Type</th>
                  <th className="px-4 py-3 text-left font-medium">Market</th>
                  <th className="px-4 py-3 text-right font-medium">Entry</th>
                  <th className="px-4 py-3 text-right font-medium">Exit</th>
                  <th className="px-4 py-3 text-right font-medium">P&L</th>
                  <th className="px-4 py-3 text-right font-medium">%</th>
                  <th className="px-4 py-3 text-left font-medium">Entry Date</th>
                  <th className="px-4 py-3 text-left font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {tradesLoading ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">
                      Loading…
                    </td>
                  </tr>
                ) : trades.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">
                      No trades yet. Add your first trade above.
                    </td>
                  </tr>
                ) : (
                  trades.map((t) => (
                    <TradeRow
                      key={t.id}
                      trade={t}
                      onDelete={() => deleteMutation.mutate(t.id)}
                      isDeleting={deleteMutation.isPending}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
        {trades.length > 0 && (
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <p className="text-sm text-muted-foreground">
              Trades ({trades.length})
            </p>
            {confirmDeleteAll ? (
              <span className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    deleteAllMutation.mutate();
                    setConfirmDeleteAll(false);
                  }}
                  disabled={deleteAllMutation.isPending}
                  className="text-sm text-red-600 dark:text-red-400 hover:underline disabled:opacity-50"
                >
                  {deleteAllMutation.isPending ? "Deleting…" : "Confirm delete all"}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDeleteAll(false)}
                  className="text-sm text-muted-foreground hover:underline"
                >
                  Cancel
                </button>
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmDeleteAll(true)}
                className="text-sm text-muted-foreground hover:text-destructive"
                title="Delete all trades"
              >
                Delete all
              </button>
            )}
          </div>
        )}
      </div>

      <AddTradeDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSuccess={refetch}
        totalBalance={totalBalance}
      />
      <ImportTradesModal open={importOpen} onOpenChange={setImportOpen} onSuccess={refetch} />
    </div>
  );
}

function KpiCard({
  label,
  value,
  positive,
  loading,
}: {
  label: string;
  value: string;
  positive?: boolean;
  loading?: boolean;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
        {label}
      </p>
      {loading ? (
        <p className="mt-1 text-lg font-semibold text-muted-foreground">—</p>
      ) : (
        <p
          className={`mt-1 text-lg font-semibold ${
            positive === true ? "text-emerald-600 dark:text-emerald-400" : ""
          } ${positive === false ? "text-red-600 dark:text-red-400" : ""}`}
        >
          {value}
        </p>
      )}
    </div>
  );
}

function TradeRow({
  trade,
  onDelete,
  isDeleting,
}: {
  trade: Trade;
  onDelete: () => void;
  isDeleting: boolean;
}) {
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const pnlPositive = trade.pnl >= 0;

  return (
    <tr className="border-b border-border last:border-0 hover:bg-muted/20">
      <td className="px-4 py-3 font-medium">{trade.symbol}</td>
      <td className="px-4 py-3">
        <span
          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
            trade.type === "long"
              ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400"
              : "bg-red-500/20 text-red-600 dark:text-red-400"
          }`}
        >
          {trade.type.toUpperCase()}
        </span>
      </td>
      <td className="px-4 py-3 capitalize text-muted-foreground">{trade.market}</td>
      <td className="px-4 py-3 text-right">${trade.entry_price.toFixed(2)}</td>
      <td className="px-4 py-3 text-right">${trade.exit_price.toFixed(2)}</td>
      <td
        className={`px-4 py-3 text-right font-medium ${
          pnlPositive ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
        }`}
      >
        {formatMoney(trade.pnl)}
      </td>
      <td
        className={`px-4 py-3 text-right ${
          pnlPositive ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
        }`}
      >
        {formatPct(trade.pnl_percent)}
      </td>
      <td className="px-4 py-3 text-muted-foreground">{formatDate(trade.created_at)}</td>
      <td className="px-4 py-3">
        {confirmDelete ? (
          <span className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => {
                onDelete();
                setConfirmDelete(false);
              }}
              disabled={isDeleting}
              className="text-xs text-red-600 hover:underline disabled:opacity-50"
            >
              Confirm
            </button>
            <button
              type="button"
              onClick={() => setConfirmDelete(false)}
              className="text-xs text-muted-foreground hover:underline"
            >
              Cancel
            </button>
          </span>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="text-muted-foreground hover:text-destructive"
            title="Delete trade"
          >
            🗑
          </button>
        )}
      </td>
    </tr>
  );
}
