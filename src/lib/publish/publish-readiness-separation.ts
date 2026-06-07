/**
 * P1.3.9 — Separate web publish readiness from mobile packaging readiness.
 */
export type WebPublishReadinessItem = {
  id: string;
  label: string;
  status: "ready" | "needs_repair" | "not_started" | "blocked";
  detail?: string;
};

export type MobilePackagingReadinessItem = {
  id: string;
  label: string;
  status: "ready" | "missing" | "deferred";
  detail?: string;
};

export type SeparatedPublishReadiness = {
  web: WebPublishReadinessItem[];
  mobile: MobilePackagingReadinessItem[];
  webBlockers: string[];
  mobileBlockers: string[];
};

export function separatePublishReadiness(input: {
  hasFiles: boolean;
  previewReady: boolean;
  previewHonest?: boolean;
  slugValid: boolean;
  secretsOk: boolean;
  routeRenderable: boolean;
  mobileSigningConfigured?: boolean;
  mobileVersionConfigured?: boolean;
  isImport?: boolean;
}): SeparatedPublishReadiness {
  const web: WebPublishReadinessItem[] = [
    {
      id: "files",
      label: "Source files",
      status: input.hasFiles ? "ready" : "blocked",
    },
    {
      id: "routes",
      label: "Routes",
      status: input.routeRenderable ? "ready" : input.hasFiles ? "needs_repair" : "not_started",
    },
    {
      id: "preview",
      label: "Preview",
      status: input.previewReady
        ? "ready"
        : input.hasFiles
          ? "needs_repair"
          : "not_started",
      detail: input.previewReady
        ? "Ready"
        : input.hasFiles
          ? "Needs repair or prepare"
          : "Not started",
    },
    {
      id: "slug",
      label: "Public URL slug",
      status: input.slugValid ? "ready" : "blocked",
    },
    {
      id: "security",
      label: "Security scan",
      status: input.secretsOk ? "ready" : "blocked",
    },
  ];

  const mobile: MobilePackagingReadinessItem[] = [
    {
      id: "signing",
      label: "Signing configured",
      status: input.mobileSigningConfigured ? "ready" : "missing",
      detail: "Configure in Mobile App tab",
    },
    {
      id: "version",
      label: "Version & build",
      status: input.mobileVersionConfigured ? "ready" : "missing",
      detail: "Set version name/code in Mobile App",
    },
    {
      id: "store_metadata",
      label: "Store metadata",
      status: "deferred",
      detail: "Required before Play/App Store submit only",
    },
  ];

  const webBlockers = web
    .filter((w) => w.status === "blocked" || w.status === "needs_repair")
    .map((w) => {
      if (w.id === "preview") return "Preview: needs repair or prepare before web publish";
      return `${w.label}: ${w.status === "blocked" ? "blocked" : "needs attention"}`;
    });

  const mobileBlockers = mobile
    .filter((m) => m.status === "missing")
    .map((m) => `${m.label} (mobile packaging only)`);

  return { web, mobile, webBlockers, mobileBlockers };
}

/** Strip mobile-only blockers from web publish modal copy. */
export function filterWebPublishBlockers(blockers: string[]): string[] {
  const mobileRe =
    /signing|version\s*&\s*build|android package|bundle id|sha-?256|play store|app store|keystore/i;
  return blockers.filter((b) => !mobileRe.test(b));
}
