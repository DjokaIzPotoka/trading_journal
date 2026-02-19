export type DisplayMode = "absolute" | "multiple";

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Format balance for tooltip/display.
 * All values rounded to 2 decimal places max.
 * Absolute: $ (e.g. $1,234.56). Multiple: 2 decimals + × (e.g. 1.25×).
 */
export function formatBalance(value: number, mode: DisplayMode): string {
  const v = round2(value);
  if (mode === "absolute") {
    return "$" + v.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  }
  return v.toFixed(2) + "×";
}

/**
 * Format Y-axis tick label.
 * All values rounded to 2 decimal places max.
 */
export function formatAxisLabel(value: number, mode: DisplayMode): string {
  const v = round2(value);
  if (mode === "absolute") {
    return v.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  }
  return v.toFixed(2) + "×";
}
