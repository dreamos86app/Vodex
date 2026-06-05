import type { ReadinessEngineReport } from "@/lib/mobile/readiness-engine";

export function readinessReportToJson(report: ReadinessEngineReport): string {
  return JSON.stringify(report, null, 2);
}

export function readinessReportToHtml(report: ReadinessEngineReport, appName: string): string {
  const section = (title: string, items: ReadinessEngineReport["critical"]) => {
    if (!items.length) return "";
    const rows = items
      .map(
        (f) =>
          `<tr><td>${escapeHtml(f.severity)}</td><td>${escapeHtml(f.label)}</td><td>${escapeHtml(f.detail)}</td><td>${escapeHtml(f.platform ?? "")}</td></tr>`,
      )
      .join("");
    return `<h2>${escapeHtml(title)} (${items.length})</h2><table><thead><tr><th>Severity</th><th>Check</th><th>Detail</th><th>Platform</th></tr></thead><tbody>${rows}</tbody></table>`;
  };

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Vodex Readiness Report — ${escapeHtml(appName)}</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 2rem; color: #111; }
    h1 { font-size: 1.5rem; }
    .score { font-size: 2.5rem; font-weight: 700; color: ${report.gatePassed ? "#059669" : "#dc2626"}; }
    table { width: 100%; border-collapse: collapse; margin: 1rem 0 2rem; font-size: 13px; }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; vertical-align: top; }
    th { background: #f4f4f5; }
    @media print { body { margin: 1cm; } }
  </style>
</head>
<body>
  <h1>App Store Readiness Report</h1>
  <p><strong>App:</strong> ${escapeHtml(appName)}</p>
  <p><strong>Generated:</strong> ${escapeHtml(report.generatedAt)}</p>
  <p class="score">${report.score}/100</p>
  <p>${escapeHtml(report.summary)}</p>
  <p><strong>RevenueCat:</strong> ${escapeHtml(report.revenueCat.status)} — ${escapeHtml(report.revenueCat.checks[0]?.detail ?? "")}</p>
  ${section("Critical", report.critical)}
  ${section("High", report.high)}
  ${section("Medium", report.medium)}
  ${section("Low", report.low)}
</body>
</html>`;
}

/** Minimal PDF 1.4 with text lines (no external deps). */
export function readinessReportToPdfBytes(report: ReadinessEngineReport, appName: string): Buffer {
  const lines = [
    `Vodex Readiness Report`,
    `App: ${appName}`,
    `Score: ${report.score}/100`,
    `Gate: ${report.gatePassed ? "PASSED" : "BLOCKED"}`,
    `Summary: ${report.summary}`,
    ``,
    `Critical (${report.critical.length}):`,
    ...report.critical.map((f) => `- ${f.label}: ${f.detail}`),
    `High (${report.high.length}):`,
    ...report.high.slice(0, 12).map((f) => `- ${f.label}: ${f.detail}`),
  ];
  const text = lines.join("\n").slice(0, 4000);
  return buildSimplePdf(text);
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildSimplePdf(text: string): Buffer {
  const escaped = text.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
  const content = `BT /F1 10 Tf 50 750 Td (${escaped.replace(/\n/g, ") Tj T* (")}) Tj ET`;
  const stream = `<< /Length ${content.length} >>\nstream\n${content}\nendstream`;
  const objs = [
    "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj",
    "2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj",
    "3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> >> endobj",
    `4 0 obj ${stream} endobj`,
    "5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj",
  ];
  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [0];
  for (const o of objs) {
    offsets.push(Buffer.byteLength(pdf, "utf8"));
    pdf += o + "\n";
  }
  const xrefPos = Buffer.byteLength(pdf, "utf8");
  pdf += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i < offsets.length; i++) {
    pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer << /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF`;
  return Buffer.from(pdf, "utf8");
}
