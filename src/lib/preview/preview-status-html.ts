import type { PreviewRuntimeStatusPayload } from "@/lib/preview/preview-runtime-status";
import { previewRuntimeStateLabel } from "@/lib/preview/preview-runtime-status";

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Non-blank HTML for iframe when preview is not renderable (never empty 200). */
export function buildPreviewStatusHtml(status: PreviewRuntimeStatusPayload, logs?: string): string {
  const title = previewRuntimeStateLabel(status);
  const rows: Array<[string, string]> = [
    ["Status", title],
    ["Job", status.jobId ?? "—"],
    ["Job status", status.jobStatus ?? status.previewStatus],
    ["Framework", status.frameworkLabel ?? status.framework ?? "—"],
    ["Artifact", status.artifactPath ?? "—"],
    ["Renderable", status.previewRenderable ? "yes" : "no"],
    ["Honest", status.previewHonest ? "yes" : "no"],
  ];
  if (status.lockedBy) rows.push(["Worker", status.lockedBy]);
  if (status.blockedReason) rows.push(["Blocked", status.blockedReason]);
  if (status.workerUnavailableMessage) rows.push(["Worker", status.workerUnavailableMessage]);

  const table = rows
    .map(
      ([k, v]) =>
        `<tr><td style="padding:4px 12px 4px 0;color:#94a3b8;font-size:11px;white-space:nowrap">${esc(k)}</td><td style="padding:4px 0;font-size:12px;color:#e2e8f0">${esc(v)}</td></tr>`,
    )
    .join("");

  const logBlock = logs?.trim()
    ? `<pre style="margin-top:16px;max-height:200px;overflow:auto;padding:12px;background:#0f172a;border-radius:8px;font-size:10px;color:#94a3b8;white-space:pre-wrap">${esc(logs.slice(0, 8000))}</pre>`
    : "";

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${esc(title)}</title></head>
<body style="margin:0;font-family:system-ui,sans-serif;background:#0b1220;color:#e2e8f0;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px">
<div style="max-width:520px;width:100%">
<h1 style="margin:0 0 8px;font-size:18px;font-weight:600">${esc(title)}</h1>
<p style="margin:0 0 16px;font-size:13px;color:#94a3b8">VODEX preview runtime — waiting for a renderable build.</p>
<table style="width:100%;border-collapse:collapse">${table}</table>
${logBlock}
</div></body></html>`;
}
