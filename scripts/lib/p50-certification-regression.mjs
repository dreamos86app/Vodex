import fs from "node:fs";
import path from "node:path";

function stripSecretsFromFiles(files) {
  const secretRe = /(SUPABASE_SERVICE_ROLE|STRIPE_SECRET|OPENAI_API_KEY|sk_live_|sk_test_)/i;
  return files.map((f) => {
    if (!secretRe.test(f.content)) return f;
    return {
      ...f,
      content: f.content.replace(
        /(SUPABASE_SERVICE_ROLE|STRIPE_SECRET|OPENAI_API_KEY)\s*=\s*["'][^"']+["']/gi,
        "$1=[REDACTED]",
      ),
    };
  });
}

function detectCertificationSecretLeak(files) {
  const safe = stripSecretsFromFiles(files);
  const combined = safe.map((f) => f.content).join("\n");
  if (/SUPABASE_SERVICE_ROLE|sk_live_|sk-proj-/i.test(combined)) return true;
  if (/BEGIN PRIVATE KEY/.test(combined)) return true;
  if (/service_role\s*[=:]\s*["'][^"']{8,}["']/i.test(combined)) return true;
  return false;
}

function isZipImportProject(metadata) {
  if (!metadata || typeof metadata !== "object") return false;
  if (metadata.source === "zip_import") return true;
  const ls = metadata.lifecycle_status;
  if (typeof ls === "string" && (ls === "importing" || ls.startsWith("imported"))) return true;
  return metadata.import != null && typeof metadata.import === "object";
}

function placeholderCertificationStatus(files, metadata) {
  const TODO = /\bTODO\b/i;
  const findings = [];
  for (const file of files) {
    if (!/\.(tsx|jsx|html|vue|svelte|mdx?)$/i.test(file.path)) continue;
    for (const line of file.content.split("\n")) {
      if (TODO.test(line)) findings.push(file.path);
    }
  }
  if (!findings.length) return "passed";
  return isZipImportProject(metadata) ? "warning" : "blocker";
}

function rejectBannedRefs(text) {
  const lower = text.toLowerCase();
  if (lower.includes("wciioegiczwqlmlroley")) return "legacy";
  return null;
}

export function runP50CertificationRegression(root) {
  const errors = [];

  const commentOnly = [{ path: "src/lib/supabase.ts", content: "// never use service_role in client code\n" }];
  if (detectCertificationSecretLeak(commentOnly)) {
    errors.push("comment-only service_role must not be a secret leak");
  }

  const realSecret = [{ path: "src/env.ts", content: "SUPABASE_SERVICE_ROLE=eyJhbGciOiJIUzI1NiJ9\n" }];
  if (!detectCertificationSecretLeak(realSecret)) {
    errors.push("real service_role assignment must be detected");
  }

  const redacted = [
    {
      path: "src/config.ts",
      content:
        'SUPABASE_SERVICE_ROLE=[REDACTED]\nconst url = "https://xycqutvqxtkbszytaxbe.supabase.co"\n',
    },
  ];
  if (detectCertificationSecretLeak(redacted)) {
    errors.push("redacted SUPABASE_SERVICE_ROLE line must not block certification");
  }

  const zipMeta = { source: "zip_import" };
  const todoFile = [{ path: "src/App.tsx", content: "// TODO: polish copy\nexport default function App(){return null}\n" }];
  if (placeholderCertificationStatus(todoFile, zipMeta) !== "warning") {
    errors.push("zip import TODO must be warning not blocker");
  }

  const genMeta = { generated_by: "ai" };
  if (placeholderCertificationStatus(todoFile, genMeta) !== "blocker") {
    errors.push("generated app TODO must remain blocker");
  }

  if (!rejectBannedRefs("wciioegiczwqlmlroley")) {
    errors.push("legacy project ref must be banned in generation fingerprint");
  }
  if (rejectBannedRefs("xycqutvqxtkbszytaxbe")) {
    errors.push("canonical platform project ref must not be banned");
  }

  const fp = path.join(root, "src/lib/certification/source-scan.ts");
  if (!fs.existsSync(fp)) errors.push("source-scan.ts missing");

  return errors;
}
