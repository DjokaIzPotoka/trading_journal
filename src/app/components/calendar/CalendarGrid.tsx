"use client";

import * as React from "react";
import { getDaysForCalendarGrid, type CalendarDay } from "@/lib/date";
import { DayCell, type DayCellData } from "./DayCell";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type CalendarGridProps = {
  monthDate: Date;
  selectedDate: Date | null;
  dailyData: Map<string, DayCellData>;
  onSelectDay: (date: Date) => void;
};

export function CalendarGrid({
  monthDate,
  selectedDate,
  dailyData,
  onSelectDay,
}: CalendarGridProps) {
  const days = React.useMemo(
    () => getDaysForCalendarGrid(monthDate),
    [monthDate.getFullYear(), monthDate.getMonth()]
  );

  const isSelected = React.useCallback(
    (day: CalendarDay) => {
      if (!selectedDate) return false;
      return (
        selectedDate.getFullYear() === day.date.getFullYear() &&
        selectedDate.getMonth() === day.date.getMonth() &&
        selectedDate.getDate() === day.date.getDate()
      );
    },
    [selectedDate]
  );

  return (
    <div className="mt-4">
      <div className="grid grid-cols-7 gap-1">
        {WEEKDAYS.map((label) => (
          <div
            key={label}
            className="py-2 text-center text-xs font-medium uppercase tracking-wider text-white/60"
          >
            {label}
          </div>
        ))}
        {days.map((day) => (
          <DayCell
            key={day.isoDateKey}
            day={day}
            data={day.isCurrentMonth ? dailyData.get(day.isoDateKey) ?? null : null}
            isSelected={day.isCurrentMonth && isSelected(day)}
            isWeekend={day.date.getDay() === 0 || day.date.getDay() === 6}
            onSelect={() => onSelectDay(day.date)}
          />
        ))}
      </div>
    </div>
  );
}
