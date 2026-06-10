/** Server-side scan for bootstrap state that can make Next route to preview proxy paths. */

import {
  countHydrationPathLeaks,
  scanBootstrapLeaksDetailed,
  stripPlatformInjectionScripts,
} from "@/lib/preview/preview-bootstrap-sanitizer";

export type InnerRouteBootstrapIssue = {
  id: string;
  severity: "error" | "warning";
  message: string;
  snippet?: string;
};

export function detectInnerRouteBootstrapIssues(
  html: string,
  projectId: string,
): InnerRouteBootstrapIssue[] {
  const issues: InnerRouteBootstrapIssue[] = [];

  const appHtml = stripPlatformInjectionScripts(html);
  const leaks = scanBootstrapLeaksDetailed(appHtml, projectId, { excludePlatformInjections: false });
  for (const leak of leaks.slice(0, 12)) {
    issues.push({
      id: `leak_${leak.pattern}`,
      severity: "error",
      message: `Artifact contains ${leak.pattern} leak that can poison Next router`,
      snippet: leak.snippet,
    });
  }

  const nextData = appHtml.match(/<script[^>]+id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i);
  if (nextData?.[1] && /preview-html|preview-runtime\/[a-f0-9-]+\/[a-f0-9-]+|api\/projects\/[a-f0-9-]+\/preview-html/i.test(nextData[1])) {
    issues.push({
      id: "next_data_router_state",
      severity: "error",
      message: "__NEXT_DATA__ still references preview-html or api/projects paths",
      snippet: nextData[1].slice(0, 160).replace(/\s+/g, " "),
    });
  }

  if (/__next_f\.push\([^)]*preview-html/i.test(appHtml)) {
    issues.push({
      id: "next_f_flight_push",
      severity: "error",
      message: "__next_f.push flight chunks still embed preview-html paths",
    });
  }

  if (/navigator\.serviceWorker\.register\s*\(/i.test(html) && !html.includes("vodex-preview-virtual-history")) {
    issues.push({
      id: "service_worker_register",
      severity: "warning",
      message: "Service worker registration present without preview virtual-history shim",
    });
  }

  if (!html.includes("vodex-preview-virtual-history")) {
    issues.push({
      id: "missing_virtual_history_shim",
      severity: "warning",
      message: "Served HTML is missing vodex-preview-virtual-history shim",
    });
  }

  if (!html.includes("vodex-preview-inner-watchdog")) {
    issues.push({
      id: "missing_inner_watchdog",
      severity: "warning",
      message: "Served HTML is missing vodex-preview-inner-watchdog",
    });
  }

  return issues;
}

export function innerRouteBootstrapLikelyBroken(
  html: string,
  projectId: string,
): boolean {
  const appHtml = stripPlatformInjectionScripts(html);
  if (countHydrationPathLeaks(appHtml, projectId, false) > 0) return true;
  return detectInnerRouteBootstrapIssues(html, projectId).some((i) => i.severity === "error");
}
