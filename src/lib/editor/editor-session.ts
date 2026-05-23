export type EditorSessionState = {
  tabs: string[];
  activePath: string | null;
  updatedAt: string;
};

const PREFIX = "dreamos-editor-session:";

export function loadEditorSession(projectId: string): EditorSessionState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(`${PREFIX}${projectId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as EditorSessionState;
    if (!Array.isArray(parsed.tabs)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveEditorSession(projectId: string, state: Omit<EditorSessionState, "updatedAt">): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(
      `${PREFIX}${projectId}`,
      JSON.stringify({ ...state, updatedAt: new Date().toISOString() }),
    );
  } catch {
    /* quota */
  }
}

export function clearEditorSession(projectId: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(`${PREFIX}${projectId}`);
  } catch {
    /* ignore */
  }
}
