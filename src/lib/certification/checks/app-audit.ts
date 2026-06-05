import { validateGeneratedApp } from "@/lib/build/generated-app-validator";
import { findPlaceholderFindings } from "@/lib/publish/placeholder-findings";
import { scanAppSourceForReadiness } from "@/lib/publish/readiness-scan";
import { isZipImportProject, readImportMeta } from "@/lib/projects/imported-project-state";
import {
  detectCertificationSecretLeak,
  detectUnsafePublicEnvReferences,
  placeholderCertificationStatus,
  prepareCertificationFiles,
} from "@/lib/certification/source-scan";
import type { CertificationCheck, CertificationContext } from "@/lib/certification/types";

export function runAppAuditChecks(ctx: CertificationContext): CertificationCheck[] {
  const checks: CertificationCheck[] = [];
  const { files } = ctx;

  if (files.length === 0) {
    checks.push({
      id: "app_no_files",
      section: "app_audit",
      title: "Application files",
      status: "blocker",
      weight: 10,
      detail: "No source files found for this project.",
      fix: "Generate or import app code before certification.",
    });
    return checks;
  }

  checks.push({
    id: "app_files_present",
    section: "app_audit",
    title: "Application files",
    status: "passed",
    weight: 5,
    detail: `${files.length} files scanned.`,
  });

  const safeFiles = prepareCertificationFiles(files);
  const isImport = isZipImportProject(ctx.metadata);

  const importMeta = isImport ? readImportMeta(ctx.metadata) : null;
  const validation = validateGeneratedApp({
    files: safeFiles,
    projectId: ctx.projectId,
    ownerId: ctx.ownerId,
    routeMap: importMeta?.routes ?? null,
  });

  const routeReasons = validation.reasons.filter(
    (r) =>
      !r.startsWith("placeholder_content:") &&
      r !== "todo_only_content" &&
      r !== "todo_or_stub_page" &&
      r !== "fake_disabled_primary_button",
  );

  if (routeReasons.length === 0) {
    checks.push({
      id: "app_route_manifest",
      section: "app_audit",
      title: "Route manifest validity",
      status: "passed",
      weight: 8,
      detail: "Core routes and package.json present.",
    });
  } else {
    const importRouteGap =
      isImport &&
      routeReasons.every((r) => r === "no_page_route" || r === "unstyled_html") &&
      (ctx.published || ctx.metadata.preview_renderable === true) &&
      (importMeta?.routes?.length ?? 0) > 0;
    const routeStatus =
      importRouteGap || (isImport && routeReasons.includes("no_page_route") && ctx.published)
        ? "warning"
        : routeReasons.includes("no_page_route")
          ? "blocker"
          : "warning";
    checks.push({
      id: "app_route_manifest",
      section: "app_audit",
      title: "Route manifest validity",
      status: routeStatus,
      weight: 8,
      detail: routeReasons.join("; "),
      fix: "Add a main page route (app/page or index.html).",
    });
  }

  const placeholders = findPlaceholderFindings(safeFiles);
  const placeholderStatus = placeholderCertificationStatus(files, ctx.metadata);
  if (placeholderStatus !== "passed") {
    checks.push({
      id: "app_placeholders",
      section: "app_audit",
      title: "Placeholder content",
      status: placeholderStatus,
      weight: 9,
      detail: `${placeholders.length} placeholder/TODO/lorem findings in ${[...new Set(placeholders.map((p) => p.path))].slice(0, 3).join(", ")}.${isImport ? " Imported apps may ship with review warnings." : ""}`,
      fix: "Replace TODO, lorem ipsum, and 'coming soon' text with real content.",
    });
  } else {
    checks.push({
      id: "app_placeholders",
      section: "app_audit",
      title: "Placeholder content",
      status: "passed",
      weight: 9,
      detail: "No placeholder patterns detected.",
    });
  }

  const readiness = scanAppSourceForReadiness(safeFiles);
  const readinessErrors = readiness.filter((r) => r.severity === "error");
  if (readinessErrors.length) {
    checks.push({
      id: "app_readiness_errors",
      section: "app_audit",
      title: "Mobile/store readiness signals",
      status: "warning",
      weight: 4,
      detail: readinessErrors.map((r) => r.title).join("; "),
    });
  }

  const combined = safeFiles.map((f) => f.content).join("\n");
  const hasMeta = /<title>|metadata|description/i.test(combined);
  checks.push({
    id: "app_seo_metadata",
    section: "app_audit",
    title: "SEO metadata",
    status: hasMeta ? "passed" : "warning",
    weight: 4,
    detail: hasMeta ? "Title or metadata patterns found." : "No obvious title/meta tags in scanned files.",
    fix: hasMeta ? undefined : "Add page titles and meta descriptions.",
  });

  const largeJs = files.filter(
    (f) => f.path.endsWith(".js") && f.content.length > 500_000,
  );
  checks.push({
    id: "app_bundle_size",
    section: "performance",
    title: "Oversized assets",
    status: largeJs.length ? "warning" : "passed",
    weight: 5,
    detail: largeJs.length
      ? `${largeJs.length} JS files exceed 500KB.`
      : "No single JS file exceeds 500KB in scan sample.",
  });

  const imgWithoutAlt = (combined.match(/<img(?![^>]*alt=)/gi) ?? []).length;
  checks.push({
    id: "app_a11y_alt",
    section: "app_audit",
    title: "Image alt text",
    status: imgWithoutAlt > 3 ? "warning" : "passed",
    weight: 3,
    detail:
      imgWithoutAlt > 3
        ? `${imgWithoutAlt} img tags may be missing alt attributes.`
        : "No widespread missing alt pattern detected.",
  });

  return checks;
}

export function runSecurityChecks(ctx: CertificationContext): CertificationCheck[] {
  const checks: CertificationCheck[] = [];
  const leaked = detectCertificationSecretLeak(ctx.files);

  checks.push({
    id: "security_secrets",
    section: "security",
    title: "Exposed secrets in source",
    status: leaked ? "blocker" : "passed",
    weight: 12,
    detail: leaked
      ? "Service role keys or live secret patterns detected in app files."
      : "No service role or live secret patterns in scanned files.",
    fix: leaked ? "Remove secrets from client code; use server env vars only." : undefined,
  });

  const unsafeEnv = detectUnsafePublicEnvReferences(ctx.files);
  checks.push({
    id: "security_public_env",
    section: "security",
    title: "Unsafe public env references",
    status: unsafeEnv ? "blocker" : "passed",
    weight: 8,
    detail: unsafeEnv
      ? "NEXT_PUBLIC_* may expose secrets to the browser."
      : "No unsafe NEXT_PUBLIC secret patterns.",
  });

  return checks;
}
