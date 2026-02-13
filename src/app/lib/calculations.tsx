/** Fee rate for crypto (e.g. 0.05%) */
export const CRYPTO_FEE_RATE = 0.0005;

/**
 * Crypto fees: fee = (entry_price × qty_coin × fee_rate) + (exit_price × qty_coin × fee_rate)
 * with qty_coin = qty / entry_price (qty = position size in USD).
 */
export function calculateCryptoFees(
  entry: number,
  exit: number,
  qty: number,
  feeRate: number = CRYPTO_FEE_RATE
): number {
  if (entry <= 0 || qty <= 0) return 0;
  const qty_coin = qty / entry;
  return (
    entry * qty_coin * feeRate +
    exit * qty_coin * feeRate
  );
}

export function calculatePnL({
  type,
  entry,
  exit,
  qty,
  fees,
}: {
  type: "long" | "short";
  entry: number;
  exit: number;
  qty: number;
  fees: number;
}) {
  const gross =
    type === "long"
      ? (exit - entry) * qty
      : (entry - exit) * qty;

  const pnl = Math.round((gross - fees) * 100) / 100;
  const pnlPct = Math.round((qty > 0 ? (pnl / (entry * qty)) * 100 : 0) * 100) / 100;

  return { pnl, pnlPct };
}

/**
 * Crypto PnL: qty is position size (e.g. leverage * margin in USD).
 * qty_coin = qty / entry_price
 * Long:  PnL = (exit - entry) * qty_coin - fees
 * Short: PnL = (entry - exit) * qty_coin - fees
 * PnL % = pnl / position_margin * 100
 */
export function calculateCryptoPnL({
  type,
  entry,
  exit,
  qty,
  fees,
  position_margin,
}: {
  type: "long" | "short";
  entry: number;
  exit: number;
  qty: number;
  fees: number;
  position_margin: number;
}) {
  if (entry <= 0) return { pnl: 0, pnlPct: 0 };
  const qty_coin = qty / entry;
  const gross =
    type === "long"
      ? (exit - entry) * qty_coin
      : (entry - exit) * qty_coin;
  const pnl = Math.round((gross - fees) * 100) / 100;
  const pnlPct = Math.round((position_margin > 0 ? (pnl / position_margin) * 100 : 0) * 100) / 100;
  return { pnl, pnlPct };
}
