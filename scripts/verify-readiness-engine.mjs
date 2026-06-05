#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const errors = [];
const must = (rel, needle, label) => {
  const p = path.join(root, rel);
  if (!fs.existsSync(p) || !fs.readFileSync(p, "utf8").includes(needle)) errors.push(label);
};

must("src/lib/mobile/readiness-engine.ts", "runAppReadinessEngine", "readiness engine");
must("src/lib/mobile/readiness-engine.ts", "gatePassed", "gate from critical count");
must("src/lib/mobile/readiness-engine.ts", "scoreFromFindings", "0-100 score");
must("src/lib/mobile/readiness-report-export.ts", "readinessReportToJson", "JSON export");
must("src/lib/mobile/readiness-report-export.ts", "readinessReportToHtml", "HTML export");
must("src/lib/mobile/readiness-report-export.ts", "readinessReportToPdfBytes", "PDF export");
must("src/app/api/projects/[id]/mobile/readiness/route.ts", "runAppReadinessEngine", "API uses engine");
must("src/app/api/projects/[id]/mobile/readiness/route.ts", "format=pdf", "PDF download");
must("src/lib/mobile/eligibility-report.ts", "not_found_route", "404 check");
must("src/lib/mobile/eligibility-report.ts", "errorboundary", "error boundary check");

if (errors.length) {
  console.error("verify:readiness-engine FAILED\n", errors.map((e) => `  - ${e}`).join("\n"));
  process.exit(1);
}
console.log("verify:readiness-engine OK");
