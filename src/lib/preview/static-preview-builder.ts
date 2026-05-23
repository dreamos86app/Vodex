/** Build a self-contained HTML snapshot from generated files. */
export function buildStaticPreviewHtml(files: Array<{ path: string; content: string }>): string {
  const html = files.find((f) => f.path === "index.html" || f.path.endsWith("/index.html"));
  if (html) return html.content;

  const page =
    files.find((f) => /\/page\.(tsx|jsx)$/i.test(f.path)) ||
    files.find((f) => /^app\/page\.(tsx|jsx)$/i.test(f.path)) ||
    files.find((f) => /page\.(tsx|jsx)$/i.test(f.path));
  const jsxBody = page?.content ?? "";
  const rendered = jsxToStaticHtml(jsxBody);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <script src="https://cdn.tailwindcss.com"></script>
  <title>DreamOS86 Preview</title>
  <meta name="dreamos-preview" content="static-snapshot" />
  <style>body{margin:0;font-family:Inter,system-ui,sans-serif}</style>
</head>
<body class="bg-slate-50 text-slate-900 antialiased">
  <div id="root" class="min-h-screen">${rendered || "<p class=\"p-6 text-slate-500\">No renderable content.</p>"}</div>
</body>
</html>`;
}

function jsxToStaticHtml(content: string): string {
  if (!content.trim()) return "";
  let body = content;
  const returnMatch = body.match(/return\s*\(\s*([\s\S]*?)\s*\)\s*;?\s*}/);
  if (returnMatch) body = returnMatch[1] ?? body;
  else body = body.replace(/^[\s\S]*?return\s*/m, "").replace(/\);?\s*}$/m, "");

  return body
    .replace(/className=/g, "class=")
    .replace(/\{`([^`]+)`\}/g, "$1")
    .replace(/\{["']([^"']+)["']\}/g, "$1")
    .replace(/\{[^}]+\}/g, "")
    .replace(/<\/>/g, "")
    .replace(/<>/g, "")
    .slice(0, 12000);
}
