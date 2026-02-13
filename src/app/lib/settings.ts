const STORAGE_KEY = "trading_journal_starting_balance";

export function getStartingBalance(): number {
  if (typeof window === "undefined") return 0;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw == null) return 0;
    const n = Number(raw);
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

export function setStartingBalance(value: number): void {
  if (typeof window === "undefined") return;
  try {
    const n = Number.isFinite(value) ? value : 0;
    localStorage.setItem(STORAGE_KEY, String(n));
  } catch {
    // ignore
  }
}
