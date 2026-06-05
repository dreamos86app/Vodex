export function buildPublishedErrorPage(input: {
  title: string;
  message: string;
  slug?: string;
  diagnostics?: string[];
}): string {
  const diag = (input.diagnostics ?? []).filter(Boolean);
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(input.title)} · Vodex</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{min-height:100vh;display:flex;align-items:center;justify-content:center;font-family:system-ui,-apple-system,sans-serif;background:linear-gradient(135deg,#0f172a 0%,#1e1b4b 100%);color:#f8fafc;padding:24px}
    .card{max-width:480px;width:100%;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);border-radius:20px;padding:32px;backdrop-filter:blur(12px)}
    h1{font-size:20px;font-weight:700;margin-bottom:8px}
    p{font-size:14px;color:#94a3b8;line-height:1.6;margin-bottom:16px}
    .diag{font-family:ui-monospace,monospace;font-size:11px;color:#64748b;background:rgba(0,0,0,.25);border-radius:10px;padding:12px;margin-top:12px;white-space:pre-wrap;word-break:break-word}
    a{color:#818cf8;text-decoration:none;font-weight:600}
    a:hover{text-decoration:underline}
    .logo{display:flex;align-items:center;gap:8px;margin-bottom:20px;font-size:13px;font-weight:700;color:#a5b4fc}
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">◆ Vodex</div>
    <h1>${escapeHtml(input.title)}</h1>
    <p>${escapeHtml(input.message)}</p>
    <p><a href="https://vodex.dev">Return to Vodex</a></p>
    ${diag.length ? `<div class="diag">${escapeHtml(diag.join("\n"))}</div>` : ""}
  </div>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
