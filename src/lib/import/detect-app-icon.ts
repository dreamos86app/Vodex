import type { ZipImportFile } from "@/lib/import/zip-file-validator";
import { buildInitialsIconSvg } from "@/lib/projects/build-initials-icon-svg";

const ICON_PATH_PREFS = [
  "public/favicon.svg",
  "public/icon.svg",
  "public/apple-touch-icon.svg",
  "public/logo.svg",
  "src/assets/icon.svg",
  "src/assets/logo.svg",
  "app/icon.svg",
  "favicon.svg",
];

export type DetectedAppIcon = {
  svg: string;
  source: "imported_svg" | "manifest" | "initials";
  path?: string;
};

function normalizeSvg(content: string): string | null {
  const t = content.trim();
  if (!t.includes("<svg")) return null;
  return t;
}

function iconFromManifest(files: ZipImportFile[]): DetectedAppIcon | null {
  const manifest = files.find((f) => /manifest\.json$/i.test(f.path));
  if (!manifest) return null;
  try {
    const json = JSON.parse(manifest.content) as { icons?: Array<{ src?: string }> };
    for (const icon of json.icons ?? []) {
      const src = icon.src?.replace(/^\.\//, "");
      if (!src) continue;
      const hit = files.find((f) => f.path === src || f.path.endsWith(`/${src}`));
      if (hit && hit.path.endsWith(".svg")) {
        const svg = normalizeSvg(hit.content);
        if (svg) return { svg, source: "manifest", path: hit.path };
      }
    }
  } catch {
    /* ignore */
  }
  return null;
}

/** Pick best SVG icon from imported text files, else deterministic initials. */
export function detectAppIconFromImport(files: ZipImportFile[], appName: string): DetectedAppIcon {
  for (const pref of ICON_PATH_PREFS) {
    const hit = files.find((f) => f.path.toLowerCase() === pref);
    if (hit) {
      const svg = normalizeSvg(hit.content);
      if (svg) return { svg, source: "imported_svg", path: hit.path };
    }
  }

  const svgHit = files.find(
    (f) =>
      f.path.endsWith(".svg") &&
      /(?:favicon|icon|logo|apple-touch)/i.test(f.path) &&
      /public\/|assets\//i.test(f.path),
  );
  if (svgHit) {
    const svg = normalizeSvg(svgHit.content);
    if (svg) return { svg, source: "imported_svg", path: svgHit.path };
  }

  const fromManifest = iconFromManifest(files);
  if (fromManifest) return fromManifest;

  return { svg: buildInitialsIconSvg(appName), source: "initials" };
}
