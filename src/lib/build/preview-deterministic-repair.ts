import type { BuildFile } from "@/lib/build/generated-file-utils";
import type { AppArchetypeId } from "@/lib/build/app-archetype-classifier";
import { repairRootPageContent } from "@/lib/build/root-page-repair";
import type { PreviewFailureCode } from "@/lib/preview/preview-failure-codes";

export type PreviewRepairResult = {
  applied: boolean;
  files: BuildFile[];
  reason?: string;
  codesAddressed: PreviewFailureCode[];
};

const REPAIRABLE: PreviewFailureCode[] = [
  "missing_root_page",
  "missing_layout",
  "invalid_import",
  "package_missing",
  "empty_preview_html",
  "source_integrity_failed",
];

export function isPreviewRepairEligible(code: PreviewFailureCode): boolean {
  return REPAIRABLE.includes(code);
}

/** One deterministic repair pass before surfacing preview failure (no extra credits). */
export function runDeterministicPreviewRepair(input: {
  files: BuildFile[];
  failureCode: PreviewFailureCode;
  appName: string;
  archetypeId?: string;
}): PreviewRepairResult {
  if (!isPreviewRepairEligible(input.failureCode)) {
    return { applied: false, files: input.files, reason: "not_eligible", codesAddressed: [] };
  }

  let files = [...input.files];
  const addressed: PreviewFailureCode[] = [];

  const hasRoot = files.some((f) => f.path === "app/page.tsx" || f.path === "src/app/page.tsx");
  const hasLayout = files.some((f) => f.path === "app/layout.tsx" || f.path === "src/app/layout.tsx");

  if (!hasRoot || input.failureCode === "missing_root_page" || input.failureCode === "empty_preview_html") {
    const archetype = (input.archetypeId ?? "dashboard") as AppArchetypeId;
    const repair = repairRootPageContent(archetype, files, input.appName);
    if (repair.rootPageRepaired || repair.deterministicRepairApplied) {
      files = repair.files;
      addressed.push("missing_root_page");
    }
  }

  if (!hasLayout || input.failureCode === "missing_layout") {
    const layoutPath = files.some((f) => f.path.startsWith("src/app/")) ? "src/app/layout.tsx" : "app/layout.tsx";
    if (!files.some((f) => f.path === layoutPath)) {
      files.push({
        path: layoutPath,
        content: `export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
`,
      });
      addressed.push("missing_layout");
    }
  }

  const applied = addressed.length > 0;
  return {
    applied,
    files,
    reason: applied ? "deterministic_repair_applied" : "no_changes",
    codesAddressed: addressed,
  };
}
