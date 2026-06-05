/**
 * Edge-safe custom domain → published slug lookup for proxy routing.
 */

export async function resolveCustomDomainSlug(hostname: string): Promise<string | null> {
  const host = hostname.trim().toLowerCase();
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!base || !serviceKey || !host) return null;

  try {
    const domainRes = await fetch(
      `${base}/rest/v1/custom_domains?hostname=eq.${encodeURIComponent(host)}&status=eq.active&select=project_id&limit=1`,
      {
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
        },
        cache: "no-store",
      },
    );
    if (!domainRes.ok) return null;
    const domains = (await domainRes.json()) as Array<{ project_id?: string }>;
    const projectId = domains[0]?.project_id;
    if (!projectId) return null;

    const pubRes = await fetch(
      `${base}/rest/v1/published_apps?project_id=eq.${encodeURIComponent(projectId)}&status=eq.published&select=slug&limit=1`,
      {
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
        },
        cache: "no-store",
      },
    );
    if (!pubRes.ok) return null;
    const pubs = (await pubRes.json()) as Array<{ slug?: string }>;
    return pubs[0]?.slug?.trim().toLowerCase() ?? null;
  } catch {
    return null;
  }
}
