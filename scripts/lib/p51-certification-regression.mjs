import fs from "node:fs";
import path from "node:path";

const MAX_FILES = 250;
const MAX_BYTES = 4_000_000;

function normalizePath(p) {
  return p.replace(/^\.?\//, "").replace(/\\/g, "/").trim();
}

function isRenderable(path) {
  const p = normalizePath(path);
  if (!p) return false;
  if (p === "package.json") return true;
  return /\.(tsx|jsx|ts|js|mjs|cjs|css|html|json)$/i.test(p);
}

function isPage(path) {
  const p = normalizePath(path);
  return (
    /(^|\/)page\.(tsx|jsx|js)$/i.test(p) ||
    /(^|\/)pages?\//i.test(p) ||
    /index\.html$/i.test(p)
  );
}

function isPriority(path) {
  const p = normalizePath(path);
  return (
    p === "package.json" ||
    /index\.html$/i.test(p) ||
    isPage(p) ||
    /^src\/App\./i.test(p) ||
    /^src\/main\./i.test(p)
  );
}

function prioritize(files) {
  const priority = [];
  const rest = [];
  for (const f of files) {
    if (isPriority(f.path)) priority.push(f);
    else rest.push(f);
  }
  return [...priority, ...rest];
}

function capFiles(files) {
  const out = [];
  let bytes = 0;
  for (const file of prioritize(files)) {
    bytes += file.content.length;
    if (bytes > MAX_BYTES) break;
    out.push(file);
    if (out.length >= MAX_FILES) break;
  }
  return out;
}

function filterRenderable(files) {
  const seen = new Set();
  const out = [];
  for (const f of files) {
    if (!f.path || !f.content?.trim()) continue;
    const p = normalizePath(f.path);
    if (!isRenderable(p)) continue;
    if (seen.has(p)) continue;
    seen.add(p);
    out.push({ path: p, content: f.content });
  }
  return out;
}

function validateRoutes(files) {
  const hasPage = files.some((f) => isPage(f.path));
  const hasPackage = files.some((f) => f.path === "package.json" || f.path.endsWith("/package.json"));
  return { hasPage, hasPackage, noPageRoute: !hasPage };
}

function simulateLegacyAlphabeticalLoad(files) {
  return capFiles(filterRenderable([...files].sort((a, b) => a.path.localeCompare(b.path))));
}

function simulateSnapshotLoad(snapshot) {
  return capFiles(filterRenderable(snapshot));
}

export function runP51CertificationRegression(root) {
  const errors = [];
  const snapPath = path.join(root, "scripts/.live-cert-snapshot.json");
  const filesPath = path.join(root, "scripts/.live-cert-files.json");

  if (!fs.existsSync(snapPath)) {
    errors.push("scripts/.live-cert-snapshot.json missing — run scripts/fetch-live-cert-data.ps1");
    return errors;
  }
  if (!fs.existsSync(filesPath)) {
    errors.push("scripts/.live-cert-files.json missing");
    return errors;
  }

  const readJson = (p) => JSON.parse(fs.readFileSync(p, "utf8").replace(/^\uFEFF/, ""));
  const snapshot = readJson(snapPath);
  const appFiles = readJson(filesPath);

  const legacy = simulateLegacyAlphabeticalLoad(appFiles);
  const legacyRoutes = validateRoutes(legacy);
  if (!legacyRoutes.noPageRoute) {
    errors.push("legacy alphabetical load should miss page routes for Reciply fixture");
  }

  const modern = simulateSnapshotLoad(snapshot);
  const modernRoutes = validateRoutes(modern);
  if (modernRoutes.noPageRoute) {
    errors.push("snapshot-first load must include a page route for Reciply fixture");
  }
  if (!modernRoutes.hasPackage) {
    errors.push("snapshot-first load must include package.json after priority cap");
  }

  const filler = Array.from({ length: 300 }, (_, i) => ({
    path: `src/components/z-fill-${String(i).padStart(3, "0")}.jsx`,
    content: `export default function F${i}(){return <div className="x">f${i}</div>}\n`,
  }));
  const synthetic = [
    ...filler,
    { path: "package.json", content: '{"name":"x","dependencies":{}}\n' },
    { path: "index.html", content: "<html><body><div id=root></div></body></html>\n" },
    { path: "src/pages/Home.jsx", content: "export default function Home(){return <main className='p'>ok</main>}\n" },
  ];
  const capped = capFiles(filterRenderable(synthetic));
  const cappedRoutes = validateRoutes(capped);
  if (!cappedRoutes.hasPackage || !cappedRoutes.hasPage) {
    errors.push("priority cap must retain package.json and page routes when file count exceeds limit");
  }

  const loader = path.join(root, "src/lib/certification/load-project-files.ts");
  const loaderSrc = fs.readFileSync(loader, "utf8");
  if (!loaderSrc.includes("filesFromPublishedSnapshot")) {
    errors.push("load-project-files must export snapshot loader");
  }
  if (!loaderSrc.includes("prioritizeCertificationFiles")) {
    errors.push("load-project-files must prioritize certification-critical paths before cap");
  }

  const context = path.join(root, "src/lib/certification/load-context.ts");
  const contextSrc = fs.readFileSync(context, "utf8");
  if (!contextSrc.includes("snapshot_files")) {
    errors.push("load-context must read published_apps.snapshot_files");
  }

  const audit = path.join(root, "src/lib/certification/checks/app-audit.ts");
  const auditSrc = fs.readFileSync(audit, "utf8");
  if (!auditSrc.includes("routeReasons")) {
    errors.push("app-audit must separate route reasons from placeholder validation");
  }
  if (!auditSrc.includes("readImportMeta")) {
    errors.push("app-audit must pass import routeMap into validateGeneratedApp");
  }

  return errors;
}
