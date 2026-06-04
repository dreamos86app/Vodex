import JSZip from "jszip";
import { extractAndAnalyzeZip } from "../src/lib/import/zip-import-service";
import { normalizeZipEntryPath } from "../src/lib/import/zip-file-validator";

async function makeZip(entries: Record<string, string>): Promise<Buffer> {
  const zip = new JSZip();
  for (const [p, c] of Object.entries(entries)) zip.file(p, c);
  return zip.generateAsync({ type: "nodebuffer" });
}

async function main() {
  const errors: string[] = [];

  // Path traversal rejected
  if (normalizeZipEntryPath("../etc/passwd") !== null) errors.push("traversal should be null");
  if (normalizeZipEntryPath("foo/../../secret.txt") !== null) errors.push("traversal segments not rejected");

  // Next.js valid
  const nextZip = await makeZip({
    "package.json": JSON.stringify({
      scripts: { dev: "next dev", build: "next build", start: "next start" },
      dependencies: { next: "16.0.0", react: "19.0.0", "@supabase/supabase-js": "2.0.0" },
    }),
    ".env.example": "NEXT_PUBLIC_SUPABASE_URL=\nSUPABASE_SERVICE_ROLE_KEY=\n",
    "lib/supabase.ts": "export const url = process.env.NEXT_PUBLIC_SUPABASE_URL;",
    "app/page.tsx": "export default function Page() { return <main>Home</main>; }",
    "app/dashboard/page.tsx": "export default function Dash() { return null; }",
  });
  const next = await extractAndAnalyzeZip(nextZip);
  if (!next.ok) errors.push(`next zip: ${next.error}`);
  else {
    if (next.validation.framework.id !== "nextjs") errors.push("next framework not detected");
    if (next.validation.routes.length < 2) errors.push("next routes missing");
    if (next.validation.qualityScore < 90) errors.push(`next quality too low: ${next.validation.qualityScore}`);
    if (next.validation.previewReady) errors.push("previewReady must stay false until runtime build completes");
    if (!next.validation.previewEntry) errors.push("next should have a preview entry after import");
  }

  // Vite valid
  const viteZip = await makeZip({
    "package.json": JSON.stringify({
      scripts: { dev: "vite", build: "vite build" },
      devDependencies: { vite: "6.0.0", vue: "3.5.0" },
    }),
    "src/main.ts": "console.log('hi')",
  });
  const vite = await extractAndAnalyzeZip(viteZip);
  if (!vite.ok) errors.push(`vite zip: ${vite.error}`);
  else if (vite.validation.framework.id !== "vite") errors.push("vite not detected");

  // Static HTML
  const staticZip = await makeZip({ "index.html": "<html><body>Hi</body></html>" });
  const stat = await extractAndAnalyzeZip(staticZip);
  if (!stat.ok) errors.push(`static zip: ${stat.error}`);
  else {
    if (stat.validation.framework.id !== "static") errors.push("static not detected");
    if (!stat.validation.previewEntry || stat.validation.previewEntry.kind !== "html") {
      errors.push("static should expose html preview entry");
    }
    if (stat.validation.previewReady) errors.push("static previewReady must be false until build");
  }

  // .env excluded
  const envZip = await makeZip({
    "package.json": JSON.stringify({ scripts: { build: "next build" }, dependencies: { next: "16" } }),
    ".env": "SECRET=bad",
    "app/page.tsx": "export default function P() { return null }",
  });
  const env = await extractAndAnalyzeZip(envZip);
  if (!env.ok) errors.push(`env zip: ${env.error}`);
  else if (env.rejectedSecrets.length === 0) errors.push(".env should be rejected");
  else if (env.files.some((f) => f.path.includes(".env"))) errors.push(".env must not be in files");

  // Unsafe path in archive
  const unsafeZip = await makeZip({
    "package.json": JSON.stringify({ name: "x" }),
    "../../outside.txt": "nope",
  });
  const unsafe = await extractAndAnalyzeZip(unsafeZip);
  if (!unsafe.ok && unsafe.error.includes("No importable")) {
    /* ok - no valid files */
  } else if (unsafe.ok && unsafe.files.some((f) => f.path.includes(".."))) {
    errors.push("unsafe path imported");
  }

  // Missing package.json still imports html-only with warning
  const missingPkg = await makeZip({ "readme.md": "# hello" });
  const mp = await extractAndAnalyzeZip(missingPkg);
  if (!mp.ok) errors.push("readme-only should import");
  else if (mp.validation.framework.id !== "unknown") errors.push("unknown framework expected");

  // Bulk accepted files — 1470 passes, 1501 blocks
  async function makeBulkSourceZip(sourceCount: number): Promise<Buffer> {
    const zip = new JSZip();
    zip.file(
      "package.json",
      JSON.stringify({
        scripts: { dev: "next dev", build: "next build" },
        dependencies: { next: "16.0.0", react: "19.0.0" },
      }),
    );
    zip.file("app/page.tsx", "export default function Page() { return null; }");
    const extra = sourceCount - 2;
    for (let i = 0; i < extra; i++) {
      zip.file(`src/module-${i}.ts`, `export const v${i} = ${i};`);
    }
    return zip.generateAsync({ type: "nodebuffer" });
  }

  const zip1470 = await makeBulkSourceZip(1470);
  const bulk1470 = await extractAndAnalyzeZip(zip1470);
  if (!bulk1470.ok) errors.push(`1470 accepted files should pass: ${bulk1470.error}`);
  else {
    if (bulk1470.stats.acceptedFiles !== 1470) {
      errors.push(`1470 accepted count mismatch: ${bulk1470.stats.acceptedFiles}`);
    }
    if (bulk1470.stats.scanProviderCostUsd !== 0) errors.push("1470 scan must cost $0");
  }

  const zip1501 = await makeBulkSourceZip(1501);
  const bulk1501 = await extractAndAnalyzeZip(zip1501);
  if (bulk1501.ok) errors.push("1501 accepted files should be blocked");
  else if (!bulk1501.error.includes("1,500") && !bulk1501.error.includes("1500")) {
    errors.push(`1501 block message unexpected: ${bulk1501.error}`);
  }

  // node_modules/.next skipped — thousands raw but accepted <= 1500
  const heavyZip = new JSZip();
  heavyZip.file(
    "package.json",
    JSON.stringify({
      scripts: { dev: "next dev", build: "next build" },
      dependencies: { next: "16.0.0", react: "19.0.0" },
    }),
  );
  heavyZip.file("app/page.tsx", "export default function Page() { return null; }");
  for (let i = 0; i < 120; i++) heavyZip.file(`src/f-${i}.ts`, "export {}");
  for (let i = 0; i < 2500; i++) {
    heavyZip.file(`node_modules/dep/file-${i}.js`, "module.exports = {}");
    heavyZip.file(`.next/cache/chunk-${i}.js`, "exports.x=1");
  }
  const heavy = await extractAndAnalyzeZip(await heavyZip.generateAsync({ type: "nodebuffer" }));
  if (!heavy.ok) errors.push(`heavy zip with cache deps should pass: ${heavy.error}`);
  else {
    if (heavy.stats.skippedIgnoredPaths < 2500) errors.push("ignored paths under-counted");
    if (heavy.stats.acceptedFiles > 1500) errors.push("accepted too many after skip");
    if (heavy.stats.scanProviderCostUsd !== 0) errors.push("heavy scan must cost $0");
  }

  if (errors.length) {
    errors.forEach((e) => console.error("✗", e));
    process.exit(1);
  }
  console.log("✓ zip import runtime tests OK");
  if (next.ok) console.log(`  next quality: ${next.validation.qualityScore}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
