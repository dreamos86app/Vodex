/** True when HTML is a standard Vite/React production index shell (worker-built artifact). */
export function isViteSpaPreviewShell(html: string): boolean {
  const trimmed = html.trim();
  if (trimmed.length < 120) return false;
  const lower = trimmed.toLowerCase();
  const hasMountRoot =
    /id=["']root["']/i.test(trimmed) ||
    /id=["']app["']/i.test(trimmed) ||
    trimmed.includes("generated-app-preview-root");
  if (!hasMountRoot) return false;
  const hasModuleScript = /<script\s+[^>]*type=["']module["']/i.test(trimmed);
  const hasAssetRef =
    /\/assets\//i.test(trimmed) ||
    /\.\/assets\//i.test(trimmed) ||
    /src=["'][^"']+\.js["']/i.test(trimmed);
  return hasModuleScript || hasAssetRef;
}
