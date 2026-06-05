import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { runProductionCertification } from "../src/lib/certification/run-production-certification";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const envPath = path.join(root, ".env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const projectId = "59bf67fb-2203-4f3a-82e7-07f31a7dc4ad";
const ownerId = "82681c97-83d4-4c2b-9b54-060e2ef70c79";

async function main() {
  const result = await runProductionCertification({ projectId, ownerId });
  if ("error" in result) {
    console.log(JSON.stringify({ error: result.error }));
    process.exit(1);
  }

  const blockers = result.sections.flatMap((s) =>
    s.checks
      .filter((c) => c.status === "blocker")
      .map((c) => ({ section: s.id, id: c.id, title: c.title, detail: c.detail, fix: c.fix })),
  );
  const warnings = result.sections.flatMap((s) =>
    s.checks
      .filter((c) => c.status === "warning")
      .map((c) => ({ section: s.id, id: c.id, title: c.title, detail: c.detail, fix: c.fix })),
  );

  console.log(
    JSON.stringify(
      {
        project: result.report.app_name,
        overall_score: result.overall_score,
        level: result.certification_level,
        passed: result.passed_checks,
        warnings_count: result.warnings,
        blockers_count: result.blockers,
        blockers,
        warnings,
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
