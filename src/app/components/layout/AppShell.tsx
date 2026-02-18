"use client";

import * as React from "react";
import { Sidebar } from "./Sidebar";
import { getSidebarCollapsed, setSidebarCollapsed } from "@/lib/sidebarState";

const SIDEBAR_WIDTH_EXPANDED = 280;
const SIDEBAR_WIDTH_COLLAPSED = 88;

type AppShellProps = {
  children: React.ReactNode;
};

export function AppShell({ children }: AppShellProps) {
  const [collapsed, setCollapsed] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setCollapsed(getSidebarCollapsed());
    setMounted(true);
  }, []);

  const handleCollapseToggle = React.useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      setSidebarCollapsed(next);
      return next;
    });
  }, []);

  const sidebarWidth = mounted
    ? collapsed
      ? SIDEBAR_WIDTH_COLLAPSED
      : SIDEBAR_WIDTH_EXPANDED
    : SIDEBAR_WIDTH_EXPANDED;

  return (
    <div className="min-h-screen bg-[#0B0F1A]">
      <Sidebar collapsed={collapsed} onCollapseToggle={handleCollapseToggle} />
      <main
        className="min-h-screen transition-[margin-left] duration-200 ease-in-out"
        style={{ marginLeft: sidebarWidth }}
      >
        {children}
      </main>
    </div>
  );
}
