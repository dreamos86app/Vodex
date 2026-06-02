import "server-only";

import { mergeNonprofitCrmScaffold } from "@/lib/build/nonprofit-crm-scaffold";
import {
  buildRestaurantInventoryPreviewBody,
  isRestaurantInventoryPreview,
} from "@/lib/preview/restaurant-static-preview";
import {
  buildPortfolioPreviewBody,
  isPortfolioPreview,
} from "@/lib/preview/portfolio-static-preview";
import {
  isCrmLikeArchetype,
  previewArchetypeMismatch,
} from "@/lib/preview/preview-archetype-guard";
import {
  injectDreamOSBrandingIntoPreviewHtml,
  type GeneratedAppBrandingOptions,
} from "@/lib/branding/generated-app-branding";
import { findPrimaryAppPage } from "@/lib/build/source-integrity-validator";
import { jsxToStaticHtml } from "@/lib/preview/jsx-to-static-html";
import {
  sanitizePreviewDocument,
  stripInlineScriptsFromPreviewBody,
  validatePreviewHtmlSafe,
} from "@/lib/preview/preview-html-sanitizer";

export type PreviewRendererSource =
  | "compiled"
  | "static_snapshot"
  | "archetype_template"
  | "fallback_error";

export type PreviewHtmlOptions = {
  projectId?: string;
  previewSessionId?: string;
  buildJobId?: string | null;
  snapshotHash?: string | null;
  archetypeId?: string | null;
  branding?: GeneratedAppBrandingOptions;
};

export type StaticPreviewBuildResult = {
  html: string;
  rendererSource: PreviewRendererSource;
  primaryFile: string | null;
};

