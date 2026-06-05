import "server-only";

import { checkPublishReadiness } from "@/lib/publish/publish-readiness";
import { prepareCertificationFiles } from "@/lib/certification/source-scan";
import type { CertificationCheck, CertificationContext } from "@/lib/certification/types";

export function runPublishCertificationChecks(ctx: CertificationContext): CertificationCheck[] {
  const checks: CertificationCheck[] = [];

  if (!ctx.published) {
    checks.push({
      id: "publish_not_live",
      section: "publish",
      title: "Published URL",
      status: "warning",
      weight: 8,
      detail: "App is not published yet.",
      fix: "Publish from Dashboard → Publish when blockers are resolved.",
    });
    return checks;
  }

  checks.push({
    id: "publish_url",
    section: "publish",
    title: "Published URL",
    status: ctx.publishedUrl ? "passed" : "blocker",
    weight: 10,
    detail: ctx.publishedUrl ?? "Missing public URL on published_apps row.",
    fix: ctx.publishedUrl ? undefined : "Republish to regenerate public URL.",
  });

  const readiness = checkPublishReadiness({
    files: prepareCertificationFiles(ctx.files),
    projectId: ctx.projectId,
    ownerId: ctx.ownerId,
    metadata: ctx.metadata,
  });

  if (readiness.blockers.length) {
    checks.push({
      id: "publish_blockers",
      section: "publish",
      title: "Publish gate blockers",
      status: "blocker",
      weight: 12,
      detail: readiness.blockers.slice(0, 4).join("; "),
      fix: "Resolve publish readiness blockers before claiming production ready.",
    });
  } else {
    checks.push({
      id: "publish_blockers",
      section: "publish",
      title: "Publish gate",
      status: "passed",
      weight: 12,
      detail: "No publish blockers from source scan.",
    });
  }

  if (!readiness.routeRenderable) {
    checks.push({
      id: "publish_routes",
      section: "publish",
      title: "SPA routing",
      status: "warning",
      weight: 6,
      detail: "Route renderability not confirmed.",
      fix: "Test nested routes after publish (refresh on /subpage).",
    });
  } else {
    checks.push({
      id: "publish_routes",
      section: "publish",
      title: "SPA routing",
      status: "passed",
      weight: 6,
      detail: "Entry route detected in artifact.",
    });
  }

  checks.push({
    id: "publish_blank_guard",
    section: "publish",
    title: "Blank page guard",
    status: ctx.files.length === 0 ? "blocker" : "passed",
    weight: 10,
    detail:
      ctx.files.length === 0
        ? "Published artifact may be empty."
        : `${ctx.files.length} source files in project.`,
  });

  return checks;
}
