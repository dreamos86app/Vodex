import type { SupabaseClient } from "@supabase/supabase-js";

/** Recursively list all file paths under a storage prefix. */
export async function listStorageFilePaths(
  admin: SupabaseClient,
  bucket: string,
  prefix: string,
  acc: string[] = [],
): Promise<string[]> {
  const cleanPrefix = prefix.replace(/\/+$/, "");
  let offset = 0;
  const pageSize = 500;

  for (;;) {
    const { data, error } = await admin.storage.from(bucket).list(cleanPrefix, {
      limit: pageSize,
      offset,
      sortBy: { column: "name", order: "asc" },
    });
    if (error || !data?.length) break;

    for (const item of data) {
      if (!item.name) continue;
      const full = cleanPrefix ? `${cleanPrefix}/${item.name}` : item.name;
      if (isStorageFolder(item)) {
        await listStorageFilePaths(admin, bucket, full, acc);
      } else {
        acc.push(full);
      }
    }

    if (data.length < pageSize) break;
    offset += data.length;
  }

  return acc;
}

function isStorageFolder(item: {
  id?: string | null;
  name?: string;
  metadata?: Record<string, unknown> | null;
}): boolean {
  const meta = item.metadata;
  if (meta && typeof meta === "object") {
    if ("mimetype" in meta && meta.mimetype) return false;
    if ("size" in meta && typeof meta.size === "number") return false;
  }
  if (item.id) return false;
  const name = item.name ?? "";
  if (name.includes(".")) return false;
  return true;
}
