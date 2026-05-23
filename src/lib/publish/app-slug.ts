import { RESERVED_PUBLISH_SLUGS } from "@/lib/publish/publish-config";

export function slugifyAppName(name: string): string {
  let s = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
  if (!s || s.length < 2) s = "app";
  if (RESERVED_PUBLISH_SLUGS.has(s)) s = `${s}-app`;
  return s;
}

export function isReservedPublishSlug(slug: string): boolean {
  return RESERVED_PUBLISH_SLUGS.has(slug);
}

export function nextSlugCandidate(base: string, index: number): string {
  return index === 0 ? base : `${base}-${index + 1}`;
}

export function validateCustomSlug(input: string): { ok: boolean; slug: string; error?: string } {
  const slug = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
  if (slug.length < 2) return { ok: false, slug: slug || "app", error: "slug_too_short" };
  if (isReservedPublishSlug(slug)) return { ok: false, slug, error: "reserved_slug" };
  return { ok: true, slug };
}
