import { scanAppSourceForReadiness } from "@/lib/publish/readiness-scan";
import type { MobileAppConfig, ReadinessItem } from "@/lib/mobile/types";
import {
  scanAndroidReadiness,
  scanGeneralReadiness,
  scanIosReadiness,
  scanStoreReadiness,
} from "@/lib/mobile/readiness";

export type EligibilityTier = "critical" | "warning" | "recommendation";

export type EligibilityFinding = {
  id: string;
  tier: EligibilityTier;
  label: string;
  detail: string;
  platform: ReadinessItem["platform"];
  category: string;
};

export type EligibilityReport = {
  critical: EligibilityFinding[];
  warnings: EligibilityFinding[];
  recommendations: EligibilityFinding[];
  scores: { android: number; ios: number; store: number; general: number };
  gatePassed: boolean;
  revenueCat: { status: "configured" | "opted_out" | "missing"; detail: string };
  generatedAt: string;
};

function mapItemTier(item: ReadinessItem): EligibilityTier {
  if (item.status === "missing") return "critical";
  if (item.status === "warning") return "warning";
  return "recommendation";
}

function toFinding(item: ReadinessItem, category: string): EligibilityFinding {
  return {
    id: item.id,
    tier: mapItemTier(item),
    label: item.label,
    detail: item.detail,
    platform: item.platform,
    category,
  };
}

function scanSourceExtended(files: Array<{ path: string; content: string }>): EligibilityFinding[] {
  const findings: EligibilityFinding[] = [];
  const paths = new Set(files.map((f) => f.path.toLowerCase()));
  const combined = files.map((f) => `${f.path}\n${f.content}`).join("\n");

  const hasTerms =
    [...paths].some((p) => p.includes("terms")) || /terms\s+(of\s+)?service/i.test(combined);
  const hasContact =
    [...paths].some((p) => p.includes("contact")) || /contact\s+us|support@/i.test(combined);
  const has404 =
    [...paths].some((p) => p.includes("not-found") || p.includes("404")) ||
    /not\s*found|404/i.test(combined);
  const hasErrorBoundary =
    /errorboundary|error-boundary/i.test(combined) || paths.has("src/app/error.tsx");
  const hasEnv =
    paths.has(".env.example") ||
    paths.has("env.example") ||
    /process\.env\./i.test(combined);
  const hasManifest =
    paths.has("public/manifest.json") ||
    paths.has("manifest.webmanifest") ||
    /manifest\.webmanifest/i.test(combined);
  const hasDeepLink =
    /universal\s*link|assetlinks|apple-app-site-association|deeplink|deep\s*link/i.test(combined);

  if (!hasTerms) {
    findings.push({
      id: "terms_page",
      tier: "warning",
      label: "Terms of service",
      detail: "No terms page detected — stores often require a terms URL.",
      platform: "store",
      category: "legal",
    });
  }
  if (!hasContact) {
    findings.push({
      id: "contact_page",
      tier: "recommendation",
      label: "Contact / support page",
      detail: "Add a public contact or support URL for store review.",
      platform: "store",
      category: "legal",
    });
  }
  if (!has404) {
    findings.push({
      id: "not_found_route",
      tier: "warning",
      label: "404 / not-found handling",
      detail: "No dedicated not-found route detected — add graceful 404 handling.",
      platform: "general",
      category: "navigation",
    });
  }
  if (!hasErrorBoundary) {
    findings.push({
      id: "error_boundary",
      tier: "warning",
      label: "Error boundaries",
      detail: "No React error boundary detected — crashes may blank the WebView.",
      platform: "general",
      category: "stability",
    });
  }
  if (!hasEnv) {
    findings.push({
      id: "env_documentation",
      tier: "recommendation",
      label: "Environment variables",
      detail: "Document required env vars (.env.example) for reproducible builds.",
      platform: "general",
      category: "config",
    });
  }
  if (!hasManifest) {
    findings.push({
      id: "web_manifest",
      tier: "warning",
      label: "Web manifest",
      detail: "No manifest.webmanifest — recommended for PWA/TWA metadata.",
      platform: "android",
      category: "assets",
    });
  }
  if (!hasDeepLink) {
    findings.push({
      id: "deep_links",
      tier: "recommendation",
      label: "Deep links / universal links",
      detail: "Configure assetlinks.json and Apple universal links before marketing campaigns.",
      platform: "general",
      category: "links",
    });
  }

  for (const issue of scanAppSourceForReadiness(files)) {
    findings.push({
      id: issue.id,
      tier: issue.severity === "error" ? "critical" : issue.severity === "warning" ? "warning" : "recommendation",
      label: issue.title,
      detail: issue.detail,
      platform: "general",
      category: "source_scan",
    });
  }

  return findings;
}

