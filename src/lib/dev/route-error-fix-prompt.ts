import type { RouteErrorPayload } from "@/lib/dev/route-error-context";
import { readRuntimeDiagnostics } from "@/lib/dev/runtime-diagnostics";
import { readOwnerIncidents } from "@/lib/dev/owner-incident-store";

export function buildRouteErrorFixPrompt(
  payload: RouteErrorPayload,
  options?: { ownerEmail?: string | null },
): string {
  const diagnostics = readRuntimeDiagnostics().slice(0, 24);
  const incidents = readOwnerIncidents().slice(0, 12);

  const lines = [
    "# Vodex — fatal route error fix prompt",
    "",
    "You are a principal engineer fixing a production crash in DreamOS / Vodex (Next.js 16 App Router, Supabase, AI build pipeline).",
    "Deliver a minimal, safe patch. Do not change unrelated billing or UI.",
    "",
    "## Crash summary",
    `- captured_at: ${payload.at}`,
    `- error_boundary: ${payload.boundary}`,
    `- boundary_source: ${payload.boundarySource}`,
    `- owner_email: ${options?.ownerEmail ?? "(unknown)"}`,
    "",
    "## Error",
    `- name: ${payload.name ?? "Error"}`,
    `- message: ${payload.message}`,
    `- digest: ${payload.digest ?? "n/a"}`,
    "",
    "## Route context",
    `- pathname: ${payload.pathname ?? "n/a"}`,
    `- full_route: ${payload.route ?? "n/a"}`,
    `- project_id: ${payload.projectId ?? "n/a"}`,
    `- autostart: ${payload.autostart ?? "n/a"}`,
    `- strategy: ${payload.strategy ?? "n/a"}`,
    `- conversationId: ${payload.conversationId ?? "n/a"}`,
    `- jobId: ${payload.jobId ?? "n/a"}`,
    `- user_agent: ${payload.userAgent ?? "n/a"}`,
    "",
    "## Query params",
    "```json",
    JSON.stringify(payload.searchParams ?? {}, null, 2),
    "```",
    "",
    "## Stack trace",
    "```",
    payload.stack ?? "(no stack — check digest / server logs)",
    "```",
  ];

  if (incidents.length > 0) {
    lines.push("", "## Owner incidents (client)");
    for (const inc of incidents) {
      lines.push(`- ${inc.at} · ${inc.kind} · ${inc.title}`);
      if (inc.message) lines.push(`  ${inc.message.slice(0, 500)}`);
    }
  }

  if (diagnostics.length > 0) {
    lines.push("", "## Runtime diagnostics tail");
    for (const d of diagnostics) {
      lines.push(`- ${d.at} · ${d.event}`);
      if (d.detail) lines.push(`  ${JSON.stringify(d.detail).slice(0, 800)}`);
    }
  }

  lines.push(
    "",
    "## Likely builder autostart checks",
    "- ImmersiveWorkspace autostart effect must not call runSubmit before ref is assigned.",
    "- Invalid conversationId UUID in URL must be ignored.",
    "- Project gate must tolerate null icon/name until identity step.",
    "- Error boundaries: src/app/error.tsx and src/app/(workspace)/error.tsx must render owner diagnostics inline.",
    "",
    "## Required output",
    "1. Root cause (1–3 sentences)",
    "2. Exact files and line-level fix",
    "3. Patch snippets",
    "4. verify: `npm run typecheck`, `npm run verify:error-boundary-diagnostics`, `npm run verify:builder-autostart-crash`",
    "5. Manual QA: open `/apps/{id}/builder?autostart=1&strategy=build_now&conversationId=...` as owner",
  );

  return lines.join("\n");
}

export function buildSanitizedCrashReport(payload: RouteErrorPayload): string {
  return [
    "Vodex crash report (sanitized)",
    `at: ${payload.at}`,
    `boundary: ${payload.boundary}`,
    `digest: ${payload.digest ?? "n/a"}`,
    `route: ${payload.route ?? "n/a"}`,
    "Sign in as platform owner for full diagnostics on the error page.",
  ].join("\n");
}
