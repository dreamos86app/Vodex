#!/usr/bin/env npx tsx
/**
 * Runtime preview diagnostics for production validation.
 * Usage: npm run verify:preview-diagnostics -- --project <uuid>
 */
import {
  arg,
  loadPreviewDiagnosticsReport,
} from "./lib/fetch-preview-diagnostics";

const projectId = arg("--project", "ff55c353-aabf-479a-aaec-2138bba9d6b4");

async function main() {
  const report = await loadPreviewDiagnosticsReport(projectId);
  if (!report) {
    console.error(`✗ Project not found: ${projectId}`);
    process.exit(1);
  }

  console.log(JSON.stringify(report, null, 2));
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
