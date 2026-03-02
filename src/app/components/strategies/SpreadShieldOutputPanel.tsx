"use client";

import * as React from "react";

export function SpreadShieldOutputPanel({ children }: { children: React.ReactNode }) {
  return (
    <div className="lg:col-span-7 lg:sticky lg:top-6 lg:self-start">
      {children}
    </div>
  );
}
