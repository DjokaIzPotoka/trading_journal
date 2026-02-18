import { supabase } from "@/app/lib/supabase";
import type { Trade } from "@/app/lib/trades";

/**
 * Fetches trades whose trade date falls within [fromISO, toISO].
 * Uses created_at for filtering (schema has no exit_time).
 */
export async function getTradesInRange(
  fromISO: string,
  toISO: string
): Promise<Trade[]> {
  const { data, error } = await supabase
    .from("trades")
    .select("*")
    .gte("created_at", fromISO)
    .lte("created_at", toISO)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return (data ?? []) as Trade[];
}
