const STORAGE_KEY = "vodex_help_recent";

export type RecentHelpView = {
  href: string;
  title: string;
  category: string;
  viewedAt: number;
};

export function recordHelpView(entry: Omit<RecentHelpView, "viewedAt">): void {
  if (typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const list: RecentHelpView[] = raw ? (JSON.parse(raw) as RecentHelpView[]) : [];
    const next = [
      { ...entry, viewedAt: Date.now() },
      ...list.filter((x) => x.href !== entry.href),
    ].slice(0, 8);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

export function getRecentHelpViews(): RecentHelpView[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as RecentHelpView[]) : [];
  } catch {
    return [];
  }
}
