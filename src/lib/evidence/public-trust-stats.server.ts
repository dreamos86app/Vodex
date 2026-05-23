import fs from "node:fs";
import path from "node:path";
import type { PublicTrustStat, PublicTrustStats } from "@/lib/evidence/public-trust-types";

function readJson(rel: string): Record<string, unknown> | null {
  try {
    return JSON.parse(fs.readFileSync(path.join(process.cwd(), rel), "utf8"));
  } catch {
    return null;
  }
}

/**
 * Evidence-backed public stats — never inflated. Missing data uses soft truthful labels.
 */
export function getPublicTrustStats(): PublicTrustStats {
  const evidence = readJson(".dreamos-evidence.json") ?? {};
  const liveBench = readJson(".dreamos-benchmark-results.live.json");
  const bench = liveBench ?? readJson(".dreamos-benchmark-results.json");
  const report = (evidence.benchmarkReport ?? {}) as Record<string, unknown>;
  const counts = (evidence.e2eCounts ?? {}) as { passed?: number; total?: number };

  const stats: PublicTrustStat[] = [];

  if (evidence.e2eLiveProof === true && typeof counts.passed === "number" && typeof counts.total === "number") {
    stats.push({
      label: "Live checks passed",
      value: `${counts.passed}/${counts.total}`,
      detail: "real auth journeys",
    });
  } else if (evidence.verifyPassed === true) {
    stats.push({
      label: "Product verification",
      value: "Verified",
      detail: "structure + build gate",
    });
  }

  const avgUi =
    (bench?.averageQualityScore as number | undefined) ??
    (report.averageQualityScore as number | undefined);
  if (typeof avgUi === "number" && avgUi > 0) {
    stats.push({
      label: "Avg UI quality",
      value: avgUi.toFixed(1),
      detail: bench?.smokePassed ? "live benchmark" : "benchmark run",
    });
  }

  const placeholder =
    (bench?.placeholderRate as number | undefined) ??
    (report.placeholderRate as number | undefined);
  if (typeof placeholder === "number") {
    stats.push({
      label: "Placeholder rate",
      value: `${Math.round(placeholder * 100)}%`,
      detail: "benchmark validated",
    });
  }

  stats.push({
    label: "Build stages",
    value: "6",
    detail: "Describe → Publish",
  });

  stats.push({
    label: "Credits protected",
    value: "Reserve + reconcile",
    detail: "pay for completed work",
  });

  if (bench?.smokePassed === true) {
    stats.push({
      label: "Generation smoke",
      value: "Passed",
      detail: "live benchmark verified",
    });
  }

  return { stats, source: stats.some((s) => s.detail?.includes("benchmark") || s.detail?.includes("auth")) ? "evidence" : "product" };
}
