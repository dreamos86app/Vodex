/**
 * P1.3.9 — Same-page builder navigation without full reloads.
 */
export type BuilderSectionTarget =
  | "builder.chat"
  | "builder.preview"
  | "builder.dashboard.overview"
  | "builder.dashboard.deploy"
  | "builder.dashboard.integrations"
  | "builder.dashboard.secrets"
  | "builder.dashboard.payments"
  | "builder.dashboard.auth"
  | "builder.dashboard.settings"
  | "builder.mobile"
  | "builder.code"
  | "builder.versions"
  | "builder.publish"
  | "builder.diagnostics";

export function builderSectionPath(
  projectId: string,
  target: BuilderSectionTarget,
): string {
  const base = `/apps/${projectId}/builder`;
  switch (target) {
    case "builder.chat":
      return base;
    case "builder.preview":
      return `${base}?tab=preview`;
    case "builder.code":
      return `${base}?tab=code`;
    case "builder.mobile":
      return `${base}?tab=mobile`;
    case "builder.versions":
      return `${base}?tab=code&panel=versions`;
    case "builder.publish":
      return `${base}?tab=dashboard&section=deploy`;
    case "builder.diagnostics":
      return `${base}?tab=dashboard&section=overview&diagnostics=1`;
    case "builder.dashboard.overview":
      return `${base}?tab=dashboard&section=overview`;
    case "builder.dashboard.deploy":
      return `${base}?tab=dashboard&section=deploy`;
    case "builder.dashboard.integrations":
      return `${base}?tab=dashboard&section=integrations`;
    case "builder.dashboard.secrets":
      return `${base}?tab=dashboard&section=secrets`;
    case "builder.dashboard.payments":
      return `${base}?tab=dashboard&section=payments`;
    case "builder.dashboard.auth":
      return `${base}?tab=dashboard&section=auth`;
    case "builder.dashboard.settings":
      return `${base}?tab=dashboard&section=settings`;
    default:
      return base;
  }
}

export type BuilderSectionNavEvent = {
  projectId: string;
  target: BuilderSectionTarget;
  scroll?: boolean;
};

export const BUILDER_SECTION_NAV_EVENT = "dreamos:builder-section-nav";

/** Dispatch in-app navigation (immersive workspace listens). */
export function navigateBuilderSection(projectId: string, target: BuilderSectionTarget): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(BUILDER_SECTION_NAV_EVENT, {
      detail: { projectId, target, scroll: true } satisfies BuilderSectionNavEvent,
    }),
  );
}

/** Router fallback when not already in builder shell. */
export function hrefBuilderSection(projectId: string, target: BuilderSectionTarget): string {
  return builderSectionPath(projectId, target);
}
