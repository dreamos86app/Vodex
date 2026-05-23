export type EditorCheckpoint = {
  id: string;
  projectId: string;
  label: string;
  createdAt: string;
  fileCount: number;
  stage: "pre_build" | "pre_edit" | "pre_polish" | "pre_publish" | "post_stage" | "manual";
  files: Array<{ path: string; content: string }>;
  changedPaths?: string[];
};

export const CHECKPOINT_STAGE_LABELS: Record<EditorCheckpoint["stage"], string> = {
  pre_build: "Before build",
  pre_edit: "Before edit",
  pre_polish: "Before polish",
  pre_publish: "Before publish",
  post_stage: "After stage",
  manual: "Manual",
};

export function createCheckpoint(input: {
  projectId: string;
  label: string;
  stage: EditorCheckpoint["stage"];
  files: Array<{ path: string; content: string }>;
  changedPaths?: string[];
}): EditorCheckpoint {
  return {
    id: `cp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    projectId: input.projectId,
    label: input.label,
    createdAt: new Date().toISOString(),
    fileCount: input.files.length,
    stage: input.stage,
    files: input.files,
    changedPaths: input.changedPaths,
  };
}
