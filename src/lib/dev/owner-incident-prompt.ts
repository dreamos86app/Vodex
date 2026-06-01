import type { OwnerIncident } from "@/lib/dev/owner-incident-store";
import type { RuntimeDiagnosticEntry } from "@/lib/dev/runtime-diagnostics";

export function buildOwnerFixPrompt(input: {
  incidents: OwnerIncident[];
  diagnostics?: RuntimeDiagnosticEntry[];
  route?: string;
  userAgent?: string;
}): string {
  const lines = [
    "# Vodex platform — owner incident fix prompt",
    "",
    "You are a senior full-stack engineer fixing DreamOS / Vodex (Next.js 16, Supabase, AI build pipeline).",
    "Produce a minimal, production-safe patch. Do not change billing math or unrelated features.",
    "",
    "## Environment",
    `- route: ${input.route ?? "(unknown)"}`,
    `- user_agent: ${input.userAgent ?? "(unknown)"}`,
    `- captured_at: ${new Date().toISOString()}`,
    "",
    "## Incidents (newest first)",
  ];

  for (const inc of input.incidents.slice(0, 20)) {
    lines.push(
      "",
      `### ${inc.kind.toUpperCase()} — ${inc.title}`,
      `- at: ${inc.at}`,
      `- route: ${inc.route ?? "n/a"}`,
    );
    if (inc.message) lines.push("", inc.message);
    if (inc.stack) {
      lines.push("", "```", inc.stack.slice(0, 8000), "```");
    }
    if (inc.meta && Object.keys(inc.meta).length > 0) {
      lines.push("", "```json", JSON.stringify(inc.meta, null, 2).slice(0, 6000), "```");
    }
  }

  if (input.diagnostics?.length) {
    lines.push("", "## Runtime diagnostic tail");
    for (const d of input.diagnostics.slice(0, 24)) {
      lines.push(`- ${d.at} · ${d.event}`);
      if (d.detail) {
        lines.push("  ```json", JSON.stringify(d.detail).slice(0, 1500), "  ```");
      }
    }
  }

  lines.push(
    "",
    "## Required output",
    "1. Root cause (1–3 sentences)",
    "2. Exact files to change",
    "3. Patch plan with code snippets",
    "4. Regression risks + verify commands (`npm run typecheck`, relevant `verify:*`)",
    "5. Manual QA steps for the affected route",
    "",
    "## Constraints",
    "- Never use raw user prompts as app names; identity step owns naming/logo.",
    "- Home/apps cards must use canonical `card_status` from backend.",
    "- Owner-only diagnostics must stay gated to vodexlabs@gmail.com.",
  );

  return lines.join("\n");
}
