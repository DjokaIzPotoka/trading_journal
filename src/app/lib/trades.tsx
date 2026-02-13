import { supabase } from "./supabase";

export type Market = "crypto" | "cfd" | "forex";
export type TradeType = "long" | "short";

export type Trade = {
  id: string;
  created_at: string;
  symbol: string;
  type: TradeType;
  market: Market;
  entry_price: number;
  exit_price: number;
  fees: number;
  pnl: number;
  pnl_percent: number;
  notes: string | null;
  qty: number;
};

export type TradeStats = {
  total_trades: number;
  total_pnl: number | null;
  total_fees: number | null;
  avg_pnl: number | null;
  avg_win: number | null;
  avg_loss: number | null;
  win_rate_pct: number | null;
};

export type InsertTrade = Omit<Trade, "id" | "created_at"> & {
  created_at?: string;
};

export async function getTrades(params?: {
  symbol?: string;
  market?: Market;
  type?: TradeType;
  from?: string;
  to?: string;
}) {
  let query = supabase
    .from("trades")
    .select("*")
    .order("created_at", { ascending: false });

  if (params?.symbol?.trim()) {
    query = query.ilike("symbol", `%${params.symbol.trim()}%`);
  }
  if (params?.market) {
    query = query.eq("market", params.market);
  }
  if (params?.type) {
    query = query.eq("type", params.type);
  }
  if (params?.from) {
    query = query.gte("created_at", params.from);
  }
  if (params?.to) {
    query = query.lte("created_at", params.to);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as Trade[];
}

export async function getTradeStats(): Promise<TradeStats> {
  const { data, error } = await supabase.from("v_trade_stats").select("*").single();
  if (error) throw error;
  return data as TradeStats;
}

export async function insertTrade(row: {
  symbol: string;
  type: TradeType;
  market: Market;
  entry_price: number;
  exit_price: number;
  fees: number;
  pnl: number;
  pnl_percent: number;
  notes?: string | null;
  qty: number;
}) {
  const { data, error } = await supabase
    .from("trades")
    .insert({
      symbol: row.symbol.trim(),
      type: row.type,
      market: row.market,
      entry_price: row.entry_price,
      exit_price: row.exit_price,
      fees: row.fees,
      pnl: row.pnl,
      pnl_percent: row.pnl_percent,
      notes: row.notes?.trim() || null,
      qty: row.qty,
    })
    .select("id, created_at")
    .single();
  if (error) throw error;
  return data as { id: string; created_at: string };
}

export async function deleteTrade(id: string) {
  const { error } = await supabase.from("trades").delete().eq("id", id);
  if (error) throw error;
}
