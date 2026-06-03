import { canUseIntegrations, isPaidPlan } from "@/lib/billing/plan-features";

export type DashboardSectionAccess =
  | "unlocked"
  | "locked_publish_required"
  | "locked_plan_required"
  | "locked_setup_required";

export type DashboardSectionId =
  | "overview"
  | "mobile"
  | "preview"
  | "code"
  | "publish"
  | "users"
  | "data"
  | "analytics"
  | "marketing"
  | "domains"
  | "integrations"
  | "payments"
  | "security"
  | "automations"
  | "logs"
  | "api"
  | "settings"
  | "secrets";

type ProjectAccessInput = {
  status?: string | null;
  published_subdomain?: string | null;
  custom_domain?: string | null;
  metadata?: unknown;
};

export function isProjectPublished(project: ProjectAccessInput | null | undefined): boolean {
  if (!project) return false;
  const meta =
    project.metadata && typeof project.metadata === "object" && !Array.isArray(project.metadata)
      ? (project.metadata as Record<string, unknown>)
      : {};
  return Boolean(
    project.published_subdomain ||
      project.custom_domain ||
      project.status === "live" ||
      meta.published_at ||
      meta.lifecycle_status === "published",
  );
}

/** Available before first publish — setup, mobile, secrets, integrations. */
const PRE_PUBLISH_UNLOCKED: DashboardSectionId[] = [
  "overview",
  "settings",
  "secrets",
  "integrations",
  "mobile",
  "preview",
  "code",
  "publish",
];

/** Requires live publish before use. */
const PUBLISH_GATED: DashboardSectionId[] = [
  "users",
  "data",
  "analytics",
  "marketing",
  "logs",
  "automations",
  "payments",
  "security",
  "domains",
];

const PLAN_GATED: DashboardSectionId[] = ["api", "automations"];
const INTEGRATIONS_GATED: DashboardSectionId[] = ["integrations", "domains"];

export function getDashboardSectionAccess(
  project: ProjectAccessInput | null | undefined,
  section: DashboardSectionId,
  userPlan?: string | null,
): DashboardSectionAccess {
  if (PRE_PUBLISH_UNLOCKED.includes(section)) return "unlocked";

  if (!isProjectPublished(project)) {
    if (PUBLISH_GATED.includes(section)) return "locked_publish_required";
    return "locked_publish_required";
  }

  if (PLAN_GATED.includes(section) && !isPaidPlan(userPlan)) {
    return "locked_plan_required";
  }

  if (INTEGRATIONS_GATED.includes(section) && !canUseIntegrations(userPlan)) {
    return "locked_plan_required";
  }

  if (section === "domains" && !project?.published_subdomain && !project?.custom_domain) {
    return "locked_setup_required";
  }

  return "unlocked";
}
