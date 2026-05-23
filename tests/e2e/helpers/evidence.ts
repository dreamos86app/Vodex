import fs from "node:fs";
import path from "node:path";

export type E2eTestEvidence = {
  name: string;
  passed: boolean;
  skipped?: boolean;
  skipReason?: string;
  screenshot?: string;
  projectId?: string;
  publishedSlug?: string;
  lifecycleObserved?: string[];
  creditQuote?: number;
  timestamp: string;
  error?: string;
};

export type DreamosEvidenceFile = {
  e2eMode: "structure-only" | "live-skipped-no-auth" | "live-passed" | "live-failed";
  e2ePassed: boolean;
  e2eLiveProof: boolean;
  e2eLastRun: string;
  e2eNote?: string;
  e2eTests?: E2eTestEvidence[];
  failureCoverage?: boolean;
  benchmarkReport?: Record<string, unknown> | null;
  previewRuntimeHonest?: boolean;
  wildcardDnsVerified?: boolean;
};

const EVIDENCE_PATH = path.join(process.cwd(), ".dreamos-evidence.json");

export function readEvidence(): DreamosEvidenceFile {
  try {
    if (!fs.existsSync(EVIDENCE_PATH)) {
      return {
        e2eMode: "structure-only",
        e2ePassed: false,
        e2eLiveProof: false,
        e2eLastRun: new Date().toISOString(),
      };
    }
    return JSON.parse(fs.readFileSync(EVIDENCE_PATH, "utf8")) as DreamosEvidenceFile;
  } catch {
    return {
      e2eMode: "structure-only",
      e2ePassed: false,
      e2eLiveProof: false,
      e2eLastRun: new Date().toISOString(),
    };
  }
}

export function writeEvidence(patch: Partial<DreamosEvidenceFile>): DreamosEvidenceFile {
  const cur = readEvidence();
  const next: DreamosEvidenceFile = { ...cur, ...patch, e2eLastRun: new Date().toISOString() };
  fs.writeFileSync(EVIDENCE_PATH, JSON.stringify(next, null, 2));
  return next;
}

export function appendTestEvidence(entry: E2eTestEvidence): void {
  const cur = readEvidence();
  const tests = [...(cur.e2eTests ?? []), entry];
  const failureCoverage =
    tests.some((t) => t.name.includes("question") && t.passed) &&
    (tests.some((t) => /insufficient|credits/i.test(t.name) && t.passed) ||
      tests.some((t) => /repair|failure/i.test(t.name) && t.passed));
  writeEvidence({ e2eTests: tests, failureCoverage });
}

export function mergePlaywrightReport(reportPath: string): void {
  if (!fs.existsSync(reportPath)) return;
  const report = JSON.parse(fs.readFileSync(reportPath, "utf8")) as {
    suites?: Array<{ specs?: Array<{ title: string; ok: boolean; tests?: Array<{ results?: Array<{ status: string }> }> }> }>;
  };
  const tests: E2eTestEvidence[] = [];
  for (const suite of report.suites ?? []) {
    for (const spec of suite.specs ?? []) {
      const status = spec.tests?.[0]?.results?.[0]?.status ?? (spec.ok ? "passed" : "failed");
      tests.push({
        name: spec.title,
        passed: status === "passed",
        skipped: status === "skipped",
        timestamp: new Date().toISOString(),
      });
    }
  }
  const passed = tests.length > 0 && tests.every((t) => t.passed || t.skipped);
  writeEvidence({
    e2eTests: tests,
    e2eMode: passed ? "live-passed" : "live-failed",
    e2ePassed: passed,
    e2eLiveProof: true,
    e2eNote: passed ? "Live Playwright run completed" : "Live Playwright run had failures",
  });
}
