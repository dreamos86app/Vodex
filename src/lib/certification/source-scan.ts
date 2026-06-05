import { stripSecretsFromFiles } from "@/lib/preview/preview-sandbox";
import { findPlaceholderFindings } from "@/lib/publish/placeholder-findings";
import { isZipImportProject } from "@/lib/projects/imported-project-state";

/** Align with publish-readiness — strip redacted env lines before scanning. */
export function prepareCertificationFiles(
  files: Array<{ path: string; content: string }>,
): Array<{ path: string; content: string }> {
  return stripSecretsFromFiles(files);
}

/**
 * Detect real secret leaks in app source (not comment/doc false positives).
 * Matches publish-readiness `hasSecrets` semantics.
 */
export function detectCertificationSecretLeak(
  files: Array<{ path: string; content: string }>,
): boolean {
  const safe = prepareCertificationFiles(files);
  const combined = safe.map((f) => f.content).join("\n");
  if (/SUPABASE_SERVICE_ROLE|sk_live_|sk-proj-/i.test(combined)) return true;
  if (/BEGIN PRIVATE KEY/.test(combined)) return true;
  if (/service_role\s*[=:]\s*["'][^"']{8,}["']/i.test(combined)) return true;
  return false;
}

export function detectUnsafePublicEnvReferences(
  files: Array<{ path: string; content: string }>,
): boolean {
  const combined = prepareCertificationFiles(files).map((f) => f.content).join("\n");
  return /NEXT_PUBLIC_.*SERVICE|NEXT_PUBLIC_.*SECRET/i.test(combined);
}

/** Imported apps: placeholders warn (same as publish gate). Generated apps: blocker. */
export function placeholderCertificationStatus(
  files: Array<{ path: string; content: string }>,
  metadata: Record<string, unknown>,
): "passed" | "warning" | "blocker" {
  const findings = findPlaceholderFindings(prepareCertificationFiles(files));
  if (!findings.length) return "passed";
  return isZipImportProject(metadata) ? "warning" : "blocker";
}
