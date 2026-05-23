import { scanAppSourceForReadiness } from "@/lib/publish/readiness-scan";
import { validateGeneratedBuild } from "@/lib/creation/validate-build-quality";

export type QualityCheck = {
  id: string;
  label: string;
  passed: boolean;
  weight: number;
  detail?: string;
};

export type AppQualityScore = {
  scorePercent: number;
  readyToPreview: boolean;
  deployBlockers: number;
  checks: QualityCheck[];
  userSummary: string;
  adminSummary: string;
};

export function scoreAppQuality(input: {
  files: Array<{ path: string; content: string }>;
  hasAuth?: boolean;
  hasLoadingStates?: boolean;
}): AppQualityScore {
  const checks: QualityCheck[] = [];
  const buildQ = validateGeneratedBuild(input.files);
  checks.push({
    id: "build_valid",
    label: "Build structure",
    passed: buildQ.ok,
    weight: 20,
    detail: buildQ.reasons?.join("; "),
  });

  const readiness = scanAppSourceForReadiness(input.files);
  const errors = readiness.filter((r) => r.severity === "error").length;
  checks.push({
    id: "deploy_readiness",
    label: "Deploy readiness",
    passed: errors === 0,
    weight: 15,
    detail: `${readiness.length} findings`,
  });

  const hasResponsive = input.files.some(
    (f) => /@media|sm:|md:|max-w-|mobile/i.test(f.content) && /\.(tsx|jsx|css)$/.test(f.path),
  );
  checks.push({
    id: "responsive",
    label: "Responsive layout",
    passed: hasResponsive,
    weight: 12,
  });

  checks.push({
    id: "auth",
    label: "Authentication",
    passed: Boolean(input.hasAuth),
    weight: 10,
  });

  checks.push({
    id: "loading",
    label: "Loading states",
    passed: Boolean(input.hasLoadingStates),
    weight: 8,
  });

  const hasErrorUi = input.files.some((f) =>
    /error|fallback|try\s*\{|catch/i.test(f.content),
  );
  checks.push({
    id: "errors",
    label: "Error handling",
    passed: hasErrorUi,
    weight: 10,
  });

  const totalWeight = checks.reduce((s, c) => s + c.weight, 0);
  const earned = checks.filter((c) => c.passed).reduce((s, c) => s + c.weight, 0);
  const scorePercent = totalWeight > 0 ? Math.round((earned / totalWeight) * 100) : 0;
  const deployBlockers = readiness.filter((i) => i.severity === "error").length;
  const readyToPreview = buildQ.ok && scorePercent >= 70;

  return {
    scorePercent,
    readyToPreview,
    deployBlockers,
    checks,
    userSummary: readyToPreview
      ? `App quality score: ${scorePercent}% — Ready to preview`
      : `App quality score: ${scorePercent}% — Needs ${Math.max(1, deployBlockers || 2)} fixes before deploy`,
    adminSummary: checks
      .filter((c) => !c.passed)
      .map((c) => `${c.label}: ${c.detail ?? "failed"}`)
      .join(" | "),
  };
}
