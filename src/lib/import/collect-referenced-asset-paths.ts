/** Scan app source for referenced asset paths (Ripo, Lottie, images, fonts). */

const ASSET_FILE_RE =
  /["'`](\.?\/?(?:src\/|public\/|assets\/|static\/|media\/|\.well-known\/)[^"'`\s?#]+\.(?:ripo|json|png|jpe?g|gif|webp|svg|ico|avif|woff2?|ttf|otf|eot|mp4|webm|mp3|wav|lottie))(?:["'`?]|$)/gi;

const BARE_ASSET_RE =
  /["'`]([^"'`\s?#]+\.(?:ripo|png|jpe?g|gif|webp|svg|ico|avif|woff2?|ttf|mp4|webm|lottie))(?:["'`?]|$)/gi;

const RIPO_API_RE = /getRipoAssetPublic[^)]*["']([^"']+)["']/gi;
const RIPO_NAME_RE =
  /(?:ripo|lottie|animation)(?:Asset|File|Path|Url|Name)?[^"'`\n]{0,40}["']([^"']+\.(?:ripo|json|lottie))["']/gi;

function normRef(raw: string): string {
  return raw.replace(/\\/g, "/").replace(/^\.\//, "").replace(/^\/+/, "");
}

export function collectReferencedAssetPaths(
  files: Array<{ path: string; content: string }>,
): Set<string> {
  const refs = new Set<string>();

  for (const file of files) {
    const content = file.content;
    if (!content || content.length > 2_000_000) continue;

    for (const re of [ASSET_FILE_RE, BARE_ASSET_RE, RIPO_API_RE, RIPO_NAME_RE]) {
      re.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = re.exec(content))) {
        const ref = normRef(m[1] ?? "");
        if (ref && !ref.includes("..") && ref.length < 260) refs.add(ref);
      }
    }

    if (/\.(ripo|png|jpe?g|webp|gif|svg|json|lottie|woff2?|ttf|mp4|webm)$/i.test(file.path)) {
      refs.add(normRef(file.path));
    }
  }

  return refs;
}

export function zipEntryMatchesReference(normalizedZipPath: string, refs: Set<string>): boolean {
  const lower = normalizedZipPath.toLowerCase();
  for (const ref of refs) {
    const r = ref.toLowerCase();
    if (lower === r) return true;
    if (lower.endsWith(`/${r}`)) return true;
    if (r.endsWith(lower.split("/").pop() ?? "")) return true;
    const rBase = r.split("/").pop() ?? r;
    const zBase = lower.split("/").pop() ?? lower;
    if (rBase === zBase && rBase.length > 3) return true;
  }
  return false;
}
