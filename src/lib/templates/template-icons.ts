/** Deterministic template brand icon — not AI-generated. */
export function buildTemplateIconSvg(appName: string, accentHex: string): string {
  const letter = (appName.trim().charAt(0) || "V").toUpperCase();
  const accent = accentHex.trim() || "#38bdf8";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="${letter}">
  <defs>
    <linearGradient id="tpl" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${accent}"/>
      <stop offset="100%" stop-color="#0ea5e9"/>
    </linearGradient>
  </defs>
  <rect width="64" height="64" rx="16" fill="url(#tpl)"/>
  <text x="32" y="40" text-anchor="middle" font-family="ui-sans-serif,system-ui,sans-serif" font-size="28" font-weight="700" fill="#ffffff">${letter}</text>
</svg>`;
}
