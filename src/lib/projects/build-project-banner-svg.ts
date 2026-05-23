import { escapeXml } from "@/lib/projects/svg-utils";

export type ProjectBannerKind = "imported" | "generated" | "published" | "draft";

export type ProjectBannerInput = {
  title: string;
  framework?: string | null;
  fileCount?: number;
  routeCount?: number;
  kind: ProjectBannerKind;
};

function hashHue(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h % 360;
}

/** Deterministic card banner mock — opaque, no LLM, no blank gradient. */
export function buildProjectBannerSvg(input: ProjectBannerInput): string {
  const title = input.title.trim() || "App";
  const hue = hashHue(title);
  const c1 = `hsl(${hue}, 58%, 42%)`;
  const c2 = `hsl(${(hue + 40) % 360}, 52%, 32%)`;
  const c3 = `hsl(${(hue + 18) % 360}, 45%, 94%)`;
  const fw = escapeXml((input.framework ?? "web").replace(/_/g, " "));
  const kindLabel =
    input.kind === "imported"
      ? "Imported"
      : input.kind === "published"
        ? "Published"
        : input.kind === "generated"
          ? "Generated"
          : "Draft";
  const meta =
    input.fileCount != null && input.fileCount > 0
      ? `${input.fileCount.toLocaleString()} files`
      : input.routeCount != null && input.routeCount > 0
        ? `${input.routeCount} routes`
        : "App preview";

  return `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="240" viewBox="0 0 640 240">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:${c1}"/>
      <stop offset="100%" style="stop-color:${c2}"/>
    </linearGradient>
  </defs>
  <rect width="640" height="240" fill="url(#bg)"/>
  <rect x="24" y="24" width="592" height="192" rx="16" fill="${c3}" opacity="0.92"/>
  <rect x="44" y="44" width="120" height="14" rx="7" fill="${c1}" opacity="0.35"/>
  <rect x="44" y="72" width="220" height="22" rx="6" fill="${c2}" opacity="0.55"/>
  <rect x="44" y="108" width="320" height="10" rx="5" fill="${c1}" opacity="0.2"/>
  <rect x="44" y="128" width="280" height="10" rx="5" fill="${c1}" opacity="0.16"/>
  <rect x="44" y="148" width="240" height="10" rx="5" fill="${c1}" opacity="0.12"/>
  <rect x="44" y="178" width="96" height="24" rx="8" fill="${c1}" opacity="0.75"/>
  <text x="92" y="195" text-anchor="middle" font-family="system-ui,Segoe UI,sans-serif" font-size="11" font-weight="600" fill="#ffffff">${escapeXml(kindLabel)}</text>
  <text x="520" y="52" text-anchor="end" font-family="system-ui,Segoe UI,sans-serif" font-size="12" font-weight="600" fill="${c2}">${fw}</text>
  <text x="520" y="72" text-anchor="end" font-family="system-ui,Segoe UI,sans-serif" font-size="11" fill="${c2}" opacity="0.75">${escapeXml(meta)}</text>
  <text x="320" y="210" text-anchor="middle" font-family="system-ui,Segoe UI,sans-serif" font-size="13" font-weight="600" fill="${c2}" opacity="0.85">${escapeXml(title.slice(0, 48))}</text>
</svg>`;
}
