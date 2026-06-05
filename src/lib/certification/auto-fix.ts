import type {
  AutoFixSuggestion,
  CertificationCheck,
  CertificationSectionReport,
} from "@/lib/certification/types";

export function buildAutoFixSuggestions(
  sections: CertificationSectionReport[],
): AutoFixSuggestion[] {
  const suggestions: AutoFixSuggestion[] = [];
  const allChecks = sections.flatMap((s) => s.checks);

  for (const c of allChecks) {
    if (c.status === "passed" || !c.fix) continue;

    if (c.id.startsWith("data_table_")) {
      suggestions.push({
        id: `fix_${c.id}`,
        title: "Apply dashboard runtime migration",
        description: c.fix,
        kind: "migration",
        safe: false,
      });
    } else if (c.id === "security_secrets" || c.id === "security_public_env") {
      suggestions.push({
        id: `fix_${c.id}`,
        title: "Remove exposed secrets",
        description: c.fix,
        kind: "manual",
        safe: false,
      });
    } else if (c.id === "auth_supabase_env" || c.id === "platform_service_role") {
      suggestions.push({
        id: `fix_${c.id}`,
        title: "Environment variable recommendation",
        description: c.fix,
        kind: "env",
        safe: true,
      });
    } else if (c.id === "auth_central_callback") {
      suggestions.push({
        id: `fix_${c.id}`,
        title: "OAuth redirect configuration",
        description: c.fix,
        kind: "manual",
        safe: true,
      });
    } else if (c.id.startsWith("integration_")) {
      suggestions.push({
        id: `fix_${c.id}`,
        title: "Integration repair",
        description: c.fix,
        kind: "integration",
        safe: true,
      });
    } else if (c.id.startsWith("payment_")) {
      suggestions.push({
        id: `fix_${c.id}`,
        title: "Payment configuration",
        description: c.fix,
        kind: "manual",
        safe: true,
      });
    } else if (c.id === "app_placeholders" || c.id === "app_route_manifest") {
      suggestions.push({
        id: `fix_${c.id}`,
        title: "Source code repair",
        description: c.fix,
        kind: "route",
        safe: false,
      });
    }
  }

  const seen = new Set<string>();
  return suggestions.filter((s) => {
    if (seen.has(s.id)) return false;
    seen.add(s.id);
    return true;
  });
}
