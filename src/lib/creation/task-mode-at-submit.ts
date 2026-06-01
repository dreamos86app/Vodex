export type TaskModeAtSubmit = "discuss" | "edit" | "build";

export function parseTaskModeAtSubmit(raw: unknown): TaskModeAtSubmit {
  if (raw === "edit") return "edit";
  if (raw === "build") return "build";
  return "discuss";
}

/** Immutable mode for an in-flight task — UI must not switch tabs to change behavior. */
export function resolveActiveTaskMode(
  locked: TaskModeAtSubmit | null | undefined,
  currentUi: TaskModeAtSubmit,
): TaskModeAtSubmit {
  return locked ?? currentUi;
}
