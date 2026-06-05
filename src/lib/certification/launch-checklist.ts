import type { CertificationSectionReport, LaunchChecklistItem } from "@/lib/certification/types";

export function buildLaunchChecklist(sections: CertificationSectionReport[]): LaunchChecklistItem[] {
  const find = (id: string) =>
    sections.flatMap((s) => s.checks).find((c) => c.id === id);

  const item = (
    id: string,
    label: string,
    checkId: string,
    invert = false,
  ): LaunchChecklistItem => {
    const c = find(checkId);
    if (!c) return { id, label, status: "pending" };
    const ok = c.status === "passed";
    return {
      id,
      label,
      status: invert ? (ok ? "pending" : "done") : ok ? "done" : c.status === "blocker" ? "blocked" : "pending",
      detail: c.detail,
    };
  };

  return [
    item("published_url", "Published URL healthy", "publish_url"),
    item("auth_tested", "Auth configuration valid", "auth_central_callback"),
    item("auth_live", "Live Google login tested (manual)", "auth_live_test", true),
    item("payment_provider", "One payment provider verified (sandbox or live)", "payment_readiness_score"),
    item("email_provider", "Email provider configured (if used)", "integration_resend"),
    item("analytics", "Analytics tables reachable", "dash_analytics"),
    item("mobile", "Mobile certification (if shipping apps)", "mobile_android_aab"),
    item("security", "Security scan passed", "security_secrets"),
    item("no_blockers", "No critical blockers", "publish_blockers"),
    item("integrations", "Core integrations connected", "integrations_summary"),
  ];
}
