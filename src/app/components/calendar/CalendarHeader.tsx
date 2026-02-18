"use client";

import * as React from "react";

type CalendarHeaderProps = {
  onToday?: () => void;
};

export function CalendarHeader({ onToday }: CalendarHeaderProps) {
  return (
    <header className="mb-6 flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold text-white">Trading Calendar</h1>
        <p className="mt-1 text-sm text-white/60">
          Track your daily performance and identify patterns
        </p>
      </div>
      {onToday && (
        <button
          type="button"
          onClick={onToday}
          className="mt-2 rounded-lg border border-white/10 bg-[#121826] px-4 py-2 text-sm font-medium text-white shadow transition hover:bg-white/5 sm:mt-0"
        >
          Today
        </button>
      )}
    </header>
  );
}
