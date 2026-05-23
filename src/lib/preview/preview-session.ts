export type PreviewSessionStatus = "pending" | "building" | "ready" | "failed" | "expired";

export type PreviewSessionRow = {
  id: string;
  project_id: string;
  owner_id: string;
  status: PreviewSessionStatus;
  preview_url: string | null;
  snapshot_id: string | null;
  snapshot_files: Array<{ path: string; content: string }> | null;
  logs: Array<{ at: string; message: string }> | null;
  error: string | null;
  created_at: string;
  updated_at: string;
  expires_at: string | null;
};

export function appendPreviewLog(
  logs: Array<{ at: string; message: string }> | null | undefined,
  message: string,
): Array<{ at: string; message: string }> {
  const cur = logs ?? [];
  return [...cur, { at: new Date().toISOString(), message }];
}

export function previewExpiresAt(hours = 24): string {
  return new Date(Date.now() + hours * 3600_000).toISOString();
}