function escapeAttr(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

export function wrapPreviewDocument(bodyInner: string, options?: PreviewHtmlOptions): string {
  const rootAttrs = [
    'id="dreamos-preview-root"',
    'data-testid="generated-app-preview-root"',
    'data-preview-ready="true"',
    options?.projectId ? `data-project-id="${escapeAttr(options.projectId)}"` : "",
    options?.previewSessionId
      ? `data-preview-session-id="${escapeAttr(options.previewSessionId)}"`
      : "",
    options?.buildJobId ? `data-build-job-id="${escapeAttr(options.buildJobId)}"` : "",
    options?.snapshotHash ? `data-snapshot-hash="${escapeAttr(options.snapshotHash)}"` : "",
    options?.archetypeId ? `data-archetype-id="${escapeAttr(options.archetypeId)}"` : "",
  ]
    .filter(Boolean)
    .join(" ");

  const doc = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <script src="https://cdn.tailwindcss.com"></script>
  <title>Vodex Preview</title>
  <meta name="dreamos-preview" content="static-snapshot" />
  <style>body{margin:0;font-family:Inter,system-ui,sans-serif}</style>
</head>
<body class="bg-slate-50 text-slate-900 antialiased">
  <div ${rootAttrs} class="min-h-screen">${bodyInner}</div>
</body>
</html>`;
  return sanitizePreviewDocument(injectDreamOSBrandingIntoPreviewHtml(doc, options?.branding ?? {}));
}

/** Build a self-contained HTML snapshot from generated files. */
export function buildStaticPreviewHtml(
  files: Array<{ path: string; content: string }>,
  options?: PreviewHtmlOptions,
): string {
  return buildStaticPreviewHtmlDetailed(files, options).html;
}

export function buildStaticPreviewHtmlDetailed(
  files: Array<{ path: string; content: string }>,
  options?: PreviewHtmlOptions,
): StaticPreviewBuildResult {
  if (files.length === 0 && options?.archetypeId === "restaurant_inventory") {
    return {
      html: wrapPreviewDocument(buildRestaurantInventoryPreviewBody(), options),
      rendererSource: "archetype_template",
      primaryFile: null,
    };
  }

  const indexHtml = files.find((f) => f.path === "index.html" || f.path.endsWith("/index.html"));
  if (indexHtml?.content?.trim()) {
    if (indexHtml.content.includes("generated-app-preview-root")) {
      const safe = sanitizePreviewDocument(indexHtml.content);
      return { html: safe, rendererSource: "compiled", primaryFile: indexHtml.path };
    }
    const body = stripInlineScriptsFromPreviewBody(
      indexHtml.content.replace(/<\/?html[^>]*>|<\/?head[^>]*>|<\/?body[^>]*>/gi, ""),
    );
    if (!validatePreviewHtmlSafe(body).ok) {
      return {
        html: wrapPreviewDocument("<div class='p-6 text-sm text-slate-600'>Preview blocked — invalid script in generated HTML.</div>", options),
        rendererSource: "fallback_error",
        primaryFile: indexHtml.path,
      };
    }
    return {
      html: wrapPreviewDocument(
        body,
        options,
      ),
      rendererSource: "compiled",
      primaryFile: indexHtml.path,
    };
  }

  if (isRestaurantInventoryPreview(files, options?.archetypeId)) {
    return {
      html: wrapPreviewDocument(buildRestaurantInventoryPreviewBody(), options),
      rendererSource: "archetype_template",
      primaryFile: "app/dashboard/page.tsx",
    };
  }

  if (isPortfolioPreview(files, options?.archetypeId)) {
    const appName =
      files.find((f) => f.path === "app/layout.tsx")?.content?.match(/title:\s*["']([^"']+)["']/)?.[1] ??
      "Portfolio";
    return {
      html: wrapPreviewDocument(buildPortfolioPreviewBody(appName), options),
      rendererSource: "archetype_template",
      primaryFile: "app/page.tsx",
    };
  }

  if (isCrmLikeArchetype(options?.archetypeId)) {
    const crmFiles = mergeNonprofitCrmScaffold(files, "Donor CRM");
    const crmPage = crmFiles.find((f) => f.path === "app/page.tsx");
    if (crmPage?.content?.trim()) {
      const rendered = jsxToStaticHtml(crmPage.content);
      const inner =
        rendered && !/no renderable content/i.test(rendered)
          ? rendered
          : "<p class=\"p-6 text-slate-500\">Donor CRM preview</p>";
      const crmHtml = wrapPreviewDocument(inner, options);
      if (!previewArchetypeMismatch(crmHtml, options?.archetypeId)) {
        return {
          html: crmHtml,
          rendererSource: "static_snapshot",
          primaryFile: crmPage.path,
        };
      }
    }
  }

  const page = findPrimaryAppPage(files);
  const jsxBody = page?.content ?? "";
  const rendered = jsxToStaticHtml(jsxBody);
  const inner =
    rendered && !/no renderable content/i.test(rendered)
      ? rendered
      : "<p class=\"p-6 text-slate-500\">No renderable content.</p>";

  let html = wrapPreviewDocument(inner, options);
  let primaryFile = page?.path ?? null;
  let rendererSource: PreviewRendererSource =
    rendered && inner.includes("<") ? "static_snapshot" : "fallback_error";

  if (previewArchetypeMismatch(html, options?.archetypeId) && isCrmLikeArchetype(options?.archetypeId)) {
    const crmFiles = mergeNonprofitCrmScaffold(files, "Donor CRM");
    const crmPage = crmFiles.find((f) => f.path === "app/page.tsx");
    const crmRendered = crmPage?.content ? jsxToStaticHtml(crmPage.content) : "";
    html = wrapPreviewDocument(
      crmRendered && !/no renderable content/i.test(crmRendered)
        ? crmRendered
        : "<p class=\"p-6\">Donor CRM — campaign tracking and donation history</p>",
      options,
    );
    primaryFile = crmPage?.path ?? primaryFile;
    rendererSource = "static_snapshot";
  }

  return { html, rendererSource, primaryFile };
}
