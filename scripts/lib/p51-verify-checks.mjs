import { createChecker } from "./p42-verify-checks.mjs";
import { runP51CertificationRegression } from "./p51-certification-regression.mjs";

export const P51_CHECKS = {
  "p51-load-project-files": (root) => {
    const { errors, mustExist, must } = createChecker(root);
    mustExist("src/lib/certification/load-project-files.ts", "snapshot loader");
    must("src/lib/certification/load-project-files.ts", "loadCertificationProjectFiles", "loader export");
    must("src/lib/certification/load-project-files.ts", "filesFromPublishedSnapshot", "snapshot helper");
    must("src/lib/certification/load-context.ts", "loadCertificationProjectFiles", "context uses loader");
    return errors;
  },
  "p51-import-route-manifest": (root) => {
    const { errors, must } = createChecker(root);
    must("src/lib/certification/checks/app-audit.ts", "routeReasons", "route-only reasons");
    must("src/lib/certification/checks/app-audit.ts", "routeMap: importMeta?.routes", "import route map");
    return errors;
  },
  "p51-regression-tests": (root) => runP51CertificationRegression(root),
};
