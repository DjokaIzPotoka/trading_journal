"use client";

import * as React from "react";
import { parseTradesCsv, type ParseResult, type RowResult, type ParsedTradeRow } from "@/lib/csv/tradeParser";
import { insertTradesBatch, type InsertTradeRow } from "@/app/lib/trades";

const EXPECTED_COLUMNS = `Required: symbol, type (long/short), market (crypto/forex/stocks), entry_price, exit_price, qty. Optional: fees, pnl, pnl_percent, notes, date.`;

type ImportTradesModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
};

export function ImportTradesModal({ open, onOpenChange, onSuccess }: ImportTradesModalProps) {
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [file, setFile] = React.useState<File | null>(null);
  const [parseResult, setParseResult] = React.useState<ParseResult | null>(null);
  const [parseError, setParseError] = React.useState<string | null>(null);
  const [importing, setImporting] = React.useState(false);
  const [toast, setToast] = React.useState<{ type: "success" | "error"; message: string } | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    setParseResult(null);
    setParseError(null);
    setToast(null);
    if (!f) {
      setFile(null);
      return;
    }
    if (!f.name.toLowerCase().endsWith(".csv")) {
      setParseError("Please select a .csv file.");
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    setFile(f);
    const reader = new FileReader();
    reader.onload = () => {
      const text = reader.result as string;
      if (typeof text !== "string" || !text.trim()) {
        setParseError("File is empty or could not be read.");
        setParseResult(null);
        return;
      }
      const result = parseTradesCsv(text);
      setParseResult(result);
      if (result.error) setParseError(result.error);
      else setParseError(null);
    };
    reader.onerror = () => setParseError("Failed to read file.");
    reader.readAsText(f, "UTF-8");
  };

  const handleImport = async () => {
    if (!parseResult?.validRows.length || importing) return;
    setImporting(true);
    setToast(null);
    const rows: InsertTradeRow[] = parseResult.validRows.map((r: ParsedTradeRow) => ({
      symbol: r.symbol,
      type: r.type,
      market: r.market,
      entry_price: r.entry_price,
      exit_price: r.exit_price,
      qty: r.qty,
      fees: r.fees,
      pnl: r.pnl,
      pnl_percent: r.pnl_percent,
      notes: r.notes,
      created_at: r.date ?? undefined,
    }));
    const { inserted, error: insertError } = await insertTradesBatch(rows);
    setImporting(false);
    if (insertError) {
      setToast({ type: "error", message: insertError });
      return;
    }
    const skipped = parseResult.invalidCount;
    setToast({
      type: "success",
      message: skipped > 0
        ? `Imported ${inserted} trades. Skipped ${skipped} invalid rows.`
        : `Imported ${inserted} trades.`,
    });
    onSuccess?.();
    setTimeout(() => {
      onOpenChange(false);
      setFile(null);
      setParseResult(null);
      setParseError(null);
      setToast(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }, 1500);
  };

  const handleClose = () => {
    if (!importing) {
      onOpenChange(false);
      setFile(null);
      setParseResult(null);
      setParseError(null);
      setToast(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const canImport = parseResult?.validRows && parseResult.validRows.length > 0 && !importing;

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      <div
        className="absolute inset-0 bg-black/60"
        onClick={handleClose}
        aria-hidden
      />
      <div className="flex min-h-full flex-col items-center justify-center py-8 px-4">
        <dialog
          open
          className="relative z-10 mt-8 mb-16 flex w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-border bg-card text-foreground shadow-xl max-h-[calc(95vh-5rem)]"
          onCancel={handleClose}
        >
          <div className="flex shrink-0 items-start justify-between border-b border-border px-6 py-4">
            <div>
              <h2 className="text-xl font-semibold text-foreground">Import CSV</h2>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Upload a CSV file with your trades to import in bulk.
              </p>
            </div>
            <button
              type="button"
              onClick={handleClose}
              disabled={importing}
              className="rounded-md p-1.5 text-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
              aria-label="Close"
            >
              <span className="text-lg leading-none">×</span>
            </button>
          </div>

          <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-6 py-5">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">CSV file</label>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="block w-full text-sm text-foreground file:mr-4 file:rounded-lg file:border-0 file:bg-primary file:px-4 file:py-2 file:text-sm file:font-medium file:text-primary-foreground file:hover:opacity-90"
              />
            </div>

            <p className="text-sm text-muted-foreground">
              {EXPECTED_COLUMNS}
            </p>

            {parseError && (
              <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {parseError}
              </div>
            )}

            {toast && (
              <div
                className={`rounded-lg border px-4 py-3 text-sm ${
                  toast.type === "success"
                    ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                    : "border-destructive/50 bg-destructive/10 text-destructive"
                }`}
              >
                {toast.message}
              </div>
            )}

            {parseResult?.rowResults && parseResult.rowResults.length > 0 && (
              <div className="min-h-0 overflow-auto rounded-lg border border-border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/40">
                      <th className="px-3 py-2 text-left font-medium text-foreground">Row</th>
                      <th className="px-3 py-2 text-left font-medium text-foreground">Symbol</th>
                      <th className="px-3 py-2 text-left font-medium text-foreground">Type</th>
                      <th className="px-3 py-2 text-left font-medium text-foreground">Market</th>
                      <th className="px-3 py-2 text-right font-medium text-foreground">Entry</th>
                      <th className="px-3 py-2 text-right font-medium text-foreground">Exit</th>
                      <th className="px-3 py-2 text-right font-medium text-foreground">Qty</th>
                      <th className="px-3 py-2 text-left font-medium text-foreground">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parseResult.rowResults.map((res, idx) => (
                      <PreviewRow key={idx} result={res} />
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {parseResult?.success && parseResult.rowResults.length === 0 && file && !parseError && (
              <p className="text-sm text-muted-foreground">No data rows found in the CSV.</p>
            )}
          </div>

          <div className="shrink-0 flex justify-end gap-3 border-t border-border px-6 py-4">
            <button
              type="button"
              onClick={handleClose}
              disabled={importing}
              className="rounded-lg border border-border bg-transparent px-5 py-2.5 text-sm font-medium text-foreground hover:bg-muted hover:text-foreground disabled:opacity-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleImport}
              disabled={!canImport}
              className="rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {importing ? "Importing…" : `Import ${parseResult?.validRows?.length ?? 0} valid rows`}
            </button>
          </div>
        </dialog>
      </div>
    </div>
  );
}

function PreviewRow({ result }: { result: RowResult }) {
  if (result.valid) {
    const r = result.row;
    return (
      <tr className="border-b border-border last:border-0 bg-card text-foreground">
        <td className="px-3 py-2 text-muted-foreground">{result.rowIndex}</td>
        <td className="px-3 py-2 font-medium">{r.symbol}</td>
        <td className="px-3 py-2">{r.type}</td>
        <td className="px-3 py-2">{r.market}</td>
        <td className="px-3 py-2 text-right">{r.entry_price}</td>
        <td className="px-3 py-2 text-right">{r.exit_price}</td>
        <td className="px-3 py-2 text-right">{r.qty}</td>
        <td className="px-3 py-2">
          <span className="inline-flex rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
            Valid
          </span>
        </td>
      </tr>
    );
  }
  return (
    <tr className="border-b border-border last:border-0 bg-destructive/5 text-foreground">
      <td className="px-3 py-2 text-muted-foreground">{result.rowIndex}</td>
      <td className="px-3 py-2">{String((result.raw as Record<string, unknown>).symbol ?? "—")}</td>
      <td className="px-3 py-2">{String((result.raw as Record<string, unknown>).type ?? "—")}</td>
      <td className="px-3 py-2">{String((result.raw as Record<string, unknown>).market ?? "—")}</td>
      <td className="px-3 py-2 text-right">{String((result.raw as Record<string, unknown>).entry_price ?? "—")}</td>
      <td className="px-3 py-2 text-right">{String((result.raw as Record<string, unknown>).exit_price ?? "—")}</td>
      <td className="px-3 py-2 text-right">{String((result.raw as Record<string, unknown>).qty ?? "—")}</td>
      <td className="px-3 py-2">
        <span className="inline-flex rounded-full bg-destructive/20 px-2 py-0.5 text-xs font-medium text-destructive" title={result.error}>
          Error
        </span>
        <span className="ml-1 text-xs text-destructive">{result.error}</span>
      </td>
    </tr>
  );
}
