/** Detect assets imported from ZIP (tags column or metadata fallback). */
export function isZipImportedAsset(asset: {
  tags?: unknown;
  metadata?: unknown;
  storage_path?: string | null;
}): boolean {
  if (Array.isArray(asset.tags) && asset.tags.includes("zip_import")) return true;
  const meta = asset.metadata;
  if (meta && typeof meta === "object" && !Array.isArray(meta)) {
    const row = meta as Record<string, unknown>;
    if (typeof row.zip_import_path === "string" && row.zip_import_path.trim()) return true;
    const metaTags = row.tags;
    if (Array.isArray(metaTags) && metaTags.includes("zip_import")) return true;
  }
  const path = String(asset.storage_path ?? "");
  if (path.includes("/imported/")) return true;
  return false;
}
