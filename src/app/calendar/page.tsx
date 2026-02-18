"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  getTrades,
  type Trade,
} from "../lib/trades";
import {
  startOfMonth,
  endOfMonth,
  startOfWeekSunday,
  endOfWeekSaturday,
  getDaysForCalendarGrid,
  toISODateKey,
  getTradeDate,
} from "@/lib/date";
import { CalendarHeader } from "../components/calendar/CalendarHeader";
import { MonthNavigator } from "../components/calendar/MonthNavigator";
import { CalendarGrid } from "../components/calendar/CalendarGrid";
import { MonthlySummary } from "../components/calendar/MonthlySummary";
import { WeeklySummary } from "../components/calendar/WeeklySummary";
import { SelectedDayTrades } from "../components/calendar/SelectedDayTrades";
import type { DayCellData } from "../components/calendar/DayCell";

function buildDailyData(trades: Trade[]): Map<string, DayCellData> {
  const map = new Map<string, DayCellData>();
  for (const t of trades) {
    const d = getTradeDate(t.created_at);
    const key = toISODateKey(d);
    const existing = map.get(key);
    if (!existing) {
      map.set(key, {
        dailyPnl: t.pnl,
        tradesCount: 1,
        winRateDay: t.pnl > 0 ? 1 : 0,
      });
    } else {
      existing.dailyPnl += t.pnl;
      existing.tradesCount += 1;
      const wins = existing.winRateDay * (existing.tradesCount - 1) + (t.pnl > 0 ? 1 : 0);
      existing.winRateDay = wins / existing.tradesCount;
    }
  }
  return map;
}

function getMonthRange(monthDate: Date): { from: string; to: string } {
  const start = startOfMonth(monthDate);
  const end = endOfMonth(monthDate);
  return {
    from: start.toISOString(),
    to: end.toISOString(),
  };
}

function getWeekNumberInGrid(monthDate: Date, selectedDate: Date): number {
  const days = getDaysForCalendarGrid(monthDate);
  const key = toISODateKey(selectedDate);
  const idx = days.findIndex((d) => d.isoDateKey === key);
  if (idx < 0) return 1;
  return Math.floor(idx / 7) + 1;
}

function getWeeklyAggregation(
  selectedDate: Date,
  dailyData: Map<string, DayCellData>
): { weeklyPnl: number; tradedDays: number } {
  const weekStart = startOfWeekSunday(selectedDate);
  let weeklyPnl = 0;
  let tradedDays = 0;
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    const key = toISODateKey(d);
    const cell = dailyData.get(key);
    if (cell) {
      weeklyPnl += cell.dailyPnl;
      if (cell.tradesCount > 0) tradedDays += 1;
    }
  }
  return { weeklyPnl, tradedDays };
}

export default function CalendarPage() {
  const today = new Date();
  const [monthDate, setMonthDate] = React.useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDate, setSelectedDate] = React.useState<Date | null>(() => new Date(today));

  const { data: trades = [] } = useQuery({
    queryKey: ["trades", "calendar"],
    queryFn: () => getTrades({}),
  });

  const monthRange = React.useMemo(
    () => getMonthRange(monthDate),
    [monthDate.getFullYear(), monthDate.getMonth()]
  );

  const tradesInMonth = React.useMemo(() => {
    const from = new Date(monthRange.from).getTime();
    const to = new Date(monthRange.to).getTime();
    return trades.filter((t) => {
      const tms = new Date(t.created_at).getTime();
      return tms >= from && tms <= to;
    });
  }, [trades, monthRange]);

  const dailyData = React.useMemo(() => buildDailyData(trades), [trades]);

  const monthlyStats = React.useMemo(() => {
    const dailyByKey = new Map<string, { pnl: number; trades: number }>();
    for (const t of tradesInMonth) {
      const d = getTradeDate(t.created_at);
      const key = toISODateKey(d);
      const ex = dailyByKey.get(key);
      if (!ex) {
        dailyByKey.set(key, { pnl: t.pnl, trades: 1 });
      } else {
        ex.pnl += t.pnl;
        ex.trades += 1;
      }
    }
    let netPnl = 0;
    let totalTrades = 0;
    let winningDays = 0;
    let losingDays = 0;
    let wins = 0;
    for (const t of tradesInMonth) {
      netPnl += t.pnl;
      totalTrades += 1;
      if (t.pnl > 0) wins += 1;
    }
    dailyByKey.forEach(({ pnl }) => {
      if (pnl > 0) winningDays += 1;
      if (pnl < 0) losingDays += 1;
    });
    const winRatePct = totalTrades > 0 ? (wins / totalTrades) * 100 : 0;
    return {
      netPnl,
      totalTrades,
      winningDays,
      losingDays,
      winRatePct,
    };
  }, [tradesInMonth]);

  const monthPnl = monthlyStats.netPnl;
  const daysTradedInMonth = React.useMemo(() => {
    const keys = new Set<string>();
    tradesInMonth.forEach((t) => keys.add(toISODateKey(getTradeDate(t.created_at))));
    return keys.size;
  }, [tradesInMonth]);

  const weeklyInfo = React.useMemo(() => {
    if (!selectedDate) return { weekLabel: "—", weeklyPnl: 0, tradedDays: 0 };
    const { weeklyPnl, tradedDays } = getWeeklyAggregation(selectedDate, dailyData);
    const weekNum = getWeekNumberInGrid(monthDate, selectedDate);
    return {
      weekLabel: `Week ${weekNum}`,
      weeklyPnl,
      tradedDays,
    };
  }, [selectedDate, dailyData, monthDate]);

  const goPrevMonth = React.useCallback(() => {
    setMonthDate((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1));
  }, []);

  const goNextMonth = React.useCallback(() => {
    setMonthDate((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1));
  }, []);

  const goToday = React.useCallback(() => {
    const now = new Date();
    setMonthDate(new Date(now.getFullYear(), now.getMonth(), 1));
    setSelectedDate(new Date(now));
  }, []);

  const handleSelectDay = React.useCallback((date: Date) => {
    setSelectedDate(date);
  }, []);

  return (
    <div className="min-h-screen bg-[#0B0F1A] text-white">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <CalendarHeader onToday={goToday} />

        <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
          <div className="flex-1 rounded-xl border border-white/10 bg-[#121826] p-4 shadow-lg">
            <MonthNavigator
              monthDate={monthDate}
              onPrev={goPrevMonth}
              onNext={goNextMonth}
              monthPnl={monthPnl}
              daysTraded={daysTradedInMonth}
            />
            <CalendarGrid
              monthDate={monthDate}
              selectedDate={selectedDate}
              dailyData={dailyData}
              onSelectDay={handleSelectDay}
            />
          </div>

          <aside className="w-full shrink-0 space-y-4 lg:w-80">
            <MonthlySummary
              netPnl={monthlyStats.netPnl}
              totalTrades={monthlyStats.totalTrades}
              winningDays={monthlyStats.winningDays}
              losingDays={monthlyStats.losingDays}
              winRatePct={monthlyStats.winRatePct}
            />
            <WeeklySummary
              weekLabel={weeklyInfo.weekLabel}
              weeklyPnl={weeklyInfo.weeklyPnl}
              tradedDays={weeklyInfo.tradedDays}
            />
            <SelectedDayTrades
              selectedDate={selectedDate ?? new Date()}
              trades={trades}
            />
          </aside>
        </div>
      </div>
    </div>
  );
}
