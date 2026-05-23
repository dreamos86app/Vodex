import fs from "fs";
import path from "path";

export type BenchmarkReport = {
  live?: boolean;
  mode?: string;
  placeholderRate?: number;
  buildSuccessRate?: number;
  previewSuccessRate?: number;
  publishReadinessRate?: number;
  averageCredits?: number;
  averageProviderCostUsd?: number;
  averageQualityScore?: number;
  averageMobileScore?: number;
  smokePassed?: boolean;
  fullBenchmarkPending?: boolean;
  promptCount?: number;
  reason?: string;
  /** Extended UI quality categories */
  uiCompleteness?: number;
  appSpecificRelevance?: number;
  visualPolish?: number;
  mobileReadiness?: number;
  routeCompleteness?: number;
  interactionCompleteness?: number;
  qualityBeforePolish?: number;
  qualityAfterPolish?: number;
  validatorFailMarkedGenerated?: number;
  averageBlueprintScore?: number;
  templateInfluenceRate?: number;
  backendPlanCompleteness?: number;
  routeDecisionsLogged?: boolean;
  halfBenchmarkReady?: boolean;
  fullBenchmarkReady?: boolean;
};

export type EvidenceArtifact = {
  e2ePassed?: boolean;
  e2eLiveProof?: boolean;
  e2eMode?: "structure-only" | "live-skipped-no-auth" | "live-passed" | "live-failed";
  e2eLastRun?: string | null;
  e2eNote?: string;
  failureCoverage?: boolean;
  verifyPassed?: boolean;
  benchmarkReport?: BenchmarkReport | null;
  previewRuntimeHonest?: boolean;
  publishRuntimeHonest?: boolean;
  wildcardDnsVerified?: boolean;
  /** All security verify scripts passed (mutation guards, RLS, rate limits, audit, secrets). */
  securityVerifyPassed?: boolean;
  publicLandingHonest?: boolean;
  publicLandingScoreAfter?: number;
  polishScoreAfter?: number;
  endUserTrustScoreAfter?: number;
  createWorkflowScoreAfter?: number;
  mobileScoreAfter?: number;
  mobileLayoutHonest?: boolean;
  /** Valid Next.js ZIP fixture quality from test:zip-import */
  zipImportQualityScore?: number;
};

const ARTIFACT_PATH = path.join(process.cwd(), ".dreamos-evidence.json");

export function readEvidenceArtifact(): EvidenceArtifact {
  try {
    if (!fs.existsSync(ARTIFACT_PATH)) return {};
    return JSON.parse(fs.readFileSync(ARTIFACT_PATH, "utf8")) as EvidenceArtifact;
  } catch {
    return {};
  }
}

export function writeEvidenceArtifact(patch: Partial<EvidenceArtifact>): EvidenceArtifact {
  const cur = readEvidenceArtifact();
  const next = { ...cur, ...patch };
  fs.mkdirSync(path.dirname(ARTIFACT_PATH), { recursive: true });
  fs.writeFileSync(ARTIFACT_PATH, JSON.stringify(next, null, 2));
  return next;
}

export function fileExists(rel: string): boolean {
  return fs.existsSync(path.join(process.cwd(), rel));
}

/** Live E2E proof — structure-only runs never qualify. Requires evidence file. */
export function hasLiveE2eProof(artifact: EvidenceArtifact): boolean {
  if (!fileExists(".dreamos-evidence.json")) return false;
  return Boolean(
    artifact.e2eLiveProof === true &&
      artifact.e2eMode === "live-passed" &&
      artifact.e2ePassed === true,
  );
}

/** Benchmark smoke passed on live run with quality gate. */
export function hasBenchmarkPass(artifact: EvidenceArtifact): boolean {
  const br = artifact.benchmarkReport;
  if (!br?.live || br.smokePassed !== true) return false;
  return (br.buildSuccessRate ?? 0) >= 0.9 && (br.placeholderRate ?? 1) <= 0.05;
}

/** Full 50-prompt benchmark passed. */
export function hasFullBenchmarkPass(artifact: EvidenceArtifact): boolean {
  const br = artifact.benchmarkReport;
  if (!br?.live) return false;
  return (br.promptCount ?? 0) >= 50 && (br.buildSuccessRate ?? 0) >= 0.9 && (br.placeholderRate ?? 1) <= 0.05;
}
