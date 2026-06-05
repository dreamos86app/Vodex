export function buildPublishedRecoveryPage(input: {
  slug: string;
  title?: string;
  reason: "no_artifact" | "empty_snapshot" | "asset_missing";
}): string {
  const messages: Record<string, string> = {
    no_artifact:
      "This app was published before a successful preview build. Open Vodex, run a preview build, then republish.",
    empty_snapshot: "The published snapshot is empty. Republish after your preview renders correctly in the builder.",
    asset_missing:
      "The published build files are missing. Republish from Vodex after a successful preview build completes.",
  };

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(input.title ?? input.slug)} · Republish needed</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{min-height:100vh;font-family:system-ui,-apple-system,sans-serif;background:linear-gradient(160deg,#f8fafc 0%,#eef2ff 50%,#f1f5f9 100%);color:#0f172a;padding:32px 20px}
    .wrap{max-width:520px;margin:0 auto;padding-top:10vh}
    .card{background:rgba(255,255,255,.88);border:1px solid rgba(99,102,241,.15);border-radius:20px;padding:28px;box-shadow:0 20px 50px rgba(59,130,246,.08)}
    .logo{display:flex;align-items:center;gap:10px;margin-bottom:20px}
    .logo img{width:36px;height:36px;border-radius:10px}
    h1{font-size:22px;font-weight:700;letter-spacing:-.02em}
    p{margin-top:12px;font-size:14px;line-height:1.65;color:#475569}
    .steps{margin-top:20px;padding:16px;border-radius:14px;background:#f8fafc;border:1px solid #e2e8f0}
    .steps li{margin:8px 0 0 18px;font-size:13px;color:#334155}
    a.btn{display:inline-block;margin-top:20px;padding:10px 18px;border-radius:12px;background:#4f46e5;color:#fff;font-size:13px;font-weight:600;text-decoration:none}
  </style>
</head>
<body>
  <div class="wrap">
    <div class="card">
      <div class="logo">
        <img src="https://vodex.dev/logo.png" alt="Vodex" />
        <span style="font-weight:700;font-size:14px">Vodex Published App</span>
      </div>
      <h1>Almost live — one more step</h1>
      <p>${escapeHtml(messages[input.reason] ?? messages.no_artifact)}</p>
      <ol class="steps">
        <li>Open your app in the Vodex builder</li>
        <li>Wait until preview shows your full app</li>
        <li>Click Publish again</li>
      </ol>
      <a class="btn" href="https://vodex.dev">Open Vodex</a>
    </div>
  </div>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
