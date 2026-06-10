export type ProfileNameRow = {
  id: string;
  full_name: string | null;
  email?: string | null;
  username?: string | null;
  avatar_url?: string | null;
};

export type ProfilePreviewRow = ProfileNameRow & {
  avatar_url: string | null;
  username: string | null;
};

export function profileDisplayName(
  profile: ProfileNameRow | null | undefined,
  fallback = "Member",
): string {
  if (!profile) return fallback;
  if (profile.full_name?.trim()) return profile.full_name.trim();
  if (profile.username?.trim()) return profile.username.trim();
  if (profile.email?.trim()) return profile.email.split("@")[0] ?? fallback;
  return fallback;
}

export async function fetchProfileNameMap(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  userIds: string[],
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const unique = [...new Set(userIds.filter(Boolean))];
  if (!unique.length) return map;
  const { data } = await supabase.from("profiles").select("id, full_name, email, username").in("id", unique);
  for (const p of data ?? []) {
    map.set(p.id, profileDisplayName(p));
  }
  return map;
}

export async function fetchProfilePreviewMap(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  userIds: string[],
): Promise<Map<string, ProfilePreviewRow>> {
  const map = new Map<string, ProfilePreviewRow>();
  const unique = [...new Set(userIds.filter(Boolean))];
  if (!unique.length) return map;
  const { data } = await supabase
    .from("profiles")
    .select("id, full_name, email, username, avatar_url")
    .in("id", unique);
  for (const p of data ?? []) {
    map.set(p.id, {
      id: p.id,
      full_name: p.full_name ?? null,
      email: p.email ?? null,
      username: p.username ?? null,
      avatar_url: p.avatar_url ?? null,
    });
  }
  return map;
}
