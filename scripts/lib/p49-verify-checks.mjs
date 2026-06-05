import fs from "node:fs";
import path from "node:path";
import { createChecker } from "./p42-verify-checks.mjs";

const SECTIONS = [
  "security",
  "auth",
  "integrations",
  "payments",
  "publish",
  "mobile",
  "data",
  "dashboard",
  "app_audit",
  "platform",
];

const CHECK_MODULES = [
  "app-audit",
  "auth",
  "integrations",
  "payments",
  "publish",
  "mobile",
  "data",
  "dashboard",
  "platform",
];

export const P49_CHECKS = {
  "p49-engine": (root) => {
    const { errors, mustExist, must } = createChecker(root);
    mustExist("src/lib/certification/run-production-certification.ts", "engine");
    must("src/lib/certification/run-production-certification.ts", "runProductionCertification", "export");
    must("src/lib/certification/run-production-certification.ts", "overall_score", "score output");
    must("src/lib/certification/run-production-certification.ts", "certification_level", "level output");
    must("src/lib/certification/run-production-certification.ts", "blockers", "blockers output");
    must("src/lib/certification/run-production-certification.ts", "launch_checklist", "checklist");
    must("src/lib/certification/run-production-certification.ts", "auto_fix_suggestions", "auto-fix");
    return errors;
  },
  "p49-scoring": (root) => {
    const { errors, mustExist, must } = createChecker(root);
    mustExist("src/lib/certification/scoring.ts", "scoring");
    must("src/lib/certification/scoring.ts", "aggregateChecks", "aggregate");
    must("src/lib/certification/scoring.ts", "NOT_READY", "levels");
    must("src/lib/certification/scoring.ts", "PRODUCTION_READY", "production level");
    must("src/lib/certification/scoring.ts", "Math.min(overall_score", "blocker cap");
    return errors;
  },
  "p49-check-modules": (root) => {
    const errors = [];
    for (const mod of CHECK_MODULES) {
      const file = path.join(root, `src/lib/certification/checks/${mod}.ts`);
      if (!fs.existsSync(file)) errors.push(`check module missing: ${mod}`);
    }
    return errors;
  },
  "p49-no-hardcoded-scores": (root) => {
    const errors = [];
    const dir = path.join(root, "src/lib/certification");
    const skip = new Set(["scoring.ts", "types.ts"]);
    const walk = (d) => {
      for (const name of fs.readdirSync(d)) {
        const full = path.join(d, name);
        if (fs.statSync(full).isDirectory()) walk(full);
        else if (name.endsWith(".ts") && !skip.has(name)) {
          const src = fs.readFileSync(full, "utf8");
          if (/overall_score\s*[:=]\s*(100|90|85|80|75)\b/.test(src)) {
            errors.push(`hardcoded overall_score in ${path.relative(root, full)}`);
          }
          if (/certification_level\s*[:=]\s*["']PRODUCTION_READY["']/.test(src)) {
            errors.push(`hardcoded PRODUCTION_READY in ${path.relative(root, full)}`);
          }
        }
      }
    };
    walk(dir);
    return errors;
  },
  "p49-api": (root) => {
    const { errors, mustExist, must } = createChecker(root);
    mustExist("src/app/api/projects/[id]/certification/run/route.ts", "api route");
    must("src/app/api/projects/[id]/certification/run/route.ts", "runProductionCertification", "calls engine");
    return errors;
  },
  "p49-ui": (root) => {
    const { errors, mustExist, must } = createChecker(root);
    mustExist("src/components/certification/production-certification-center.tsx", "ui");
    must("src/components/certification/production-certification-center.tsx", "Run Production Certification", "cta");
    must("src/components/certification/production-certification-center.tsx", "production-certification-center", "testid");
    must("src/components/create/workspace/app-dashboard-panel.tsx", "ProductionCertificationCenter", "dashboard wire");
    return errors;
  },
  "p49-launch-checklist": (root) => {
    const { errors, mustExist, must } = createChecker(root);
    mustExist("src/lib/certification/launch-checklist.ts", "launch checklist");
    must("src/lib/certification/launch-checklist.ts", "buildLaunchChecklist", "builder");
    must("src/lib/certification/launch-checklist.ts", "Published URL healthy", "published item");
    return errors;
  },
  "p49-auto-fix": (root) => {
    const { errors, mustExist, must } = createChecker(root);
    mustExist("src/lib/certification/auto-fix.ts", "auto-fix");
    must("src/lib/certification/auto-fix.ts", "buildAutoFixSuggestions", "builder");
    must("src/lib/certification/auto-fix.ts", "safe:", "safe flag");
    return errors;
  },
  "p49-types": (root) => {
    const { errors, mustExist, must } = createChecker(root);
    mustExist("src/lib/certification/types.ts", "types");
    for (const level of ["NOT_READY", "BASIC", "BETA_READY", "PRODUCTION_READY", "ENTERPRISE_READY"]) {
      must("src/lib/certification/types.ts", level, `level ${level}`);
    }
    for (const section of SECTIONS) {
      if (!fs.readFileSync(path.join(root, "src/lib/certification/types.ts"), "utf8").includes(`"${section}"`)) {
        errors.push(`section type missing: ${section}`);
      }
    }
    return errors;
  },
  "p49-blocker-caps-level": (root) => {
    const errors = [];
    const scoring = fs.readFileSync(path.join(root, "src/lib/certification/scoring.ts"), "utf8");
    if (!scoring.includes("blockers > 0")) errors.push("scoring must consider blockers");
    if (!scoring.includes('certification_level = "NOT_READY"')) {
      errors.push("blockers must force NOT_READY for critical sections");
    }
    return errors;
  },
};
