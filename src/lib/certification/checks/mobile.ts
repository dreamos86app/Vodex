import "server-only";

import { createServiceRoleClient } from "@/lib/supabase/admin";
import { scanAppSourceForReadiness } from "@/lib/publish/readiness-scan";
import type { CertificationCheck, CertificationContext } from "@/lib/certification/types";

export async function runMobileCertificationChecks(
  ctx: CertificationContext,
): Promise<CertificationCheck[]> {
  const checks: CertificationCheck[] = [];
  const admin = createServiceRoleClient();

  const { data: mobileConfig } = admin
    ? await admin
        .from("mobile_app_configs" as never)
        .select("package_name, bundle_id, icon_path, splash_path, android_ready, ios_ready")
        .eq("project_id", ctx.projectId)
        .maybeSingle()
    : { data: null };

  const mc = mobileConfig as Record<string, unknown> | null;
  const scan = scanAppSourceForReadiness(ctx.files);

  const hasPackage = Boolean(mc?.package_name || mc?.bundle_id);
  checks.push({
    id: "mobile_package_id",
    section: "mobile",
    title: "Package / bundle identifier",
    status: hasPackage ? "passed" : "warning",
    weight: 5,
    detail: hasPackage
      ? `Android: ${String(mc?.package_name ?? "—")} · iOS: ${String(mc?.bundle_id ?? "—")}`
      : "Not configured in Mobile dashboard.",
    fix: hasPackage ? undefined : "Set package name and bundle ID in Mobile App settings.",
  });

  const iconIssue = scan.find((s) => s.id === "icon");
  checks.push({
    id: "mobile_icons",
    section: "mobile",
    title: "App icons",
    status: iconIssue ? "warning" : "passed",
    weight: 4,
    detail: iconIssue?.detail ?? "Icon assets detected or configured.",
  });

  const privacyIssue = scan.find((s) => s.id === "privacy");
  checks.push({
    id: "mobile_privacy",
    section: "mobile",
    title: "Privacy policy",
    status: privacyIssue ? "warning" : "passed",
    weight: 5,
    detail: privacyIssue?.detail ?? "Privacy policy content detected.",
    fix: privacyIssue ? "Add a public privacy policy URL for store submission." : undefined,
  });

  checks.push({
    id: "mobile_android_aab",
    section: "mobile",
    title: "Android AAB readiness",
    status: mc?.android_ready === true ? "passed" : "warning",
    weight: 5,
    detail:
      mc?.android_ready === true
        ? "Android build marked ready."
        : "Run Android builder and internal testing track.",
    fix: mc?.android_ready ? undefined : "Dashboard → Mobile → Build AAB.",
  });

  checks.push({
    id: "mobile_ios",
    section: "mobile",
    title: "iOS App Store readiness",
    status: mc?.ios_ready === true ? "passed" : "warning",
    weight: 4,
    detail:
      mc?.ios_ready === true
        ? "iOS build marked ready."
        : "iOS requires Apple Developer account and certificates.",
  });

  return checks;
}
