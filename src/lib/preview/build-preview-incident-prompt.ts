import type { PreviewIframeUrlResolution } from "@/lib/preview/preview-iframe-url-resolver";
import type {
  PreviewBootAuditPayload,
  PreviewBootAuditSummary,
} from "@/lib/preview/preview-boot-audit-types";
import { isIgnorablePreviewAssetLoadFailure, previewBootSucceeded } from "@/lib/preview/preview-boot-audit-types";
import type { PreviewLiveDiagnosticsSnapshot } from "@/lib/preview/preview-live-diagnostics";

export type PreviewIncidentPromptInput = {
  projectId?: string | null;
  artifactId?: string | null;
  previewRoute?: string | null;
  iframeUrl?: string | null;
  canonicalState?: string | null;
  embedBlocked?: boolean;
  embedBlockReason?: string | null;
  iframeMountCount?: number;
  bootAudit: PreviewBootAuditSummary;
  bootEvents?: PreviewBootAuditPayload[];
  liveSnapshot?: PreviewLiveDiagnosticsSnapshot | null;
  urlResolution?: PreviewIframeUrlResolution | null;
  runtimePreviewRenderable?: boolean | null;
  jobStatus?: string | null;
};

function topFailedResources(summary: PreviewBootAuditSummary, limit = 8): string[] {
  return summary.resources
    .filter((r) => {
      const failed = r.transferSize === 0 && r.duration === 0;
      const badStatus = typeof r.responseStatus === "number" && r.responseStatus >= 400;
      return failed || badStatus;
    })
    .slice(0, limit)
    .map(
      (r) =>
        `${r.name} [${r.initiatorType}] status=${r.responseStatus ?? "?"} size=${r.transferSize}`,
    );
}

function suggestFixes(input: PreviewIncidentPromptInput): string[] {
  const fixes: string[] = [];
  const { bootAudit: s } = input;

  if (input.embedBlocked) {
    fixes.push("Fix embed headers or use preview-runtime URL — external URL blocked in iframe.");
  }
  if (s.firstRuntimeError) {
    if (/createClient is not defined/i.test(s.firstRuntimeError)) {
      fixes.push("Inject Supabase createClient shim in preview-runtime HTML (base44-lovable-adapter).");
    } else if (/redirectToLogin is not a function/i.test(s.firstRuntimeError)) {
      fixes.push(
        "Add Base44 auth.redirectToLogin to preview shim (inject-preview-auth-compat.ts, base44-lovable-adapter.ts) and patch served JS chunks.",
      );
    } else if (/google sign-in|opening secure google/i.test(s.bootFailureReason ?? "")) {
      fixes.push(
        "Intercept OAuth via inject-preview-auth-guard.ts (location.href + window.open) and redirect to preview-runtime /login.",
      );
    } else {
      fixes.push(`Fix runtime error in imported bundle: ${s.firstRuntimeError}`);
    }
  }
  if (s.firstFailedAssetUrl && !isIgnorablePreviewAssetLoadFailure(s.firstFailedAssetUrl)) {
    fixes.push(`Repair missing/broken asset: ${s.firstFailedAssetUrl}`);
  }
  if (s.serviceWorkerCount && s.serviceWorkerCount > 0) {
    fixes.push("Unregister service workers in preview — Clear cache in preview toolbar.");
  }
  if (s.loadedCount === 0 && s.cancelledOrIncompleteCount > 0) {
    fixes.push("Iframe remounted or wrong base path — lock preview-runtime mount URL; verify artifact index.html.");
  }
  const authStuckEntry = (input.liveSnapshot?.entries ?? []).find(
    (e) => e.kind === "auth" && /google|oauth|sign-in/i.test(e.message),
  );
  if (authStuckEntry) {
    fixes.unshift(
      `Functional blocker: ${authStuckEntry.message}${authStuckEntry.rootCause ? ` — ${authStuckEntry.rootCause}` : ""}. Redirect iframe to preview-runtime/.../login (inject-preview-auth-guard.ts, preview-panel.tsx).`,
    );
  } else if (
    previewBootSucceeded(input.bootEvents ?? [], { iframeRemountCount: input.iframeMountCount })
  ) {
    const bodyHint = (input.liveSnapshot?.entries ?? [])
      .map((e) => e.detail ?? e.message)
      .join(" ")
      .toLowerCase();
    if (/opening secure google|connecting you securely/.test(bodyHint)) {
      fixes.unshift(
        "Boot OK but app stuck on Google OAuth welcome — intercept location.href/window.open and serve Vodex /login page.",
      );
    } else {
      fixes.push("Boot audit reports healthy load — dismiss false-positive failure overlay if preview renders.");
    }
  }
  if (fixes.length === 0) {
    fixes.push("Open expanded diagnostic bar; check Network tab for 404 on /assets/* under preview-runtime.");
  }
  return fixes;
}

