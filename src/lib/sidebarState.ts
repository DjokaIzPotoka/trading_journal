const STORAGE_KEY = "sidebarCollapsed";

export function getSidebarCollapsed(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(STORAGE_KEY) === "true";
}

export function setSidebarCollapsed(collapsed: boolean): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, String(collapsed));
}