export function buildEligibilityReport(input: {
  config: Partial<MobileAppConfig>;
  fileCount: number;
  hasPreview: boolean;
  appName?: string | null;
  description?: string | null;
  files: Array<{ path: string; content: string }>;
  androidCtx: Parameters<typeof scanAndroidReadiness>[1];
  iosCtx: Parameters<typeof scanIosReadiness>[1];
  revenueCatConfigured: boolean;
  revenueCatOptedOut: boolean;
}): EligibilityReport {
  const results = [
    scanGeneralReadiness({
      fileCount: input.fileCount,
      hasPreview: input.hasPreview,
      appName: input.appName,
      description: input.description,
      files: input.files,
    }),
    scanAndroidReadiness(input.config, input.androidCtx),
    scanIosReadiness(input.config, input.iosCtx),
    scanStoreReadiness(input.config, "android"),
    scanStoreReadiness(input.config, "ios"),
  ];

  const fromScans = results.flatMap((r) => r.items.map((item) => toFinding(item, r.platform ?? "general")));
  const fromSource = scanSourceExtended(input.files);

  const draft =
    input.config.store_draft && typeof input.config.store_draft === "object"
      ? (input.config.store_draft as Record<string, unknown>)
      : {};
  const sha256 = Array.isArray(draft.play_sha256_fingerprints)
    ? (draft.play_sha256_fingerprints as string[]).filter(Boolean)
    : [];
  const sha1 = Array.isArray(draft.play_sha1_fingerprints)
    ? (draft.play_sha1_fingerprints as string[]).filter(Boolean)
    : [];

  if (sha256.length === 0) {
    fromSource.push({
      id: "play_sha256",
      tier: "warning",
      label: "Play SHA-256 fingerprints",
      detail: "Add at least one SHA-256 for Play App Signing / assetlinks.",
      platform: "android",
      category: "signing",
    });
  }

  const splashMs =
    typeof input.config.splash_duration_ms === "number" ? input.config.splash_duration_ms : null;
  if (!input.config.splash_url) {
    fromSource.push({
      id: "splash_image",
      tier: "warning",
      label: "Splash screen image",
      detail: "Upload a splash image URL for store-quality launch experience.",
      platform: "general",
      category: "assets",
    });
  } else if (!splashMs || splashMs < 500) {
    fromSource.push({
      id: "splash_duration",
      tier: "critical",
      label: "Splash duration",
      detail: "Splash duration must be between 500ms and 15s.",
      platform: "general",
      category: "assets",
    });
  }

  let revenueCat: EligibilityReport["revenueCat"];
  if (input.revenueCatConfigured) {
    revenueCat = { status: "configured", detail: "RevenueCat public SDK key configured." };
  } else if (input.revenueCatOptedOut) {
    revenueCat = {
      status: "opted_out",
      detail: "User confirmed the app has no in-app subscriptions.",
    };
  } else {
    revenueCat = {
      status: "missing",
      detail: "Connect RevenueCat or confirm the app does not use subscriptions.",
    };
    fromSource.push({
      id: "revenuecat_required",
      tier: "critical",
      label: "RevenueCat / billing",
      detail: revenueCat.detail,
      platform: "general",
      category: "billing",
    });
  }

  const all = [...fromScans, ...fromSource];
  const critical = all.filter((f) => f.tier === "critical");
  const warnings = all.filter((f) => f.tier === "warning");
  const recommendations = all.filter((f) => f.tier === "recommendation");

  const gatePassed =
    critical.length === 0 &&
    input.fileCount > 0 &&
    (results.find((r) => r.platform === "android")?.score ?? 0) >= 55 &&
    (results.find((r) => r.platform === "ios")?.score ?? 0) >= 55;

  return {
    critical,
    warnings,
    recommendations,
    scores: {
      general: results.find((r) => r.platform === "general")?.score ?? 0,
      android: results.find((r) => r.platform === "android")?.score ?? 0,
      ios: results.find((r) => r.platform === "ios")?.score ?? 0,
      store: Math.round(
        results.filter((r) => r.platform === "store").reduce((s, r) => s + r.score, 0) /
          Math.max(1, results.filter((r) => r.platform === "store").length),
      ),
    },
    gatePassed,
    revenueCat,
    generatedAt: new Date().toISOString(),
  };
}

export function eligibilityReportJson(report: EligibilityReport): string {
  return JSON.stringify(report, null, 2);
}