/** Full copy-paste prompt for Cursor / support — locates preview blockers with fix hints. */
export function buildPreviewIncidentPrompt(input: PreviewIncidentPromptInput): string {
  const bootOk = previewBootSucceeded(input.bootEvents ?? [], {
    iframeRemountCount: input.iframeMountCount,
  });
  const failedResources = topFailedResources(input.bootAudit);
  const liveEntries = (input.liveSnapshot?.entries ?? []).slice(-15);

  const payload = {
    captured_at: new Date().toISOString(),
    route: typeof window !== "undefined" ? window.location.pathname : null,
    project_id: input.projectId ?? null,
    artifact_id: input.artifactId ?? null,
    preview_route: input.previewRoute ?? null,
    iframe_url: input.iframeUrl ?? null,
    canonical_state: input.canonicalState ?? null,
    embed_blocked: input.embedBlocked ?? false,
    embed_block_reason: input.embedBlockReason ?? null,
    runtime_preview_renderable: input.runtimePreviewRenderable ?? null,
    job_status: input.jobStatus ?? null,
    boot_succeeded: bootOk,
    boot_failure_reason: input.bootAudit.bootFailureReason,
    boot_summary: {
      loadedCount: input.bootAudit.loadedCount,
      failedCount: input.bootAudit.failedCount,
      cancelledOrIncompleteCount: input.bootAudit.cancelledOrIncompleteCount,
      firstFailedAssetUrl: input.bootAudit.firstFailedAssetUrl,
      firstRuntimeError: input.bootAudit.firstRuntimeError,
      serviceWorkerCount: input.bootAudit.serviceWorkerCount,
      navigations: input.bootAudit.navigations,
      iframe_mount_count: input.iframeMountCount ?? 0,
    },
    url_resolution: input.urlResolution
      ? {
          source: input.urlResolution.source,
          artifactId: input.urlResolution.artifactId,
          route: input.urlResolution.route,
          wasNormalized: input.urlResolution.wasNormalized,
          wasRejected: input.urlResolution.wasRejected,
          rejectReason: input.urlResolution.rejectReason,
        }
      : null,
    failed_resources_sample: failedResources,
    live_diagnostics: liveEntries,
  };

  const fixes = suggestFixes(input);

  return `# Vodex preview — debug incident

You are fixing a preview-runtime load failure in DreamOS / Vodex (Next.js App Router, imported ZIP artifacts).

## Summary
- **Boot healthy:** ${bootOk ? "yes" : "no"}
- **Blocker:** ${input.bootAudit.bootFailureReason ?? input.liveSnapshot?.lastBlocker ?? "unknown"}
- **Project:** ${input.projectId ?? "n/a"}
- **Artifact:** ${input.artifactId ?? "n/a"}
- **Iframe:** ${input.iframeUrl ?? "n/a"}

## Boot audit
\`\`\`json
${JSON.stringify(payload.boot_summary, null, 2)}
\`\`\`

## Full diagnostic payload
\`\`\`json
${JSON.stringify(payload, null, 2)}
\`\`\`

## Suggested fixes (priority order)
${fixes.map((f, i) => `${i + 1}. ${f}`).join("\n")}

## Required output
1. Root cause (1–3 sentences)
2. Exact files and line-level fix
3. Minimal patch only — preview boot audit, preview-runtime serving, or artifact shims
4. Verify: \`npm run verify:preview-boot-resource-audit\`, \`npx tsc --noEmit\`
`;
}
