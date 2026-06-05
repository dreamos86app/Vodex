import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { RESERVED_PUBLISH_SLUGS } from "@/lib/publish/publish-config";

async function isSlugAvailable(
  writer: SupabaseClient<Database>,
  slug: string,
  excludeProjectId?: string,
): Promise<boolean> {
  const safe = slug.trim().toLowerCase();
  const { data: clashProj } = await writer
    .from("projects")
    .select("id")
    .eq("published_subdomain", safe)
    .maybeSingle();
  if (clashProj?.id && clashProj.id !== excludeProjectId) return false;

  const { data: clashPub } = await (writer as SupabaseClient)
    .from("published_apps" as never)
    .select("id, project_id, status")
    .eq("slug", safe)
    .maybeSingle()
    .then((r) => r, () => ({ data: null }));

  const pub = clashPub as { id?: string; project_id?: string; status?: string } | null;
  if (!pub) return true;
  if (pub.project_id === excludeProjectId) return true;
  if (pub.status === "unpublished") return true;
  return false;
}

export type SubdomainAllocateErrorCode =
  | "reserved_word"
  | "invalid_slug"
  | "database_unique_conflict_exhausted"
  | "missing_publish_table"
  | "rls_denied"
  | "service_role_missing"
  | "project_not_found"
  | "unknown_db_error";

export type SubdomainAllocateResult =
  | {
      ok: true;
      slug: string;
      reservedUrl: string;
      attempts: number;
    }
  | {
      ok: false;
      code: SubdomainAllocateErrorCode;
      message: string;
      debug?: string;
    };

const RESERVED = new Set([
  ...RESERVED_PUBLISH_SLUGS,
  "localhost",
  "vercel",
  "vodex",
  "mail",
  "support",
  "help",
]);

export function sanitizePublishSlug(raw: string): string {
  let s = raw
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
  return s;
}

export function isReservedPublishSlugStrict(slug: string): boolean {
  return RESERVED.has(slug) || slug.startsWith("app-") && slug.length < 6;
}

export function buildSlugCandidates(input: {
  appName?: string | null;
  projectName?: string | null;
  projectSlug?: string | null;
  projectId: string;
  desiredSlug?: string | null;
}): string[] {
  const shortId = input.projectId.replace(/-/g, "").slice(0, 6);
  const bases: string[] = [];

  if (input.desiredSlug?.trim()) {
    bases.push(sanitizePublishSlug(input.desiredSlug));
  }
  if (input.projectSlug?.trim()) bases.push(sanitizePublishSlug(input.projectSlug));
  if (input.appName?.trim()) bases.push(sanitizePublishSlug(input.appName));
  if (input.projectName?.trim()) bases.push(sanitizePublishSlug(input.projectName));

  bases.push(`app-${shortId}`);

  const out: string[] = [];
  for (const base of bases) {
    let b = base;
    if (!b || b.length < 2) b = `app-${shortId}`;
    if (isReservedPublishSlugStrict(b)) b = `app-${shortId}`;
    if (!out.includes(b)) out.push(b);
    // Collision suffixes: base-2, base-3, … before base-{shortId} and random6.
    const collisionSuffixes = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;
    for (const n of collisionSuffixes) {
      const suffixed = `${b}-${n}`;
      if (!out.includes(suffixed)) out.push(suffixed);
    }
  }

  return out.filter((s) => s.length >= 2 && !isReservedPublishSlugStrict(s));
}

function mapPgError(err: { code?: string; message?: string }): SubdomainAllocateErrorCode {
  if (err.code === "23505") return "database_unique_conflict_exhausted";
  if (err.code === "42501" || err.message?.includes("permission")) return "rls_denied";
  if (err.message?.includes("published_apps") && err.message?.includes("does not exist")) {
    return "missing_publish_table";
  }
  return "unknown_db_error";
}

/**
 * Atomically reserve a unique published_subdomain on the project row (collision-safe retries).
 */
export async function allocatePublishSubdomain(
  db: SupabaseClient<Database>,
  input: {
    projectId: string;
    ownerId: string;
    appName?: string | null;
    projectName?: string | null;
    projectSlug?: string | null;
    desiredSlug?: string | null;
  },
): Promise<SubdomainAllocateResult> {
  const { data: row, error: selErr } = await db
    .from("projects")
    .select("slug, name, app_name, published_subdomain")
    .eq("id", input.projectId)
    .eq("owner_id", input.ownerId)
    .maybeSingle();

  if (selErr) {
    return {
      ok: false,
      code: mapPgError(selErr),
      message: "Could not load project for publish",
      debug: selErr.message,
    };
  }
  if (!row) {
    return { ok: false, code: "project_not_found", message: "Project not found" };
  }

  const existing = row.published_subdomain?.trim();
  if (existing) {
    return { ok: true, slug: existing, reservedUrl: existing, attempts: 0 };
  }

  const candidates = buildSlugCandidates({
    appName: input.appName ?? row.app_name,
    projectName: input.projectName ?? row.name,
    projectSlug: input.projectSlug ?? row.slug,
    projectId: input.projectId,
    desiredSlug: input.desiredSlug,
  });

  if (candidates.length === 0) {
    return {
      ok: false,
      code: "invalid_slug",
      message: "Could not derive a valid public slug",
    };
  }

  let attempts = 0;
  for (const candidate of candidates) {
    attempts += 1;
    if (isReservedPublishSlugStrict(candidate)) continue;

    const available = await isSlugAvailable(db, candidate, input.projectId);
    if (!available) continue;

    const { error: upErr } = await db
      .from("projects")
      .update({ published_subdomain: candidate } as never)
      .eq("id", input.projectId)
      .eq("owner_id", input.ownerId)
      .is("published_subdomain", null);

    if (!upErr) {
      return { ok: true, slug: candidate, reservedUrl: candidate, attempts };
    }

    if (upErr.code === "23505") continue;

    return {
      ok: false,
      code: mapPgError(upErr),
      message: "Subdomain reservation failed",
      debug: upErr.message,
    };
  }

  return {
    ok: false,
    code: "database_unique_conflict_exhausted",
    message: "All slug candidates are taken — try a custom slug",
    debug: `tried_${attempts}_candidates`,
  };
}
