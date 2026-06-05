const PREFIX = "vodex_setup_checklist_";

export function getChecklistProgress(
  projectId: string,
  providerId: string,
): Record<string, boolean> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(`${PREFIX}${projectId}_${providerId}`);
    return raw ? (JSON.parse(raw) as Record<string, boolean>) : {};
  } catch {
    return {};
  }
}

export function setChecklistItem(
  projectId: string,
  providerId: string,
  itemId: string,
  checked: boolean,
): Record<string, boolean> {
  const current = getChecklistProgress(projectId, providerId);
  const next = { ...current, [itemId]: checked };
  if (typeof window !== "undefined") {
    localStorage.setItem(`${PREFIX}${projectId}_${providerId}`, JSON.stringify(next));
  }
  return next;
}

export function checklistPercent(
  items: Array<{ id: string }>,
  progress: Record<string, boolean>,
): number {
  if (!items.length) return 0;
  const done = items.filter((i) => progress[i.id]).length;
  return Math.round((done / items.length) * 100);
}
