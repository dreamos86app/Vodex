const KEY_PREFIX = "vodex:workspace-task:";

export type PersistedWorkspaceTask = {
  projectId: string;
  buildJobId?: string;
  eventsUrl?: string;
  operationId?: string;
  lockedMode?: "discuss" | "edit" | "build";
  buildStartedAtMs?: number;
  updatedAt?: string;
};

export function persistWorkspaceTask(task: PersistedWorkspaceTask): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(
      `${KEY_PREFIX}${task.projectId}`,
      JSON.stringify({ ...task, updatedAt: new Date().toISOString() }),
    );
  } catch {
    /* quota */
  }
}

export function readWorkspaceTask(projectId: string): PersistedWorkspaceTask | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(`${KEY_PREFIX}${projectId}`);
    if (!raw) return null;
    return JSON.parse(raw) as PersistedWorkspaceTask;
  } catch {
    return null;
  }
}

export function clearWorkspaceTask(projectId: string): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(`${KEY_PREFIX}${projectId}`);
  } catch {
    /* ignore */
  }
}
