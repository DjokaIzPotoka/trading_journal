/**
 * Calendar date helpers. Week is Sun–Sat.
 */

export function startOfMonth(d: Date): Date {
  const out = new Date(d.getFullYear(), d.getMonth(), 1);
  out.setHours(0, 0, 0, 0);
  return out;
}

export function endOfMonth(d: Date): Date {
  const out = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  out.setHours(23, 59, 59, 999);
  return out;
}

/** Sunday 00:00:00 of the week containing d */
export function startOfWeekSunday(d: Date): Date {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  const day = out.getDay();
  out.setDate(out.getDate() - day);
  return out;
}

/** Saturday 23:59:59 of the week containing d */
export function endOfWeekSaturday(d: Date): Date {
  const start = startOfWeekSunday(d);
  const out = new Date(start);
  out.setDate(out.getDate() + 6);
  out.setHours(23, 59, 59, 999);
  return out;
}

export function formatMonthYear(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

export type CalendarDay = {
  date: Date;
  dayOfMonth: number;
  isCurrentMonth: boolean;
  isoDateKey: string;
};

/**
 * Returns 42 day objects (6 rows × 7 cols) for a calendar grid.
 * Includes leading/trailing days from adjacent months so the grid is full.
 * Week starts Sunday.
 */
export function getDaysForCalendarGrid(monthDate: Date): CalendarDay[] {
  const monthStart = startOfMonth(monthDate);
  const monthEnd = endOfMonth(monthDate);
  const gridStart = startOfWeekSunday(monthStart);
  const days: CalendarDay[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    const isoKey = toISODateKey(d);
    const isCurrentMonth = d.getMonth() === monthDate.getMonth();
    days.push({
      date: d,
      dayOfMonth: d.getDate(),
      isCurrentMonth,
      isoDateKey: isoKey,
    });
  }
  return days;
}

/** YYYY-MM-DD for a date (local date, not UTC) */
export function toISODateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Whether two dates are the same calendar day (local) */
export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** Short date for display, e.g. "Feb 22, 2026" */
export function formatShortDate(d: Date): string {
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** Get trade date from a trade (uses created_at; no exit_time in schema) */
export function getTradeDate(createdAt: string): Date {
  return new Date(createdAt);
}
